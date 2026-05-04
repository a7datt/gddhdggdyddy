import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.ts';
import * as samapi from '../services/samapi.ts';

const router = Router();
const prisma = new PrismaClient();

// POST /api/sessions/create
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const samSession = await samapi.createQRSession();

    const session = await prisma.qRSession.create({
      data: {
        userId: req.user.id,
        samSessionId: samSession.id,
        qrPayload: samSession.qrPayload,
        status: samSession.status,
        expiresAt: new Date(samSession.expiresAt)
      }
    });

    res.json({
      success: true,
      session: {
        id: session.id,
        samSessionId: session.samSessionId,
        qrPayload: session.qrPayload,
        status: session.status,
        expiresAt: session.expiresAt
      }
    });
  } catch (error: any) {
    const isAuthError = error.message === 'UNAUTHENTICATED' || error.response?.status === 401;
    const apiMessage = error.response?.data?.message || error.response?.data?.error || error.message;
    
    console.error('Session create error:', apiMessage);
    
    if (isAuthError) {
      return res.status(502).json({ 
        success: false, 
        error: 'SAM_AUTH_REQUIRED', 
        message: `خطأ في المصادقة مع المزود: ${apiMessage}. يرجى تحديث SAM_SID في الإعدادات.` 
      });
    }

    res.status(502).json({ success: false, error: 'SAM_API_ERROR', message: `خطأ من مزود الخدمة: ${apiMessage}` });
  }
});

// GET /api/sessions/:id/status
router.get('/:id/status', authMiddleware, async (req, res) => {
  try {
    const session = await prisma.qRSession.findUnique({
      where: { id: req.params.id }
    });

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'الجلسة غير موجودة' });
    }

    if (session.status === 'linked') {
      const wallet = await prisma.wallet.findFirst({ where: { samWalletId: session.samWalletId! } });
      return res.json({ success: true, status: 'linked', walletId: wallet?.id });
    }

    const samStatus = await samapi.checkQRSession(session.samSessionId);

    // Update session in DB
    await prisma.qRSession.update({
      where: { id: session.id },
      data: {
        status: samStatus.status,
        samWalletId: samStatus.walletAccountId
      }
    });

    if (samStatus.status === 'linked' && samStatus.walletAccountId) {
      // Check if wallet already exists
      let wallet = await prisma.wallet.findFirst({
        where: { samWalletId: samStatus.walletAccountId }
      });

      if (!wallet) {
        // Fetch balance
        const balanceData = await samapi.getBalance(samStatus.walletAccountId);

        wallet = await prisma.wallet.create({
          data: {
            userId: req.user.id,
            samWalletId: samStatus.walletAccountId,
            balance: balanceData.balance,
            currency: balanceData.currency || 'SYP'
          }
        });

        // Initial transactions fetch
        try {
          const transactionsData = await samapi.getTransactions(samStatus.walletAccountId);
          if (transactionsData && Array.isArray(transactionsData)) {
            await prisma.transaction.createMany({
              data: transactionsData.map((t: any) => ({
                walletId: wallet!.id,
                type: t.type,
                amount: t.amount,
                currency: t.currency || 'SYP',
                description: t.description || '',
                date: new Date(t.date)
              }))
            });
          }
        } catch (tErr) {
          console.error('Error fetching initial transactions:', tErr);
        }
      }

      return res.json({ success: true, status: 'linked', walletId: wallet.id });
    }

    res.json({ success: true, status: samStatus.status });
  } catch (error: any) {
    console.error('Session status error:', error);
    res.status(502).json({ success: false, error: 'SAM_API_ERROR', message: 'خطأ في تحديث حالة الجلسة' });
  }
});

export default router;

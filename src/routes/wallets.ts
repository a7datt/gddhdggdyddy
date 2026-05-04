import { Router } from 'express';
import prisma from '../lib/prisma.ts';
import { authMiddleware } from '../middleware/auth.ts';
import * as samapi from '../services/samapi.ts';

const router = Router();

// GET /api/wallets
router.get('/', authMiddleware, async (req, res) => {
  try {
    const wallets = await prisma.wallet.findMany({
      where: { userId: req.user.id },
      orderBy: { linkedAt: 'desc' }
    });

    res.json({
      success: true,
      wallets
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
});

// GET /api/wallets/:id/balance
router.get('/:id/balance', authMiddleware, async (req, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { id: req.params.id }
    });

    if (!wallet || wallet.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'المحفظة غير موجودة' });
    }

    const data = await samapi.getBalance(wallet.samWalletId);

    // Update DB
    const updatedWallet = await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: data.balance,
        currency: data.currency || 'SYP'
      }
    });

    res.json({
      success: true,
      balance: updatedWallet.balance,
      currency: updatedWallet.currency
    });
  } catch (error) {
    console.error('Balance error:', error);
    res.status(502).json({ success: false, error: 'SAM_API_ERROR' });
  }
});

// GET /api/wallets/:id/transactions
router.get('/:id/transactions', authMiddleware, async (req, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { id: req.params.id },
      include: { transactions: { orderBy: { date: 'desc' }, take: 50 } }
    });

    if (!wallet || wallet.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    }

    // Try to update with latest from API
    try {
      const apiTransactions = await samapi.getTransactions(wallet.samWalletId);
      if (apiTransactions && Array.isArray(apiTransactions)) {
        // Sync logic: For simplicity, we'll just return what's in DB for now
        // A real sync would match IDs or timestamps
      }
    } catch (apiErr) {
      console.error('API Transactions error:', apiErr);
    }

    res.json({
      success: true,
      transactions: wallet.transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
});

export default router;

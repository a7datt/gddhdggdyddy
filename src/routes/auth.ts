import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'بينات ناقصة' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'EMAIL_EXISTS', message: 'الحساب موجود مسبقاً' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword }
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, apiKey: user.apiKey }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'خطأ في السيرفر' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, error: 'AUTH_FAILED', message: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'AUTH_FAILED', message: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, apiKey: user.apiKey }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'خطأ في السيرفر' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { _count: { select: { wallets: true } } }
    });

    res.json({
      success: true,
      user: {
        id: user?.id,
        email: user?.email,
        apiKey: user?.apiKey,
        walletsCount: user?._count.wallets
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
});

// GET /api/auth/usage
router.get('/usage', authMiddleware, async (req, res) => {
  try {
    const logs = await prisma.apiCall.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
});

export default router;

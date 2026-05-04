import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let user = null;

    // Check JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        user = await prisma.user.findUnique({
          where: { id: decoded.id },
          include: { wallets: true }
        });
      } catch (err) {
        // JWT invalid, check API key
      }
    }

    // Check API Key if no user yet
    if (!user) {
      const apiKey = req.headers['x-api-key'] as string;
      if (apiKey) {
        user = await prisma.user.findUnique({
          where: { apiKey },
          include: { wallets: true }
        });

        // Log API call if verified by API Key
        if (user) {
          await prisma.apiCall.create({
            data: {
              userId: user.id,
              endpoint: req.originalUrl,
              method: req.method,
              status: 200 // Will be updated by interceptor or just assume success if it reaches here
            }
          });
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'ليس لديك صلاحية الوصول'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'خطأ في المصادقة'
    });
  }
}

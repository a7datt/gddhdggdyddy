import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

import authRouter from './src/routes/auth.js';
import sessionsRouter from './src/routes/sessions.js';
import walletsRouter from './src/routes/wallets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/wallets', walletsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Serve public folder
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for unknown routes (frontend)
app.get('*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ShamCash API Service running on http://0.0.0.0:${PORT}`);

  if (!process.env.SAM_SID) {
    console.warn('WARNING: SAM_SID is not set in environment variables. API calls to SAM will fail with 401.');
  }
  if (!process.env.SAM_API_BASE) {
    console.warn('WARNING: SAM_API_BASE is not set. Defaulting to https://www.sam-api.pro/api');
  }
});

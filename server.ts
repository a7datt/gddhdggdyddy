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

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

app.use('/api/auth', authRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/wallets', walletsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// public folder is at dist/public after build, or ./public in dev
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.get('*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ShamCash API running on http://0.0.0.0:${PORT}`);
  console.log(`Public path: ${publicPath}`);
  if (!process.env.SAM_SID) {
    console.warn('WARNING: SAM_SID is not set!');
  }
});

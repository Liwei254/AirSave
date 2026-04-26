import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import walletRoutes from './routes/wallet.js';
import transactionRoutes from './routes/transaction.js';
import goalRoutes from './routes/goal.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notification.js';
import paymentRoutes from './routes/paymentRoutes.js';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.join(__dirname, '../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]
  .map((origin) => String(origin || '').trim().replace(/\/$/, ''))
  .filter(Boolean);

app.set('trust proxy', 1);

if (!isProduction) {
  app.use(
    cors({
      origin(origin, callback) {
        const normalizedOrigin = String(origin || '').trim().replace(/\/$/, '');

        if (!origin || allowedOrigins.includes(normalizedOrigin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
}

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'AirSave API - Micro-Savings Platform',
    version: '1.0.0',
    status: 'running',
    mode: isProduction ? 'production' : 'development',
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

if (isProduction) {
  console.log('Serving frontend from:', frontendDistPath);
  console.log('Frontend index exists:', fs.existsSync(frontendIndexPath));

  if (fs.existsSync(frontendIndexPath)) {
    app.use(express.static(frontendDistPath));

    app.get('*', (req, res) => {
      res.sendFile(frontendIndexPath);
    });
  } else {
    console.warn(`Frontend build not found at ${frontendIndexPath}`);
  }
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`AirSave Server running on port ${PORT}`);
});

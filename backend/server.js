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
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import { submitWithdrawal } from './controllers/transactionController.js';
import { protect } from './middlewares/auth.js';
import { validateRequest } from './middlewares/validation.js';
import { withdrawalValidator } from './validators/transactionValidators.js';
import { sendError, sendSuccess } from './utils/apiResponse.js';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.join(__dirname, '../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const isProduction = process.env.NODE_ENV === 'production';

const parseOrigins = (value = '') =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = Array.from(new Set([
  'https://airsave-1.onrender.com',
  process.env.FRONTEND_URL,
  ...parseOrigins(process.env.CLIENT_URLS),
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
].filter(Boolean)));

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

console.log('Allowed origins:', allowedOrigins);

app.set('trust proxy', 1);
if (!isProduction) {
  app.use((req, res, next) => {
    console.log('Request origin:', req.headers.origin);
    next();
  });
}
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

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
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.post('/api/withdraw', protect, withdrawalValidator, validateRequest, submitWithdrawal);

app.get('/api', (req, res) => {
  return sendSuccess(res, {
    message: 'AirSave API - Micro-Savings Platform',
    data: {
      version: '1.0.0',
      status: 'running',
      mode: isProduction ? 'production' : 'development',
    },
  });
});

app.use('/api', (req, res) => {
  return sendError(res, { statusCode: 404, message: 'API route not found' });
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
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || (err.code === 11000 ? 409 : 500);
  const message =
    err.code === 11000
      ? 'A record with those details already exists'
      : err.message || 'Server Error';
  const errors = Array.isArray(err.errors) ? err.errors : [];

  if (statusCode >= 500) {
    console.error(err.stack || err);
  }

  return sendError(res, {
    statusCode,
    message,
    errors,
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`AirSave Server running on port ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Find the process with: netstat -ano | findstr :${PORT}`);
    console.error('Then stop that PID with: taskkill /PID <PID> /F');
    process.exit(1);
  }

  console.error('Server failed to start:', error);
  process.exit(1);
});

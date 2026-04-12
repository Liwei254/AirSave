import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import walletRoutes from "./routes/wallet.js";
import transactionRoutes from "./routes/transaction.js";
import goalRoutes from "./routes/goal.js";
import analyticsRoutes from "./routes/analytics.js";
import notificationRoutes from "./routes/notification.js";

// Load env vars FIRST
dotenv.config();

const app = express();

// Connect Database
connectDB();

// ==================== MIDDLEWARE ====================

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// Routes 
app.use("/api/transactions", transactionRoutes);

// goal routes
app.use("/api/goals", goalRoutes);

// analytics routes
app.use("/api/analytics", analyticsRoutes);

// notification routes
app.use("/api/notifications", notificationRoutes);

// Security & Logging
app.use(helmet());

app.use("/api/wallet", walletRoutes);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(morgan('combined'));

// ==================== ROUTES ====================

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'AirSave API - Micro-Savings Platform',
    version: '1.0.0',
    status: 'running'
  });
});

// ✅ FIXED HERE
app.use('/api/auth', authRoutes);

// ==================== ERROR HANDLING ====================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ==================== SERVER ====================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 AirSave Server running on port ${PORT}`);
});
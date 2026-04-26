import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import walletRoutes from "./routes/wallet.js";
import transactionRoutes from "./routes/transaction.js";
import goalRoutes from "./routes/goal.js";
import analyticsRoutes from "./routes/analytics.js";
import notificationRoutes from "./routes/notification.js";
import paymentRoutes from "./routes/paymentRoutes.js";

dotenv.config();

const app = express();
const __dirname = path.resolve();

app.set("trust proxy", 1);

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_URL,
  "https://airsave-1.onrender.com",
].filter(Boolean).map(normalizeOrigin);

app.use(cors({
  origin(origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin);

    if (!origin || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'AirSave API - Micro-Savings Platform',
    version: '1.0.0',
    status: 'running',
    frontendUrl: normalizeOrigin(process.env.FRONTEND_URL),
  });
});

app.use(express.static(path.join(__dirname, "frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`AirSave Server running on port ${PORT}`);
});

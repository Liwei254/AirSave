import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { normalizePhone } from "../utils/auth.js";
import {
  calculateWalletBalance,
  creditWallet,
  normalizeMoney,
  syncUserWalletBalance,
} from "./ledgerService.js";
import { createNotification } from "./notificationService.js";
import { createTransactionRecord } from "./transactionService.js";
import { invalidateDashboardCache } from "./cacheService.js";

function buildReference(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function getUserWallet(userId) {
  const wallet = await Wallet.findOne({ user: userId });

  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  return wallet;
}

export async function getWallet(userId) {
  const wallet = await getUserWallet(userId);
  const balance = await calculateWalletBalance(wallet._id);
  const transactionsCount = await Ledger.countDocuments({
    wallet: wallet._id,
    status: "completed",
  });

  await User.findByIdAndUpdate(userId, { walletBalance: Math.max(0, balance) });

  return {
    walletId: wallet._id,
    balance,
    transactionsCount,
  };
}

export async function depositWallet(userId, payload = {}, user = {}) {
  const numericAmount = normalizeMoney(payload.amount, "Enter a valid deposit amount.");
  const sourceMethod = String(payload.sourceMethod || "M-Pesa").trim();
  const phoneNumber = normalizePhone(payload.phoneNumber || payload.phone || user.phone);

  if (!phoneNumber) {
    throw new AppError("A valid Kenyan phone number is required.", 400);
  }

  if (sourceMethod.toLowerCase() !== "m-pesa") {
    throw new AppError("M-Pesa is the supported deposit method.", 400);
  }

  const wallet = await getUserWallet(userId);
  const reference = buildReference("DEP");
  const ledgerEntry = await creditWallet({
    userId,
    walletId: wallet._id,
    amount: numericAmount,
    reference,
    description: `Wallet deposit from M-Pesa ${phoneNumber}.`,
  });

  const transaction = await createTransactionRecord({
    userId,
    phone: phoneNumber,
    originalAmount: numericAmount,
    roundedAmount: numericAmount,
    savingsAmount: numericAmount,
    amount: numericAmount,
    savings: numericAmount,
    merchant: "Wallet deposit",
    description: "Wallet deposit from M-Pesa",
    transactionType: "deposit",
    roundingType: user.roundUpRule || 50,
    status: "confirmed",
    walletId: wallet._id,
    ledgerRef: ledgerEntry._id,
    paymentReference: reference,
    reference,
  });

  const balance = await syncUserWalletBalance(userId, wallet._id);

  await createNotification({
    userId,
    message: `Deposit confirmed. ${numericAmount} KES added to your AirSave wallet.`,
    type: "system",
  });
  await invalidateDashboardCache(userId);

  return {
    message: "Deposit confirmed successfully.",
    reference,
    status: "confirmed",
    amount: numericAmount,
    sourceMethod: "M-Pesa",
    phoneNumber,
    balance,
    transaction,
  };
}

export async function getTransactionHistory(userId) {
  const wallet = await getUserWallet(userId);
  const transactions = await Ledger.find({ wallet: wallet._id })
    .select("_id amount type reference description status createdAt")
    .sort({ createdAt: -1 });

  return {
    walletId: wallet._id,
    count: transactions.length,
    transactions,
  };
}

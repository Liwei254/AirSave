import mongoose from "mongoose";
import Ledger from "../models/Ledger.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";

export function normalizeMoney(value, message = "Enter a valid amount.") {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(message, 400);
  }

  return Number(amount.toFixed(2));
}

function normalizeWalletId(walletId) {
  if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
    throw new AppError("Wallet not found", 404);
  }

  return new mongoose.Types.ObjectId(String(walletId));
}

export async function calculateWalletBalance(walletId) {
  const normalizedWalletId = normalizeWalletId(walletId);

  const [summary] = await Ledger.aggregate([
    {
      $match: {
        wallet: normalizedWalletId,
        status: "completed",
      },
    },
    {
      $group: {
        _id: "$wallet",
        credits: {
          $sum: {
            $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0],
          },
        },
        debits: {
          $sum: {
            $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0],
          },
        },
      },
    },
  ]);

  return Number(((summary?.credits || 0) - (summary?.debits || 0)).toFixed(2));
}

export async function syncUserWalletBalance(userId, walletId) {
  const balance = await calculateWalletBalance(walletId);
  await User.findByIdAndUpdate(userId, { walletBalance: Math.max(0, balance) });
  return balance;
}

export async function createLedgerEntry({
  userId,
  walletId,
  amount,
  type,
  reference,
  description,
  status = "completed",
  session = null,
}) {
  const normalizedAmount = normalizeMoney(amount);
  const normalizedType = String(type || "").toUpperCase();

  if (!["CREDIT", "DEBIT"].includes(normalizedType)) {
    throw new AppError("Invalid ledger entry type", 400);
  }

  if (!reference) {
    throw new AppError("Ledger reference is required", 400);
  }

  const payload = {
    user: userId || null,
    wallet: walletId,
    amount: normalizedAmount,
    type: normalizedType,
    reference,
    description,
    status,
  };

  if (session) {
    const [entry] = await Ledger.create([payload], { session });
    return entry;
  }

  return Ledger.create(payload);
}

export async function creditWallet({ userId, walletId, amount, reference, description, session = null }) {
  return createLedgerEntry({
    userId,
    walletId,
    amount,
    type: "CREDIT",
    reference,
    description,
    session,
  });
}

export async function debitWallet({
  userId,
  walletId,
  amount,
  reference,
  description,
  checkAvailable = true,
  session = null,
}) {
  const debitAmount = normalizeMoney(amount);

  if (checkAvailable) {
    const currentBalance = await calculateWalletBalance(walletId);
    if (debitAmount > currentBalance) {
      throw new AppError("Insufficient wallet balance.", 400);
    }
  }

  return createLedgerEntry({
    userId,
    walletId,
    amount: debitAmount,
    type: "DEBIT",
    reference,
    description,
    session,
  });
}

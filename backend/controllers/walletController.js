import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import Notification from "../models/Notification.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { calculateWalletBalance, createLedgerEntry } from "../services/ledgerService.js";
import { normalizePhone } from "../utils/auth.js";

function buildReference(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/**
 * @desc    Get wallet details (balance + count)
 * @route   GET /api/wallet
 * @access  Private
 */
export const getWallet = async (req, res) => {
  try {
    // Find user's wallet
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // Get all transactions for this wallet
    const transactions = await Ledger.find({ wallet: wallet._id, status: "completed" });
    const balance = await calculateWalletBalance(wallet._id);
    await User.findByIdAndUpdate(req.user._id, { walletBalance: Math.max(0, balance) });

    res.status(200).json({
      walletId: wallet._id,
      balance,
      transactionsCount: transactions.length,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Deposit money into the user's AirSave wallet
 * @route   POST /api/wallet/deposit
 * @access  Private
 */
export const depositWallet = async (req, res) => {
  try {
    const numericAmount = Number(req.body.amount);
    const sourceMethod = String(req.body.sourceMethod || "M-Pesa").trim();
    const phoneNumber = normalizePhone(req.body.phoneNumber || req.body.phone || req.user.phone);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ message: "Enter a valid deposit amount." });
    }

    if (!phoneNumber) {
      return res.status(400).json({ message: "A valid Kenyan phone number is required." });
    }

    if (sourceMethod.toLowerCase() !== "m-pesa") {
      return res.status(400).json({ message: "M-Pesa is the supported deposit method." });
    }

    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const amount = Number(numericAmount.toFixed(2));
    const reference = buildReference("DEP");
    const ledgerEntry = await createLedgerEntry({
      walletId: wallet._id,
      amount,
      type: "CREDIT",
      reference,
      description: `Wallet deposit from M-Pesa ${phoneNumber}.`,
    });

    const transaction = await Transaction.create({
      user: req.user._id,
      phone: phoneNumber,
      originalAmount: amount,
      roundedAmount: amount,
      savingsAmount: amount,
      amount,
      savings: amount,
      merchant: "Wallet deposit",
      description: "Wallet deposit from M-Pesa",
      transactionType: "deposit",
      roundingType: String(req.user.roundUpRule || 50),
      status: "confirmed",
      wallet: wallet._id,
      ledgerRef: ledgerEntry._id,
      paymentReference: reference,
      reference,
    });

    const balance = await calculateWalletBalance(wallet._id);
    await User.findByIdAndUpdate(req.user._id, { walletBalance: Math.max(0, balance) });

    await Notification.create({
      user: req.user._id,
      message: `Deposit confirmed. ${amount} KES added to your AirSave wallet.`,
      type: "system",
    });

    return res.status(201).json({
      message: "Deposit confirmed successfully.",
      reference,
      status: "confirmed",
      amount,
      sourceMethod: "M-Pesa",
      phoneNumber,
      balance,
      transaction,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


/**
 * @desc    Get transaction history
 * @route   GET /api/wallet/transactions
 * @access  Private
 */
export const getTransactionHistory = async (req, res) => {
  try {
    // Find user's wallet
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // Fetch transactions (latest first)
    const transactions = await Ledger.find({ wallet: wallet._id })
      .select("_id amount type reference description status createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      walletId: wallet._id,
      count: transactions.length,
      transactions,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

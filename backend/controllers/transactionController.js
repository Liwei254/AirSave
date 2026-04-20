import Wallet from "../models/Wallet.js";
import Goal from "../models/Goal.js";
import Notification from "../models/Notification.js";
import Transaction from "../models/Transaction.js";
import { normalizePhone } from "../services/paymentService.js";
import {
  calculateWalletBalance,
  createLedgerEntry,
} from "../services/ledgerService.js";
import { roundAmount } from "../utils/rounding.js";

async function getUserWallet(userId) {
  return Wallet.findOne({ user: userId });
}

function buildReference(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function getSavingsValue(transaction) {
  return Number(
    transaction.savings ??
      transaction.savingsAmount ??
      transaction.amount ??
      transaction.originalAmount ??
      0
  );
}

async function confirmTransactionByReference(paymentReference) {
  const transaction = await Transaction.findOne({ paymentReference });

  if (!transaction || transaction.status !== "processing") {
    return transaction;
  }

  const savingsValue = getSavingsValue(transaction);
  const wallet = await Wallet.findById(transaction.wallet);

  if (!wallet) {
    transaction.status = "failed";
    await transaction.save();
    return transaction;
  }

  const ledgerEntry = await createLedgerEntry({
    walletId: wallet._id,
    amount: savingsValue,
    type: "CREDIT",
    reference: transaction.paymentReference || transaction.reference,
    description: `Confirmed savings from payment ${transaction.originalAmount}`,
  });

  if (transaction.goal) {
    const goal = await Goal.findById(transaction.goal);

    if (goal) {
      goal.savedAmount = Number(goal.savedAmount || 0) + savingsValue;

      if (goal.savedAmount >= Number(goal.targetAmount || 0)) {
        goal.status = "completed";
      }

      await goal.save();
    }
  }

  transaction.ledgerRef = ledgerEntry._id;
  transaction.status = "confirmed";
  await transaction.save();

  await Notification.create({
    user: transaction.user,
    message: `Payment confirmed. ${savingsValue} KES moved to your savings wallet.`,
    type: "saving",
  });

  return transaction;
}

function scheduleAutoConfirmation(paymentReference) {
  setTimeout(async () => {
    try {
      await confirmTransactionByReference(paymentReference);
    } catch (error) {
      console.error("Auto confirmation error:", error.message);
    }
  }, 4000);
}

export const initiatePayment = async (req, res) => {
  try {
    const { amount, rule = 10, goalId, walletId, phone } = req.body;
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ message: "Amount required" });
    }

    if (![10, 50, 100].includes(Number(rule))) {
      return res.status(400).json({ message: "Invalid rounding rule" });
    }

    const wallet = await getUserWallet(req.user._id);
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    if (!goalId && !walletId) {
      return res.status(400).json({ message: "goalId or walletId is required." });
    }

    if (walletId && String(wallet._id) !== String(walletId)) {
      return res.status(400).json({ message: "Selected wallet not found." });
    }

    if (phone && normalizePhone(phone) !== normalizePhone(req.user.phone)) {
      return res.status(400).json({ message: "Payments must use the account phone number." });
    }

    let goal = null;
    if (goalId) {
      goal = await Goal.findOne({ _id: goalId, user: req.user._id });

      if (!goal) {
        return res.status(404).json({ message: "Selected goal not found." });
      }
    }

    const rounding = roundAmount(numericAmount, Number(rule));
    const paymentReference = buildReference("PAY");
    const callbackReference = buildReference("CALLBACK");

    const transaction = await Transaction.create({
      user: req.user._id,
      phone: normalizePhone(phone || req.user.phone),
      originalAmount: rounding.original,
      roundedAmount: rounding.rounded,
      savingsAmount: rounding.savings,
      amount: rounding.original,
      savings: rounding.savings,
      roundingType: String(rule),
      status: "processing",
      wallet: wallet._id,
      goal: goal?._id || null,
      paymentReference,
      reference: paymentReference,
    });

    scheduleAutoConfirmation(paymentReference);

    res.status(201).json({
      message: "Payment initiated. Savings will post after callback confirmation.",
      paymentId: transaction._id,
      paymentReference,
      callbackReference,
      phone: transaction.phone,
      status: transaction.status,
      rounding,
      checkout: {
        provider: "mock-mobile-money",
        prompt: `Approve the mobile money debit on ${transaction.phone} to save ${rounding.savings} KES.`,
        callbackReference,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const handlePaymentCallback = async (req, res) => {
  try {
    const { paymentReference, status } = req.body;

    if (!paymentReference) {
      return res.status(400).json({ message: "paymentReference is required" });
    }

    const transaction = await Transaction.findOne({ paymentReference });

    if (!transaction) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (status === "failed") {
      transaction.status = "failed";
      await transaction.save();
    } else {
      await confirmTransactionByReference(paymentReference);
    }

    const refreshedTransaction = await Transaction.findById(transaction._id);

    res.status(200).json({
      message:
        refreshedTransaction.status === "confirmed"
          ? "Payment confirmed and savings posted."
          : "Payment callback processed.",
      status: refreshedTransaction.status,
      paymentReference: refreshedTransaction.paymentReference,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      paymentReference: req.params.reference,
      user: req.user._id,
    }).select("status");

    if (!transaction) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.status(200).json({ status: transaction.status });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSavingsActivity = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .populate("goal", "name")
      .sort({ createdAt: -1 })
      .select("originalAmount savingsAmount createdAt status paymentReference goal");

    const activity = transactions.map((transaction) => ({
      _id: transaction._id,
      amount: transaction.originalAmount,
      savings: transaction.savingsAmount,
      date: transaction.createdAt,
      status: transaction.status,
      reference: transaction.paymentReference || transaction.reference,
      goalName: transaction.goal?.name || "Savings wallet",
    }));

    res.status(200).json(activity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const submitWithdrawal = async (req, res) => {
  try {
    const { amount, sourceType = "wallet", sourceId, breakGoal = false } = req.body;
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ message: "A valid withdrawal amount is required." });
    }

    const wallet = await getUserWallet(req.user._id);
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const walletBalance = await calculateWalletBalance(wallet._id);
    if (numericAmount > walletBalance) {
      return res.status(400).json({ message: "Insufficient savings balance." });
    }

    let sourceLabel = "wallet";

    if (sourceType === "goal") {
      const goal = await Goal.findOne({ _id: sourceId, user: req.user._id });

      if (!goal) {
        return res.status(404).json({ message: "Selected goal not found." });
      }

      if (numericAmount > Number(goal.savedAmount || 0)) {
        return res.status(400).json({ message: "Withdrawal amount exceeds the goal balance." });
      }

      if (goal.status !== "completed" && !breakGoal) {
        return res.status(400).json({
          message: "This goal has not matured",
          code: "GOAL_NOT_MATURED",
        });
      }

      goal.savedAmount = Math.max(0, Number(goal.savedAmount || 0) - numericAmount);
      if (goal.savedAmount < Number(goal.targetAmount || 0)) {
        goal.status = "active";
      }
      await goal.save();
      sourceLabel = goal.name;
    }

    const reference = `WDR-${Date.now()}`;
    await createLedgerEntry({
      walletId: wallet._id,
      amount: numericAmount,
      type: "DEBIT",
      reference,
      description: `Withdrawal from ${sourceLabel}`,
    });

    await Notification.create({
      user: req.user._id,
      message: `Withdrawal request submitted for ${numericAmount} KES from ${sourceLabel}.`,
      type: "system",
    });

    const balance = await calculateWalletBalance(wallet._id);

    res.status(201).json({
      message: "Withdrawal submitted successfully.",
      reference,
      balance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const simulateTransaction = initiatePayment;

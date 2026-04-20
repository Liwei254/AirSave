import Wallet from "../models/Wallet.js";
import Payment from "../models/Payment.js";
import Goal from "../models/Goal.js";
import Notification from "../models/Notification.js";
import {
  confirmSavingsPayment,
  initiateSavingsPayment,
  normalizePhone,
} from "../services/paymentService.js";
import {
  calculateWalletBalance,
  createLedgerEntry,
} from "../services/ledgerService.js";

async function getUserWallet(userId) {
  return Wallet.findOne({ user: userId });
}

export const initiatePayment = async (req, res) => {
  try {
    const { amount, rule, goalId, phone } = req.body;

    if (!amount) {
      return res.status(400).json({ message: "Amount required" });
    }

    const wallet = await getUserWallet(req.user._id);
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    if (phone && normalizePhone(phone) !== normalizePhone(req.user.phone)) {
      return res.status(400).json({ message: "Payments must use the account phone number." });
    }

    const { payment, rounding, checkout } = await initiateSavingsPayment({
      user: req.user,
      wallet,
      amount: Number(amount),
      rule,
      goalId,
    });

    res.status(201).json({
      message: "Payment initiated. Savings will post after callback confirmation.",
      paymentId: payment._id,
      paymentReference: payment.providerReference,
      callbackReference: payment.callbackReference,
      phone: payment.phone,
      status: payment.status,
      rounding,
      checkout,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const handlePaymentCallback = async (req, res) => {
  try {
    const { callbackReference, status, providerPayload } = req.body;

    if (!callbackReference) {
      return res.status(400).json({ message: "callbackReference is required" });
    }

    const payment = await confirmSavingsPayment({
      callbackReference,
      status,
      providerPayload: providerPayload || req.body,
    });

    res.status(200).json({
      message:
        payment.status === "confirmed"
          ? "Payment confirmed and savings posted."
          : "Payment callback processed.",
      status: payment.status,
      paymentReference: payment.providerReference,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      providerReference: req.params.reference,
      user: req.user._id,
    }).select("-callbackPayload");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSavingsActivity = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .populate("goal", "name")
      .sort({ createdAt: -1 })
      .select("originalAmount savingsAmount createdAt status providerReference goal");

    const activity = payments.map((payment) => ({
      _id: payment._id,
      amount: payment.originalAmount,
      savings: payment.savingsAmount,
      date: payment.createdAt,
      status: payment.status,
      reference: payment.providerReference,
      goalName: payment.goal?.name || "Savings wallet",
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

// Backward compatible alias while the frontend transitions from "simulate" wording.
export const simulateTransaction = initiatePayment;

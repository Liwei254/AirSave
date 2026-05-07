import Wallet from "../models/Wallet.js";
import Goal from "../models/Goal.js";
import Ledger from "../models/Ledger.js";
import Notification from "../models/Notification.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
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

function getWithdrawalSource(description) {
  const match = String(description || "").match(/Withdrawal from (.*?) to /i);
  return match?.[1] || "Savings wallet";
}

function getWithdrawalPhone(description) {
  const match = String(description || "").match(/ to ([^.]+)\./i);
  return match?.[1] || "";
}

function shouldAutoSave(transactionType) {
  return ["purchase", "bill", "save"].includes(String(transactionType || "").toLowerCase());
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function getTransactionActivityType(transactionType) {
  const normalizedType = String(transactionType || "").toLowerCase();

  if (normalizedType === "send") return "send";
  if (normalizedType === "purchase") return "buy-goods";
  if (normalizedType === "bill") return "paybill";
  if (normalizedType === "deposit") return "deposit";
  if (normalizedType === "withdraw") return "withdraw";
  return "deposit";
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

  let ledgerEntry = null;
  const debitAmount = Number(Number(transaction.roundedAmount ?? transaction.amount ?? transaction.originalAmount ?? 0).toFixed(2));
  const walletBalance = await calculateWalletBalance(wallet._id);

  if (debitAmount > 0 && walletBalance < debitAmount) {
    transaction.status = "failed";
    await transaction.save();

    await Notification.create({
      user: transaction.user,
      message: "Payment failed because your wallet balance is insufficient.",
      type: "system",
    });

    return transaction;
  }

  if (debitAmount > 0) {
    await createLedgerEntry({
      walletId: wallet._id,
      amount: debitAmount,
      type: "DEBIT",
      reference: transaction.paymentReference || transaction.reference,
      description: `Wallet debit for ${transaction.transactionType || "payment"}: ${transaction.merchant || transaction.description || "AirSave payment"}.`,
    });
  }

  if (savingsValue > 0) {
    ledgerEntry = await createLedgerEntry({
      walletId: wallet._id,
      amount: savingsValue,
      type: "CREDIT",
      reference: `${transaction.paymentReference || transaction.reference}-SAVE`,
      description: `Auto-saved ${savingsValue} KES from ${transaction.merchant || transaction.description || "purchase"}`,
    });
  }

  if (transaction.goal) {
    const goal = await Goal.findById(transaction.goal);

    if (goal) {
      const nextAmount = Number(goal.currentAmount ?? goal.savedAmount ?? 0) + savingsValue;
      goal.savedAmount = nextAmount;
      goal.currentAmount = nextAmount;

      if (goal.currentAmount >= Number(goal.targetAmount || 0)) {
        goal.status = "completed";
      }

      await goal.save();
    }
  }

  transaction.ledgerRef = ledgerEntry?._id || null;
  transaction.status = "confirmed";
  await transaction.save();

  const balance = await calculateWalletBalance(wallet._id);
  await User.findByIdAndUpdate(transaction.user, { walletBalance: Math.max(0, balance) });

  await Notification.create({
    user: transaction.user,
    message:
      savingsValue > 0
        ? `Payment confirmed. ${savingsValue} KES auto-saved from your purchase.`
        : "Payment confirmed.",
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
    const {
      amount,
      goalId,
      walletId,
      phone,
      description = "",
      merchant = "",
      transactionType = "purchase",
    } = req.body;
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ message: "Amount required" });
    }

    const requestedTransactionType = ["purchase", "bill", "send", "save"].includes(transactionType)
      ? transactionType
      : "purchase";

    const user = await User.findById(req.user._id).select("phone roundUpRule preferences");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const rule = Number(user.roundUpRule || 50);
    if (![10, 50, 100].includes(rule)) {
      return res.status(400).json({ message: "Invalid saved round-up rule" });
    }

    const wallet = await getUserWallet(req.user._id);
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    if (walletId && String(wallet._id) !== String(walletId)) {
      return res.status(400).json({ message: "Selected wallet not found." });
    }

    const transactionPhone = normalizePhone(phone || user.phone);
    if (!transactionPhone) {
      return res.status(400).json({ message: "A valid Kenyan phone number is required." });
    }

    if (requestedTransactionType !== "send" && phone && transactionPhone !== normalizePhone(user.phone)) {
      return res.status(400).json({ message: "Payments must use the account phone number." });
    }

    let validatedTillNumber = "";
    let validatedBusinessNumber = "";
    let validatedAccountNumber = "";

    if (requestedTransactionType === "purchase") {
      validatedTillNumber = normalizeDigits(req.body.tillNumber || req.body.till || merchant || description);
      if (!validatedTillNumber || validatedTillNumber.length < 5) {
        return res.status(400).json({ message: "A valid till number is required." });
      }
    }

    if (requestedTransactionType === "bill") {
      validatedBusinessNumber = normalizeDigits(req.body.businessNumber || merchant || description);
      validatedAccountNumber = String(req.body.accountNumber || "").trim();
      if (!validatedBusinessNumber || validatedBusinessNumber.length < 5) {
        return res.status(400).json({ message: "A valid business number is required." });
      }
      if (!validatedAccountNumber) {
        return res.status(400).json({ message: "Account number is required." });
      }
    }

    let goal = null;
    if (goalId) {
      goal = await Goal.findOne({ _id: goalId, user: req.user._id, status: "active" });

      if (!goal) {
        return res.status(404).json({ message: "Active goal not found." });
      }
    } else {
      goal = await Goal.findOne({ user: req.user._id, status: "active" }).sort({ updatedAt: -1, createdAt: -1 });
    }

    const autoSaveApplies = shouldAutoSave(requestedTransactionType);

    if (autoSaveApplies && user.preferences?.autoSaveEnabled === false) {
      return res.status(400).json({ message: "Auto-save is disabled. Enable it in Settings to continue." });
    }

    const rounding = autoSaveApplies
      ? roundAmount(numericAmount, rule)
      : { original: numericAmount, rounded: numericAmount, savings: 0 };
    const savingsValue = Number(rounding.savings.toFixed(2));
    const roundedAmount = Number(rounding.rounded.toFixed(2));
    const walletBalance = await calculateWalletBalance(wallet._id);

    if (roundedAmount > walletBalance) {
      return res.status(400).json({ message: "Insufficient wallet balance. Deposit funds before continuing." });
    }

    const paymentReference = buildReference("PAY");
    const callbackReference = buildReference("CALLBACK");
    const fallbackMerchant =
      requestedTransactionType === "purchase"
        ? `Till ${validatedTillNumber}`
        : requestedTransactionType === "bill"
          ? `Paybill ${validatedBusinessNumber}`
          : requestedTransactionType === "send"
            ? `Send to ${transactionPhone}`
            : "Purchase";
    const fallbackDescription =
      requestedTransactionType === "bill"
        ? `Paybill ${validatedBusinessNumber} account ${validatedAccountNumber}`
        : fallbackMerchant;
    const cleanMerchant = String(merchant || fallbackMerchant).trim().slice(0, 140);
    const cleanDescription = String(description || fallbackDescription || merchant || "AirSave wallet purchase").trim().slice(0, 240);

    const transaction = await Transaction.create({
      user: req.user._id,
      phone: transactionPhone,
      originalAmount: numericAmount,
      roundedAmount,
      savingsAmount: savingsValue,
      amount: roundedAmount,
      savings: savingsValue,
      roundingType: String(rule),
      merchant: cleanMerchant,
      description: cleanDescription,
      transactionType: requestedTransactionType,
      status: "processing",
      wallet: wallet._id,
      goal: goal?._id || null,
      paymentReference,
      reference: paymentReference,
    });

    scheduleAutoConfirmation(paymentReference);

    res.status(201).json({
      message: autoSaveApplies
        ? "Payment initiated. Round-up savings will post after confirmation."
        : "Payment initiated. Wallet debit will post after confirmation.",
      paymentId: transaction._id,
      paymentReference,
      callbackReference,
      phone: transaction.phone,
      status: transaction.status,
      merchant: transaction.merchant,
      description: transaction.description,
      amount: transaction.originalAmount,
      chargedAmount: transaction.roundedAmount,
      savingsAmount: transaction.savingsAmount,
      roundUpRule: rule,
      rounding: {
        ...rounding,
        savings: savingsValue,
        rounded: roundedAmount,
        roundUpAmount: savingsValue,
        walletCharged: roundedAmount,
      },
      checkout: {
        provider: "mock-mobile-money",
        prompt: savingsValue > 0
          ? `Approve the wallet debit for ${roundedAmount} KES. AirSave will save ${savingsValue} KES automatically.`
          : `Approve the wallet debit for ${roundedAmount} KES.`,
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
    const wallet = await getUserWallet(req.user._id);
    const transactions = await Transaction.find({ user: req.user._id })
      .populate("goal", "name")
      .sort({ createdAt: -1 })
      .select("originalAmount roundedAmount savingsAmount amount savings merchant description transactionType createdAt status paymentReference reference goal phone roundingType");

    const withdrawals = wallet
      ? await Ledger.find({
          wallet: wallet._id,
          type: "DEBIT",
          description: /^Withdrawal from/i,
        })
          .sort({ createdAt: -1 })
          .select("_id amount reference description status createdAt")
      : [];

    const activity = transactions.map((transaction) => {
      const transactionType = transaction.transactionType || "purchase";
      const activityType = getTransactionActivityType(transactionType);
      const isWalletDebit = activityType === "send";
      const activityAmount = isWalletDebit
        ? Number(transaction.originalAmount || transaction.amount || 0)
        : getSavingsValue(transaction);

      return {
        _id: transaction._id,
        amount: activityAmount,
        savings: isWalletDebit ? -Math.abs(activityAmount) : activityAmount,
        purchaseAmount: Number(transaction.originalAmount || 0),
        chargedAmount: Number(transaction.roundedAmount || 0),
        roundUpRule: Number(transaction.roundingType || 0),
        date: transaction.createdAt,
        status: transaction.status,
        reference: transaction.paymentReference || transaction.reference,
        goalName: isWalletDebit
          ? "Mobile transfer"
          : transaction.goal?.name || "Savings wallet",
        goalId: transaction.goal?._id || null,
        from: transaction.phone,
        phone: transaction.phone,
        channel: "M-Pesa",
        merchant: transaction.merchant || transaction.description || "Purchase",
        description: transaction.description,
        transactionType,
        type: activityType,
      };
    });

    const withdrawalActivity = withdrawals.map((entry) => ({
      _id: entry._id,
      amount: Number(entry.amount || 0),
      savings: Number(entry.amount || 0) * -1,
      date: entry.createdAt,
      status: entry.status,
      reference: entry.reference,
      goalName: getWithdrawalSource(entry.description),
      goalId: null,
      from: getWithdrawalPhone(entry.description),
      phone: getWithdrawalPhone(entry.description),
      channel: "M-Pesa",
      type: "withdraw",
      description: entry.description,
    }));

    res.status(200).json(
      [...activity, ...withdrawalActivity].sort(
        (left, right) => new Date(right.date || 0) - new Date(left.date || 0)
      )
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const submitWithdrawal = async (req, res) => {
  try {
    const {
      amount,
      fee = 0,
      sourceType = "wallet",
      sourceId,
      phoneNumber,
      totalDeducted,
    } = req.body;
    const numericAmount = Number(amount);
    const numericFee = Number(fee || 0);
    const requestedTotal = Number(totalDeducted ?? numericAmount + numericFee);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ message: "A valid withdrawal amount is required." });
    }

    if (numericFee < 0) {
      return res.status(400).json({ message: "Withdrawal fee cannot be negative." });
    }

    if (!requestedTotal || requestedTotal !== numericAmount + numericFee) {
      return res.status(400).json({ message: "Withdrawal total is invalid." });
    }

    if (!["wallet", "goal"].includes(sourceType)) {
      return res.status(400).json({ message: "Invalid withdrawal source." });
    }

    const withdrawalPhone = normalizePhone(phoneNumber || req.user.phone);
    if (!withdrawalPhone) {
      return res.status(400).json({ message: "A valid Kenyan phone number is required." });
    }

    const wallet = await getUserWallet(req.user._id);
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const walletBalance = await calculateWalletBalance(wallet._id);
    if (requestedTotal > walletBalance) {
      return res.status(400).json({ message: "Insufficient savings balance." });
    }

    let sourceLabel = "Savings wallet";
    let selectedSourceBalance = walletBalance;
    let goal = null;

    if (sourceType === "goal") {
      goal = await Goal.findOne({ _id: sourceId, user: req.user._id, status: "active" });

      if (!goal) {
        return res.status(404).json({ message: "Current active goal not found." });
      }

      selectedSourceBalance = Number(goal.currentAmount ?? goal.savedAmount ?? 0);

      if (requestedTotal > selectedSourceBalance) {
        return res.status(400).json({ message: "Withdrawal amount exceeds the goal balance." });
      }

      const nextGoalBalance = Math.max(0, selectedSourceBalance - requestedTotal);
      goal.savedAmount = nextGoalBalance;
      goal.currentAmount = nextGoalBalance;
      if (goal.currentAmount < Number(goal.targetAmount || 0)) {
        goal.status = "active";
      }
      await goal.save();
      sourceLabel = goal.name;
    } else if (requestedTotal > selectedSourceBalance) {
      return res.status(400).json({ message: "Withdrawal amount exceeds the wallet balance." });
    }

    const reference = `WDR-${Date.now()}`;
    await createLedgerEntry({
      walletId: wallet._id,
      amount: requestedTotal,
      type: "DEBIT",
      reference,
      description: `Withdrawal from ${sourceLabel} to ${withdrawalPhone}. Receive ${numericAmount} KES, fee ${numericFee} KES.`,
    });

    await Notification.create({
      user: req.user._id,
      message: `Withdrawal request submitted for ${numericAmount} KES from ${sourceLabel}.`,
      type: "system",
    });

    const balance = await calculateWalletBalance(wallet._id);
    await User.findByIdAndUpdate(req.user._id, { walletBalance: Math.max(0, balance) });

    res.status(201).json({
      message: "Withdrawal submitted successfully.",
      reference,
      status: "submitted",
      amount: numericAmount,
      fee: numericFee,
      totalDeducted: requestedTotal,
      phoneNumber: withdrawalPhone,
      sourceType,
      sourceId: goal?._id || null,
      balance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const simulateTransaction = initiatePayment;

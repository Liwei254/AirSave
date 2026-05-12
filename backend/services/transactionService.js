import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import AppError from "../utils/AppError.js";
import { normalizePhone } from "../utils/auth.js";
import { roundAmount } from "../utils/rounding.js";
import {
  calculateWalletBalance,
  creditWallet,
  debitWallet,
  normalizeMoney,
  syncUserWalletBalance,
} from "./ledgerService.js";
import { createNotification } from "./notificationService.js";
import { creditActiveGoal, findActiveGoal } from "./goalService.js";
import User from "../models/User.js";
import Ledger from "../models/Ledger.js";
import {
  invalidateDashboardCache,
  setTemporaryState,
} from "./cacheService.js";

function buildReference(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function shouldAutoSave(transactionType) {
  return ["purchase", "bill", "save"].includes(String(transactionType || "").toLowerCase());
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

function getTransactionActivityType(transactionType) {
  const normalizedType = String(transactionType || "").toLowerCase();

  if (normalizedType === "send") return "send";
  if (normalizedType === "purchase") return "buy-goods";
  if (normalizedType === "bill") return "paybill";
  if (normalizedType === "deposit") return "deposit";
  if (normalizedType === "withdraw") return "withdraw";
  return "deposit";
}

async function getUserWallet(userId) {
  const wallet = await Wallet.findOne({ user: userId });

  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  return wallet;
}

async function getPaymentUser(userId) {
  const user = await User.findById(userId).select("phone roundUpRule preferences status");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.status === "suspended") {
    throw new AppError("Account is suspended", 403);
  }

  return user;
}

export async function createTransactionRecord({
  userId,
  phone,
  originalAmount,
  roundedAmount,
  savingsAmount = 0,
  amount = null,
  savings = null,
  merchant = "",
  description = "",
  transactionType,
  roundingType = 50,
  status = "confirmed",
  walletId,
  goalId = null,
  ledgerRef = null,
  paymentReference = "",
  reference = "",
}) {
  return Transaction.create({
    user: userId,
    phone,
    originalAmount,
    roundedAmount,
    savingsAmount,
    amount: amount ?? roundedAmount,
    savings: savings ?? savingsAmount,
    merchant,
    description,
    transactionType,
    roundingType: String(roundingType || 50),
    status,
    wallet: walletId,
    goal: goalId,
    ledgerRef,
    paymentReference: paymentReference || reference || buildReference("PAY"),
    reference: reference || paymentReference || buildReference("TXN"),
  });
}

export async function processWalletPayment(userId, payload = {}) {
  const numericAmount = normalizeMoney(payload.amount, "Amount required");
  const requestedTransactionType = ["purchase", "bill", "send", "save"].includes(payload.transactionType)
    ? payload.transactionType
    : "purchase";
  const user = await getPaymentUser(userId);
  const wallet = await getUserWallet(userId);

  if (payload.walletId && String(wallet._id) !== String(payload.walletId)) {
    throw new AppError("Selected wallet not found.", 400);
  }

  const rule = Number(user.roundUpRule || 50);
  if (![10, 50, 100].includes(rule)) {
    throw new AppError("Invalid saved round-up rule", 400);
  }

  const transactionPhone = normalizePhone(payload.phone || user.phone);
  if (!transactionPhone) {
    throw new AppError("A valid Kenyan phone number is required.", 400);
  }

  if (requestedTransactionType !== "send" && payload.phone && transactionPhone !== normalizePhone(user.phone)) {
    throw new AppError("Payments must use the account phone number.", 400);
  }

  let validatedTillNumber = "";
  let validatedBusinessNumber = "";
  let validatedAccountNumber = "";

  if (requestedTransactionType === "purchase") {
    validatedTillNumber = normalizeDigits(payload.tillNumber || payload.till || payload.merchant || payload.description);
    if (!validatedTillNumber || validatedTillNumber.length < 5) {
      throw new AppError("A valid till number is required.", 400);
    }
  }

  if (requestedTransactionType === "bill") {
    validatedBusinessNumber = normalizeDigits(payload.businessNumber || payload.merchant || payload.description);
    validatedAccountNumber = String(payload.accountNumber || "").trim();
    if (!validatedBusinessNumber || validatedBusinessNumber.length < 5) {
      throw new AppError("A valid business number is required.", 400);
    }
    if (!validatedAccountNumber) {
      throw new AppError("Account number is required.", 400);
    }
  }

  const autoSaveApplies = shouldAutoSave(requestedTransactionType);

  if (autoSaveApplies && user.preferences?.autoSaveEnabled === false) {
    throw new AppError("Auto-save is disabled. Enable it in Settings to continue.", 400);
  }

  const activeGoal = autoSaveApplies
    ? payload.goalId
      ? await findActiveGoal(userId).then((goal) => (goal && String(goal._id) === String(payload.goalId) ? goal : null))
      : await findActiveGoal(userId)
    : null;

  if (payload.goalId && autoSaveApplies && !activeGoal) {
    throw new AppError("Active goal not found.", 404);
  }

  const rounding = autoSaveApplies
    ? roundAmount(numericAmount, rule)
    : { original: numericAmount, rounded: numericAmount, savings: 0 };
  const savingsValue = Number(rounding.savings.toFixed(2));
  const roundedAmount = Number(rounding.rounded.toFixed(2));
  const walletBalance = await calculateWalletBalance(wallet._id);

  if (roundedAmount > walletBalance) {
    throw new AppError("Insufficient wallet balance. Deposit funds before continuing.", 400);
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
  const cleanMerchant = String(payload.merchant || fallbackMerchant).trim().slice(0, 140);
  const cleanDescription = String(payload.description || fallbackDescription || payload.merchant || "AirSave wallet purchase")
    .trim()
    .slice(0, 240);

  const debitEntry = await debitWallet({
    userId,
    walletId: wallet._id,
    amount: roundedAmount,
    reference: paymentReference,
    description: `Wallet debit for ${requestedTransactionType}: ${cleanMerchant || cleanDescription}.`,
    checkAvailable: false,
  });

  let savingsEntry = null;
  let updatedGoal = null;

  if (savingsValue > 0) {
    savingsEntry = await creditWallet({
      userId,
      walletId: wallet._id,
      amount: savingsValue,
      reference: `${paymentReference}-SAVE`,
      description: `Auto-saved ${savingsValue} KES from ${cleanMerchant || cleanDescription}.`,
    });

    updatedGoal = await creditActiveGoal(userId, savingsValue, activeGoal?._id || null);
  }

  const transaction = await createTransactionRecord({
    userId,
    phone: transactionPhone,
    originalAmount: numericAmount,
    roundedAmount,
    savingsAmount: savingsValue,
    amount: roundedAmount,
    savings: savingsValue,
    merchant: cleanMerchant,
    description: cleanDescription,
    transactionType: requestedTransactionType,
    roundingType: rule,
    status: "confirmed",
    walletId: wallet._id,
    goalId: updatedGoal?._id || activeGoal?._id || null,
    ledgerRef: savingsEntry?._id || debitEntry._id,
    paymentReference,
    reference: paymentReference,
  });

  const balance = await syncUserWalletBalance(userId, wallet._id);
  const message =
    savingsValue > 0
      ? `Payment confirmed. ${savingsValue} KES auto-saved ${updatedGoal ? "to your active goal" : "to your savings wallet"}.`
      : "Payment confirmed.";

  await createNotification({
    userId,
    message,
    type: savingsValue > 0 ? "saving" : "system",
  });
  await setTemporaryState("payment", paymentReference, {
    userId: String(userId),
    status: transaction.status,
    transactionId: String(transaction._id),
    transactionType: requestedTransactionType,
  });
  await invalidateDashboardCache(userId);

  return {
    message,
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
    balance,
    goal: updatedGoal,
    transaction,
    rounding: {
      ...rounding,
      savings: savingsValue,
      rounded: roundedAmount,
      roundUpAmount: savingsValue,
      walletCharged: roundedAmount,
    },
    checkout: {
      provider: "mock-mobile-money",
      prompt:
        savingsValue > 0
          ? `Confirmed wallet debit for ${roundedAmount} KES. AirSave saved ${savingsValue} KES automatically.`
          : `Confirmed wallet debit for ${roundedAmount} KES.`,
      callbackReference,
    },
  };
}

export async function handlePaymentCallback({ paymentReference, status }) {
  if (!paymentReference) {
    throw new AppError("paymentReference is required", 400);
  }

  const transaction = await Transaction.findOne({ paymentReference });

  if (!transaction) {
    throw new AppError("Payment not found", 404);
  }

  if (status === "failed" && transaction.status !== "confirmed") {
    transaction.status = "failed";
    await transaction.save();
  }
  await setTemporaryState("payment", paymentReference, {
    userId: String(transaction.user),
    status: transaction.status,
    transactionId: String(transaction._id),
    transactionType: transaction.transactionType,
  });
  await invalidateDashboardCache(transaction.user);

  return {
    status: transaction.status,
    paymentReference: transaction.paymentReference,
  };
}

export async function getPaymentStatus(userId, reference) {
  const transaction = await Transaction.findOne({
    paymentReference: reference,
    user: userId,
  }).select("status");

  if (!transaction) {
    throw new AppError("Payment not found", 404);
  }

  return { status: transaction.status };
}

export async function getSavingsActivity(userId) {
  const wallet = await Wallet.findOne({ user: userId });
  const transactions = await Transaction.find({ user: userId })
    .populate("goal", "name")
    .sort({ createdAt: -1 })
    .select("originalAmount roundedAmount savingsAmount amount savings merchant description transactionType createdAt status paymentReference reference goal phone roundingType");

  const transactionReferences = new Set(
    transactions
      .map((transaction) => transaction.paymentReference || transaction.reference)
      .filter(Boolean)
      .map(String)
  );

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
    const isWalletOutflow = ["send", "withdraw"].includes(activityType);
    const activityAmount = isWalletOutflow
      ? Number(transaction.originalAmount || transaction.amount || 0)
      : getSavingsValue(transaction);

    return {
      _id: transaction._id,
      amount: activityAmount,
      savings: isWalletOutflow ? -Math.abs(activityAmount) : activityAmount,
      purchaseAmount: Number(transaction.originalAmount || 0),
      chargedAmount: Number(transaction.roundedAmount || 0),
      roundUpRule: Number(transaction.roundingType || 0),
      date: transaction.createdAt,
      createdAt: transaction.createdAt,
      status: transaction.status,
      reference: transaction.paymentReference || transaction.reference,
      goalName: isWalletOutflow
        ? activityType === "send"
          ? "Mobile transfer"
          : "Withdrawal"
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

  const legacyWithdrawalActivity = withdrawals
    .filter((entry) => !transactionReferences.has(String(entry.reference)))
    .map((entry) => ({
      _id: entry._id,
      amount: Number(entry.amount || 0),
      savings: Number(entry.amount || 0) * -1,
      date: entry.createdAt,
      createdAt: entry.createdAt,
      status: entry.status,
      reference: entry.reference,
      goalName: getWithdrawalSource(entry.description),
      goalId: null,
      from: getWithdrawalPhone(entry.description),
      phone: getWithdrawalPhone(entry.description),
      channel: "M-Pesa",
      type: "withdraw",
      transactionType: "withdraw",
      description: entry.description,
    }));

  return [...activity, ...legacyWithdrawalActivity].sort(
    (left, right) => new Date(right.date || 0) - new Date(left.date || 0)
  );
}

export async function submitWithdrawal(userId, payload = {}) {
  const numericAmount = normalizeMoney(payload.amount, "A valid withdrawal amount is required.");
  const numericFee = Number(payload.fee || 0);
  const requestedTotal = Number(payload.totalDeducted ?? numericAmount + numericFee);

  if (numericFee < 0) {
    throw new AppError("Withdrawal fee cannot be negative.", 400);
  }

  if (!requestedTotal || Number(requestedTotal.toFixed(2)) !== Number((numericAmount + numericFee).toFixed(2))) {
    throw new AppError("Withdrawal total is invalid.", 400);
  }

  const sourceType = payload.sourceType || "wallet";
  if (!["wallet", "goal"].includes(sourceType)) {
    throw new AppError("Invalid withdrawal source.", 400);
  }

  const user = await getPaymentUser(userId);
  const withdrawalPhone = normalizePhone(payload.phoneNumber || payload.recipient || user.phone);
  if (!withdrawalPhone) {
    throw new AppError("A valid Kenyan phone number is required.", 400);
  }

  const wallet = await getUserWallet(userId);
  const walletBalance = await calculateWalletBalance(wallet._id);

  if (requestedTotal > walletBalance) {
    throw new AppError("Insufficient savings balance.", 400);
  }

  let sourceLabel = "Savings wallet";
  let selectedSourceBalance = walletBalance;
  let goal = null;

  if (sourceType === "goal") {
    goal = await findActiveGoal(userId);

    if (!goal || String(goal._id) !== String(payload.sourceId)) {
      throw new AppError("Current active goal not found.", 404);
    }

    selectedSourceBalance = Number(goal.currentAmount ?? goal.savedAmount ?? 0);

    if (requestedTotal > selectedSourceBalance) {
      throw new AppError("Withdrawal amount exceeds the goal balance.", 400);
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
    throw new AppError("Withdrawal amount exceeds the wallet balance.", 400);
  }

  const reference = buildReference("WDR");
  const ledgerEntry = await debitWallet({
    userId,
    walletId: wallet._id,
    amount: requestedTotal,
    reference,
    description: `Withdrawal from ${sourceLabel} to ${withdrawalPhone}. Receive ${numericAmount} KES, fee ${numericFee} KES.`,
    checkAvailable: false,
  });

  const transaction = await createTransactionRecord({
    userId,
    phone: withdrawalPhone,
    originalAmount: numericAmount,
    roundedAmount: requestedTotal,
    savingsAmount: 0,
    amount: requestedTotal,
    savings: -Math.abs(numericAmount),
    merchant: "Withdrawal",
    description: `Withdrawal from ${sourceLabel}`,
    transactionType: "withdraw",
    roundingType: user.roundUpRule || 50,
    status: "confirmed",
    walletId: wallet._id,
    goalId: goal?._id || null,
    ledgerRef: ledgerEntry._id,
    paymentReference: reference,
    reference,
  });

  await createNotification({
    userId,
    message: `Withdrawal request submitted for ${numericAmount} KES from ${sourceLabel}.`,
    type: "system",
  });

  const balance = await syncUserWalletBalance(userId, wallet._id);
  await setTemporaryState("payment", reference, {
    userId: String(userId),
    status: transaction.status,
    transactionId: String(transaction._id),
    transactionType: "withdraw",
  });
  await invalidateDashboardCache(userId);

  return {
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
    transaction,
  };
}

export async function getRecentTransactions(userId, limit = 5) {
  return getSavingsActivity(userId).then((activity) => activity.slice(0, limit));
}

import prisma from "../../config/prisma.js";
import {
  getActiveGoalByUserId,
  getGoalById,
  getGoalProgress as getGoalProgressRecord,
  updateGoal as updateGoalRecord,
} from "../../repositories/postgres/prismaGoalRepository.js";
import {
  createPaymentIntent,
  getPaymentIntentByIdempotencyKey,
  getPaymentIntentDetails,
  updatePaymentIntentStatus,
} from "../../repositories/postgres/prismaPaymentIntentRepository.js";
import {
  createProviderTransaction,
  findByCheckoutRequestId,
  findByProviderReference,
  updateProviderTransactionStatus,
} from "../../repositories/postgres/prismaProviderTransactionRepository.js";
import {
  getTransactionDetails as getTransactionDetailsRecord,
  listWalletTransactions,
} from "../../repositories/postgres/prismaTransactionRepository.js";
import { getAccountByType, getWalletOrCreate } from "../../repositories/postgres/walletRepository.js";
import AppError from "../../utils/AppError.js";
import { normalizePhone } from "../../utils/auth.js";
import { roundAmount } from "../../utils/rounding.js";
import {
  centsToMoney,
  getWalletBalance,
  moneyToCents,
  normalizeMoney,
  postDoubleEntry,
} from "../ledger/prismaLedgerService.js";
import { normalizePreferencePayload } from "./mappers.js";

function buildReference(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeTransactionType(value) {
  const transactionType = String(value || "purchase").toLowerCase();

  if (["purchase", "bill", "send", "save", "withdraw", "deposit"].includes(transactionType)) {
    return transactionType;
  }

  return "purchase";
}

function shouldAutoSave(transactionType) {
  return ["purchase", "bill", "save"].includes(String(transactionType || "").toLowerCase());
}

function toActivityType(type) {
  if (type === "purchase") return "buy-goods";
  if (type === "bill") return "paybill";
  return type || "deposit";
}

function toApiStatus(status) {
  if (status === "CONFIRMED" || status === "PROVIDER_CONFIRMED") return "confirmed";
  if (status === "FAILED") return "failed";
  if (status === "REVERSED") return "reversed";
  if (status === "EXPIRED") return "expired";
  return "processing";
}

function toProviderStatus(status) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (["success", "successful", "confirmed", "completed"].includes(normalizedStatus)) {
    return "SUCCESSFUL";
  }

  if (["fail", "failed", "cancelled", "canceled"].includes(normalizedStatus)) {
    return "FAILED";
  }

  return "PENDING";
}

function requireIdempotencyKey(payload = {}) {
  const idempotencyKey = String(
    payload.idempotencyKey || payload.paymentReference || payload.reference || ""
  ).trim();

  return idempotencyKey || buildReference("PAY");
}

function requireAccount(wallet, accountType) {
  const account = getAccountByType(wallet, accountType);

  if (!account) {
    throw new AppError(`Wallet ledger account ${accountType} is not configured.`, 500);
  }

  return account;
}

async function getPaymentUser(userId, tx = prisma) {
  const user = await tx.user.findUnique({
    where: {
      id: String(userId),
    },
    include: {
      wallet: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.status === "SUSPENDED") {
    throw new AppError("Account is suspended", 403);
  }

  return user;
}

function validateFlowPayload(transactionType, payload = {}, user = {}) {
  if (transactionType === "purchase") {
    const tillNumber = normalizeDigits(payload.tillNumber || payload.till || payload.merchant || payload.description);
    if (!tillNumber || tillNumber.length < 5) {
      throw new AppError("A valid till number is required.", 400);
    }
    return { tillNumber };
  }

  if (transactionType === "bill") {
    const businessNumber = normalizeDigits(payload.businessNumber || payload.merchant || payload.description);
    const accountNumber = String(payload.accountNumber || "").trim();
    if (!businessNumber || businessNumber.length < 5) {
      throw new AppError("A valid business number is required.", 400);
    }
    if (!accountNumber) {
      throw new AppError("Account number is required.", 400);
    }
    return { businessNumber, accountNumber };
  }

  if (transactionType === "send") {
    const phone = normalizePhone(payload.phone);
    if (!phone) {
      throw new AppError("A valid Kenyan phone number is required.", 400);
    }
    return { phone };
  }

  const phone = normalizePhone(payload.phone || payload.phoneNumber || user.phone);
  return { phone };
}

function buildLabels(transactionType, validation = {}, payload = {}) {
  if (transactionType === "purchase") {
    return {
      merchant: String(payload.merchant || `Till ${validation.tillNumber}`).trim().slice(0, 140),
      description: String(payload.description || `Till ${validation.tillNumber}`).trim().slice(0, 240),
    };
  }

  if (transactionType === "bill") {
    return {
      merchant: String(payload.merchant || `Paybill ${validation.businessNumber}`).trim().slice(0, 140),
      description: String(
        payload.description || `Paybill ${validation.businessNumber} account ${validation.accountNumber}`
      )
        .trim()
        .slice(0, 240),
    };
  }

  if (transactionType === "send") {
    return {
      merchant: String(payload.merchant || `Send to ${validation.phone}`).trim().slice(0, 140),
      description: String(payload.description || `Send to ${validation.phone}`).trim().slice(0, 240),
    };
  }

  if (transactionType === "withdraw") {
    return {
      merchant: "Withdrawal",
      description: String(payload.description || "Withdrawal").trim().slice(0, 240),
    };
  }

  return {
    merchant: String(payload.merchant || "Savings").trim().slice(0, 140),
    description: String(payload.description || "Savings allocation").trim().slice(0, 240),
  };
}

function flattenLedgerEntries(paymentIntent = {}) {
  return (paymentIntent.ledgerTransactions || []).flatMap((ledgerTransaction) =>
    (ledgerTransaction.entries || []).map((entry) => ({
      id: entry.id,
      amount: Number(entry.amount || 0),
      side: entry.side,
      status: entry.status,
      reference: entry.reference,
      accountType: entry.ledgerAccount?.accountType,
      ledgerTransactionId: ledgerTransaction.id,
    }))
  );
}

function primaryProvider(paymentIntent = {}) {
  return paymentIntent.providerTransaction || paymentIntent.providerTransactions?.[0] || null;
}

function serializePaymentIntent(paymentIntent, options = {}) {
  if (!paymentIntent) return null;

  const type = normalizeTransactionType(paymentIntent.type);
  const providerTransaction = primaryProvider(paymentIntent);
  const amount = Number(paymentIntent.originalAmount || 0);
  const chargedAmount = Number(paymentIntent.roundedAmount || paymentIntent.originalAmount || 0);
  const savingsAmount = Number(paymentIntent.savingsAmount || 0);
  const reference = paymentIntent.idempotencyKey || paymentIntent.id;
  const ledgerEntries = flattenLedgerEntries(paymentIntent);
  const goal = paymentIntent.goal
    ? {
        id: paymentIntent.goal.id,
        _id: paymentIntent.goal.id,
        name: paymentIntent.goal.name,
      }
    : null;

  return {
    _id: paymentIntent.id,
    id: paymentIntent.id,
    paymentId: paymentIntent.id,
    paymentReference: reference,
    reference,
    callbackReference: providerTransaction?.checkoutRequestId || reference,
    providerReference: providerTransaction?.providerReference || null,
    checkoutRequestId: providerTransaction?.checkoutRequestId || null,
    type: toActivityType(type),
    transactionType: type,
    amount,
    purchaseAmount: amount,
    chargedAmount,
    savingsAmount,
    savings: ["send", "withdraw"].includes(type) ? -Math.abs(amount) : savingsAmount || amount,
    roundUpRule: paymentIntent.roundingRule || 0,
    status: toApiStatus(paymentIntent.status),
    merchant: options.merchant || providerTransaction?.rawRequestData?.merchant || providerTransaction?.providerName || "",
    description:
      options.description ||
      providerTransaction?.rawRequestData?.description ||
      paymentIntent.ledgerTransactions?.[0]?.description ||
      "",
    goal,
    goalId: paymentIntent.goalId || null,
    goalName: goal?.name || (savingsAmount > 0 ? "Savings wallet" : null),
    phone: providerTransaction?.rawRequestData?.phone || options.phone || "",
    from: providerTransaction?.rawRequestData?.phone || options.phone || "",
    channel: providerTransaction?.providerName || "M-Pesa",
    date: paymentIntent.createdAt,
    createdAt: paymentIntent.createdAt,
    updatedAt: paymentIntent.updatedAt,
    ledgerEntries,
  };
}

async function refreshGoalProjection(userId, goalId, tx) {
  if (!goalId) return { goal: null, completed: false };

  const progress = await getGoalProgressRecord(userId, goalId, tx);
  if (!progress) return { goal: null, completed: false };

  const targetCents = moneyToCents(progress.goal.targetAmount);
  const savedCents = moneyToCents(progress.savedAmountDecimal || "0.00", "Goal amount cannot be negative.", {
    allowZero: true,
  });
  const wasCompleted = progress.goal.status === "COMPLETED";
  const completed = savedCents >= targetCents;

  const goal = await updateGoalRecord(
    userId,
    goalId,
    {
      savedAmount: progress.savedAmountDecimal,
      ...(completed ? { status: "COMPLETED" } : {}),
    },
    tx
  );

  return {
    goal,
    completed: completed && !wasCompleted,
  };
}

async function resolveGoalForSavings(userId, goalId, tx) {
  if (goalId) {
    const goal = await getGoalById(userId, goalId, tx);
    if (!goal) {
      throw new AppError("Active goal not found.", 404);
    }
    if (goal.status !== "ACTIVE") {
      throw new AppError("Savings can only be allocated to an active goal.", 400);
    }
    return goal;
  }

  return getActiveGoalByUserId(userId, tx);
}

async function serializeResult(paymentIntentId, userId, tx, options = {}) {
  const paymentIntent = await getPaymentIntentDetails(userId, paymentIntentId, tx);
  const serialized = serializePaymentIntent(paymentIntent, options);
  const balance = paymentIntent?.walletId ? await getWalletBalance(paymentIntent.walletId, tx) : 0;

  return {
    message:
      serialized.savingsAmount > 0
        ? `Payment confirmed. ${serialized.savingsAmount} KES auto-saved${
            serialized.goalId ? " to your active goal" : " to your savings wallet"
          }.`
        : serialized.transactionType === "withdraw"
          ? "Withdrawal submitted successfully."
          : "Payment confirmed.",
    paymentId: serialized.id,
    paymentReference: serialized.paymentReference,
    callbackReference: serialized.callbackReference,
    phone: serialized.phone,
    status: serialized.status,
    merchant: serialized.merchant,
    description: serialized.description,
    amount: serialized.amount,
    chargedAmount: serialized.chargedAmount,
    savingsAmount: serialized.savingsAmount,
    roundUpRule: serialized.roundUpRule,
    balance,
    goal: serialized.goal,
    transaction: serialized,
    rounding: {
      original: serialized.amount,
      rounded: serialized.chargedAmount,
      savings: serialized.savingsAmount,
      roundUpAmount: serialized.savingsAmount,
      walletCharged: serialized.chargedAmount,
    },
    checkout: {
      provider: serialized.channel,
      prompt:
        serialized.savingsAmount > 0
          ? `Confirmed wallet debit for ${serialized.chargedAmount} KES. AirSave saved ${serialized.savingsAmount} KES automatically.`
          : `Confirmed wallet debit for ${serialized.chargedAmount} KES.`,
      callbackReference: serialized.callbackReference,
    },
  };
}

export async function processWalletPayment(userId, payload = {}) {
  const idempotencyKey = requireIdempotencyKey(payload);
  const amount = normalizeMoney(payload.amount, "Amount required");
  const transactionType = normalizeTransactionType(payload.transactionType);

  return prisma.$transaction(async (tx) => {
    const existingIntent = await getPaymentIntentByIdempotencyKey(idempotencyKey, tx);
    if (existingIntent) {
      return serializeResult(existingIntent.id, userId, tx, {});
    }

    const user = await getPaymentUser(userId, tx);
    const wallet = await getWalletOrCreate(tx, String(userId));

    if (payload.walletId && String(payload.walletId) !== wallet.id) {
      throw new AppError("Selected wallet not found.", 400);
    }

    const validation = validateFlowPayload(transactionType, payload, user);
    const labels = buildLabels(transactionType, validation, payload);
    const transactionPhone = normalizePhone(validation.phone || payload.phone || user.phone);
    const preferences = normalizePreferencePayload({}, user.preferences || {});
    const rule = Number(user.roundUpRule || 50);

    if (![10, 50, 100].includes(rule)) {
      throw new AppError("Invalid saved round-up rule", 400);
    }

    if (transactionType !== "send" && payload.phone && transactionPhone !== normalizePhone(user.phone)) {
      throw new AppError("Payments must use the account phone number.", 400);
    }

    if (shouldAutoSave(transactionType) && preferences.autoSaveEnabled === false) {
      throw new AppError("Auto-save is disabled. Enable it in Settings to continue.", 400);
    }

    const rounding = shouldAutoSave(transactionType)
      ? roundAmount(Number(amount), rule)
      : { original: Number(amount), rounded: Number(amount), savings: 0 };
    const roundedAmount = normalizeMoney(rounding.rounded);
    const savingsAmount = normalizeMoney(rounding.savings || "0.00", "Enter a valid savings amount.", {
      allowZero: true,
    });
    const availableBalance = await getWalletBalance(wallet.id, tx);

    if (Number(roundedAmount) > availableBalance) {
      throw new AppError("Insufficient wallet balance. Deposit funds before continuing.", 400);
    }

    const availableFunds = requireAccount(wallet, "available_funds");
    const clearing = requireAccount(wallet, "clearing");
    const pendingOutbound = requireAccount(wallet, "pending_outbound");
    const savings = requireAccount(wallet, "savings");
    const activeGoal = shouldAutoSave(transactionType)
      ? await resolveGoalForSavings(userId, payload.goalId || null, tx)
      : null;
    const callbackReference = String(payload.callbackReference || buildReference("CALLBACK"));

    const paymentIntent = await createPaymentIntent(
      {
        userId: String(userId),
        walletId: wallet.id,
        goalId: activeGoal?.id || null,
        type: transactionType,
        originalAmount: amount,
        roundedAmount,
        savingsAmount,
        status: "PENDING_PROVIDER",
        roundingRule: rule,
        idempotencyKey,
      },
      tx
    );

    await createProviderTransaction(
      {
        paymentIntentId: paymentIntent.id,
        providerName: "mock-mobile-money",
        providerReference: idempotencyKey,
        checkoutRequestId: callbackReference,
        status: "SUCCESSFUL",
        amount: roundedAmount,
        rawRequestData: {
          phone: transactionPhone,
          merchant: labels.merchant,
          description: labels.description,
          transactionType,
        },
        rawResponseData: {
          simulated: true,
          reference: idempotencyKey,
        },
        confirmedAt: new Date(),
      },
      tx
    );

    const entries = [];

    if (transactionType === "send") {
      entries.push(
        {
          ledgerAccountId: availableFunds.id,
          amount,
          side: "DEBIT",
          reference: idempotencyKey,
        },
        {
          ledgerAccountId: pendingOutbound.id,
          amount,
          side: "CREDIT",
          reference: idempotencyKey,
        }
      );
    } else if (transactionType === "save") {
      entries.push(
        {
          ledgerAccountId: availableFunds.id,
          amount,
          side: "DEBIT",
          reference: idempotencyKey,
        },
        {
          ledgerAccountId: savings.id,
          amount,
          side: "CREDIT",
          reference: idempotencyKey,
        }
      );
    } else {
      entries.push(
        {
          ledgerAccountId: availableFunds.id,
          amount: roundedAmount,
          side: "DEBIT",
          reference: idempotencyKey,
        },
        {
          ledgerAccountId: clearing.id,
          amount,
          side: "CREDIT",
          reference: idempotencyKey,
        }
      );

      if (Number(savingsAmount) > 0) {
        entries.push({
          ledgerAccountId: savings.id,
          amount: savingsAmount,
          side: "CREDIT",
          reference: `${idempotencyKey}-SAVE`,
        });
      }
    }

    await postDoubleEntry(tx, {
      paymentIntentId: paymentIntent.id,
      description: `Wallet ${transactionType}: ${labels.merchant || labels.description}.`,
      entries,
    });

    const confirmedIntent = await updatePaymentIntentStatus(paymentIntent.id, "CONFIRMED", tx);

    if (activeGoal?.id) {
      const projection = await refreshGoalProjection(userId, activeGoal.id, tx);

      if (projection.completed) {
        await tx.outboxEvent.create({
          data: {
            relatedId: activeGoal.id,
            eventType: "goal.completed",
            payload: {
              userId: String(userId),
              goalId: activeGoal.id,
            },
          },
        });
      }
    }

    await tx.outboxEvent.create({
      data: {
        relatedId: confirmedIntent.id,
        eventType: "payment.confirmed",
        payload: {
          userId: String(userId),
          walletId: wallet.id,
          paymentIntentId: confirmedIntent.id,
          type: transactionType,
          amount,
          roundedAmount,
          savingsAmount,
          idempotencyKey,
        },
      },
    });

    if (Number(savingsAmount) > 0) {
      await tx.outboxEvent.create({
        data: {
          relatedId: confirmedIntent.id,
          eventType: "savings.allocated",
          payload: {
            userId: String(userId),
            walletId: wallet.id,
            goalId: activeGoal?.id || null,
            paymentIntentId: confirmedIntent.id,
            amount: savingsAmount,
            idempotencyKey,
          },
        },
      });
    }

    return serializeResult(confirmedIntent.id, userId, tx, {
      phone: transactionPhone,
      merchant: labels.merchant,
      description: labels.description,
    });
  });
}

export async function submitWithdrawal(userId, payload = {}) {
  const idempotencyKey = requireIdempotencyKey(payload);
  const amount = normalizeMoney(payload.amount, "A valid withdrawal amount is required.");
  const fee = Number(payload.fee || 0);
  const totalDeducted = normalizeMoney(payload.totalDeducted ?? Number(amount) + fee, "Withdrawal total is invalid.");
  const phoneNumber = normalizePhone(payload.phoneNumber || payload.recipient);
  const sourceType = payload.sourceType || "wallet";

  if (!phoneNumber) {
    throw new AppError("A valid Kenyan phone number is required.", 400);
  }

  if (!["wallet", "goal"].includes(sourceType)) {
    throw new AppError("Invalid withdrawal source.", 400);
  }

  if (fee < 0) {
    throw new AppError("Withdrawal fee cannot be negative.", 400);
  }

  if (Number(totalDeducted) !== Number((Number(amount) + fee).toFixed(2))) {
    throw new AppError("Withdrawal total is invalid.", 400);
  }

  if (sourceType === "goal") {
    return prisma.$transaction(async (tx) => {
      const existingIntent = await getPaymentIntentByIdempotencyKey(idempotencyKey, tx);
      if (existingIntent) {
        const existingResult = await serializeResult(existingIntent.id, userId, tx, {});
        return {
          ...existingResult,
          reference: existingResult.paymentReference,
          status: "submitted",
          amount: Number(amount),
          fee,
          totalDeducted: Number(totalDeducted),
          phoneNumber,
          sourceType,
          sourceId: existingIntent.goalId,
        };
      }

      await getPaymentUser(userId, tx);
      const wallet = await getWalletOrCreate(tx, String(userId));
      const goal = await getGoalById(userId, payload.sourceId, tx);

      if (!goal || goal.status !== "ACTIVE") {
        throw new AppError("Current active goal not found.", 404);
      }

      const progress = await getGoalProgressRecord(userId, goal.id, tx);
      if (!progress || Number(totalDeducted) > progress.savedAmount) {
        throw new AppError("Withdrawal amount exceeds the goal balance.", 400);
      }

      const savings = requireAccount(wallet, "savings");
      const clearing = requireAccount(wallet, "clearing");
      const paymentIntent = await createPaymentIntent(
        {
          userId: String(userId),
          walletId: wallet.id,
          goalId: goal.id,
          type: "withdraw",
          originalAmount: amount,
          roundedAmount: totalDeducted,
          savingsAmount: "0.00",
          status: "PENDING_PROVIDER",
          roundingRule: 0,
          idempotencyKey,
        },
        tx
      );

      await createProviderTransaction(
        {
          paymentIntentId: paymentIntent.id,
          providerName: "mock-mobile-money",
          providerReference: idempotencyKey,
          checkoutRequestId: payload.callbackReference || buildReference("CALLBACK"),
          status: "SUCCESSFUL",
          amount: totalDeducted,
          rawRequestData: {
            phone: phoneNumber,
            merchant: "Withdrawal",
            description: `Withdrawal from ${goal.name} to ${phoneNumber}.`,
            transactionType: "withdraw",
            sourceType,
            sourceId: goal.id,
          },
          rawResponseData: {
            simulated: true,
            reference: idempotencyKey,
          },
          confirmedAt: new Date(),
        },
        tx
      );

      await postDoubleEntry(tx, {
        paymentIntentId: paymentIntent.id,
        description: `Withdrawal from ${goal.name} to ${phoneNumber}. Receive ${amount} KES, fee ${fee} KES.`,
        entries: [
          {
            ledgerAccountId: savings.id,
            amount: totalDeducted,
            side: "DEBIT",
            reference: idempotencyKey,
          },
          {
            ledgerAccountId: clearing.id,
            amount: totalDeducted,
            side: "CREDIT",
            reference: idempotencyKey,
          },
        ],
      });

      const confirmedIntent = await updatePaymentIntentStatus(paymentIntent.id, "CONFIRMED", tx);
      await refreshGoalProjection(userId, goal.id, tx);
      await tx.outboxEvent.create({
        data: {
          relatedId: confirmedIntent.id,
          eventType: "payment.confirmed",
          payload: {
            userId: String(userId),
            walletId: wallet.id,
            goalId: goal.id,
            paymentIntentId: confirmedIntent.id,
            type: "withdraw",
            amount,
            totalDeducted,
            idempotencyKey,
          },
        },
      });

      const result = await serializeResult(confirmedIntent.id, userId, tx, {
        phone: phoneNumber,
        merchant: "Withdrawal",
        description: `Withdrawal from ${goal.name}`,
      });

      return {
        ...result,
        reference: result.paymentReference,
        status: "submitted",
        amount: Number(amount),
        fee,
        totalDeducted: Number(totalDeducted),
        phoneNumber,
        sourceType,
        sourceId: goal.id,
      };
    });
  }

  return processWalletPayment(userId, {
    ...payload,
    amount: totalDeducted,
    phone: phoneNumber,
    transactionType: "withdraw",
    merchant: "Withdrawal",
    description: `Withdrawal to ${phoneNumber}. Receive ${amount} KES, fee ${fee} KES.`,
  }).then((result) => ({
    ...result,
    reference: result.paymentReference,
    status: "submitted",
    amount: Number(amount),
    fee,
    totalDeducted: Number(totalDeducted),
    phoneNumber,
    sourceType: payload.sourceType || "wallet",
    sourceId: payload.sourceId || null,
  }));
}

export async function getSavingsActivity(userId, filters = {}) {
  const paymentIntents = await listWalletTransactions(userId, filters);
  return paymentIntents.map((paymentIntent) => serializePaymentIntent(paymentIntent));
}

export async function getRecentTransactions(userId, limit = 5) {
  return getSavingsActivity(userId, { limit }).then((activity) => activity.slice(0, limit));
}

export async function getPaymentStatus(userId, reference) {
  const paymentIntent = await getTransactionDetailsRecord(userId, reference);

  if (!paymentIntent) {
    throw new AppError("Payment not found", 404);
  }

  return {
    status: toApiStatus(paymentIntent.status),
    paymentReference: paymentIntent.idempotencyKey,
    paymentIntentId: paymentIntent.id,
  };
}

export async function getTransactionDetails(userId, transactionId) {
  const paymentIntent = await getTransactionDetailsRecord(userId, transactionId);

  if (!paymentIntent) {
    throw new AppError("Payment not found", 404);
  }

  return serializePaymentIntent(paymentIntent);
}

async function findCallbackProviderTransaction(payload = {}, tx = prisma) {
  const checkoutRequestId = payload.checkoutRequestId || payload.callbackReference;
  const providerReference = payload.providerReference || payload.paymentReference || payload.reference;

  return (
    (await findByCheckoutRequestId(checkoutRequestId, tx)) ||
    (await findByProviderReference(providerReference, tx))
  );
}

export async function handlePaymentCallback(payload = {}) {
  const providerTransaction = await findCallbackProviderTransaction(payload);

  if (!providerTransaction) {
    throw new AppError("Payment not found", 404);
  }

  const dedupeKey = String(
    payload.dedupeKey ||
      payload.callbackReference ||
      payload.checkoutRequestId ||
      `${providerTransaction.id}:${payload.status || "callback"}`
  );

  return prisma.$transaction(async (tx) => {
    const existingEvent = await tx.webhookEvent.findUnique({
      where: {
        dedupeKey,
      },
    });

    const providerStatus = toProviderStatus(payload.status);
    const callbackProviderTransaction = await tx.providerTransaction.findUnique({
      where: {
        id: providerTransaction.id,
      },
      include: {
        paymentIntent: true,
      },
    });

    if (existingEvent) {
      return {
        status: toApiStatus(callbackProviderTransaction.paymentIntent.status),
        paymentReference: callbackProviderTransaction.paymentIntent.idempotencyKey,
        replayed: true,
      };
    }

    await tx.webhookEvent.create({
      data: {
        providerTransactionId: callbackProviderTransaction.id,
        eventType: payload.eventType || "payment.callback",
        rawPayload: payload,
        dedupeKey,
        processedAt: new Date(),
      },
    });

    await updateProviderTransactionStatus(
      callbackProviderTransaction.id,
      providerStatus,
      {
        rawResponseData: payload,
        ...(providerStatus === "SUCCESSFUL" ? { confirmedAt: new Date() } : {}),
      },
      tx
    );

    let paymentIntent = callbackProviderTransaction.paymentIntent;
    if (providerStatus === "FAILED" && paymentIntent.status !== "CONFIRMED") {
      paymentIntent = await updatePaymentIntentStatus(paymentIntent.id, "FAILED", tx);
    } else if (providerStatus === "SUCCESSFUL" && paymentIntent.status !== "CONFIRMED") {
      paymentIntent = await updatePaymentIntentStatus(paymentIntent.id, "PROVIDER_CONFIRMED", tx);
    }

    return {
      status: toApiStatus(paymentIntent.status),
      paymentReference: paymentIntent.idempotencyKey,
      replayed: false,
    };
  });
}

export async function createTransactionRecord() {
  throw new AppError("Transaction records are represented by payment intents in PostgreSQL mode.", 400);
}

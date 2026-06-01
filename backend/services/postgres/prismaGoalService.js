import prisma from "../../config/prisma.js";
import {
  closeGoal as closeGoalRecord,
  createGoal as createGoalRecord,
  getActiveGoalByUserId,
  getGoalById,
  getGoalProgress as getGoalProgressRecord,
  getGoalsByUserId,
  getWalletForUser,
  oneActiveGoalMessage,
  updateGoal as updateGoalRecord,
} from "../../repositories/postgres/prismaGoalRepository.js";
import { getAccountByType } from "../../repositories/postgres/walletRepository.js";
import AppError from "../../utils/AppError.js";
import { centsToMoney, getWalletBalance, moneyToCents, normalizeMoney, postDoubleEntry } from "../ledger/prismaLedgerService.js";

const validStatuses = new Set(["ACTIVE", "COMPLETED", "CLOSED"]);
const validDurationUnits = new Set(["days", "weeks", "months", ""]);
const validRoundUpRules = new Set([10, 50, 100]);

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toPrismaStatus(value = "active") {
  const normalizedStatus = String(value || "active").trim().toUpperCase();

  if (!validStatuses.has(normalizedStatus)) {
    throw new AppError("Invalid goal status.", 400);
  }

  return normalizedStatus;
}

function toApiStatus(status = "ACTIVE") {
  return String(status || "ACTIVE").toLowerCase();
}

function assertRoundUpRule(value) {
  const roundUpRule = Number(value);

  if (!validRoundUpRules.has(roundUpRule)) {
    throw new AppError("Round-up rule must be 10, 50, or 100", 400);
  }

  return roundUpRule;
}

function cleanGoalPayload(body = {}, existingGoal = null) {
  const name = String(body.name ?? existingGoal?.name ?? "").trim();
  const targetAmountInput = body.targetAmount ?? existingGoal?.targetAmount;
  const targetAmount = Number(targetAmountInput);
  const status = toPrismaStatus(body.status ?? existingGoal?.status ?? "active");
  const duration = String(body.duration || "").trim();
  const durationUnit = body.durationUnit || "";
  const deadline = parseOptionalDate(body.deadline || body.expectedCompletionDate) || existingGoal?.deadline || null;
  const startDate = parseOptionalDate(body.startDate) || existingGoal?.startDate || null;

  return {
    name,
    targetAmount,
    targetAmountDecimal: normalizeMoney(targetAmount, "Enter a target amount greater than zero."),
    status,
    duration,
    durationUnit,
    deadline,
    expectedCompletionDate: deadline,
    startDate,
    template: String(body.template ?? existingGoal?.template ?? "").trim(),
  };
}

function validateGoalPayload(payload, { partial = false } = {}) {
  if (!partial || payload.name) {
    if (!payload.name) {
      throw new AppError("Goal name is required.", 400);
    }
  }

  if (!partial || typeof payload.targetAmount !== "undefined") {
    if (!Number.isFinite(payload.targetAmount) || payload.targetAmount <= 0) {
      throw new AppError("Enter a target amount greater than zero.", 400);
    }
  }

  if (payload.durationUnit && !validDurationUnits.has(payload.durationUnit)) {
    throw new AppError("Invalid duration unit.", 400);
  }
}

function mapUniqueGoalError(error) {
  if (error?.code === "P2002") {
    throw new AppError(oneActiveGoalMessage, 400);
  }

  throw error;
}

function serializeGoal(goal, progress = null) {
  if (!goal) return null;

  const savedAmount = Number(progress?.savedAmount ?? goal.savedAmount ?? 0);
  const deadline = goal.deadline || goal.expectedCompletionDate || null;
  const targetAmount = Number(goal.targetAmount || 0);

  return {
    ...goal,
    id: goal.id,
    _id: goal.id,
    wallet: goal.walletId,
    targetAmount,
    currentAmount: savedAmount,
    savedAmount,
    progressAmount: savedAmount,
    progressPercent: targetAmount > 0 ? Math.min(100, Number(((savedAmount / targetAmount) * 100).toFixed(2))) : 0,
    status: toApiStatus(goal.status),
    duration: goal.duration || "",
    durationUnit: goal.durationUnit || "",
    template: goal.template || "",
    deadline,
    expectedCompletionDate: goal.expectedCompletionDate || deadline,
  };
}

async function serializeGoalWithProgress(userId, goal, tx = prisma) {
  if (!goal) return null;

  const progress = await getGoalProgressRecord(userId, goal.id, tx);
  return serializeGoal(goal, progress);
}

async function assertSingleActiveGoal(userId, goalId = null, tx = prisma) {
  const activeGoal = await getActiveGoalByUserId(userId, tx);

  if (activeGoal && (!goalId || activeGoal.id !== String(goalId))) {
    throw new AppError(oneActiveGoalMessage, 400);
  }
}

async function syncGoalProjection(userId, goalId, tx = prisma) {
  const progress = await getGoalProgressRecord(userId, goalId, tx);

  if (!progress) {
    throw new AppError("Goal not found.", 404);
  }

  const targetCents = moneyToCents(progress.goal.targetAmount);
  const savedCents = moneyToCents(progress.savedAmountDecimal || "0.00", "Goal amount cannot be negative.", {
    allowZero: true,
  });
  const shouldComplete = savedCents >= targetCents;
  const wasCompleted = progress.goal.status === "COMPLETED";

  const updatedGoal = await updateGoalRecord(
    userId,
    goalId,
    {
      savedAmount: progress.savedAmountDecimal,
      ...(shouldComplete ? { status: "COMPLETED" } : {}),
    },
    tx
  );

  return {
    goal: updatedGoal,
    progress,
    completed: shouldComplete && !wasCompleted,
  };
}

export async function createGoal(userId, body = {}) {
  const payload = cleanGoalPayload(body);
  validateGoalPayload(payload);

  if (!payload.duration && !payload.deadline) {
    throw new AppError("Goal deadline is required.", 400);
  }

  try {
    const createdGoal = await prisma.$transaction(async (tx) => {
      if (payload.status === "ACTIVE") {
        await assertSingleActiveGoal(userId, null, tx);
      }

      if (typeof body.roundUpRule !== "undefined") {
        await tx.user.update({
          where: {
            id: String(userId),
          },
          data: {
            roundUpRule: assertRoundUpRule(body.roundUpRule),
          },
        });
      }

      const goal = await createGoalRecord(
        userId,
        {
          name: payload.name,
          targetAmount: payload.targetAmountDecimal,
          savedAmount: "0.00",
          status: payload.status,
          startDate: payload.startDate,
          deadline: payload.deadline,
          expectedCompletionDate: payload.expectedCompletionDate,
          template: payload.template,
        },
        tx
      );

      await tx.outboxEvent.create({
        data: {
          relatedId: goal.id,
          eventType: "goal.created",
          payload: {
            userId: String(userId),
            goalId: goal.id,
            targetAmount: payload.targetAmountDecimal,
          },
        },
      });

      return goal;
    });

    return serializeGoalWithProgress(userId, createdGoal);
  } catch (error) {
    mapUniqueGoalError(error);
  }
}

export async function getGoals(userId) {
  const goals = await getGoalsByUserId(userId);
  return Promise.all(goals.map((goal) => serializeGoalWithProgress(userId, goal)));
}

export async function getActiveGoal(userId) {
  const goal = await getActiveGoalByUserId(userId);
  return serializeGoalWithProgress(userId, goal);
}

export async function updateGoal(userId, goalId, body = {}) {
  try {
    const updatedGoal = await prisma.$transaction(async (tx) => {
      const existingGoal = await getGoalById(userId, goalId, tx);

      if (!existingGoal) {
        throw new AppError("Goal not found.", 404);
      }

      const payload = cleanGoalPayload(body, existingGoal);
      validateGoalPayload(payload, { partial: true });

      if (payload.status === "ACTIVE") {
        await assertSingleActiveGoal(userId, existingGoal.id, tx);
      }

      const progress = await getGoalProgressRecord(userId, existingGoal.id, tx);
      const goal = await updateGoalRecord(
        userId,
        existingGoal.id,
        {
          name: payload.name,
          targetAmount: payload.targetAmountDecimal,
          savedAmount: progress?.savedAmountDecimal || "0.00",
          status: payload.status,
          startDate: payload.startDate,
          deadline: payload.deadline,
          expectedCompletionDate: payload.expectedCompletionDate,
          template: payload.template || null,
        },
        tx
      );

      await tx.outboxEvent.create({
        data: {
          relatedId: goal.id,
          eventType: "goal.updated",
          payload: {
            userId: String(userId),
            goalId: goal.id,
          },
        },
      });

      return goal;
    });

    return serializeGoalWithProgress(userId, updatedGoal);
  } catch (error) {
    mapUniqueGoalError(error);
  }
}

export async function closeGoal(userId, goalId) {
  const closedGoal = await prisma.$transaction(async (tx) => {
    const goal = await closeGoalRecord(userId, goalId, tx);

    if (!goal) {
      throw new AppError("Goal not found.", 404);
    }

    await tx.outboxEvent.create({
      data: {
        relatedId: goal.id,
        eventType: "goal.updated",
        payload: {
          userId: String(userId),
          goalId: goal.id,
          status: "closed",
        },
      },
    });

    return goal;
  });

  return serializeGoalWithProgress(userId, closedGoal);
}

async function getConfirmedSavingsReplay(userId, paymentIntent, tx) {
  const goal = paymentIntent.goalId ? await getGoalById(userId, paymentIntent.goalId, tx) : null;
  const serializedGoal = goal ? await serializeGoalWithProgress(userId, goal, tx) : null;

  return {
    message: "Savings already allocated.",
    status: "confirmed",
    amount: Number(paymentIntent.savingsAmount || paymentIntent.originalAmount || 0),
    goal: serializedGoal,
    paymentIntentId: paymentIntent.id,
    idempotencyKey: paymentIntent.idempotencyKey,
    replayed: true,
  };
}

async function postSavingsMovement({
  userId,
  goalId = null,
  amount,
  originalAmount = null,
  roundedAmount = null,
  idempotencyKey,
  description = "Savings allocation",
  metadata = {},
  tx,
}) {
  if (!idempotencyKey) {
    throw new AppError("Idempotency key is required for savings operations.", 400);
  }

  const normalizedAmount = normalizeMoney(amount, "Enter a valid savings amount.");
  const amountCents = moneyToCents(normalizedAmount);
  const wallet = await getWalletForUser(userId, tx);
  const availableFunds = getAccountByType(wallet, "available_funds");
  const savings = getAccountByType(wallet, "savings");

  if (!availableFunds || !savings) {
    throw new AppError("Wallet ledger accounts are not configured.", 500);
  }

  const existingIntent = await tx.paymentIntent.findUnique({
    where: {
      idempotencyKey,
    },
  });

  if (existingIntent) {
    const sameAmount = moneyToCents(existingIntent.savingsAmount || existingIntent.originalAmount) === amountCents;
    const sameGoal = String(existingIntent.goalId || "") === String(goalId || "");

    if (existingIntent.status === "CONFIRMED" && sameAmount && sameGoal) {
      return getConfirmedSavingsReplay(userId, existingIntent, tx);
    }

    throw new AppError("Savings operation is already being processed.", 409);
  }

  const goal = goalId ? await getGoalById(userId, goalId, tx) : null;

  if (goalId && !goal) {
    throw new AppError("Goal not found.", 404);
  }

  if (goal && goal.status !== "ACTIVE") {
    throw new AppError("Savings can only be allocated to an active goal.", 400);
  }

  const availableBalance = await getWalletBalance(wallet.id, tx, ["available_funds"]);
  if (Number(normalizedAmount) > availableBalance) {
    throw new AppError("Insufficient wallet balance.", 400);
  }

  const paymentIntent = await tx.paymentIntent.create({
    data: {
      userId: String(userId),
      walletId: wallet.id,
      goalId: goal?.id || null,
      type: metadata.type || "save",
      originalAmount: normalizeMoney(originalAmount || normalizedAmount),
      roundedAmount: normalizeMoney(roundedAmount || normalizedAmount),
      savingsAmount: normalizedAmount,
      status: "CREATED",
      roundingRule: metadata.roundingRule || null,
      idempotencyKey,
    },
  });

  await postDoubleEntry(tx, {
    paymentIntentId: paymentIntent.id,
    description,
    entries: [
      {
        ledgerAccountId: availableFunds.id,
        amount: normalizedAmount,
        side: "DEBIT",
        reference: idempotencyKey,
      },
      {
        ledgerAccountId: savings.id,
        amount: normalizedAmount,
        side: "CREDIT",
        reference: idempotencyKey,
      },
    ],
  });

  const confirmedIntent = await tx.paymentIntent.update({
    where: {
      id: paymentIntent.id,
    },
    data: {
      status: "CONFIRMED",
    },
  });

  let serializedGoal = null;
  let completed = false;

  if (goal) {
    const projection = await syncGoalProjection(userId, goal.id, tx);
    serializedGoal = serializeGoal(projection.goal, projection.progress);
    completed = projection.completed;
  }

  await tx.outboxEvent.create({
    data: {
      relatedId: confirmedIntent.id,
      eventType: "savings.allocated",
      payload: {
        userId: String(userId),
        walletId: wallet.id,
        goalId: goal?.id || null,
        paymentIntentId: confirmedIntent.id,
        amount: normalizedAmount,
        idempotencyKey,
        metadata,
      },
    },
  });

  if (completed && serializedGoal) {
    await tx.outboxEvent.create({
      data: {
        relatedId: serializedGoal.id,
        eventType: "goal.completed",
        payload: {
          userId: String(userId),
          goalId: serializedGoal.id,
          savedAmount: centsToMoney(moneyToCents(serializedGoal.savedAmount)),
          targetAmount: centsToMoney(moneyToCents(serializedGoal.targetAmount)),
        },
      },
    });
  }

  return {
    message: serializedGoal?.status === "completed" ? "Savings allocated and goal completed." : "Savings allocated successfully.",
    status: "confirmed",
    amount: Number(normalizedAmount),
    goal: serializedGoal,
    paymentIntentId: confirmedIntent.id,
    idempotencyKey,
    replayed: false,
  };
}

export async function allocateSavingsToGoal(userId, goalId, amount, metadata = {}) {
  if (!goalId) {
    throw new AppError("Goal is required for savings allocation.", 400);
  }

  return prisma.$transaction((tx) =>
    postSavingsMovement({
      userId,
      goalId,
      amount,
      idempotencyKey: metadata.idempotencyKey,
      description: metadata.description || "Manual savings allocation",
      metadata: {
        ...metadata,
        type: metadata.type || "save",
      },
      tx,
    })
  );
}

export async function roundUpSavings(userId, originalAmount, roundedAmount, goalId = null, metadata = {}) {
  const originalCents = moneyToCents(originalAmount, "Enter a valid original amount.");
  const roundedCents = moneyToCents(roundedAmount, "Enter a valid rounded amount.");
  const savingsCents = roundedCents - originalCents;

  if (savingsCents <= 0n) {
    return {
      message: "No round-up savings were generated.",
      status: "skipped",
      amount: 0,
      goal: null,
      replayed: false,
    };
  }

  return prisma.$transaction(async (tx) => {
    const resolvedGoal = goalId ? await getGoalById(userId, goalId, tx) : await getActiveGoalByUserId(userId, tx);

    return postSavingsMovement({
      userId,
      goalId: resolvedGoal?.id || null,
      amount: centsToMoney(savingsCents),
      originalAmount,
      roundedAmount,
      idempotencyKey: metadata.idempotencyKey,
      description: metadata.description || "Round-up savings allocation",
      metadata: {
        ...metadata,
        type: metadata.type || "round_up",
      },
      tx,
    });
  });
}

export async function creditActiveGoal(userId, amount, goalId = null, metadata = {}) {
  const idempotencyKey =
    metadata.idempotencyKey || `goal-credit-${userId}-${goalId || "active"}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const result = await prisma.$transaction(async (tx) => {
    const goal = goalId ? await getGoalById(userId, goalId, tx) : await getActiveGoalByUserId(userId, tx);

    if (!goal) return null;

    return postSavingsMovement({
      userId,
      goalId: goal.id,
      amount,
      idempotencyKey,
      description: metadata.description || "Goal savings allocation",
      metadata: {
        ...metadata,
        type: metadata.type || "save",
      },
      tx,
    });
  });

  return result?.goal || null;
}

export async function getGoalProgress(userId, goalId) {
  const progress = await getGoalProgressRecord(userId, goalId);

  if (!progress) {
    throw new AppError("Goal not found.", 404);
  }

  return {
    goalId: progress.goal.id,
    savedAmount: progress.savedAmount,
    targetAmount: Number(progress.goal.targetAmount || 0),
    progressPercent:
      Number(progress.goal.targetAmount || 0) > 0
        ? Math.min(100, Number(((progress.savedAmount / Number(progress.goal.targetAmount || 0)) * 100).toFixed(2)))
        : 0,
  };
}

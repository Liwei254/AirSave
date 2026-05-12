import Goal from "../models/Goal.js";
import AppError from "../utils/AppError.js";
import { updateRoundUpRule } from "./settingsService.js";
import { invalidateDashboardCache } from "./cacheService.js";

const oneActiveGoalMessage = "You can only have one active goal at a time.";
const validStatuses = ["active", "completed", "closed"];
const validDurationUnits = ["days", "weeks", "months", ""];

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function serializeGoal(goal) {
  if (!goal) return null;
  const raw = typeof goal.toObject === "function" ? goal.toObject() : goal;
  const currentAmount = Number(raw.currentAmount ?? raw.savedAmount ?? 0);
  const deadline = raw.deadline || raw.expectedCompletionDate || null;

  return {
    ...raw,
    currentAmount,
    savedAmount: currentAmount,
    deadline,
    expectedCompletionDate: raw.expectedCompletionDate || deadline,
  };
}

export async function findActiveGoal(userId, excludeGoalId = null) {
  const query = {
    user: userId,
    status: "active",
  };

  if (excludeGoalId) {
    query._id = { $ne: excludeGoalId };
  }

  return Goal.findOne(query).sort({ updatedAt: -1, createdAt: -1 });
}

function cleanGoalPayload(body = {}) {
  const cleanName = String(body.name || "").trim();
  const numericTarget = Number(body.targetAmount);
  const numericCurrent = Number(body.currentAmount ?? body.savedAmount ?? 0);
  const status = body.status || "active";
  const duration = String(body.duration || "").trim();
  const durationUnit = body.durationUnit || "";
  const deadline = parseOptionalDate(body.deadline || body.expectedCompletionDate);

  return {
    cleanName,
    numericTarget,
    numericCurrent,
    status,
    duration,
    durationUnit,
    deadline,
    template: String(body.template || "").trim(),
    startDate: parseOptionalDate(body.startDate),
  };
}

function validateGoalPayload(payload, { partial = false } = {}) {
  if (!partial || typeof payload.cleanName !== "undefined") {
    if (!payload.cleanName) {
      throw new AppError("Goal name is required.", 400);
    }
  }

  if (!partial || typeof payload.numericTarget !== "undefined") {
    if (!payload.numericTarget || payload.numericTarget <= 0) {
      throw new AppError("Enter a target amount greater than zero.", 400);
    }
  }

  if (payload.numericCurrent < 0) {
    throw new AppError("Goal amount cannot be negative.", 400);
  }

  if (payload.status && !validStatuses.includes(payload.status)) {
    throw new AppError("Invalid goal status.", 400);
  }

  if (payload.durationUnit && !validDurationUnits.includes(payload.durationUnit)) {
    throw new AppError("Invalid duration unit.", 400);
  }
}

export async function createGoal(userId, body = {}) {
  const payload = cleanGoalPayload(body);
  validateGoalPayload(payload);

  if (!payload.duration && !payload.deadline) {
    throw new AppError("Goal deadline is required.", 400);
  }

  if (payload.status === "active") {
    const existingGoal = await findActiveGoal(userId);

    if (existingGoal) {
      throw new AppError(oneActiveGoalMessage, 400);
    }
  }

  if (typeof body.roundUpRule !== "undefined") {
    await updateRoundUpRule(userId, body.roundUpRule);
  }

  try {
    const goal = await Goal.create({
      user: userId,
      name: payload.cleanName,
      targetAmount: payload.numericTarget,
      currentAmount: Math.max(0, payload.numericCurrent),
      savedAmount: Math.max(0, payload.numericCurrent),
      status: payload.status,
      duration: payload.duration,
      durationUnit: payload.durationUnit,
      template: payload.template,
      startDate: payload.startDate,
      deadline: payload.deadline,
      expectedCompletionDate: payload.deadline,
    });

    await invalidateDashboardCache(userId);
    return serializeGoal(goal);
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(oneActiveGoalMessage, 400);
    }
    throw error;
  }
}

export async function getGoals(userId) {
  const goals = await Goal.find({ user: userId }).sort({ status: 1, updatedAt: -1 });
  return goals.map(serializeGoal);
}

export async function getActiveGoal(userId) {
  const goal = await findActiveGoal(userId);
  return serializeGoal(goal);
}

export async function updateGoal(userId, goalId, body = {}) {
  const goal = await Goal.findOne({ _id: goalId, user: userId });

  if (!goal) {
    throw new AppError("Goal not found.", 404);
  }

  const payload = cleanGoalPayload({
    ...goal.toObject(),
    ...body,
  });
  validateGoalPayload(payload, { partial: true });

  if (payload.status === "active") {
    const existingGoal = await findActiveGoal(userId, goal._id);

    if (existingGoal) {
      throw new AppError(oneActiveGoalMessage, 400);
    }
  }

  goal.name = payload.cleanName;
  goal.targetAmount = payload.numericTarget;
  goal.currentAmount = Math.max(0, payload.numericCurrent);
  goal.savedAmount = Math.max(0, payload.numericCurrent);
  goal.status = payload.status;
  goal.duration = payload.duration;
  goal.durationUnit = payload.durationUnit;
  goal.template = payload.template;
  goal.startDate = payload.startDate || goal.startDate;
  goal.deadline = payload.deadline;
  goal.expectedCompletionDate = payload.deadline;

  if (goal.status === "completed") {
    const completionAmount = Math.max(Number(goal.currentAmount || 0), Number(goal.targetAmount || 0));
    goal.currentAmount = completionAmount;
    goal.savedAmount = completionAmount;
  }

  try {
    await goal.save();
    await invalidateDashboardCache(userId);
    return serializeGoal(goal);
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(oneActiveGoalMessage, 400);
    }
    throw error;
  }
}

export async function closeGoal(userId, goalId) {
  const goal = await Goal.findOne({ _id: goalId, user: userId });

  if (!goal) {
    throw new AppError("Goal not found.", 404);
  }

  goal.status = "closed";
  await goal.save();
  await invalidateDashboardCache(userId);

  return serializeGoal(goal);
}

export async function creditActiveGoal(userId, amount, goalId = null) {
  const numericAmount = Number(amount || 0);
  if (numericAmount <= 0) return null;

  const goal = goalId
    ? await Goal.findOne({ _id: goalId, user: userId, status: "active" })
    : await findActiveGoal(userId);

  if (!goal) return null;

  const nextAmount = Number(goal.currentAmount ?? goal.savedAmount ?? 0) + numericAmount;
  goal.savedAmount = nextAmount;
  goal.currentAmount = nextAmount;

  if (goal.currentAmount >= Number(goal.targetAmount || 0)) {
    goal.status = "completed";
  }

  await goal.save();
  await invalidateDashboardCache(userId);
  return serializeGoal(goal);
}

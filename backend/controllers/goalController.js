import Goal from "../models/Goal.js";
import User from "../models/User.js";

const oneActiveGoalMessage = "You can only have one active goal at a time.";
const validStatuses = ["active", "completed", "closed"];
const validDurationUnits = ["days", "weeks", "months", ""];

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializeGoal(goal) {
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

async function findActiveGoal(userId, excludeGoalId = null) {
  const query = {
    user: userId,
    status: "active",
  };

  if (excludeGoalId) {
    query._id = { $ne: excludeGoalId };
  }

  return Goal.findOne(query).sort({ updatedAt: -1, createdAt: -1 });
}

function getCleanGoalPayload(body) {
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
      return "Goal name is required.";
    }
  }

  if (!partial || typeof payload.numericTarget !== "undefined") {
    if (!payload.numericTarget || payload.numericTarget <= 0) {
      return "Enter a target amount greater than zero.";
    }
  }

  if (payload.numericCurrent < 0) {
    return "Goal amount cannot be negative.";
  }

  if (payload.status && !validStatuses.includes(payload.status)) {
    return "Invalid goal status.";
  }

  if (payload.durationUnit && !validDurationUnits.includes(payload.durationUnit)) {
    return "Invalid duration unit.";
  }

  return "";
}

async function updateRoundUpRuleIfProvided(req) {
  if (typeof req.body.roundUpRule === "undefined") return null;

  const numericRoundUpRule = Number(req.body.roundUpRule);
  if (![10, 50, 100].includes(numericRoundUpRule)) {
    return "Invalid round-up rule";
  }

  await User.findByIdAndUpdate(req.user._id, { roundUpRule: numericRoundUpRule });
  return null;
}

export const createGoal = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const payload = getCleanGoalPayload(req.body);
    const validationMessage = validateGoalPayload(payload);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    if (!payload.duration && !payload.deadline) {
      return res.status(400).json({ message: "Goal deadline is required." });
    }

    if (payload.status === "active") {
      const existingGoal = await findActiveGoal(userId);

      if (existingGoal) {
        return res.status(400).json({
          message: oneActiveGoalMessage,
        });
      }
    }

    const roundUpError = await updateRoundUpRuleIfProvided(req);
    if (roundUpError) {
      return res.status(400).json({ message: roundUpError });
    }

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

    return res.status(201).json(serializeGoal(goal));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: oneActiveGoalMessage });
    }

    return res.status(500).json({ message: error.message });
  }
};

export const getGoals = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const goals = await Goal.find({ user: userId }).sort({ status: 1, updatedAt: -1 });

    return res.status(200).json(goals.map(serializeGoal));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getActiveGoal = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const goal = await findActiveGoal(userId);

    return res.status(200).json({ goal: serializeGoal(goal) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateGoal = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const goal = await Goal.findOne({ _id: req.params.id, user: userId });

    if (!goal) {
      return res.status(404).json({ message: "Goal not found." });
    }

    const payload = getCleanGoalPayload({
      ...goal.toObject(),
      ...req.body,
    });
    const validationMessage = validateGoalPayload(payload, { partial: true });

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    if (payload.status === "active") {
      const existingGoal = await findActiveGoal(userId, goal._id);

      if (existingGoal) {
        return res.status(400).json({
          message: oneActiveGoalMessage,
        });
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

    await goal.save();

    return res.status(200).json(serializeGoal(goal));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: oneActiveGoalMessage });
    }

    return res.status(500).json({ message: error.message });
  }
};

export const deleteGoal = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const goal = await Goal.findOne({ _id: req.params.id, user: userId });

    if (!goal) {
      return res.status(404).json({ message: "Goal not found." });
    }

    goal.status = "closed";
    await goal.save();

    return res.status(200).json({
      message: "Goal closed successfully.",
      goal: serializeGoal(goal),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

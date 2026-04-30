import Goal from "../models/Goal.js";
import User from "../models/User.js";

const MAX_ACTIVE_GOALS = 5;

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const createGoal = async (req, res) => {
  try {
    const {
      name,
      targetAmount,
      duration,
      durationUnit = "",
      template = "",
      savedAmount = 0,
      status = "active",
      startDate,
      expectedCompletionDate,
      roundUpRule,
    } = req.body;
    const cleanName = String(name || "").trim();
    const numericTarget = Number(targetAmount);

    if (!cleanName || !numericTarget || numericTarget <= 0 || !duration) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (durationUnit && !["days", "weeks", "months"].includes(durationUnit)) {
      return res.status(400).json({ message: "Invalid duration unit" });
    }

    if (status && !["active", "completed"].includes(status)) {
      return res.status(400).json({ message: "Invalid goal status" });
    }

    const activeGoalsCount = await Goal.countDocuments({
      user: req.user._id,
      status: "active",
    });

    if (status === "active" && activeGoalsCount >= MAX_ACTIVE_GOALS) {
      return res.status(400).json({
        message: "You can only have 5 active goals. Complete or delete one first.",
      });
    }

    if (typeof roundUpRule !== "undefined") {
      const numericRoundUpRule = Number(roundUpRule);
      if (![10, 50, 100].includes(numericRoundUpRule)) {
        return res.status(400).json({ message: "Invalid round-up rule" });
      }

      await User.findByIdAndUpdate(req.user._id, { roundUpRule: numericRoundUpRule });
    }

    const goal = await Goal.create({
      user: req.user._id,
      name: cleanName,
      targetAmount: numericTarget,
      duration,
      durationUnit,
      template,
      savedAmount: Math.max(0, Number(savedAmount || 0)),
      status,
      startDate: parseOptionalDate(startDate),
      expectedCompletionDate: parseOptionalDate(expectedCompletionDate),
    });

    return res.status(201).json(goal);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user._id });

    return res.status(200).json(goals);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

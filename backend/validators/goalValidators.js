import { checkSchema } from "express-validator";

const validStatuses = ["active", "closed"];
const validDurationUnits = ["days", "weeks", "months", ""];

export const createGoalValidator = checkSchema({
  name: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Goal name is required" },
    isLength: {
      options: { max: 120 },
      errorMessage: "Goal name is too long",
    },
  },
  targetAmount: {
    in: ["body"],
    notEmpty: { errorMessage: "Target amount is required" },
    isFloat: {
      options: { gt: 0 },
      errorMessage: "Target amount must be greater than zero",
    },
    toFloat: true,
  },
  duration: {
    in: ["body"],
    optional: true,
    trim: true,
  },
  durationUnit: {
    in: ["body"],
    optional: true,
    isIn: {
      options: [validDurationUnits],
      errorMessage: "Invalid duration unit",
    },
  },
  deadline: {
    in: ["body"],
    optional: true,
    isISO8601: { errorMessage: "Goal deadline must be a valid date" },
  },
  expectedCompletionDate: {
    in: ["body"],
    optional: true,
    isISO8601: { errorMessage: "Goal deadline must be a valid date" },
  },
  status: {
    in: ["body"],
    optional: true,
    isIn: {
      options: [validStatuses],
      errorMessage: "Invalid goal status",
    },
  },
  roundUpRule: {
    in: ["body"],
    optional: true,
    isIn: {
      options: [[10, 50, 100, "10", "50", "100"]],
      errorMessage: "Round-up rule must be 10, 50, or 100",
    },
  },
});

export const updateGoalValidator = checkSchema({
  name: {
    in: ["body"],
    optional: true,
    trim: true,
    notEmpty: { errorMessage: "Goal name is required" },
    isLength: {
      options: { max: 120 },
      errorMessage: "Goal name is too long",
    },
  },
  targetAmount: {
    in: ["body"],
    optional: true,
    isFloat: {
      options: { gt: 0 },
      errorMessage: "Target amount must be greater than zero",
    },
    toFloat: true,
  },
  currentAmount: {
    in: ["body"],
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: "Goal amount cannot be negative",
    },
    toFloat: true,
  },
  savedAmount: {
    in: ["body"],
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: "Goal amount cannot be negative",
    },
    toFloat: true,
  },
  deadline: {
    in: ["body"],
    optional: true,
    isISO8601: { errorMessage: "Goal deadline must be a valid date" },
  },
  expectedCompletionDate: {
    in: ["body"],
    optional: true,
    isISO8601: { errorMessage: "Goal deadline must be a valid date" },
  },
  status: {
    in: ["body"],
    optional: true,
    isIn: {
      options: [validStatuses],
      errorMessage: "Invalid goal status",
    },
  },
});

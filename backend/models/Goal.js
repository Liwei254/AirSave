import mongoose from "mongoose";

const goalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: String,
      default: "",
    },
    durationUnit: {
      type: String,
      enum: ["days", "weeks", "months", ""],
      default: "",
    },
    template: {
      type: String,
      default: "",
    },
    startDate: {
      type: Date,
      default: null,
    },
    deadline: {
      type: Date,
      default: null,
    },
    expectedCompletionDate: {
      type: Date,
      default: null,
    },
    savedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "completed", "closed"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

goalSchema.index(
  { user: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  }
);

goalSchema.pre("validate", function syncGoalAmounts(next) {
  const savedAmount = Number(this.savedAmount || 0);
  const currentAmount = Number(this.currentAmount || 0);
  const normalizedAmount = Math.max(savedAmount, currentAmount, 0);

  this.savedAmount = normalizedAmount;
  this.currentAmount = normalizedAmount;

  if (!this.deadline && this.expectedCompletionDate) {
    this.deadline = this.expectedCompletionDate;
  }

  if (!this.expectedCompletionDate && this.deadline) {
    this.expectedCompletionDate = this.deadline;
  }

  next();
});

const Goal = mongoose.model("Goal", goalSchema);

export default Goal;

import mongoose from "mongoose";

const goalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: {
    type: String,
    required: true
  },
  targetAmount: {
    type: Number,
    required: true
  },
  duration: {
    type: String,
    default: ""
  },
  durationUnit: {
    type: String,
    enum: ["days", "weeks", "months", ""],
    default: ""
  },
  template: {
    type: String,
    default: ""
  },
  startDate: {
    type: Date,
    default: null
  },
  expectedCompletionDate: {
    type: Date,
    default: null
  },
  savedAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ["active", "completed"],
    default: "active"
  }
}, { timestamps: true });

const Goal = mongoose.model("Goal", goalSchema);

export default Goal;

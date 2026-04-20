import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wallet",
    required: true,
    index: true,
  },
  phone: {
    type: String,
    required: true,
    index: true,
  },
  originalAmount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  roundedAmount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  savingsAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  roundingType: {
    type: String,
    enum: ["10", "50", "100"],
    default: "10",
  },
  goal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Goal",
    default: null,
  },
  provider: {
    type: String,
    enum: ["mock-mobile-money"],
    default: "mock-mobile-money",
  },
  providerReference: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  callbackReference: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["initiated", "processing", "confirmed", "failed"],
    default: "initiated",
    index: true,
  },
  callbackPayload: {
    type: Object,
    default: null,
  },
  confirmedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

paymentSchema.index({ user: 1, createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;

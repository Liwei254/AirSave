import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
    },
    originalAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    roundedAmount: {
      type: Number,
      required: true,
    },
    savingsAmount: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      default: null,
    },
    savings: {
      type: Number,
      default: null,
    },
    merchant: {
      type: String,
      trim: true,
      maxlength: 140,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    transactionType: {
      type: String,
      enum: ["purchase", "bill", "send", "withdraw", "save"],
      default: "purchase",
      index: true,
    },
    roundingType: {
      type: String,
      enum: ["10", "50", "100"],
      required: true,
    },
    status: {
      type: String,
      enum: ["processing", "confirmed", "failed", "pending", "success"],
      default: "processing",
      index: true,
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      default: null,
    },
    goal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Goal",
      default: null,
    },
    ledgerRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
      default: null,
    },
    mpesaReceipt: String,
    checkoutRequestId: String,
    merchantRequestId: String,
    paymentReference: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    reference: {
      type: String,
      default: () => `TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ user: 1, createdAt: -1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;

import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  // 📱 PHONE (CRITICAL FOR M-PESA)
  phone: {
    type: String,
    required: true
  },

  // 💰 AMOUNTS
  originalAmount: {
    type: Number,
    required: true,
    min: 0.01
  },

  roundedAmount: {
    type: Number,
    required: true
  },

  savingsAmount: {
    type: Number,
    required: true
  },

  roundingType: {
    type: String,
    enum: ["10", "50", "100"],
    required: true
  },

  // 🧾 STATUS FLOW
  status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending"
  },

  // 🔗 REFERENCES (OPTIONAL NOW)
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wallet"
  },

  ledgerRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ledger",
    default: null
  },

  // 🔁 PAYMENT TRACKING
  mpesaReceipt: String,   // e.g. QK123ABC
  checkoutRequestId: String,
  merchantRequestId: String,

  reference: {
    type: String,
    default: () => `TXN-${uuidv4().slice(0, 8).toUpperCase()}`
  }

}, {
  timestamps: true
});

// 🔥 INDEX FOR FAST USER QUERIES
transactionSchema.index({ user: 1, createdAt: -1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
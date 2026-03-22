import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  originalAmount: {
    type: Number,
    required: true,
    min: [0.01, 'Amount must be greater than 0']
  },
  roundedAmount: {
    type: Number,
    required: true,
    min: [0.01, 'Rounded amount must be greater than 0']
  },
  savingsAmount: {
    type: Number,
    required: true,
    min: [0, 'Savings cannot be negative']
  },
  roundingType: {
    type: String,
    enum: ['10', '50', '100'],
    required: true
  },
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  ledgerRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ledger',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  reference: {
    type: String,
    default: () => `TXN-${uuidv4().slice(0, 8).toUpperCase()}`
  }
}, {
  timestamps: true
});

transactionSchema.index({ user: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;

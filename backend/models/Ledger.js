import mongoose from 'mongoose';

const ledgerSchema = new mongoose.Schema({
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount must be positive']
  },
  type: {
    type: String,
    enum: ['CREDIT', 'DEBIT'],
    required: true,
    index: true
  },
  reference: {
    type: String,
    required: true,
    index: true
  },
  description: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed',
    index: true
  }
}, {
  timestamps: true
});

// Index for efficient balance queries
ledgerSchema.index({ wallet: 1, createdAt: -1 });

const Ledger = mongoose.model('Ledger', ledgerSchema);

export default Ledger;

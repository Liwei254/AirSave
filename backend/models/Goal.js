import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  targetAmount: {
    type: Number,
    required: true,
    min: [0.01, 'Target must be positive']
  },
  currentAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  achieved: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused'],
    default: 'active'
  }
}, {
  timestamps: true
});

goalSchema.index({ user: 1, status: 1 });

const Goal = mongoose.model('Goal', goalSchema);

export default Goal;

const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Account name is required'],
    trim: true,
    maxlength: [100, 'Account name cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['checking', 'savings', 'credit', 'investment', 'cash'],
      message: 'Account type must be one of: checking, savings, credit, investment, cash'
    },
    required: [true, 'Account type is required']
  },
  balance: {
    type: Number,
    default: 0,
    set: function(val) {
      return Math.round(val * 100) / 100; // Round to 2 decimal places
    }
  },
  initialBalance: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: '#1976d2',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color']
  },
  icon: {
    type: String,
    default: 'account_balance'
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  bank: {
    name: String,
    accountNumber: String,
    routingNumber: String
  },
  creditLimit: {
    type: Number,
    default: 0,
    min: [0, 'Credit limit cannot be negative']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for available balance (for credit accounts)
accountSchema.virtual('availableBalance').get(function() {
  if (this.type === 'credit') {
    return this.creditLimit + this.balance; // Balance is negative for credit
  }
  return this.balance;
});

// Compound index for user queries
accountSchema.index({ userId: 1, isActive: 1 });

// Pre-save middleware
accountSchema.pre('save', function(next) {
  // Set initial balance on first save
  if (this.isNew) {
    this.initialBalance = this.balance;
  }
  next();
});

module.exports = mongoose.model('Account', accountSchema);
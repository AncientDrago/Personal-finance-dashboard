const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['income', 'expense'],
      message: 'Category type must be either income or expense'
    },
    required: [true, 'Category type is required']
  },
  color: {
    type: String,
    required: [true, 'Category color is required'],
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color']
  },
  icon: {
    type: String,
    default: 'category',
    maxlength: [50, 'Icon name cannot exceed 50 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
categorySchema.index({ userId: 1, type: 1 });
categorySchema.index({ userId: 1, isActive: 1 });

// Ensure category name is unique per user
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

// Pre-save middleware to handle default categories
categorySchema.pre('save', function(next) {
  // Ensure default categories cannot be deleted
  if (this.isDefault && !this.isActive) {
    return next(new Error('Default categories cannot be deactivated'));
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
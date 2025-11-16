const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const { validationResult } = require('express-validator');

// Get all categories for user
const getCategories = async (req, res) => {
  try {
    const { type, includeInactive = false } = req.query;
    
    const query = { userId: req.user.id };
    
    if (type && ['income', 'expense'].includes(type)) {
      query.type = type;
    }
    
    if (!includeInactive) {
      query.isActive = true;
    }

    const categories = await Category.find(query)
      .sort({ type: 1, sortOrder: 1, name: 1 })
      .lean();

    // Add transaction count and total amount for each category
    const categoriesWithStats = await Promise.all(
      categories.map(async (category) => {
        const stats = await Transaction.aggregate([
          {
            $match: {
              categoryId: category._id,
              userId: req.user._id
            }
          },
          {
            $group: {
              _id: null,
              transactionCount: { $sum: 1 },
              totalAmount: { $sum: '$amount' }
            }
          }
        ]);

        const categoryStats = stats[0] || { transactionCount: 0, totalAmount: 0 };

        return {
          ...category,
          transactionCount: categoryStats.transactionCount,
          totalAmount: categoryStats.totalAmount
        };
      })
    );

    // Group by type
    const groupedCategories = {
      income: categoriesWithStats.filter(cat => cat.type === 'income'),
      expense: categoriesWithStats.filter(cat => cat.type === 'expense')
    };

    res.json({
      success: true,
      data: type ? categoriesWithStats : groupedCategories,
      summary: {
        totalCategories: categoriesWithStats.length,
        incomeCategories: groupedCategories.income.length,
        expenseCategories: groupedCategories.expense.length,
        activeCategories: categoriesWithStats.filter(cat => cat.isActive).length
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching categories' 
    });
  }
};

// Get single category
const getCategory = async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!category) {
      return res.status(404).json({ 
        success: false,
        error: 'Category not found' 
      });
    }

    // Get category statistics
    const stats = await Transaction.aggregate([
      {
        $match: {
          categoryId: category._id,
          userId: req.user._id
        }
      },
      {
        $group: {
          _id: null,
          transactionCount: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    // Get recent transactions
    const recentTransactions = await Transaction.find({
      categoryId: category._id,
      userId: req.user.id
    })
    .populate('accountId', 'name type')
    .sort({ date: -1 })
    .limit(5)
    .lean();

    // Get monthly spending for this category (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await Transaction.aggregate([
      {
        $match: {
          categoryId: category._id,
          userId: req.user._id,
          date: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    const categoryStats = stats[0] || { 
      transactionCount: 0, 
      totalAmount: 0, 
      avgAmount: 0 
    };

    res.json({
      success: true,
      data: {
        ...category.toObject(),
        stats: categoryStats,
        recentTransactions,
        monthlyStats
      }
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching category' 
    });
  }
};

// Create category
const createCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const {
      name,
      type,
      color,
      icon = 'category',
      description,
      parentCategory,
      sortOrder = 0
    } = req.body;

    // Check if category name already exists for user and type
    const existingCategory = await Category.findOne({
      userId: req.user.id,
      name: name.trim(),
      type,
      isActive: true
    });

    if (existingCategory) {
      return res.status(400).json({ 
        success: false,
        error: 'Category with this name already exists for this type' 
      });
    }

    // Validate parent category if provided
    if (parentCategory) {
      const parent = await Category.findOne({
        _id: parentCategory,
        userId: req.user.id,
        type,
        isActive: true
      });

      if (!parent) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid parent category' 
        });
      }
    }

    // Create category
    const category = new Category({
      userId: req.user.id,
      name: name.trim(),
      type,
      color,
      icon,
      description: description?.trim(),
      parentCategory: parentCategory || null,
      sortOrder: Number(sortOrder)
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    console.error('Create category error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        error: 'Category with this name already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Server error while creating category' 
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const categoryId = req.params.id;
    const updates = req.body;

    // Find category
    const category = await Category.findOne({
      _id: categoryId,
      userId: req.user.id
    });

    if (!category) {
      return res.status(404).json({ 
        success: false,
        error: 'Category not found' 
      });
    }

    // Prevent updating default categories' core properties
    if (category.isDefault && (updates.name || updates.type)) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot modify name or type of default categories' 
      });
    }

    // Check if name is being changed and already exists
    if (updates.name && updates.name.trim() !== category.name) {
      const existingCategory = await Category.findOne({
        userId: req.user.id,
        name: updates.name.trim(),
        type: updates.type || category.type,
        isActive: true,
        _id: { $ne: categoryId }
      });

      if (existingCategory) {
        return res.status(400).json({ 
          success: false,
          error: 'Category with this name already exists' 
        });
      }
    }

    // Validate parent category if being updated
    if (updates.parentCategory) {
      const parent = await Category.findOne({
        _id: updates.parentCategory,
        userId: req.user.id,
        type: updates.type || category.type,
        isActive: true,
        _id: { $ne: categoryId } // Prevent self-referencing
      });

      if (!parent) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid parent category' 
        });
      }
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key === 'name' || key === 'description') {
        category[key] = updates[key]?.trim();
      } else if (key === 'sortOrder') {
        category[key] = Number(updates[key]);
      } else {
        category[key] = updates[key];
      }
    });

    await category.save();

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while updating category' 
    });
  }
};

// Delete/Deactivate category
const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Find category
    const category = await Category.findOne({
      _id: categoryId,
      userId: req.user.id
    });

    if (!category) {
      return res.status(404).json({ 
        success: false,
        error: 'Category not found' 
      });
    }

    // Prevent deletion of default categories
    if (category.isDefault) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot delete default categories' 
      });
    }

    // Check if category has transactions
    const transactionCount = await Transaction.countDocuments({
      categoryId: categoryId,
      userId: req.user.id
    });

    if (transactionCount > 0) {
      // Don't delete, just deactivate
      category.isActive = false;
      await category.save();

      return res.json({
        success: true,
        message: 'Category deactivated successfully (transactions preserved)'
      });
    }

    // If no transactions, safe to delete
    await Category.findByIdAndDelete(categoryId);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while deleting category' 
    });
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
};
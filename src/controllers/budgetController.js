const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Get all budgets for user
const getBudgets = async (req, res) => {
  try {
    const { period, isActive, categoryType } = req.query;
    
    const query = { userId: req.user.id };
    
    if (period) {
      query.period = period;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    let budgets = await Budget.find(query)
      .populate('categoryId', 'name color icon type')
      .sort({ createdAt: -1 })
      .lean();

    // Filter by category type if specified
    if (categoryType) {
      budgets = budgets.filter(budget => budget.categoryId.type === categoryType);
    }

    // Add spending data to each budget
    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        const actualSpending = await Transaction.aggregate([
          {
            $match: {
              userId: req.user._id,
              categoryId: budget.categoryId._id,
              type: 'expense',
              date: {
                $gte: budget.startDate,
                $lte: budget.endDate
              }
            }
          },
          {
            $group: {
              _id: null,
              totalSpent: { $sum: '$amount' },
              transactionCount: { $sum: 1 }
            }
          }
        ]);

        const spent = actualSpending[0]?.totalSpent || 0;
        const transactionCount = actualSpending[0]?.transactionCount || 0;
        const remaining = budget.amount - spent;
        const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        // Determine status
        let status = 'good';
        if (percentage > 100) {
          status = 'over';
        } else if (percentage >= budget.alertThreshold) {
          status = 'warning';
        }

        return {
          ...budget,
          spent: Math.round(spent * 100) / 100,
          remaining: Math.round(remaining * 100) / 100,
          percentage: Math.round(percentage * 100) / 100,
          status,
          transactionCount,
          daysRemaining: Math.max(0, Math.ceil((budget.endDate - new Date()) / (1000 * 60 * 60 * 24)))
        };
      })
    );

    // Calculate summary statistics
    const summary = {
      totalBudgets: budgetsWithSpending.length,
      activeBudgets: budgetsWithSpending.filter(b => b.isActive).length,
      overBudgetCount: budgetsWithSpending.filter(b => b.status === 'over').length,
      warningCount: budgetsWithSpending.filter(b => b.status === 'warning').length,
      totalBudgeted: budgetsWithSpending.reduce((sum, b) => sum + b.amount, 0),
      totalSpent: budgetsWithSpending.reduce((sum, b) => sum + b.spent, 0)
    };

    res.json({
      success: true,
      data: budgetsWithSpending,
      summary
    });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching budgets' 
    });
  }
};

// Get single budget
const getBudget = async (req, res) => {
  try {
    const budget = await Budget.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).populate('categoryId', 'name color icon type');

    if (!budget) {
      return res.status(404).json({ 
        success: false,
        error: 'Budget not found' 
      });
    }

    // Get detailed spending data
    const transactions = await Transaction.find({
      userId: req.user.id,
      categoryId: budget.categoryId._id,
      type: 'expense',
      date: {
        $gte: budget.startDate,
        $lte: budget.endDate
      }
    })
    .populate('accountId', 'name type')
    .sort({ date: -1 })
    .lean();

    // Calculate daily spending
    const dailySpending = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          categoryId: budget.categoryId._id,
          type: 'expense',
          date: {
            $gte: budget.startDate,
            $lte: budget.endDate
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            day: { $dayOfMonth: '$date' }
          },
          dailyTotal: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    const totalSpent = transactions.reduce((sum, txn) => sum + txn.amount, 0);
    const remaining = budget.amount - totalSpent;
    const percentage = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;

    // Determine status
    let status = 'good';
    if (percentage > 100) {
      status = 'over';
    } else if (percentage >= budget.alertThreshold) {
      status = 'warning';
    }

    res.json({
      success: true,
      data: {
        ...budget.toObject(),
        spent: Math.round(totalSpent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        percentage: Math.round(percentage * 100) / 100,
        status,
        transactions,
        dailySpending,
        daysRemaining: Math.max(0, Math.ceil((budget.endDate - new Date()) / (1000 * 60 * 60 * 24)))
      }
    });
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching budget' 
    });
  }
};

// Create budget
const createBudget = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const {
      categoryId,
      name,
      amount,
      period = 'monthly',
      startDate,
      endDate,
      alertThreshold = 80
    } = req.body;

    // Verify category belongs to user and is expense type
    const category = await Category.findOne({
      _id: categoryId,
      userId: req.user.id,
      type: 'expense',
      isActive: true
    });

    if (!category) {
      return res.status(404).json({ 
        success: false,
        error: 'Category not found or not an expense category' 
      });
    }

    // Check for overlapping budgets for the same category
    const overlappingBudget = await Budget.findOne({
      userId: req.user.id,
      categoryId,
      isActive: true,
      $or: [
        {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) }
        }
      ]
    });

    if (overlappingBudget) {
      return res.status(400).json({ 
        success: false,
        error: 'A budget for this category already exists in the specified date range' 
      });
    }

    // Validate date range
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ 
        success: false,
        error: 'End date must be after start date' 
      });
    }

    // Create budget
    const budget = new Budget({
      userId: req.user.id,
      categoryId,
      name: name.trim(),
      amount: Number(amount),
      period,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      alertThreshold: Number(alertThreshold)
    });

    await budget.save();

    // Populate category for response
    await budget.populate('categoryId', 'name color icon type');

    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: budget
    });
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while creating budget' 
    });
  }
};

// Update budget
const updateBudget = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const budgetId = req.params.id;
    const updates = req.body;

    // Find budget
    const budget = await Budget.findOne({
      _id: budgetId,
      userId: req.user.id
    });

    if (!budget) {
      return res.status(404).json({ 
        success: false,
        error: 'Budget not found' 
      });
    }

    // If category is being changed, verify new category
    if (updates.categoryId && updates.categoryId !== budget.categoryId.toString()) {
      const category = await Category.findOne({
        _id: updates.categoryId,
        userId: req.user.id,
        type: 'expense',
        isActive: true
      });

      if (!category) {
        return res.status(404).json({ 
          success: false,
          error: 'New category not found or not an expense category' 
        });
      }
    }

    // Validate date range if dates are being updated
    const newStartDate = updates.startDate ? new Date(updates.startDate) : budget.startDate;
    const newEndDate = updates.endDate ? new Date(updates.endDate) : budget.endDate;

    if (newStartDate >= newEndDate) {
      return res.status(400).json({ 
        success: false,
        error: 'End date must be after start date' 
      });
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key === 'name') {
        budget[key] = updates[key].trim();
      } else if (key === 'amount' || key === 'alertThreshold') {
        budget[key] = Number(updates[key]);
      } else if (key === 'startDate' || key === 'endDate') {
        budget[key] = new Date(updates[key]);
      } else {
        budget[key] = updates[key];
      }
    });

    await budget.save();

    // Populate category for response
    await budget.populate('categoryId', 'name color icon type');

    res.json({
      success: true,
      message: 'Budget updated successfully',
      data: budget
    });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while updating budget' 
    });
  }
};

// Delete budget
const deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!budget) {
      return res.status(404).json({ 
        success: false,
        error: 'Budget not found' 
      });
    }

    await Budget.findByIdAndDelete(budget._id);

    res.json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while deleting budget' 
    });
  }
};

module.exports = {
  getBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget
};
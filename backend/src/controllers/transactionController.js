const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Category = require('../models/Category');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Get all transactions for user
const getTransactions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      startDate, 
      endDate, 
      categoryId, 
      accountId,
      type,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { userId: req.user.id };

    // Date filtering
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Category filtering
    if (categoryId) {
      query.categoryId = categoryId;
    }

    // Account filtering
    if (accountId) {
      query.accountId = accountId;
    }

    // Type filtering
    if (type && ['income', 'expense'].includes(type)) {
      query.type = type;
    }

    // Search filtering
    if (search) {
      query.description = { $regex: search, $options: 'i' };
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const transactions = await Transaction.find(query)
      .populate('categoryId', 'name color icon type')
      .populate('accountId', 'name type color')
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    // Get total count for pagination
    const total = await Transaction.countDocuments(query);

    // Calculate summary statistics
    const stats = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = {
      totalIncome: stats.find(s => s._id === 'income')?.total || 0,
      totalExpenses: stats.find(s => s._id === 'expense')?.total || 0,
      transactionCount: stats.reduce((sum, s) => sum + s.count, 0)
    };
    summary.netAmount = summary.totalIncome - summary.totalExpenses;

    res.json({
      success: true,
      data: transactions,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: Number(limit),
        hasNext: Number(page) < Math.ceil(total / limit),
        hasPrev: Number(page) > 1
      },
      summary
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching transactions' 
    });
  }
};

// Get single transaction
const getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.id
    })
    .populate('categoryId', 'name color icon type')
    .populate('accountId', 'name type color');

    if (!transaction) {
      return res.status(404).json({ 
        success: false,
        error: 'Transaction not found' 
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching transaction' 
    });
  }
};

// Create transaction
const createTransaction = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const {
      accountId,
      categoryId,
      amount,
      description,
      date,
      type,
      isRecurring = false,
      recurringPattern,
      tags = []
    } = req.body;

    // Verify account belongs to user
    const account = await Account.findOne({ 
      _id: accountId, 
      userId: req.user.id,
      isActive: true
    });
    
    if (!account) {
      return res.status(404).json({ 
        success: false,
        error: 'Account not found or inactive' 
      });
    }

    // Verify category belongs to user and matches type
    const category = await Category.findOne({ 
      _id: categoryId, 
      userId: req.user.id,
      type: type,
      isActive: true
    });
    
    if (!category) {
      return res.status(404).json({ 
        success: false,
        error: 'Category not found, inactive, or type mismatch' 
      });
    }

    // Validate amount
    const transactionAmount = Math.abs(Number(amount));
    if (transactionAmount <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Amount must be greater than 0' 
      });
    }

    // Create transaction
    const transaction = new Transaction({
      userId: req.user.id,
      accountId,
      categoryId,
      amount: transactionAmount,
      description: description.trim(),
      date: new Date(date),
      type,
      isRecurring,
      recurringPattern: isRecurring ? recurringPattern : undefined,
      tags: Array.isArray(tags) ? tags.map(tag => tag.trim()).filter(Boolean) : []
    });

    await transaction.save();

    // Update account balance
    if (type === 'income') {
      account.balance += transactionAmount;
    } else {
      account.balance -= transactionAmount;
    }
    await account.save();

    // Populate transaction for response
    await transaction.populate([
      { path: 'categoryId', select: 'name color icon type' },
      { path: 'accountId', select: 'name type color' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while creating transaction' 
    });
  }
};

// Update transaction
const updateTransaction = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const transactionId = req.params.id;
    const updates = req.body;

    // Find existing transaction
    const existingTransaction = await Transaction.findOne({
      _id: transactionId,
      userId: req.user.id
    });

    if (!existingTransaction) {
      return res.status(404).json({ 
        success: false,
        error: 'Transaction not found' 
      });
    }

    // Store old values for balance calculation
    const oldAmount = existingTransaction.amount;
    const oldType = existingTransaction.type;
    const oldAccountId = existingTransaction.accountId.toString();

    // If account is being changed, verify new account
    if (updates.accountId && updates.accountId !== oldAccountId) {
      const newAccount = await Account.findOne({
        _id: updates.accountId,
        userId: req.user.id,
        isActive: true
      });
      
      if (!newAccount) {
        return res.status(404).json({ 
          success: false,
          error: 'New account not found or inactive' 
        });
      }
    }

    // If category is being changed, verify new category
    if (updates.categoryId) {
      const newCategory = await Category.findOne({
        _id: updates.categoryId,
        userId: req.user.id,
        type: updates.type || existingTransaction.type,
        isActive: true
      });
      
      if (!newCategory) {
        return res.status(404).json({ 
          success: false,
          error: 'New category not found, inactive, or type mismatch' 
        });
      }
    }

    // Update transaction
    Object.keys(updates).forEach(key => {
      if (key === 'amount') {
        existingTransaction[key] = Math.abs(Number(updates[key]));
      } else if (key === 'description') {
        existingTransaction[key] = updates[key].trim();
      } else if (key === 'tags') {
        existingTransaction[key] = Array.isArray(updates[key]) 
          ? updates[key].map(tag => tag.trim()).filter(Boolean) 
          : [];
      } else {
        existingTransaction[key] = updates[key];
      }
    });

    existingTransaction.updatedAt = new Date();
    await existingTransaction.save();

    // Update account balances
    const oldAccount = await Account.findById(oldAccountId);
    const newAccountId = existingTransaction.accountId.toString();
    const newAccount = oldAccountId === newAccountId 
      ? oldAccount 
      : await Account.findById(newAccountId);

    // Reverse old transaction effect
    if (oldType === 'income') {
      oldAccount.balance -= oldAmount;
    } else {
      oldAccount.balance += oldAmount;
    }

    // Apply new transaction effect
    if (existingTransaction.type === 'income') {
      newAccount.balance += existingTransaction.amount;
    } else {
      newAccount.balance -= existingTransaction.amount;
    }

    await oldAccount.save();
    if (oldAccountId !== newAccountId) {
      await newAccount.save();
    }

    // Populate and return updated transaction
    await existingTransaction.populate([
      { path: 'categoryId', select: 'name color icon type' },
      { path: 'accountId', select: 'name type color' }
    ]);

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: existingTransaction
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while updating transaction' 
    });
  }
};

// Delete transaction
const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({ 
        success: false,
        error: 'Transaction not found' 
      });
    }

    // Update account balance (reverse transaction effect)
    const account = await Account.findById(transaction.accountId);
    if (account) {
      if (transaction.type === 'income') {
        account.balance -= transaction.amount;
      } else {
        account.balance += transaction.amount;
      }
      await account.save();
    }

    // Delete transaction
    await Transaction.findByIdAndDelete(transaction._id);

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while deleting transaction' 
    });
  }
};
// Bulk import transactions
const bulkImportTransactions = async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid transactions data' 
      });
    }

    const validTransactions = [];
    const errors = [];

    // Get user's default account and categories
    const userAccounts = await Account.find({ 
      userId: req.user.id, 
      isActive: true 
    });
    
    const userCategories = await Category.find({ 
      userId: req.user.id, 
      isActive: true 
    });

    if (userAccounts.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No active accounts found. Please create an account first.' 
      });
    }

    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i];
      
      try {
        // Validate required fields
        if (!txn.amount || !txn.description || !txn.date) {
          errors.push({ 
            row: i + 1, 
            error: 'Missing required fields' 
          });
          continue;
        }

        const amount = Math.abs(parseFloat(txn.amount));
        if (isNaN(amount) || amount <= 0) {
          errors.push({ 
            row: i + 1, 
            error: 'Invalid amount' 
          });
          continue;
        }

        // Determine transaction type
        const type = parseFloat(txn.amount) >= 0 ? 'income' : 'expense';

        // Find category or use default
        let category = userCategories.find(cat => 
          cat.name.toLowerCase().includes((txn.category || 'other').toLowerCase()) && 
          cat.type === type
        );

        if (!category) {
          // Use first available category of the correct type
          category = userCategories.find(cat => cat.type === type);
        }

        if (!category) {
          errors.push({ 
            row: i + 1, 
            error: `No ${type} category found` 
          });
          continue;
        }

        // Use first available account
        const account = userAccounts[0];

        validTransactions.push({
          userId: req.user.id,
          accountId: account._id,
          categoryId: category._id,
          amount: amount,
          description: txn.description.trim(),
          date: new Date(txn.date),
          type: type,
          tags: txn.tags ? txn.tags.split(',').map(t => t.trim()).filter(Boolean) : []
        });

      } catch (error) {
        errors.push({ 
          row: i + 1, 
          error: error.message 
        });
      }
    }

    // Insert valid transactions
    let insertedTransactions = [];
    if (validTransactions.length > 0) {
      insertedTransactions = await Transaction.insertMany(validTransactions);

      // Update account balances
      const accountUpdates = new Map();
      
      for (const txn of validTransactions) {
        const accountId = txn.accountId.toString();
        const currentUpdate = accountUpdates.get(accountId) || 0;
        
        if (txn.type === 'income') {
          accountUpdates.set(accountId, currentUpdate + txn.amount);
        } else {
          accountUpdates.set(accountId, currentUpdate - txn.amount);
        }
      }

      // Apply balance updates
      for (const [accountId, balanceChange] of accountUpdates) {
        await Account.findByIdAndUpdate(
          accountId,
          { $inc: { balance: balanceChange } }
        );
      }
    }

    res.json({
      success: true,
      data: {
        imported: insertedTransactions.length,
        errors: errors.length,
        total: transactions.length,
        details: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error during bulk import' 
    });
  }
};

module.exports = {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkImportTransactions
};
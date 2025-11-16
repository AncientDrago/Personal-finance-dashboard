const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { validationResult } = require('express-validator');

// Get all accounts for user
const getAccounts = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;
    
    const query = { userId: req.user.id };
    if (!includeInactive) {
      query.isActive = true;
    }

    const accounts = await Account.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Calculate total balance
    const totalBalance = accounts
      .filter(account => account.isActive)
      .reduce((sum, account) => sum + account.balance, 0);

    // Add transaction count to each account
    const accountsWithStats = await Promise.all(
      accounts.map(async (account) => {
        const transactionCount = await Transaction.countDocuments({
          accountId: account._id,
          userId: req.user.id
        });

        return {
          ...account,
          transactionCount
        };
      })
    );

    res.json({
      success: true,
      data: accountsWithStats,
      summary: {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(acc => acc.isActive).length,
        totalBalance: Math.round(totalBalance * 100) / 100
      }
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching accounts' 
    });
  }
};

// Get single account
const getAccount = async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!account) {
      return res.status(404).json({ 
        success: false,
        error: 'Account not found' 
      });
    }

    // Get recent transactions for this account
    const recentTransactions = await Transaction.find({
      accountId: account._id,
      userId: req.user.id
    })
    .populate('categoryId', 'name color icon')
    .sort({ date: -1 })
    .limit(5)
    .lean();

    // Get account statistics
    const stats = await Transaction.aggregate([
      {
        $match: {
          accountId: account._id,
          userId: req.user._id
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const accountStats = {
      totalIncome: stats.find(s => s._id === 'income')?.total || 0,
      totalExpenses: stats.find(s => s._id === 'expense')?.total || 0,
      transactionCount: stats.reduce((sum, s) => sum + s.count, 0)
    };

    res.json({
      success: true,
      data: {
        ...account.toObject(),
        recentTransactions,
        stats: accountStats
      }
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching account' 
    });
  }
};

// Create account
const createAccount = async (req, res) => {
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
      balance = 0,
      color = '#1976d2',
      icon = 'account_balance',
      description,
      creditLimit = 0,
      bank
    } = req.body;

    // Check if account name already exists for user
    const existingAccount = await Account.findOne({
      userId: req.user.id,
      name: name.trim(),
      isActive: true
    });

    if (existingAccount) {
      return res.status(400).json({ 
        success: false,
        error: 'Account with this name already exists' 
      });
    }

    // Create account
    const account = new Account({
      userId: req.user.id,
      name: name.trim(),
      type,
      balance: Number(balance),
      color,
      icon,
      description: description?.trim(),
      creditLimit: type === 'credit' ? Number(creditLimit) : 0,
      bank: bank || undefined
    });

    await account.save();

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: account
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while creating account' 
    });
  }
};

// Update account
const updateAccount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const accountId = req.params.id;
    const updates = req.body;

    // Find account
    const account = await Account.findOne({
      _id: accountId,
      userId: req.user.id
    });

    if (!account) {
      return res.status(404).json({ 
        success: false,
        error: 'Account not found' 
      });
    }

    // Check if name is being changed and already exists
    if (updates.name && updates.name.trim() !== account.name) {
      const existingAccount = await Account.findOne({
        userId: req.user.id,
        name: updates.name.trim(),
        isActive: true,
        _id: { $ne: accountId }
      });

      if (existingAccount) {
        return res.status(400).json({ 
          success: false,
          error: 'Account with this name already exists' 
        });
      }
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key === 'name' || key === 'description') {
        account[key] = updates[key]?.trim();
      } else if (key === 'balance' || key === 'creditLimit') {
        account[key] = Number(updates[key]);
      } else {
        account[key] = updates[key];
      }
    });

    await account.save();

    res.json({
      success: true,
      message: 'Account updated successfully',
      data: account
    });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while updating account' 
    });
  }
};

// Delete/Deactivate account
const deleteAccount = async (req, res) => {
  try {
    const accountId = req.params.id;

    // Find account
    const account = await Account.findOne({
      _id: accountId,
      userId: req.user.id
    });

    if (!account) {
      return res.status(404).json({ 
        success: false,
        error: 'Account not found' 
      });
    }

    // Check if account has transactions
    const transactionCount = await Transaction.countDocuments({
      accountId: accountId,
      userId: req.user.id
    });

    if (transactionCount > 0) {
      // Don't delete, just deactivate
      account.isActive = false;
      await account.save();

      return res.json({
        success: true,
        message: 'Account deactivated successfully (transactions preserved)'
      });
    }

    // If no transactions, safe to delete
    await Account.findByIdAndDelete(accountId);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while deleting account' 
    });
  }
};

// Get account balance history
const getAccountBalanceHistory = async (req, res) => {
  try {
    const accountId = req.params.id;
    const { days = 30 } = req.query;

    // Verify account ownership
    const account = await Account.findOne({
      _id: accountId,
      userId: req.user.id
    });

    if (!account) {
      return res.status(404).json({ 
        success: false,
        error: 'Account not found' 
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    // Get transactions for balance calculation
    const transactions = await Transaction.find({
      accountId: accountId,
      userId: req.user.id,
      date: { $gte: startDate }
    })
    .sort({ date: 1 })
    .lean();

    // Calculate balance history
    let runningBalance = account.initialBalance;
    const balanceHistory = [];

    // Get transactions before start date to calculate starting balance
    const earlierTransactions = await Transaction.find({
      accountId: accountId,
      userId: req.user.id,
      date: { $lt: startDate }
    });

    earlierTransactions.forEach(txn => {
      if (txn.type === 'income') {
        runningBalance += txn.amount;
      } else {
        runningBalance -= txn.amount;
      }
    });

    // Add starting point
    balanceHistory.push({
      date: startDate,
      balance: runningBalance
    });

    // Calculate daily balances
    transactions.forEach(txn => {
      if (txn.type === 'income') {
        runningBalance += txn.amount;
      } else {
        runningBalance -= txn.amount;
      }

      balanceHistory.push({
        date: txn.date,
        balance: runningBalance,
        transaction: {
          id: txn._id,
          amount: txn.amount,
          type: txn.type,
          description: txn.description
        }
      });
    });

    res.json({
      success: true,
      data: {
        account: {
          id: account._id,
          name: account.name,
          currentBalance: account.balance
        },
        history: balanceHistory
      }
    });
  } catch (error) {
    console.error('Get balance history error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching balance history' 
    });
  }
};

module.exports = {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountBalanceHistory
};
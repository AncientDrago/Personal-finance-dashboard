const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Account = require('../models/Account');
const Category = require('../models/Category');
const mongoose = require('mongoose');

// Get spending analytics
const getSpendingAnalytics = async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    const userId = req.user.id;

    // Calculate date range
    let dateRange = {};
    const now = new Date();

    if (startDate && endDate) {
      dateRange = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      switch (period) {
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - 7);
          dateRange = { $gte: weekStart };
          break;
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          dateRange = { $gte: monthStart };
          break;
        case 'year':
          const yearStart = new Date(now.getFullYear(), 0, 1);
          dateRange = { $gte: yearStart };
          break;
        case '3months':
          const threeMonthsStart = new Date(now);
          threeMonthsStart.setMonth(now.getMonth() - 3);
          dateRange = { $gte: threeMonthsStart };
          break;
        case '6months':
          const sixMonthsStart = new Date(now);
          sixMonthsStart.setMonth(now.getMonth() - 6);
          dateRange = { $gte: sixMonthsStart };
          break;
      }
    }

    // Spending by category
    const spendingByCategory = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          type: 'expense',
          date: dateRange
        }
      },
      {
        $group: {
          _id: '$categoryId',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: '$category'
      },
      {
        $project: {
          categoryName: '$category.name',
          color: '$category.color',
          icon: '$category.icon',
          totalAmount: { $round: ['$totalAmount', 2] },
          transactionCount: 1,
          avgAmount: { $round: ['$avgAmount', 2] }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    // Income by category
    const incomeByCategory = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          type: 'income',
          date: dateRange
        }
      },
      {
        $group: {
          _id: '$categoryId',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: '$category'
      },
      {
        $project: {
          categoryName: '$category.name',
          color: '$category.color',
          icon: '$category.icon',
          totalAmount: { $round: ['$totalAmount', 2] },
          transactionCount: 1
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    // Monthly trend (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyTrend = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          date: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: {
            year: '$_id.year',
            month: '$_id.month'
          },
          income: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'income'] }, '$totalAmount', 0]
            }
          },
          expense: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'expense'] }, '$totalAmount', 0]
            }
          }
        }
      },
      {
        $project: {
          month: '$_id.month',
          year: '$_id.year',
          income: { $round: ['$income', 2] },
          expense: { $round: ['$expense', 2] },
          net: { $round: [{ $subtract: ['$income', '$expense'] }, 2] }
        }
      },
      {
        $sort: { year: 1, month: 1 }
      }
    ]);

    // Spending by account
    const spendingByAccount = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          date: dateRange
        }
      },
      {
        $group: {
          _id: {
            accountId: '$accountId',
            type: '$type'
          },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.accountId',
          income: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'income'] }, '$totalAmount', 0]
            }
          },
          expense: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'expense'] }, '$totalAmount', 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'accounts',
          localField: '_id',
          foreignField: '_id',
          as: 'account'
        }
      },
      {
        $unwind: '$account'
      },
      {
        $project: {
          accountName: '$account.name',
          accountType: '$account.type',
          color: '$account.color',
          income: { $round: ['$income', 2] },
          expense: { $round: ['$expense', 2] },
          net: { $round: [{ $subtract: ['$income', '$expense'] }, 2] }
        }
      },
      {
        $sort: { expense: -1 }
      }
    ]);

    // Recent transactions summary
    const recentTransactions = await Transaction.find({
      userId,
      date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    })
    .populate('categoryId', 'name color icon')
    .populate('accountId', 'name type')
    .sort({ date: -1 })
    .limit(10)
    .lean();

    // Calculate totals
    const totalIncome = incomeByCategory.reduce((sum, cat) => sum + cat.totalAmount, 0);
    const totalExpenses = spendingByCategory.reduce((sum, cat) => sum + cat.totalAmount, 0);
    const netIncome = totalIncome - totalExpenses;

    res.json({
      success: true,
      data: {
        spendingByCategory,
        incomeByCategory,
        monthlyTrend,
        spendingByAccount,
        recentTransactions,
        summary: {
          totalIncome: Math.round(totalIncome * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          netIncome: Math.round(netIncome * 100) / 100,
          period,
          dateRange: {
            start: Object.keys(dateRange).length ? dateRange.$gte : null,
            end: Object.keys(dateRange).length ? dateRange.$lte : null
          }
        }
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while generating analytics' 
    });
  }
};

// Get financial health score
const getFinancialHealth = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentDate = new Date();
    const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const thisMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    // Get last month's data
    const lastMonthData = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          date: {
            $gte: lastMonth,
            $lt: thisMonth
          }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    const income = lastMonthData.find(d => d._id === 'income')?.total || 0;
    const expenses = lastMonthData.find(d => d._id === 'expense')?.total || 0;

    // Calculate metrics
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    const expenseRatio = income > 0 ? (expenses / income) * 100 : 100;

    // Get account balances
    const accounts = await Account.find({ 
      userId, 
      isActive: true 
    });
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    // Calculate emergency fund (assuming 3-6 months of expenses)
    const monthlyExpenses = expenses;
    const emergencyFundRatio = monthlyExpenses > 0 ? totalBalance / (monthlyExpenses * 3) : 1;

    // Budget adherence
    const budgets = await Budget.find({
      userId,
      isActive: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });

    let budgetScore = 100;
    if (budgets.length > 0) {
      let totalBudgetVariance = 0;
      
      for (const budget of budgets) {
        const actualSpending = await Transaction.aggregate([
          {
            $match: {
              userId: new mongoose.Types.ObjectId(userId),
              categoryId: budget.categoryId,
              type: 'expense',
              date: { $gte: budget.startDate, $lte: budget.endDate }
            }
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const spent = actualSpending[0]?.total || 0;
        const variance = Math.abs(spent - budget.amount) / budget.amount;
        totalBudgetVariance += variance;
      }

      budgetScore = Math.max(0, 100 - (totalBudgetVariance / budgets.length) * 100);
    }

    // Debt-to-income ratio (for credit accounts)
    const creditAccounts = accounts.filter(acc => acc.type === 'credit');
    const totalDebt = creditAccounts.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
    const debtToIncomeRatio = income > 0 ? (totalDebt / income) * 100 : 0;

    // Calculate individual scores (0-100)
    const scores = {
      savingsRate: Math.min(100, Math.max(0, savingsRate * 5)), // 20% savings = 100 points
      budgetAdherence: Math.round(budgetScore),
      emergencyFund: Math.min(100, emergencyFundRatio * 100),
      expenseControl: Math.max(0, 100 - expenseRatio),
      debtManagement: Math.max(0, 100 - debtToIncomeRatio * 2) // 50% debt-to-income = 0 points
    };

    // Calculate overall score (weighted average)
    const overallScore = (
      scores.savingsRate * 0.25 +
      scores.budgetAdherence * 0.25 +
      scores.emergencyFund * 0.2 +
      scores.expenseControl * 0.15 +
      scores.debtManagement * 0.15
    );

    // Generate insights
    const insights = [];
    
    if (savingsRate < 10) {
      insights.push({
        type: 'warning',
        title: 'Low Savings Rate',
        description: `Your savings rate is ${Math.round(savingsRate)}%. Aim for at least 20% to improve financial health.`,
        action: 'Review your expenses and find areas to cut back'
      });
    } else if (savingsRate >= 20) {
      insights.push({
        type: 'success',
        title: 'Excellent Savings Rate',
        description: `Great job! You're saving ${Math.round(savingsRate)}% of your income.`,
        action: 'Consider increasing investments or building an emergency fund'
      });
    }

    if (emergencyFundRatio < 1) {
      insights.push({
        type: 'alert',
        title: 'Insufficient Emergency Fund',
        description: 'Build an emergency fund covering 3-6 months of expenses for financial security.',
        action: 'Start by saving a small amount each month consistently'
      });
    }

    if (budgetScore < 70) {
      insights.push({
        type: 'info',
        title: 'Budget Variance',
        description: 'You\'re frequently going over or under budget in several categories.',
        action: 'Review and adjust your budgets to be more realistic'
      });
    }

    if (debtToIncomeRatio > 30) {
      insights.push({
        type: 'warning',
        title: 'High Debt-to-Income Ratio',
        description: `Your debt-to-income ratio is ${Math.round(debtToIncomeRatio)}%. Consider debt reduction strategies.`,
        action: 'Focus on paying down high-interest debt first'
      });
    }

    if (insights.length === 0) {
      insights.push({
        type: 'success',
        title: 'Strong Financial Health',
        description: 'You\'re doing great across all financial health metrics!',
        action: 'Keep up the good work and consider advanced investment strategies'
      });
    }

    res.json({
      success: true,
      data: {
        overallScore: Math.round(overallScore),
        scores,
        metrics: {
          savingsRate: Math.round(savingsRate * 100) / 100,
          expenseRatio: Math.round(expenseRatio * 100) / 100,
          emergencyFundMonths: Math.round(emergencyFundRatio * 100) / 100,
          debtToIncomeRatio: Math.round(debtToIncomeRatio * 100) / 100,
          totalBalance: Math.round(totalBalance * 100) / 100,
          totalDebt: Math.round(totalDebt * 100) / 100
        },
        insights,
        period: {
          month: lastMonth.toISOString().slice(0, 7),
          income: Math.round(income * 100) / 100,
          expenses: Math.round(expenses * 100) / 100
        }
      }
    });
  } catch (error) {
    console.error('Financial health error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while calculating financial health' 
    });
  }
};

module.exports = {
  getSpendingAnalytics,
  getFinancialHealth
};
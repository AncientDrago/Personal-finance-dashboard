const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Category = require('../models/Category');
const Account = require('../models/Account');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Create default categories for new user
const createDefaultCategories = async (userId) => {
  const defaultCategories = [
    // Expense categories
    { name: 'Food & Dining', type: 'expense', color: '#FF6B6B', icon: 'restaurant' },
    { name: 'Transportation', type: 'expense', color: '#4ECDC4', icon: 'directions_car' },
    { name: 'Shopping', type: 'expense', color: '#45B7D1', icon: 'shopping_cart' },
    { name: 'Entertainment', type: 'expense', color: '#96CEB4', icon: 'movie' },
    { name: 'Bills & Utilities', type: 'expense', color: '#FFEAA7', icon: 'receipt' },
    { name: 'Healthcare', type: 'expense', color: '#DDA0DD', icon: 'local_hospital' },
    { name: 'Education', type: 'expense', color: '#FFB347', icon: 'school' },
    { name: 'Groceries', type: 'expense', color: '#98FB98', icon: 'shopping_basket' },
    { name: 'Other Expenses', type: 'expense', color: '#B0B0B0', icon: 'category' },
    
    // Income categories
    { name: 'Salary', type: 'income', color: '#98D8C8', icon: 'work' },
    { name: 'Freelance', type: 'income', color: '#F7DC6F', icon: 'laptop' },
    { name: 'Investment', type: 'income', color: '#BB8FCE', icon: 'trending_up' },
    { name: 'Business', type: 'income', color: '#85C1E9', icon: 'business' },
    { name: 'Other Income', type: 'income', color: '#F8C471', icon: 'account_balance' }
  ];

  const categories = defaultCategories.map(cat => ({
    ...cat,
    userId,
    isDefault: true
  }));

  await Category.insertMany(categories);
};

// Create default accounts for new user
const createDefaultAccounts = async (userId) => {
  const defaultAccounts = [
    {
      name: 'Main Checking',
      type: 'checking',
      balance: 0,
      color: '#1976d2',
      icon: 'account_balance',
      userId
    },
    {
      name: 'Savings',
      type: 'savings',
      balance: 0,
      color: '#388e3c',
      icon: 'savings',
      userId
    }
  ];

  await Account.insertMany(defaultAccounts);
};

// Register user
const register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { firstName, lastName, email, password, currency = 'USD' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'User with this email already exists' 
      });
    }

    // Create user
    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password,
      currency
    });

    await user.save();

    // Create default categories and accounts
    await Promise.all([
      createDefaultCategories(user._id),
      createDefaultAccounts(user._id)
    ]);

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    await user.updateLastLogin();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        currency: user.currency,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        error: 'User with this email already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Server error during registration' 
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ 
      email: email.toLowerCase() 
    }).select('+password');

    if (!user) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(400).json({ 
        success: false,
        error: 'Account is deactivated. Please contact support.' 
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    await user.updateLastLogin();

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        currency: user.currency,
        lastLogin: user.lastLogin,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error during login' 
    });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const user = req.user; // Set by auth middleware
    
    res.json({ 
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        currency: user.currency,
        monthlyIncome: user.monthlyIncome,
        lastLogin: user.lastLogin,
        preferences: user.preferences,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { firstName, lastName, currency, monthlyIncome, preferences } = req.body;
    const userId = req.user.id;

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      {
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        currency,
        monthlyIncome,
        preferences
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        currency: user.currency,
        monthlyIncome: user.monthlyIncome,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get user with password
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ 
        success: false,
        error: 'Current password is incorrect' 
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// Logout (client-side token removal, but we can track it)
const logout = async (req, res) => {
  try {
    // In a real app, you might want to blacklist the token
    // For now, we'll just send a success response
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  updateProfile,
  changePassword,
  logout
};
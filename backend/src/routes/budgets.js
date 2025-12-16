const express = require('express');
const { body } = require('express-validator');
const {
  getBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget
} = require('../controllers/budgetController');
const auth = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createBudgetValidation = [
  body('categoryId')
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Budget name is required and must be less than 100 characters'),
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than 0'),
  body('period')
    .optional()
    .isIn(['weekly', 'monthly', 'yearly'])
    .withMessage('Period must be weekly, monthly, or yearly'),
  body('startDate')
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .isISO8601()
    .withMessage('Valid end date is required'),
  body('alertThreshold')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Alert threshold must be between 0 and 100')
];

const updateBudgetValidation = [
  body('categoryId')
    .optional()
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Budget name must be less than 100 characters'),
  body('amount')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than 0'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required')
];

// Apply auth middleware to all routes
router.use(auth);

// Routes
router.get('/', getBudgets);
router.get('/:id', getBudget);
router.post('/', createBudgetValidation, createBudget);
router.put('/:id', updateBudgetValidation, updateBudget);
router.delete('/:id', deleteBudget);

module.exports = router;
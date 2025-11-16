const express = require('express');
const { body, query } = require('express-validator');
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction
} = require('../controllers/transactionController');
const auth = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createTransactionValidation = [
  body('accountId')
    .isMongoId()
    .withMessage('Valid account ID is required'),
  body('categoryId')
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than 0'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description is required and must be less than 500 characters'),
  body('date')
    .isISO8601()
    .withMessage('Valid date is required'),
  body('type')
    .isIn(['income', 'expense'])
    .withMessage('Type must be either income or expense'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
];

const updateTransactionValidation = [
  body('accountId')
    .optional()
    .isMongoId()
    .withMessage('Valid account ID is required'),
  body('categoryId')
    .optional()
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('amount')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than 0'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Valid date is required'),
  body('type')
    .optional()
    .isIn(['income', 'expense'])
    .withMessage('Type must be either income or expense')
];

const getTransactionsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be valid'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be valid')
];

// Apply auth middleware to all routes
router.use(auth);

// Routes
router.get('/', getTransactionsValidation, getTransactions);
router.get('/:id', getTransaction);
router.post('/', createTransactionValidation, createTransaction);
router.put('/:id', updateTransactionValidation, updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
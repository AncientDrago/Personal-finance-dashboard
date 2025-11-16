const express = require('express');
const { body } = require('express-validator');
const {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountBalanceHistory
} = require('../controllers/accountController');
const auth = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createAccountValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Account name is required and must be less than 100 characters'),
  body('type')
    .isIn(['checking', 'savings', 'credit', 'investment', 'cash'])
    .withMessage('Invalid account type'),
  body('balance')
    .optional()
    .isFloat()
    .withMessage('Balance must be a number'),
  body('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Color must be a valid hex color'),
  body('creditLimit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Credit limit must be a positive number')
];

const updateAccountValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Account name must be less than 100 characters'),
  body('type')
    .optional()
    .isIn(['checking', 'savings', 'credit', 'investment', 'cash'])
    .withMessage('Invalid account type'),
  body('balance')
    .optional()
    .isFloat()
    .withMessage('Balance must be a number'),
  body('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Color must be a valid hex color')
];

// Apply auth middleware to all routes
router.use(auth);

// Routes
router.get('/', getAccounts);
router.get('/:id', getAccount);
router.get('/:id/balance-history', getAccountBalanceHistory);
router.post('/', createAccountValidation, createAccount);
router.put('/:id', updateAccountValidation, updateAccount);
router.delete('/:id', deleteAccount);

module.exports = router;
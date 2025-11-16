const express = require('express');
const { query } = require('express-validator');
const {
  getSpendingAnalytics,
  getFinancialHealth
} = require('../controllers/analyticsController');
const auth = require('../middleware/auth');

const router = express.Router();

// Validation rules
const analyticsValidation = [
  query('period')
    .optional()
    .isIn(['week', 'month', '3months', '6months', 'year'])
    .withMessage('Period must be week, month, 3months, 6months, or year'),
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
router.get('/spending', analyticsValidation, getSpendingAnalytics);
router.get('/health', getFinancialHealth);

module.exports = router;
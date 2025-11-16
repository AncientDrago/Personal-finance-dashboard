const express = require('express');
const {
  upload,
  uploadTransactions,
  getUploadTemplate
} = require('../controllers/uploadController');
const { bulkImportTransactions } = require('../controllers/transactionController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/template', getUploadTemplate);
router.post('/transactions', upload, uploadTransactions);
router.post('/bulk-import', bulkImportTransactions); // Works if defined in controller

module.exports = router;

const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const unlinkAsync = promisify(fs.unlink);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV and Excel files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Parse CSV file
const parseCsvFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Normalize column names (remove spaces, make lowercase)
        const normalizedData = {};
        Object.keys(data).forEach(key => {
          const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, '_');
          normalizedData[normalizedKey] = data[key];
        });
        results.push(normalizedData);
      })
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

// Map CSV data to transaction format
const mapCsvToTransactions = (csvData) => {
  return csvData.map((row, index) => {
    try {
      // Common column mappings
      const amount = parseFloat(
        row.amount || 
        row.debit || 
        row.credit || 
        row.transaction_amount ||
        '0'
      );

      const description = 
        row.description || 
        row.memo || 
        row.payee || 
        row.transaction_description ||
        `Transaction ${index + 1}`;

      const date = 
        row.date || 
        row.transaction_date || 
        row.posting_date ||
        new Date().toISOString().split('T')[0];

      const category = 
        row.category || 
        row.type || 
        row.transaction_type ||
        'Other';

      // Determine transaction type
      let transactionType = 'expense';
      if (amount > 0 || row.type === 'income' || row.transaction_type === 'credit') {
        transactionType = 'income';
      }

      return {
        amount: Math.abs(amount),
        description: description.trim(),
        date: new Date(date),
        category: category.trim(),
        type: transactionType,
        tags: row.tags ? row.tags.split(',').map(t => t.trim()) : []
      };
    } catch (error) {
      console.error(`Error mapping row ${index + 1}:`, error);
      return null;
    }
  }).filter(Boolean);
};

// Upload and process file
const uploadTransactions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    const filePath = req.file.path;
    let transactions = [];

    try {
      // Parse based on file type
      if (path.extname(req.file.originalname).toLowerCase() === '.csv') {
        const csvData = await parseCsvFile(filePath);
        transactions = mapCsvToTransactions(csvData);
      } else {
        return res.status(400).json({ 
          success: false,
          error: 'Excel files not yet supported' 
        });
      }

      // Clean up uploaded file
      await unlinkAsync(filePath);

      if (transactions.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'No valid transactions found in file' 
        });
      }

      res.json({
        success: true,
        data: {
          transactions,
          count: transactions.length,
          preview: transactions.slice(0, 5)
        }
      });

    } catch (parseError) {
      try {
        await unlinkAsync(filePath);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
      throw parseError;
    }

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error processing file: ' + error.message 
    });
  }
};

// Get upload template
const getUploadTemplate = (req, res) => {
  const template = [
    {
      date: '2024-01-15',
      description: 'Grocery Shopping',
      amount: -85.50,
      category: 'Food & Dining',
      tags: 'groceries,weekly'
    },
    {
      date: '2024-01-16',
      description: 'Salary Deposit',
      amount: 3000.00,
      category: 'Salary',
      tags: 'income'
    }
  ];

  res.json({
    success: true,
    data: {
      template,
      instructions: {
        requiredColumns: ['date', 'description', 'amount'],
        optionalColumns: ['category', 'tags'],
        dateFormat: 'YYYY-MM-DD',
        amountFormat: 'Negative for expenses, positive for income'
      }
    }
  });
};

module.exports = {
  upload: upload.single('file'),
  uploadTransactions,
  getUploadTemplate
};
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access denied. No token provided.' 
      });
    }

    // Check if token starts with 'Bearer '
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access denied. Invalid token format.' 
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access denied. Token not found.' 
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          error: 'Access denied. User not found.' 
        });
      }

      if (!user.isActive) {
        return res.status(401).json({ 
          success: false, 
          error: 'Access denied. Account is deactivated.' 
        });
      }

      // Add user to request object
      req.user = user;
      next();

    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          error: 'Access denied. Token expired.' 
        });
      }
      
      return res.status(401).json({ 
        success: false, 
        error: 'Access denied. Invalid token.' 
      });
    }

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during authentication' 
    });
  }
};

module.exports = auth;
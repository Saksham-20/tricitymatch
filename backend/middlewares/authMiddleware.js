const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { User } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Check if user still exists and is active
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found or inactive.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication.'
    });
  }
};

const adminMiddleware = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during admin verification.'
    });
  }
};

const premiumMiddleware = async (req, res, next) => {
  try {
    if (req.user.subscriptionType === 'free' || !req.user.isSubscriptionActive()) {
      return res.status(403).json({
        success: false,
        message: 'Premium subscription required for this feature.'
      });
    }
    next();
  } catch (error) {
    console.error('Premium middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during premium verification.'
    });
  }
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  premiumMiddleware
};

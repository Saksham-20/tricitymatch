const jwt = require('jsonwebtoken');
const { User, Subscription } = require('../models');
const { Op } = require('sequelize');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Token is not valid or user is inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
      }
      next();
    });
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

// Middleware to require premium subscription for certain routes
const requirePremium = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const subscription = await Subscription.findOne({
      where: {
        userId,
        status: 'active',
        planType: { [Op.in]: ['premium', 'elite'] }
      }
    });

    if (!subscription) {
      return res.status(403).json({ 
        message: 'Premium subscription required',
        code: 'PREMIUM_REQUIRED'
      });
    }

    // Check if subscription has expired
    if (subscription.endDate && new Date() > new Date(subscription.endDate)) {
      // Update status to expired
      subscription.status = 'expired';
      await subscription.save();
      
      return res.status(403).json({ 
        message: 'Your subscription has expired',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    // Attach subscription to request for use in controllers
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('Premium check error:', error);
    res.status(500).json({ message: 'Error checking subscription status' });
  }
};

module.exports = { auth, adminAuth, requirePremium };


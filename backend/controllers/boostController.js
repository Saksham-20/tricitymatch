const { validationResult } = require('express-validator');
const { User, ProfileBoost, Payment } = require('../models');

// Get boost status
const getBoostStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    const isActive = user.isBoostActive();
    const boostExpiry = user.boostExpiry;

    // Get current active boost
    const activeBoost = await ProfileBoost.findOne({
      where: {
        userId,
        isActive: true,
        boostStartTime: { [Op.lte]: new Date() },
        boostEndTime: { [Op.gte]: new Date() }
      }
    });

    let remainingTime = 0;
    if (activeBoost) {
      remainingTime = activeBoost.getRemainingTime();
    }

    res.json({
      success: true,
      data: {
        isActive,
        boostExpiry,
        remainingTime,
        activeBoost: activeBoost ? activeBoost.toJSON() : null
      }
    });

  } catch (error) {
    console.error('Get boost status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching boost status'
    });
  }
};

// Get boost history
const getBoostHistory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const boosts = await ProfileBoost.findAndCountAll({
      where: { userId },
      include: [
        {
          model: Payment,
          as: 'payment',
          attributes: ['id', 'amount', 'status', 'createdAt']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        boosts: boosts.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(boosts.count / limit),
          totalCount: boosts.count,
          hasNext: offset + limit < boosts.count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get boost history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching boost history'
    });
  }
};

// Get active boosts (for admin or general stats)
const getActiveBoosts = async (req, res) => {
  try {
    const activeBoosts = await ProfileBoost.findAll({
      where: {
        isActive: true,
        boostStartTime: { [Op.lte]: new Date() },
        boostEndTime: { [Op.gte]: new Date() }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['name']
            }
          ]
        }
      ],
      order: [['boostStartTime', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        activeBoosts: activeBoosts.map(boost => ({
          id: boost.id,
          userId: boost.userId,
          userName: boost.user?.profile?.name,
          boostStartTime: boost.boostStartTime,
          boostEndTime: boost.boostEndTime,
          duration: boost.duration,
          remainingTime: boost.getRemainingTime()
        }))
      }
    });

  } catch (error) {
    console.error('Get active boosts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching active boosts'
    });
  }
};

module.exports = {
  getBoostStatus,
  getBoostHistory,
  getActiveBoosts
};

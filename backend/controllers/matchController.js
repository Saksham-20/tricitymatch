const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { User, Profile, Preference, Like, Shortlist, ProfileView, Notification } = require('../models');
const { calculateCompatibility, calculateKundliCompatibility } = require('../utils/compatibility');
const { sendMatchNotificationEmail } = require('../utils/emailService');

// Get suggested matches
const getSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get user's profile and preferences
    const userProfile = await Profile.findOne({ where: { userId } });
    const userPreference = await Preference.findOne({ where: { userId } });

    if (!userProfile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found. Please complete your profile first.'
      });
    }

    // Get already liked and shortlisted users
    const likedUsers = await Like.findAll({
      where: { userId },
      attributes: ['likedUserId']
    });
    const shortlistedUsers = await Shortlist.findAll({
      where: { userId },
      attributes: ['shortlistedUserId']
    });

    const excludedUserIds = [
      userId,
      ...likedUsers.map(like => like.likedUserId),
      ...shortlistedUsers.map(shortlist => shortlist.shortlistedUserId)
    ];

    // Build search criteria
    const whereClause = {
      userId: { [Op.notIn]: excludedUserIds },
      gender: { [Op.ne]: userProfile.gender } // Opposite gender
    };

    // Add age filter
    if (userPreference?.ageMin || userPreference?.ageMax) {
      const today = new Date();
      const ageConditions = {};
      
      if (userPreference.ageMin) {
        const maxBirthDate = new Date(today.getFullYear() - userPreference.ageMin, today.getMonth(), today.getDate());
        ageConditions[Op.lte] = maxBirthDate;
      }
      
      if (userPreference.ageMax) {
        const minBirthDate = new Date(today.getFullYear() - userPreference.ageMax - 1, today.getMonth(), today.getDate());
        ageConditions[Op.gte] = minBirthDate;
      }
      
      whereClause.dob = ageConditions;
    }

    // Add other filters
    if (userPreference?.religion) {
      whereClause.religion = userPreference.religion;
    }
    if (userPreference?.caste) {
      whereClause.caste = userPreference.caste;
    }
    if (userPreference?.education) {
      whereClause.education = userPreference.education;
    }
    if (userPreference?.city) {
      whereClause.city = userPreference.city;
    }

    // Get profiles
    const profiles = await Profile.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'subscriptionType', 'subscriptionExpiry'],
          where: { isActive: true }
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Calculate compatibility for each profile
    const suggestions = await Promise.all(
      profiles.rows.map(async (profile) => {
        const profilePreference = await Preference.findOne({ where: { userId: profile.userId } });
        const compatibility = calculateCompatibility(
          userProfile,
          profile,
          userPreference,
          profilePreference
        );

        return {
          ...profile.toJSON(),
          compatibility,
          age: profile.calculateAge()
        };
      })
    );

    // Sort by compatibility
    suggestions.sort((a, b) => b.compatibility - a.compatibility);

    res.json({
      success: true,
      data: {
        suggestions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(profiles.count / limit),
          totalCount: profiles.count,
          hasNext: offset + limit < profiles.count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching suggestions'
    });
  }
};

// Search profiles with filters
const searchProfiles = async (req, res) => {
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
    const {
      page = 1,
      limit = 20,
      ageMin,
      ageMax,
      heightMin,
      heightMax,
      religion,
      caste,
      education,
      profession,
      city,
      diet,
      smoking,
      drinking,
      kundliMatch,
      sortBy = 'compatibility'
    } = req.query;

    const offset = (page - 1) * limit;

    // Get user's profile
    const userProfile = await Profile.findOne({ where: { userId } });
    if (!userProfile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found. Please complete your profile first.'
      });
    }

    // Build search criteria
    const whereClause = {
      userId: { [Op.ne]: userId },
      gender: { [Op.ne]: userProfile.gender }
    };

    // Age filter
    if (ageMin || ageMax) {
      const today = new Date();
      const ageConditions = {};
      
      if (ageMin) {
        const maxBirthDate = new Date(today.getFullYear() - ageMin, today.getMonth(), today.getDate());
        ageConditions[Op.lte] = maxBirthDate;
      }
      
      if (ageMax) {
        const minBirthDate = new Date(today.getFullYear() - ageMax - 1, today.getMonth(), today.getDate());
        ageConditions[Op.gte] = minBirthDate;
      }
      
      whereClause.dob = ageConditions;
    }

    // Other filters
    if (heightMin) whereClause.height = { ...whereClause.height, [Op.gte]: heightMin };
    if (heightMax) whereClause.height = { ...whereClause.height, [Op.lte]: heightMax };
    if (religion) whereClause.religion = religion;
    if (caste) whereClause.caste = caste;
    if (education) whereClause.education = education;
    if (profession) whereClause.profession = profession;
    if (city) whereClause.city = city;
    if (diet) whereClause.diet = diet;
    if (smoking) whereClause.smoking = smoking;
    if (drinking) whereClause.drinking = drinking;

    // Kundli match filter (simplified)
    if (kundliMatch === 'true') {
      whereClause.kundliData = { [Op.ne]: null };
    }

    // Get profiles
    const profiles = await Profile.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'subscriptionType', 'subscriptionExpiry'],
          where: { isActive: true }
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: getSortOrder(sortBy)
    });

    // Calculate compatibility and add additional data
    const searchResults = await Promise.all(
      profiles.rows.map(async (profile) => {
        const profilePreference = await Preference.findOne({ where: { userId: profile.userId } });
        const userPreference = await Preference.findOne({ where: { userId } });
        
        const compatibility = calculateCompatibility(
          userProfile,
          profile,
          userPreference,
          profilePreference
        );

        // Check if already liked or shortlisted
        const isLiked = await Like.findOne({
          where: { userId, likedUserId: profile.userId }
        });
        const isShortlisted = await Shortlist.findOne({
          where: { userId, shortlistedUserId: profile.userId }
        });

        return {
          ...profile.toJSON(),
          compatibility,
          age: profile.calculateAge(),
          isLiked: !!isLiked,
          isShortlisted: !!isShortlisted
        };
      })
    );

    res.json({
      success: true,
      data: {
        profiles: searchResults,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(profiles.count / limit),
          totalCount: profiles.count,
          hasNext: offset + limit < profiles.count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Search profiles error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching profiles'
    });
  }
};

// Like a profile
const likeProfile = async (req, res) => {
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
    const { likedUserId } = req.body;

    // Check if already liked
    const existingLike = await Like.findOne({
      where: { userId, likedUserId }
    });

    if (existingLike) {
      return res.status(400).json({
        success: false,
        message: 'Profile already liked'
      });
    }

    // Check if it's a mutual like
    const mutualLike = await Like.findOne({
      where: { userId: likedUserId, likedUserId: userId }
    });

    // Create like
    const like = await Like.create({
      userId,
      likedUserId,
      isMutual: !!mutualLike
    });

    // If mutual like, update the other like as well
    if (mutualLike) {
      await mutualLike.update({ isMutual: true });
    }

    // Get liked user's profile for notification
    const likedUser = await User.findByPk(likedUserId, {
      include: [{ model: Profile, as: 'profile' }]
    });

    // Create notification
    await Notification.create({
      userId: likedUserId,
      type: 'like',
      title: 'New Like!',
      content: `${req.user.profile?.name || 'Someone'} liked your profile`,
      data: { likerId: userId }
    });

    // Send email notification if user has email
    if (likedUser?.email) {
      try {
        await sendMatchNotificationEmail(
          likedUser.email,
          likedUser.profile?.name || 'User',
          req.user.profile?.name || 'Someone'
        );
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
      }
    }

    res.json({
      success: true,
      message: mutualLike ? 'It\'s a match! 🎉' : 'Profile liked successfully',
      data: {
        isMatch: !!mutualLike,
        like: like.toJSON()
      }
    });

  } catch (error) {
    console.error('Like profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while liking profile'
    });
  }
};

// Shortlist a profile
const shortlistProfile = async (req, res) => {
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
    const { shortlistedUserId } = req.body;

    // Check if already shortlisted
    const existingShortlist = await Shortlist.findOne({
      where: { userId, shortlistedUserId }
    });

    if (existingShortlist) {
      return res.status(400).json({
        success: false,
        message: 'Profile already shortlisted'
      });
    }

    // Create shortlist
    const shortlist = await Shortlist.create({
      userId,
      shortlistedUserId
    });

    res.json({
      success: true,
      message: 'Profile shortlisted successfully',
      data: {
        shortlist: shortlist.toJSON()
      }
    });

  } catch (error) {
    console.error('Shortlist profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while shortlisting profile'
    });
  }
};

// Get who liked you (premium feature)
const getLikedBy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const likes = await Like.findAndCountAll({
      where: { likedUserId: userId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'subscriptionType'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['name', 'photos', 'age', 'city', 'profession']
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        likedBy: likes.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(likes.count / limit),
          totalCount: likes.count,
          hasNext: offset + limit < likes.count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get liked by error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching who liked you'
    });
  }
};

// Get my likes
const getMyLikes = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const likes = await Like.findAndCountAll({
      where: { userId },
      include: [
        {
          model: User,
          as: 'likedUser',
          attributes: ['id', 'email', 'subscriptionType'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['name', 'photos', 'age', 'city', 'profession']
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        myLikes: likes.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(likes.count / limit),
          totalCount: likes.count,
          hasNext: offset + limit < likes.count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get my likes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching your likes'
    });
  }
};

// Get shortlists
const getShortlists = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const shortlists = await Shortlist.findAndCountAll({
      where: { userId },
      include: [
        {
          model: User,
          as: 'shortlistedUser',
          attributes: ['id', 'email', 'subscriptionType'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['name', 'photos', 'age', 'city', 'profession']
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        shortlists: shortlists.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(shortlists.count / limit),
          totalCount: shortlists.count,
          hasNext: offset + limit < shortlists.count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get shortlists error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching shortlists'
    });
  }
};

// Remove from shortlist
const removeShortlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userId: shortlistedUserId } = req.params;

    const shortlist = await Shortlist.findOne({
      where: { userId, shortlistedUserId }
    });

    if (!shortlist) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found in shortlist'
      });
    }

    await shortlist.destroy();

    res.json({
      success: true,
      message: 'Profile removed from shortlist'
    });

  } catch (error) {
    console.error('Remove shortlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing from shortlist'
    });
  }
};

// Get Kundli match
const getKundliMatch = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId1, userId2 } = req.body;

    // Get profiles with Kundli data
    const profile1 = await Profile.findOne({ where: { userId: userId1 } });
    const profile2 = await Profile.findOne({ where: { userId: userId2 } });

    if (!profile1 || !profile2) {
      return res.status(404).json({
        success: false,
        message: 'One or both profiles not found'
      });
    }

    if (!profile1.kundliData || !profile2.kundliData) {
      return res.status(400).json({
        success: false,
        message: 'Kundli data not available for one or both profiles'
      });
    }

    const kundliCompatibility = calculateKundliCompatibility(
      profile1.kundliData,
      profile2.kundliData
    );

    res.json({
      success: true,
      data: {
        kundliCompatibility,
        profile1: {
          name: profile1.name,
          kundliData: profile1.kundliData
        },
        profile2: {
          name: profile2.name,
          kundliData: profile2.kundliData
        }
      }
    });

  } catch (error) {
    console.error('Get Kundli match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating Kundli match'
    });
  }
};

// Helper function to get sort order
const getSortOrder = (sortBy) => {
  switch (sortBy) {
    case 'recent':
      return [['createdAt', 'DESC']];
    case 'age':
      return [['dob', 'ASC']];
    case 'height':
      return [['height', 'DESC']];
    case 'compatibility':
    default:
      return [['createdAt', 'DESC']]; // Will be sorted by compatibility in the application
  }
};

module.exports = {
  getSuggestions,
  searchProfiles,
  likeProfile,
  shortlistProfile,
  getLikedBy,
  getMyLikes,
  getShortlists,
  removeShortlist,
  getKundliMatch
};

const { Profile, User, Match, Subscription } = require('../models');
const { Op } = require('sequelize');
const { calculateCompatibility } = require('../utils/compatibility');

// @route   GET /api/search
// @desc    Search profiles with filters
// @access  Private
exports.searchProfiles = async (req, res) => {
  try {
    const {
      ageMin,
      ageMax,
      heightMin,
      heightMax,
      city,
      education,
      profession,
      diet,
      smoking,
      drinking,
      interestTags,
      page = 1,
      limit = 20,
      sortBy = 'compatibility'
    } = req.query;

    const userId = req.user.id;
    const offset = (page - 1) * limit;

    // Get current user's profile for compatibility calculation
    const currentProfile = await Profile.findOne({ where: { userId } });
    if (!currentProfile) {
      return res.status(404).json({ message: 'Please complete your profile first' });
    }

    // Build where clause
    const where = {
      isActive: true,
      userId: { [Op.ne]: userId } // Exclude self
    };

    // Gender filter (opposite gender)
    const oppositeGender = currentProfile.gender === 'male' ? 'female' : 
                          currentProfile.gender === 'female' ? 'male' : 'other';
    where.gender = oppositeGender;

    // Age filter
    if (ageMin || ageMax) {
      const now = new Date();
      const minDate = ageMax ? new Date(now.getFullYear() - ageMax - 1, now.getMonth(), now.getDate()) : null;
      const maxDate = ageMin ? new Date(now.getFullYear() - ageMin, now.getMonth(), now.getDate()) : null;
      
      if (minDate && maxDate) {
        where.dateOfBirth = { [Op.between]: [minDate, maxDate] };
      } else if (minDate) {
        where.dateOfBirth = { [Op.lte]: minDate };
      } else if (maxDate) {
        where.dateOfBirth = { [Op.gte]: maxDate };
      }
    }

    // Height filter
    if (heightMin || heightMax) {
      where.height = {};
      if (heightMin) where.height[Op.gte] = heightMin;
      if (heightMax) where.height[Op.lte] = heightMax;
    }

    // City filter
    if (city) {
      where.city = city;
    }

    // Education filter
    if (education) {
      where.education = education;
    }

    // Profession filter
    if (profession) {
      where.profession = { [Op.iLike]: `%${profession}%` };
    }

    // Lifestyle filters
    if (diet) {
      where.diet = diet;
    }
    if (smoking) {
      where.smoking = smoking;
    }
    if (drinking) {
      where.drinking = drinking;
    }

    // Interest tags filter
    if (interestTags) {
      const tags = Array.isArray(interestTags) ? interestTags : [interestTags];
      where.interestTags = {
        [Op.overlap]: tags // PostgreSQL array overlap operator
      };
    }

    // Get profiles
    const profiles = await Profile.findAll({
      where,
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'status'],
          where: { status: 'active' }
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Calculate compatibility for each profile
    const profilesWithCompatibility = await Promise.all(
      profiles.map(async (profile) => {
        const compatibilityScore = calculateCompatibility(currentProfile, profile);
        
        // Check if already liked/shortlisted
        const match = await Match.findOne({
          where: {
            userId,
            matchedUserId: profile.userId
          }
        });

        const profileData = profile.toJSON();
        profileData.compatibilityScore = compatibilityScore;
        profileData.matchStatus = match ? match.action : null;
        profileData.isMutual = match ? match.isMutual : false;

        return profileData;
      })
    );

    // Sort by compatibility if requested
    if (sortBy === 'compatibility') {
      profilesWithCompatibility.sort((a, b) => 
        (b.compatibilityScore || 0) - (a.compatibilityScore || 0)
      );
    }

    // Get total count
    const total = await Profile.count({ where });

    res.json({
      success: true,
      profiles: profilesWithCompatibility,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/search/suggestions
// @desc    Get compatibility-based profile suggestions
// @access  Private
exports.getSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const currentProfile = await Profile.findOne({ where: { userId } });
    if (!currentProfile) {
      return res.status(404).json({ message: 'Please complete your profile first' });
    }

    // Get opposite gender
    const oppositeGender = currentProfile.gender === 'male' ? 'female' : 
                          currentProfile.gender === 'female' ? 'male' : 'other';

    // Get profiles user hasn't interacted with
    const interactedUserIds = await Match.findAll({
      where: { userId },
      attributes: ['matchedUserId']
    }).then(matches => matches.map(m => m.matchedUserId));

    const profiles = await Profile.findAll({
      where: {
        isActive: true,
        userId: { [Op.ne]: userId, [Op.notIn]: interactedUserIds },
        gender: oppositeGender
      },
      include: [
        {
          model: User,
          attributes: ['id', 'status'],
          where: { status: 'active' }
        }
      ],
      limit: limit * 2 // Get more to filter by compatibility
    });

    // Calculate compatibility and sort
    const profilesWithCompatibility = profiles.map(profile => ({
      profile,
      compatibilityScore: calculateCompatibility(currentProfile, profile)
    }));

    profilesWithCompatibility.sort((a, b) => 
      b.compatibilityScore - a.compatibilityScore
    );

    // Return top matches
    const topMatches = profilesWithCompatibility
      .slice(0, limit)
      .map(item => ({
        ...item.profile.toJSON(),
        compatibilityScore: item.compatibilityScore
      }));

    res.json({
      success: true,
      suggestions: topMatches
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


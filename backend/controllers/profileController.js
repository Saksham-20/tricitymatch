const { Profile, User, ProfileView, Subscription } = require('../models');
const { calculateCompatibility } = require('../utils/compatibility');
const path = require('path');

// Calculate profile completion percentage
const calculateCompletion = (profile) => {
  let completed = 0;
  let total = 0;

  // Basic Info (30%)
  total += 30;
  if (profile.firstName) completed += 5;
  if (profile.lastName) completed += 5;
  if (profile.gender) completed += 5;
  if (profile.dateOfBirth) completed += 5;
  if (profile.height) completed += 5;
  if (profile.weight) completed += 5;

  // Lifestyle (15%)
  total += 15;
  if (profile.skinTone) completed += 3;
  if (profile.diet) completed += 4;
  if (profile.smoking) completed += 4;
  if (profile.drinking) completed += 4;

  // Education & Profession (20%)
  total += 20;
  if (profile.education) completed += 5;
  if (profile.degree) completed += 5;
  if (profile.profession) completed += 5;
  if (profile.income) completed += 5;

  // Preferences (15%)
  total += 15;
  if (profile.preferredAgeMin && profile.preferredAgeMax) completed += 5;
  if (profile.preferredHeightMin && profile.preferredHeightMax) completed += 5;
  if (profile.preferredEducation) completed += 5;

  // Photos (10%)
  total += 10;
  if (profile.profilePhoto) completed += 5;
  if (profile.photos && profile.photos.length > 0) completed += 5;

  // Personality (10%)
  total += 10;
  if (profile.personalityValues) completed += 5;
  if (profile.familyPreferences) completed += 5;

  // Enhanced Features (10%)
  total += 10;
  if (profile.interestTags && profile.interestTags.length > 0) completed += 3;
  if (profile.profilePrompts && Object.keys(profile.profilePrompts).length > 0) completed += 3;
  if (profile.spotifyPlaylist) completed += 2;
  if (profile.languages && profile.languages.length > 0) completed += 2;

  return Math.round((completed / total) * 100);
};

// @route   GET /api/profile/me
// @desc    Get current user's profile
// @access  Private
exports.getMyProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({
      where: { userId: req.user.id },
      include: [{ model: User, attributes: ['email', 'phone', 'status'] }]
    });

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   PUT /api/profile/me
// @desc    Update user's profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ where: { userId: req.user.id } });

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Update profile fields
    const updateData = { ...req.body };
    
    // Handle photo uploads
    if (req.files) {
      if (req.files.photos) {
        const photoPaths = req.files.photos.map(file => 
          `/uploads/photos/${file.filename}`
        );
        updateData.photos = [...(profile.photos || []), ...photoPaths];
      }
      if (req.files.profilePhoto && req.files.profilePhoto[0]) {
        updateData.profilePhoto = `/uploads/photos/${req.files.profilePhoto[0].filename}`;
      }
    }

    await profile.update(updateData);
    
    // Recalculate completion percentage
    profile.completionPercentage = calculateCompletion(profile);
    await profile.save();

    res.json({
      success: true,
      profile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/profile/:userId
// @desc    Get user profile by ID (with privacy checks)
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user.id;

    // Check if viewing own profile
    if (userId === viewerId) {
      return exports.getMyProfile(req, res);
    }

    const profile = await Profile.findOne({
      where: { userId, isActive: true },
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'phone', 'status'],
          include: [{ model: Subscription, where: { status: 'active' }, required: false }]
        }
      ]
    });

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Check subscription for contact visibility
    const viewerSubscription = await Subscription.findOne({
      where: { userId: viewerId, status: 'active' }
    });

    const hasPremiumAccess = viewerSubscription && 
      ['premium', 'elite'].includes(viewerSubscription.planType);

    // Record profile view
    await ProfileView.create({
      viewerId,
      viewedUserId: userId
    });

    // Calculate compatibility
    const viewerProfile = await Profile.findOne({ where: { userId: viewerId } });
    let compatibilityScore = null;
    if (viewerProfile) {
      compatibilityScore = calculateCompatibility(viewerProfile, profile);
    }

    // Prepare response with privacy checks
    const profileData = profile.toJSON();
    if (!hasPremiumAccess) {
      profileData.User.phone = null;
      profileData.User.email = null;
      // Hide social media links from non-premium users
      profileData.socialMediaLinks = null;
    }

    res.json({
      success: true,
      profile: profileData,
      compatibilityScore,
      hasPremiumAccess
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/profile/me/stats
// @desc    Get profile engagement stats
// @access  Private
exports.getProfileStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Profile views this week
    const viewsThisWeek = await ProfileView.count({
      where: {
        viewedUserId: userId,
        createdAt: { [require('sequelize').Op.gte]: weekAgo }
      }
    });

    // Total profile views
    const totalViews = await ProfileView.count({
      where: { viewedUserId: userId }
    });

    // Likes received
    const { Match } = require('../models');
    const likesReceived = await Match.count({
      where: {
        matchedUserId: userId,
        action: 'like'
      }
    });

    // Likes by city
    const likesByCity = await Match.findAll({
      where: {
        matchedUserId: userId,
        action: 'like'
      },
      include: [{
        model: User,
        as: 'User',
        include: [{
          model: Profile,
          attributes: ['city']
        }]
      }],
      attributes: []
    });

    const cityCounts = {};
    likesByCity.forEach(match => {
      const city = match.User?.Profile?.city || 'Unknown';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });

    res.json({
      success: true,
      stats: {
        viewsThisWeek,
        totalViews,
        likesReceived,
        likesByCity: cityCounts
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


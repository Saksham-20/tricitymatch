const { Profile, User, ProfileView, Subscription, Match } = require('../models');
const { calculateCompatibility } = require('../utils/compatibility');
const { Op } = require('sequelize');
const path = require('path');

// Calculate profile completion percentage based on IMPORTANT fields only
const calculateCompletion = (profile) => {
  if (!profile) return 0;
  
  let completed = 0;
  let total = 0;

  // ===== REQUIRED FIELDS (40%) - Must have for basic profile =====
  total += 40;
  if (profile.firstName && profile.firstName.trim()) completed += 8;
  if (profile.lastName && profile.lastName.trim()) completed += 8;
  if (profile.gender) completed += 8;
  if (profile.dateOfBirth) completed += 8;
  if (profile.city && profile.city.trim()) completed += 8;

  // ===== IMPORTANT FIELDS (50%) - Highly recommended =====
  total += 50;
  
  // Physical Info (10%)
  if (profile.height) completed += 5;
  if (profile.weight) completed += 5;
  
  // Education & Career (15%)
  if (profile.education && profile.education.trim()) completed += 7.5;
  if (profile.profession && profile.profession.trim()) completed += 7.5;
  
  // Profile Photo (10%) - Very important for matches
  if (profile.profilePhoto) completed += 10;
  
  // Bio (10%) - Important for personality
  if (profile.bio && profile.bio.trim().length >= 20) completed += 10;
  
  // Lifestyle Preferences (5%) - At least one lifestyle field
  let lifestyleCount = 0;
  if (profile.diet) lifestyleCount++;
  if (profile.smoking) lifestyleCount++;
  if (profile.drinking) lifestyleCount++;
  if (lifestyleCount > 0) completed += 5;

  // ===== OPTIONAL ENHANCEMENTS (10%) - Nice to have =====
  total += 10;
  
  // Additional photos
  if (profile.photos && profile.photos.length > 0) completed += 3;
  
  // Personality info
  if (profile.personalityValues && Object.keys(profile.personalityValues).length > 0) completed += 2;
  if (profile.familyPreferences && Object.keys(profile.familyPreferences).length > 0) completed += 2;
  
  // Interest tags
  if (profile.interestTags && profile.interestTags.length > 0) completed += 3;

  // Calculate percentage
  const percentage = Math.round((completed / total) * 100);
  
  // Cap at 100% and ensure minimum is 0%
  return Math.max(0, Math.min(100, percentage));
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

    // Always recalculate completion percentage to ensure accuracy
    const profileData = profile.toJSON();
    const calculatedCompletion = calculateCompletion(profileData);
    
    // Update if different from stored value
    if (profile.completionPercentage !== calculatedCompletion) {
      profile.completionPercentage = calculatedCompletion;
      await profile.save();
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

    // Update profile with new data
    await profile.update(updateData);
    
    // Reload to get all fields including JSONB fields that might have been updated
    await profile.reload();
    
    // Recalculate completion percentage with fresh data
    // Convert to plain object to ensure all fields are accessible
    const profileData = profile.toJSON();
    const completion = calculateCompletion(profileData);
    
    // Update completion percentage
    profile.completionPercentage = completion;
    await profile.save();
    
    // Final reload to return updated profile
    await profile.reload();

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

    // Check if viewer has already liked or shortlisted this profile
    const existingMatch = await Match.findOne({
      where: {
        userId: viewerId,
        matchedUserId: userId
      }
    });

    const isLiked = existingMatch && existingMatch.action === 'like';
    const isShortlisted = existingMatch && existingMatch.action === 'shortlist';

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
      hasPremiumAccess,
      isLiked,
      isShortlisted
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

    // Run all independent queries in parallel for better performance
    const [viewsThisWeek, totalViews, likesReceived, likesByCity] = await Promise.all([
      // Profile views this week
      ProfileView.count({
        where: {
          viewedUserId: userId,
          createdAt: { [Op.gte]: weekAgo }
        }
      }),
      
      // Total profile views
      ProfileView.count({
        where: { viewedUserId: userId }
      }),
      
      // Likes received
      Match.count({
        where: {
          matchedUserId: userId,
          action: 'like'
        }
      }),
      
      // Likes by city (still need join for city data)
      Match.findAll({
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
        attributes: ['id']
      })
    ]);

    // Process city counts in memory
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


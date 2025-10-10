const { validationResult } = require('express-validator');
const { User, Profile, Preference, ProfileView, Notification } = require('../models');
const { calculateCompatibility } = require('../utils/compatibility');
const { sendMatchNotificationEmail } = require('../utils/emailService');

// Get my profile
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Profile, as: 'profile' },
        { model: Preference, as: 'preference' }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toJSON(),
        profile: user.profile?.toJSON(),
        preference: user.preference?.toJSON()
      }
    });

  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const profileData = req.body;
    const profile = await Profile.findOne({ where: { userId: req.user.id } });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Update profile
    await profile.update(profileData);
    
    // Update completion status
    await profile.updateCompletionStatus();

    // Fetch updated profile
    const updatedProfile = await Profile.findByPk(profile.id, {
      include: [{ model: User, as: 'user' }]
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        profile: updatedProfile.toJSON(),
        completionPercentage: updatedProfile.profileCompletionPercentage
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
};

// Upload photo
const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo uploaded'
      });
    }

    const profile = await Profile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    const photos = profile.photos || [];
    
    // Check photo limit (max 5 photos)
    if (photos.length >= 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 photos allowed'
      });
    }

    // Add new photo
    const photoUrl = `/uploads/profiles/${req.file.filename}`;
    photos.push({
      id: Date.now().toString(),
      url: photoUrl,
      isPrimary: photos.length === 0, // First photo is primary
      uploadedAt: new Date().toISOString()
    });

    await profile.update({ photos });
    await profile.updateCompletionStatus();

    res.json({
      success: true,
      message: 'Photo uploaded successfully',
      data: {
        photo: {
          id: photos[photos.length - 1].id,
          url: photoUrl,
          isPrimary: photos[photos.length - 1].isPrimary
        },
        totalPhotos: photos.length
      }
    });

  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading photo'
    });
  }
};

// Delete photo
const deletePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const profile = await Profile.findOne({ where: { userId: req.user.id } });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    const photos = profile.photos || [];
    const photoIndex = photos.findIndex(photo => photo.id === photoId);

    if (photoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Remove photo
    photos.splice(photoIndex, 1);

    // If deleted photo was primary, make first remaining photo primary
    if (photos.length > 0 && !photos.some(photo => photo.isPrimary)) {
      photos[0].isPrimary = true;
    }

    await profile.update({ photos });
    await profile.updateCompletionStatus();

    res.json({
      success: true,
      message: 'Photo deleted successfully',
      data: {
        totalPhotos: photos.length
      }
    });

  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting photo'
    });
  }
};

// Verify identity
const verifyIdentity = async (req, res) => {
  try {
    const profile = await Profile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    const verificationDocs = {};
    
    // Process uploaded files
    if (req.files) {
      Object.keys(req.files).forEach(fieldName => {
        const file = req.files[fieldName][0];
        verificationDocs[fieldName] = {
          filename: file.filename,
          url: `/uploads/profiles/${file.filename}`,
          uploadedAt: new Date().toISOString()
        };
      });
    }

    // Update verification status
    await profile.update({
      verificationStatus: 'pending',
      verificationDocs: { ...profile.verificationDocs, ...verificationDocs }
    });

    // Create notification for admin
    await Notification.create({
      userId: req.user.id,
      type: 'admin_message',
      title: 'Identity Verification Request',
      content: 'User has submitted identity verification documents',
      data: { verificationDocs }
    });

    res.json({
      success: true,
      message: 'Identity verification documents uploaded successfully. Admin will review and approve.',
      data: {
        verificationStatus: 'pending',
        documentsUploaded: Object.keys(verificationDocs)
      }
    });

  } catch (error) {
    console.error('Verify identity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading verification documents'
    });
  }
};

// Get profile completion status
const getProfileCompletion = async (req, res) => {
  try {
    const profile = await Profile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    const completionPercentage = profile.calculateCompletionPercentage();
    const isComplete = completionPercentage >= 80;

    res.json({
      success: true,
      data: {
        completionPercentage,
        isComplete,
        missingFields: getMissingFields(profile),
        nextSteps: getNextSteps(profile)
      }
    });

  } catch (error) {
    console.error('Get profile completion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile completion'
    });
  }
};

// Update preferences
const updatePreferences = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const preferenceData = req.body;
    let preference = await Preference.findOne({ where: { userId: req.user.id } });

    if (!preference) {
      preference = await Preference.create({
        userId: req.user.id,
        ...preferenceData
      });
    } else {
      await preference.update(preferenceData);
    }

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        preference: preference.toJSON()
      }
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating preferences'
    });
  }
};

// Get profile by ID (for viewing other profiles)
const getProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.user.id;

    // Don't allow viewing own profile through this endpoint
    if (id === viewerId) {
      return res.status(400).json({
        success: false,
        message: 'Use /profile/me to view your own profile'
      });
    }

    const profile = await Profile.findOne({
      where: { userId: id },
      include: [
        { 
          model: User, 
          as: 'user',
          attributes: ['id', 'email', 'phone', 'subscriptionType', 'subscriptionExpiry']
        }
      ]
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Track profile view
    await trackProfileView(viewerId, id);

    // Get viewer's preferences for compatibility calculation
    const viewerPreference = await Preference.findOne({ where: { userId: viewerId } });
    const profilePreference = await Preference.findOne({ where: { userId: id } });

    // Calculate compatibility
    const compatibility = calculateCompatibility(
      profile,
      profile, // This would be the viewer's profile
      profilePreference,
      viewerPreference
    );

    // Hide contact info if viewer is not premium
    const viewer = await User.findByPk(viewerId);
    const isPremium = viewer.subscriptionType !== 'free' && viewer.isSubscriptionActive();

    const profileData = profile.toJSON();
    if (!isPremium) {
      profileData.user.phone = '******';
      profileData.user.email = '******';
    }

    res.json({
      success: true,
      data: {
        profile: profileData,
        compatibility,
        canViewContact: isPremium,
        isPremiumRequired: !isPremium
      }
    });

  } catch (error) {
    console.error('Get profile by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
};

// Helper function to track profile views
const trackProfileView = async (viewerId, viewedUserId) => {
  try {
    const existingView = await ProfileView.findOne({
      where: { viewerId, viewedUserId }
    });

    if (existingView) {
      await existingView.update({
        viewCount: existingView.viewCount + 1,
        updatedAt: new Date()
      });
    } else {
      await ProfileView.create({
        viewerId,
        viewedUserId,
        isRevealed: false
      });

      // Create notification for profile owner
      await Notification.create({
        userId: viewedUserId,
        type: 'profile_view',
        title: 'Profile Viewed',
        content: 'Someone viewed your profile',
        data: { viewerId }
      });
    }
  } catch (error) {
    console.error('Error tracking profile view:', error);
  }
};

// Helper function to get missing fields
const getMissingFields = (profile) => {
  const requiredFields = [
    { key: 'name', label: 'Name' },
    { key: 'height', label: 'Height' },
    { key: 'religion', label: 'Religion' },
    { key: 'education', label: 'Education' },
    { key: 'profession', label: 'Profession' },
    { key: 'city', label: 'City' },
    { key: 'bio', label: 'About You' },
    { key: 'photos', label: 'Photos' }
  ];

  return requiredFields.filter(field => {
    const value = profile[field.key];
    return !value || (Array.isArray(value) && value.length === 0);
  }).map(field => field.label);
};

// Helper function to get next steps
const getNextSteps = (profile) => {
  const steps = [];
  
  if (!profile.photos || profile.photos.length === 0) {
    steps.push('Add your best photo to get 3x more matches');
  } else if (profile.photos.length < 3) {
    steps.push('Add more photos to showcase your personality');
  }

  if (!profile.bio) {
    steps.push('Write a compelling bio to attract better matches');
  }

  if (profile.verificationStatus === 'pending') {
    steps.push('Complete identity verification for trust badge');
  } else if (profile.verificationStatus !== 'verified') {
    steps.push('Verify your identity to get verified badge');
  }

  return steps;
};

module.exports = {
  getMyProfile,
  updateProfile,
  uploadPhoto,
  deletePhoto,
  verifyIdentity,
  getProfileById,
  getProfileCompletion,
  updatePreferences
};

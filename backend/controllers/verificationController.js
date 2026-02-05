const { Verification, User } = require('../models');

// @route   POST /api/verification/submit
// @desc    Submit identity verification documents
// @access  Private
exports.submitVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentType } = req.body;

    // Check if verification already exists
    let verification = await Verification.findOne({ where: { userId } });

    if (verification && verification.status === 'pending') {
      return res.status(400).json({ 
        message: 'Verification already submitted and pending review' 
      });
    }

    if (verification && verification.status === 'approved') {
      return res.status(400).json({ 
        message: 'You are already verified' 
      });
    }

    // Handle file uploads - Cloudinary returns full URL in file.path
    const documentFront = req.files?.documentFront?.[0]?.path || null;
    const documentBack = req.files?.documentBack?.[0]?.path || null;
    const selfiePhoto = req.files?.selfiePhoto?.[0]?.path || null;

    if (!documentFront || !selfiePhoto) {
      return res.status(400).json({ 
        message: 'Document front and selfie photo are required' 
      });
    }

    if (verification) {
      // Update existing verification
      verification.documentType = documentType;
      verification.documentFront = documentFront;
      verification.documentBack = documentBack;
      verification.selfiePhoto = selfiePhoto;
      verification.status = 'pending';
      await verification.save();
    } else {
      // Create new verification
      verification = await Verification.create({
        userId,
        documentType,
        documentFront,
        documentBack,
        selfiePhoto,
        status: 'pending'
      });
    }

    res.json({
      success: true,
      message: 'Verification documents submitted successfully. Awaiting admin approval.',
      verification
    });
  } catch (error) {
    console.error('Submit verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   GET /api/verification/status
// @desc    Get verification status for current user
// @access  Private
exports.getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const verification = await Verification.findOne({
      where: { userId },
      include: [
        {
          model: User,
          as: 'Verifier',
          attributes: ['id', 'email']
        }
      ]
    });

    if (!verification) {
      return res.json({
        success: true,
        verification: {
          status: 'not_submitted'
        }
      });
    }

    res.json({
      success: true,
      verification: {
        status: verification.status,
        documentType: verification.documentType,
        adminNotes: verification.adminNotes,
        verifiedAt: verification.verifiedAt
      }
    });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

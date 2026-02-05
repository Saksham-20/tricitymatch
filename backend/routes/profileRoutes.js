const express = require('express');
const router = express.Router();
const { getMyProfile, updateProfile, getProfile, getProfileStats, deletePhoto, deleteProfilePhoto } = require('../controllers/profileController');
const { auth } = require('../middlewares/auth');
const { uploadPhotos, validateUploadedFiles } = require('../middlewares/upload');

router.get('/me', auth, getMyProfile);
router.put('/me', auth, uploadPhotos, validateUploadedFiles, updateProfile);
router.get('/me/stats', auth, getProfileStats);
router.delete('/me/photo', auth, deletePhoto);
router.delete('/me/profile-photo', auth, deleteProfilePhoto);
router.get('/:userId', auth, getProfile);

module.exports = router;

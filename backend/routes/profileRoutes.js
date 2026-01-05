const express = require('express');
const router = express.Router();
const { getMyProfile, updateProfile, getProfile, getProfileStats } = require('../controllers/profileController');
const { auth } = require('../middlewares/auth');
const { uploadPhotos } = require('../middlewares/upload');

router.get('/me', auth, getMyProfile);
router.put('/me', auth, uploadPhotos, updateProfile);
router.get('/me/stats', auth, getProfileStats);
router.get('/:userId', auth, getProfile);

module.exports = router;


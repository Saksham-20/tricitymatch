const express = require('express');
const router = express.Router();
const { 
  getUsers, 
  updateUserStatus, 
  getVerifications, 
  updateVerification, 
  getAnalytics,
  getReports
} = require('../controllers/adminController');
const { auth, adminAuth } = require('../middlewares/auth');

router.get('/users', auth, adminAuth, getUsers);
router.put('/users/:userId/status', auth, adminAuth, updateUserStatus);
router.get('/verifications', auth, adminAuth, getVerifications);
router.put('/verifications/:verificationId', auth, adminAuth, updateVerification);
router.get('/analytics', auth, adminAuth, getAnalytics);
router.get('/reports', auth, adminAuth, getReports);

module.exports = router;


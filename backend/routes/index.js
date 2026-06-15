const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const profileRoutes = require('./profileRoutes');
const searchRoutes = require('./searchRoutes');
const matchRoutes = require('./matchRoutes');
const chatRoutes = require('./chatRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const adminRoutes = require('./adminRoutes');
const verificationRoutes = require('./verificationRoutes');
const { blockRouter, reportRouter } = require('./blockReportRoutes');
const notificationRoutes = require('./notificationRoutes');
const callRoutes = require('./callRoutes');
const guardianRoutes = require('./guardianRoutes');
const astrologerRoutes = require('./astrologerRoutes');
const { getPublicSuccessStories } = require('../controllers/adminController');

// Public success stories (no auth) — social proof for the marketing site
router.get('/success-stories', getPublicSuccessStories);

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/search', searchRoutes);
router.use('/match', matchRoutes);
router.use('/chat', chatRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/admin', adminRoutes);
router.use('/verification', verificationRoutes);
router.use('/block', blockRouter);
router.use('/report', reportRouter);
router.use('/notifications', notificationRoutes);
router.use('/calls', callRoutes);
router.use('/guardian', guardianRoutes);
router.use('/astrologers', astrologerRoutes);

module.exports = router;


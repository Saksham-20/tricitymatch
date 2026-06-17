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
const groupRoutes = require('./groupRoutes');
const { getPublicSuccessStories } = require('../controllers/adminController');
const { submitContact } = require('../controllers/contactController');
const { contactLimiter } = require('../middlewares/security');
const { contactValidation } = require('../validators');
const { handleValidationErrors } = require('../middlewares/errorHandler');

// Public success stories (no auth) — social proof for the marketing site
router.get('/success-stories', getPublicSuccessStories);

// Public contact form (no auth) — stores enquiry + best-effort emails support
router.post('/contact', contactLimiter, contactValidation, handleValidationErrors, submitContact);

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
router.use('/groups', groupRoutes);

module.exports = router;


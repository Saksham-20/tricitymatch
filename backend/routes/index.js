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
const inviteRoutes = require('./inviteRoutes');
const statsRoutes = require('./statsRoutes');
const { getPublicSuccessStories } = require('../controllers/adminController');
const { submitContact, submitSuccessStory } = require('../controllers/contactController');
const { recordClientEvent } = require('../controllers/analyticsController');
const { contactLimiter, analyticsLimiter } = require('../middlewares/security');
const { contactValidation, successStoryValidation } = require('../validators');
const { handleValidationErrors } = require('../middlewares/errorHandler');

// Public success stories (no auth) — social proof for the marketing site
router.get('/success-stories', getPublicSuccessStories);
// Public success-story submission (no auth, rate-limited) — lands as a draft for admin review
router.post('/success-stories', contactLimiter, successStoryValidation, handleValidationErrors, submitSuccessStory);

// Public contact form (no auth) — stores enquiry + best-effort emails support
router.post('/contact', contactLimiter, contactValidation, handleValidationErrors, submitContact);

// Traffic-stage beacon. Public by necessity — the stages it reports happen
// before an account exists, which is exactly the half of the funnel nothing
// else can see.
router.post('/events', analyticsLimiter, recordClientEvent);

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
// D7: astrologer marketplace ships DARK — flag off means these routes 404 as
// if they don't exist (true hide + kill switch, no app-store release needed).
// Flag is checked per-request, so flipping ASTROLOGER_MARKETPLACE needs only a
// backend restart. Clients read user.features.astrologerMarketplace.
router.use('/astrologers', (req, res, next) => {
  const config = require('../config/env');
  if (!config.features.astrologerMarketplace) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.originalUrl} not found` } });
  }
  next();
}, astrologerRoutes);
router.use('/groups', groupRoutes);
// Member invites — mixed: /invite/:token is public, /invite/my-link is authed
router.use('/invite', inviteRoutes);

// Community stats — cached social-proof counters for member dashboards
router.use('/stats', statsRoutes);

module.exports = router;


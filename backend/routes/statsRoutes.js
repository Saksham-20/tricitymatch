const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { getCommunityStats } = require('../controllers/statsController');

// GET /stats/community — member-facing social-proof counters (cached 1h)
router.get('/community', auth, getCommunityStats);

module.exports = router;

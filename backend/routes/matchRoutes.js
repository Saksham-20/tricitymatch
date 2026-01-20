const express = require('express');
const router = express.Router();
const { matchAction, getLikes, getShortlist, getMutualMatches } = require('../controllers/matchController');
const { auth, requirePremium } = require('../middlewares/auth');

router.post('/:userId', auth, matchAction);
router.get('/likes', auth, requirePremium, getLikes); // Premium feature: see who liked you
router.get('/shortlist', auth, getShortlist);
router.get('/mutual', auth, getMutualMatches);

module.exports = router;


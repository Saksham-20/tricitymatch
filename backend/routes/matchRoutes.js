const express = require('express');
const router = express.Router();
const { matchAction, getLikes, getShortlist, getMutualMatches } = require('../controllers/matchController');
const { auth } = require('../middlewares/auth');

router.post('/:userId', auth, matchAction);
router.get('/likes', auth, getLikes);
router.get('/shortlist', auth, getShortlist);
router.get('/mutual', auth, getMutualMatches);

module.exports = router;


'use strict';

const express = require('express');
const router = express.Router();
const { auth, requirePremium } = require('../middlewares/auth');
const { matchActionLimiter } = require('../middlewares/security');
const {
  getAgoraToken,
  initiateCall,
  endCall,
  acceptCall,
  declineCall,
  getCallHistory,
} = require('../controllers/callController');

// All call endpoints require auth + Premium+ subscription
// Token minting and call initiation both had only the global limiter in front
// of them; the first hands out RTC credentials, the second rings other members.
router.get('/agora-token', auth, requirePremium, matchActionLimiter, getAgoraToken);
router.post('/initiate', auth, requirePremium, matchActionLimiter, initiateCall);
router.get('/history', auth, getCallHistory);
router.put('/:id/accept', auth, acceptCall);
router.put('/:id/decline', auth, declineCall);
router.put('/:id/end', auth, endCall);

module.exports = router;

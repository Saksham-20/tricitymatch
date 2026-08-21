'use strict';

const express = require('express');
const router = express.Router();
const { auth, requirePremium } = require('../middlewares/auth');
const { matchActionLimiter } = require('../middlewares/security');
const { param } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/errorHandler');
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
router.put('/:id/accept', auth, matchActionLimiter, param('id').isUUID(4), handleValidationErrors, acceptCall);
router.put('/:id/decline', auth, matchActionLimiter, param('id').isUUID(4), handleValidationErrors, declineCall);
router.put('/:id/end', auth, matchActionLimiter, param('id').isUUID(4), handleValidationErrors, endCall);

module.exports = router;

'use strict';

const express = require('express');
const router = express.Router();
const { auth, requirePremium } = require('../middlewares/auth');
const {
  getAgoraToken,
  initiateCall,
  endCall,
  acceptCall,
  declineCall,
  getCallHistory,
} = require('../controllers/callController');

// All call endpoints require auth + Premium+ subscription
router.get('/agora-token', auth, requirePremium, getAgoraToken);
router.post('/initiate', auth, requirePremium, initiateCall);
router.get('/history', auth, getCallHistory);
router.put('/:id/accept', auth, acceptCall);
router.put('/:id/decline', auth, declineCall);
router.put('/:id/end', auth, endCall);

module.exports = router;

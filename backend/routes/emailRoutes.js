'use strict';

/**
 * Reminder-mail preferences — public, signed-link authenticated. See
 * controllers/emailController.js.
 */

const express = require('express');
const router = express.Router();
const { unsubscribe, resubscribe, openConfirmation } = require('../controllers/emailController');
const { createRateLimiter } = require('../middlewares/security');

// Generous: mailbox providers POST one-click unsubscribes from shared server
// addresses, so a per-IP budget has to tolerate several members at once.
const emailPrefsLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many requests, please try again later',
});

router.get('/unsubscribe', emailPrefsLimiter, openConfirmation);
router.post('/unsubscribe', emailPrefsLimiter, unsubscribe);
router.post('/resubscribe', emailPrefsLimiter, resubscribe);

module.exports = router;

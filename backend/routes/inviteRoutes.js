'use strict';

/**
 * Invite Routes (Phase S)
 *
 * Route ORDER matters: `/my-link` is declared before `/:token` so the literal
 * path is never swallowed by the param route (which would then 404 an authed
 * caller with a public-shaped error).
 */

const express = require('express');
const router = express.Router();

const { resolveInvite, getMyInviteLink } = require('../controllers/inviteController');
const { auth } = require('../middlewares/auth');
const { inviteLimiter } = require('../middlewares/security');

// Own invite link — authed, no extra limiter (apiLimiter covers it).
router.get('/my-link', auth, getMyInviteLink);

// Public resolve — first name only, rate-limited so the token space cannot be
// swept for valid links.
router.get('/:token', inviteLimiter, resolveInvite);

module.exports = router;

/**
 * Family Group Routes
 * Group chat for families reviewing candidate matches. Every handler enforces
 * group membership (see groupController.requireMembership) — the auth boundary
 * that closes the original IDOR (SOCK-1/MF-1).
 */

const express = require('express');
const router = express.Router();
const { matchActionLimiter } = require('../middlewares/security');
const {
  createGroup,
  getMyGroups,
  getGroup,
  addMember,
  removeMember,
  leaveGroup,
  deleteGroup,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
} = require('../controllers/groupController');
const { param } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/errorHandler');
const { auth } = require('../middlewares/auth');
const { messageLimiter } = require('../middlewares/security');

router.use(auth);

// Every :groupId / :messageId / :memberUserId is a uuid column. Without this an
// arbitrary string reaches Postgres and returns a 500 carrying the driver error.
const uuidParams = (...names) => [
  ...names.map((n) => param(n).isUUID(4).withMessage(`Invalid ${n}`)),
  handleValidationErrors,
];

// Group management
router.post('/', createGroup);
router.get('/', getMyGroups);
router.get('/:groupId', uuidParams('groupId'), getGroup);
router.delete('/:groupId', uuidParams('groupId'), deleteGroup);

// Members
// Rate-limited: both aliases accept a phone number and probe the user table, so
// without a per-user budget they remain a cheap enumeration surface even with
// the response now generic.
router.post('/:groupId/members', matchActionLimiter, uuidParams('groupId'), addMember);
router.post('/:groupId/invite', matchActionLimiter, uuidParams('groupId'), addMember); // alias: invite by phone/userId
router.delete('/:groupId/leave', uuidParams('groupId'), leaveGroup);
router.delete('/:groupId/members/:memberUserId', uuidParams('groupId', 'memberUserId'), removeMember);

// Messages
router.get('/:groupId/messages', uuidParams('groupId'), getMessages);
router.post('/:groupId/messages', messageLimiter, uuidParams('groupId'), sendMessage);
router.put('/:groupId/messages/:messageId', uuidParams('groupId', 'messageId'), editMessage);
router.delete('/:groupId/messages/:messageId', uuidParams('groupId', 'messageId'), deleteMessage);

module.exports = router;

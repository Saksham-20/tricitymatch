/**
 * Family Group Routes
 * Group chat for families reviewing candidate matches. Every handler enforces
 * group membership (see groupController.requireMembership) — the auth boundary
 * that closes the original IDOR (SOCK-1/MF-1).
 */

const express = require('express');
const router = express.Router();
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
const { auth } = require('../middlewares/auth');
const { messageLimiter } = require('../middlewares/security');

router.use(auth);

// Group management
router.post('/', createGroup);
router.get('/', getMyGroups);
router.get('/:groupId', getGroup);
router.delete('/:groupId', deleteGroup);

// Members
router.post('/:groupId/members', addMember);
router.post('/:groupId/invite', addMember); // alias: invite by phone/userId
router.delete('/:groupId/leave', leaveGroup);
router.delete('/:groupId/members/:memberUserId', removeMember);

// Messages
router.get('/:groupId/messages', getMessages);
router.post('/:groupId/messages', messageLimiter, sendMessage);
router.put('/:groupId/messages/:messageId', editMessage);
router.delete('/:groupId/messages/:messageId', deleteMessage);

module.exports = router;

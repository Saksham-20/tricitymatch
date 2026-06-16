/**
 * Family Group Controller
 * Group chat for families reviewing candidate matches. Membership (GroupMember)
 * is the authorization boundary for every read/write — this closes the IDOR that
 * caused the socket events to be disabled (SOCK-1/MF-1).
 */

const { Group, GroupMember, GroupMessage, User, Profile } = require('../models');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log } = require('../middlewares/logger');

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MEMBERS = 20;

// Sanitize message content to prevent XSS (mirrors chatController).
const sanitizeMessage = (content) => {
  if (typeof content !== 'string') return '';
  return content
    .replace(/<[^>]*>/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
};

// Authorization: confirm the user is a member of the group; returns membership.
const requireMembership = async (groupId, userId) => {
  const membership = await GroupMember.findOne({ where: { groupId, userId } });
  if (!membership) throw createError.forbidden('You are not a member of this group');
  return membership;
};

const groupRoom = (groupId) => `group_${groupId}`;

// Flatten a GroupMessage (+ included Sender/Profile) into the shape clients use:
// { id, groupId, senderId, senderName, content, createdAt, editedAt }.
const serializeMessage = (m) => {
  const profile = m.Sender && m.Sender.Profile ? m.Sender.Profile : null;
  const senderName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
    : '';
  return {
    id: m.id,
    groupId: m.groupId,
    senderId: m.senderId,
    senderName,
    content: m.content,
    createdAt: m.createdAt,
    editedAt: m.editedAt || null,
  };
};

// @route   POST /api/v1/groups
// @desc    Create a family group (creator becomes owner)
exports.createGroup = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, description, candidateUserId } = req.body;

  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName) throw createError.badRequest('Group name is required');
  if (cleanName.length > 100) throw createError.badRequest('Group name too long (max 100)');

  if (candidateUserId) {
    const candidate = await User.findByPk(candidateUserId, { attributes: ['id'] });
    if (!candidate) throw createError.badRequest('Candidate user not found');
  }

  const group = await Group.create({
    name: cleanName,
    description: typeof description === 'string' ? description.trim().slice(0, 500) : null,
    createdBy: userId,
    candidateUserId: candidateUserId || null,
  });

  await GroupMember.create({ groupId: group.id, userId, role: 'owner' });

  res.status(201).json({ success: true, group });
});

// @route   GET /api/v1/groups
// @desc    List groups the current user belongs to
exports.getMyGroups = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const memberships = await GroupMember.findAll({
    where: { userId },
    attributes: ['groupId', 'role'],
  });
  const groupIds = memberships.map((m) => m.groupId);
  if (groupIds.length === 0) return res.json({ success: true, groups: [] });

  const groups = await Group.findAll({
    where: { id: groupIds },
    include: [
      { model: User, as: 'Creator', attributes: ['id'], include: [{ model: Profile, attributes: ['firstName', 'lastName'] }] },
      { model: GroupMember, as: 'Members', attributes: ['id'] },
    ],
    order: [['updatedAt', 'DESC']],
  });

  const roleByGroup = Object.fromEntries(memberships.map((m) => [m.groupId, m.role]));
  const result = groups.map((g) => {
    const json = g.toJSON();
    return {
      ...json,
      memberCount: json.Members ? json.Members.length : 0,
      myRole: roleByGroup[g.id],
      Members: undefined,
    };
  });

  res.json({ success: true, groups: result });
});

// @route   GET /api/v1/groups/:groupId
// @desc    Group detail + members (members only)
exports.getGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  await requireMembership(groupId, req.user.id);

  const group = await Group.findByPk(groupId, {
    include: [
      {
        model: GroupMember,
        as: 'Members',
        include: [{ model: User, as: 'User', attributes: ['id'], include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto'] }] }],
      },
    ],
  });
  if (!group) throw createError.notFound('Group not found');

  res.json({ success: true, group });
});

// @route   POST /api/v1/groups/:groupId/members
// @desc    Add a member (owner only)
exports.addMember = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { userId: bodyUserId, phone } = req.body;
  const membership = await requireMembership(groupId, req.user.id);
  if (membership.role !== 'owner') throw createError.forbidden('Only the group owner can add members');

  // Accept either a userId or a phone number (families invite relatives by phone).
  let target = null;
  if (bodyUserId) {
    target = await User.findByPk(bodyUserId, { attributes: ['id'] });
  } else if (phone) {
    target = await User.findOne({ where: { phone: String(phone).trim() }, attributes: ['id'] });
    if (!target) throw createError.badRequest('No registered user found with that phone number');
  } else {
    throw createError.badRequest('userId or phone is required');
  }
  if (!target) throw createError.badRequest('User not found');
  const newUserId = target.id;

  const count = await GroupMember.count({ where: { groupId } });
  if (count >= MAX_MEMBERS) throw createError.badRequest(`Group is full (max ${MAX_MEMBERS} members)`);

  const existing = await GroupMember.findOne({ where: { groupId, userId: newUserId } });
  if (existing) throw createError.conflict('User is already a member');

  const member = await GroupMember.create({ groupId, userId: newUserId, role: 'member' });
  res.status(201).json({ success: true, member });
});

// @route   DELETE /api/v1/groups/:groupId/members/:memberUserId
// @desc    Remove a member (owner removes anyone; member can remove self)
exports.removeMember = asyncHandler(async (req, res) => {
  const { groupId, memberUserId } = req.params;
  const requesterId = req.user.id;
  const membership = await requireMembership(groupId, requesterId);

  const isSelf = memberUserId === requesterId;
  if (!isSelf && membership.role !== 'owner') {
    throw createError.forbidden('Only the group owner can remove other members');
  }

  const target = await GroupMember.findOne({ where: { groupId, userId: memberUserId } });
  if (!target) throw createError.notFound('Member not found');

  // Owner cannot leave while other members remain — must delete the group or transfer.
  if (target.role === 'owner') {
    const others = await GroupMember.count({ where: { groupId } });
    if (others > 1) throw createError.badRequest('Owner must delete the group or transfer ownership before leaving');
  }

  await target.destroy();
  res.json({ success: true });
});

// @route   DELETE /api/v1/groups/:groupId/leave
// @desc    Leave a group (removes the caller's own membership)
exports.leaveGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;
  const membership = await requireMembership(groupId, userId);

  if (membership.role === 'owner') {
    const others = await GroupMember.count({ where: { groupId } });
    if (others > 1) throw createError.badRequest('Owner must delete the group or transfer ownership before leaving');
  }
  await membership.destroy();
  res.json({ success: true });
});

// @route   DELETE /api/v1/groups/:groupId
// @desc    Delete a group (owner only)
exports.deleteGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const membership = await requireMembership(groupId, req.user.id);
  if (membership.role !== 'owner') throw createError.forbidden('Only the group owner can delete the group');

  const group = await Group.findByPk(groupId);
  if (!group) throw createError.notFound('Group not found');
  await group.destroy(); // cascades to members + messages

  res.json({ success: true });
});

// @route   GET /api/v1/groups/:groupId/messages
// @desc    List group messages (members only, paginated)
exports.getMessages = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  await requireMembership(groupId, req.user.id);

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

  const { rows, count } = await GroupMessage.findAndCountAll({
    where: { groupId },
    include: [{ model: User, as: 'Sender', attributes: ['id'], include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto'] }] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  const totalPages = Math.ceil(count / limit);
  // Newest-first (matches the inverted chat list + optimistic prepend on clients).
  res.json({
    success: true,
    messages: rows.map(serializeMessage),
    nextCursor: page < totalPages ? String(page + 1) : null,
    pagination: { page, limit, total: count, totalPages },
  });
});

// @route   POST /api/v1/groups/:groupId/messages
// @desc    Post a group message (members only) — broadcasts over socket
exports.sendMessage = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const senderId = req.user.id;
  await requireMembership(groupId, senderId);

  const content = sanitizeMessage(req.body.content);
  if (!content) throw createError.badRequest('Message content cannot be empty');
  if (content.length > MAX_MESSAGE_LENGTH) {
    throw createError.badRequest(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
  }

  const created = await GroupMessage.create({ groupId, senderId, content });
  // Bump group updatedAt so it sorts to the top of the member's list.
  await Group.update({ updatedAt: new Date() }, { where: { id: groupId } });

  const full = await GroupMessage.findByPk(created.id, {
    include: [{ model: User, as: 'Sender', attributes: ['id'], include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto'] }] }],
  });
  const message = serializeMessage(full);

  // Broadcast to everyone currently in the group room (server-authoritative).
  // Payload is the flat client shape so listeners can consume it directly.
  const io = req.app.get('io');
  if (io) io.to(groupRoom(groupId)).emit('group-message-received', message);

  res.status(201).json({ success: true, message });
});

// @route   PUT /api/v1/groups/:groupId/messages/:messageId
// @desc    Edit own group message
exports.editMessage = asyncHandler(async (req, res) => {
  const { groupId, messageId } = req.params;
  const userId = req.user.id;
  await requireMembership(groupId, userId);

  const content = sanitizeMessage(req.body.content);
  if (!content) throw createError.badRequest('Message content cannot be empty');
  if (content.length > MAX_MESSAGE_LENGTH) {
    throw createError.badRequest(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
  }

  const message = await GroupMessage.findOne({ where: { id: messageId, groupId } });
  if (!message) throw createError.notFound('Message not found');
  if (message.senderId !== userId) throw createError.forbidden('You can only edit your own messages');

  message.content = content;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  const io = req.app.get('io');
  if (io) io.to(groupRoom(groupId)).emit('group-message-edited', { groupId, messageId, content, editedAt: message.editedAt });

  res.json({ success: true, message: { id: message.id, groupId, senderId: message.senderId, content, editedAt: message.editedAt } });
});

// @route   DELETE /api/v1/groups/:groupId/messages/:messageId
// @desc    Delete own group message (or owner can delete any)
exports.deleteMessage = asyncHandler(async (req, res) => {
  const { groupId, messageId } = req.params;
  const userId = req.user.id;
  const membership = await requireMembership(groupId, userId);

  const message = await GroupMessage.findOne({ where: { id: messageId, groupId } });
  if (!message) throw createError.notFound('Message not found');
  if (message.senderId !== userId && membership.role !== 'owner') {
    throw createError.forbidden('You can only delete your own messages');
  }

  await message.destroy();

  const io = req.app.get('io');
  if (io) io.to(groupRoom(groupId)).emit('group-message-deleted', { groupId, messageId });

  res.json({ success: true });
});

module.exports.requireMembership = requireMembership;
module.exports.groupRoom = groupRoom;

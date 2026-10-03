/**
 * Family Group Controller
 * Group chat for families reviewing candidate matches. Membership (GroupMember)
 * is the authorization boundary for every read/write — this closes the IDOR that
 * caused the socket events to be disabled (SOCK-1/MF-1).
 */

const { Op } = require('sequelize');
const { Group, GroupMember, GroupMessage, User, Profile } = require('../models');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { log } = require('../middlewares/logger');
const { notify } = require('../utils/notifyUser');
const { isBlockedBetween } = require('../utils/blocks');
const { cleanMessageText } = require('../utils/messageText');
const { evictGroupRoom } = require('../utils/relationship');

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MEMBERS = 20;

// Messages are stored as typed (see utils/messageText); the clients render text safely.
const sanitizeMessage = cleanMessageText;

// Authorization: confirm the user is an ACTIVE member of the group; returns
// membership. A pending invitation deliberately grants nothing — the invitee has
// not consented to being in the group, so must not read it.
const requireMembership = async (groupId, userId) => {
  const membership = await GroupMember.findOne({ where: { groupId, userId, status: 'active' } });
  if (!membership) throw createError.forbidden('You are not a member of this group');
  return membership;
};

// Signup stores a phone as typed while login matches the bare, 91, +91 and 0
// forms; an invite must find the same account login would.
const phoneLookupForms = (raw) => {
  const trimmed = String(raw).trim();
  const digits = trimmed.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return [trimmed];
  return [...new Set([trimmed, digits, `91${digits}`, `+91${digits}`, `0${digits}`])];
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
    where: { userId, status: 'active' },
    attributes: ['groupId', 'role'],
  });
  const groupIds = memberships.map((m) => m.groupId);
  if (groupIds.length === 0) return res.json({ success: true, groups: [] });

  const groups = await Group.findAll({
    where: { id: groupIds },
    include: [
      { model: User, as: 'Creator', attributes: ['id'], include: [{ model: Profile, attributes: ['firstName', 'lastName'] }] },
      { model: GroupMember, as: 'Members', attributes: ['id'], where: { status: 'active' }, required: false },
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
  const membership = await requireMembership(groupId, req.user.id);

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

  // Invitees who have not accepted are visible to the owner who invited them,
  // never to the rest of the group (they have not agreed to be shown yet).
  const json = group.toJSON();
  if (membership.role !== 'owner') {
    json.Members = (json.Members || []).filter((m) => m.status === 'active');
  }

  res.json({ success: true, group: json });
});

// @route   POST /api/v1/groups/:groupId/members  (alias: /invite)
// @desc    Invite a member (owner only). The invitee must ACCEPT before they can
//          read or write anything in the group.
//
// Every outcome that depends on the TARGET — no such user, a phone that matches
// nobody, a blocked pair, an inactive account, someone already invited or in
// the group — returns the same 202 with the same body. The endpoint used to
// answer 201 with the member row for a hit and 400 for a miss, which made it a
// phone-number -> user-id oracle for any member who created a throwaway group.
exports.addMember = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { userId: bodyUserId, phone } = req.body;
  const membership = await requireMembership(groupId, req.user.id);
  if (membership.role !== 'owner') throw createError.forbidden('Only the group owner can add members');

  if (!bodyUserId && !phone) throw createError.badRequest('userId or phone is required');

  // Group capacity is the owner's own state, not the target's, so reporting it
  // reveals nothing about who the target is. Pending invitations count so an
  // owner cannot pile up an unbounded number of them.
  const count = await GroupMember.count({ where: { groupId } });
  if (count >= MAX_MEMBERS) throw createError.badRequest(`Group is full (max ${MAX_MEMBERS} members)`);

  const accepted = { success: true, message: 'If that member can be invited, they have been sent an invitation.' };

  let target = null;
  if (bodyUserId) {
    target = await User.findByPk(bodyUserId, { attributes: ['id', 'status'] });
  } else {
    target = await User.findOne({ where: { phone: { [Op.in]: phoneLookupForms(phone) } }, attributes: ['id', 'status'] });
  }

  const invitable = target
    && target.status === 'active'
    && target.id !== req.user.id
    && !(await isBlockedBetween(req.user.id, target.id))
    && !(await GroupMember.findOne({ where: { groupId, userId: target.id }, attributes: ['id'] }));

  if (!invitable) return res.status(202).json(accepted);

  await GroupMember.create({
    groupId,
    userId: target.id,
    role: 'member',
    status: 'pending',
    invitedBy: req.user.id,
  });

  try {
    const group = await Group.findByPk(groupId, { attributes: ['name'] });
    await notify(
      target.id,
      'system',
      'You have been invited to a family group',
      `You were invited to join "${group?.name || 'a family group'}". Nothing is shared until you accept.`,
      groupId
    );
  } catch (err) {
    // Never fail the invite because the notification could not be delivered.
    log.error('Group invite notification failed', { groupId, targetId: target.id, error: err.message });
  }

  res.status(202).json(accepted);
});

// @route   GET /api/v1/groups/invitations
// @desc    Pending invitations addressed to the current user
exports.getMyInvitations = asyncHandler(async (req, res) => {
  const rows = await GroupMember.findAll({
    where: { userId: req.user.id, status: 'pending' },
    attributes: ['groupId', 'invitedBy', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  if (rows.length === 0) return res.json({ success: true, invitations: [] });

  const groups = await Group.findAll({
    where: { id: rows.map((r) => r.groupId) },
    attributes: ['id', 'name'],
  });
  const nameById = Object.fromEntries(groups.map((g) => [g.id, g.name]));

  const inviterProfiles = await Profile.findAll({
    where: { userId: rows.map((r) => r.invitedBy).filter(Boolean) },
    attributes: ['userId', 'firstName', 'lastName'],
  });
  const inviterName = Object.fromEntries(
    inviterProfiles.map((p) => [p.userId, [p.firstName, p.lastName].filter(Boolean).join(' ')])
  );

  res.json({
    success: true,
    invitations: rows.map((r) => ({
      groupId: r.groupId,
      groupName: nameById[r.groupId] || 'Family group',
      invitedByName: inviterName[r.invitedBy] || null,
      invitedAt: r.createdAt,
    })),
  });
});

// Load the caller's PENDING invitation for a group, or 404. A 404 (not 403) for
// "no invitation" so the endpoint cannot be used to probe group existence.
const requirePendingInvitation = async (groupId, userId) => {
  const invite = await GroupMember.findOne({ where: { groupId, userId, status: 'pending' } });
  if (!invite) throw createError.notFound('Invitation not found');
  return invite;
};

// @route   POST /api/v1/groups/:groupId/accept
exports.acceptInvitation = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const invite = await requirePendingInvitation(groupId, req.user.id);

  // The owner may have blocked, or been blocked by, the invitee since inviting.
  if (invite.invitedBy && (await isBlockedBetween(req.user.id, invite.invitedBy))) {
    await invite.destroy();
    throw createError.notFound('Invitation not found');
  }

  invite.status = 'active';
  await invite.save();
  res.json({ success: true });
});

// @route   POST /api/v1/groups/:groupId/decline
exports.declineInvitation = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const invite = await requirePendingInvitation(groupId, req.user.id);
  await invite.destroy();
  res.json({ success: true });
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
    const others = await GroupMember.count({ where: { groupId, status: 'active' } });
    if (others > 1) throw createError.badRequest('Owner must delete the group or transfer ownership before leaving');
  }

  await target.destroy();
  await evictGroupRoom(groupId, memberUserId);
  res.json({ success: true });
});

// @route   DELETE /api/v1/groups/:groupId/leave
// @desc    Leave a group (removes the caller's own membership)
exports.leaveGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;
  const membership = await requireMembership(groupId, userId);

  if (membership.role === 'owner') {
    const others = await GroupMember.count({ where: { groupId, status: 'active' } });
    if (others > 1) throw createError.badRequest('Owner must delete the group or transfer ownership before leaving');
  }
  await membership.destroy();
  await evictGroupRoom(groupId, userId);
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

  // Tell open tabs the group is gone, then empty the room so nothing more is delivered.
  const io = req.app.get('io');
  if (io) io.to(groupRoom(groupId)).emit('group-deleted', { groupId });
  await evictGroupRoom(groupId);

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
module.exports.phoneLookupForms = phoneLookupForms;

'use strict';

const { v4: uuidv4 } = require('uuid');
const { CallSession, User, Profile } = require('../models');
const { generateRtcToken } = require('../utils/agoraToken');
const { getIO } = require('../utils/socket');
const { notify } = require('../utils/notifyUser');
const { asyncHandler, createError } = require('../middlewares/errorHandler');
const { log } = require('../middlewares/logger');
const config = require('../config/env');

// GET /calls/agora-token?channel=<name>&type=voice|video
exports.getAgoraToken = asyncHandler(async (req, res) => {
  const { channel, type = 'voice' } = req.query;
  if (!channel) throw createError.validation('channel query param required');

  const result = generateRtcToken(channel, 0);

  if (!result) {
    // Agora not configured — return a dev stub so mobile can test UI
    return res.json({
      token: 'DEV_STUB_TOKEN',
      channelName: channel,
      uid: 0,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      isStub: true,
    });
  }

  res.json(result);
});

// POST /calls/initiate
exports.initiateCall = asyncHandler(async (req, res) => {
  const { calleeId, type = 'voice' } = req.body;
  if (!calleeId) throw createError.validation('calleeId required');
  if (!['voice', 'video'].includes(type)) throw createError.validation('type must be voice or video');

  const callee = await User.findByPk(calleeId, { attributes: ['id'] });
  if (!callee) throw createError.notFound('User not found');

  const channelName = `call_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const call = await CallSession.create({
    callerId: req.user.id,
    calleeId,
    channelName,
    type,
    status: 'initiated',
  });

  // Emit call-incoming to callee's socket room
  const io = getIO();
  if (io) {
    const callerProfile = await Profile.findOne({
      where: { userId: req.user.id },
      attributes: ['firstName', 'lastName', 'profilePhoto'],
    });
    io.to(`user_${calleeId}`).emit('call-incoming', {
      callId: call.id,
      callerId: req.user.id,
      callerName: callerProfile ? `${callerProfile.firstName} ${callerProfile.lastName}` : 'Unknown',
      callerPhoto: callerProfile?.profilePhoto || null,
      channelName,
      type,
    });
  }

  // Generate token for caller immediately
  const tokenResult = generateRtcToken(channelName, 0);

  res.status(201).json({
    callId: call.id,
    channelName,
    token: tokenResult?.token || 'DEV_STUB_TOKEN',
    uid: 0,
    expiresAt: tokenResult?.expiresAt || Math.floor(Date.now() / 1000) + 3600,
  });
});

// PUT /calls/:id/end
exports.endCall = asyncHandler(async (req, res) => {
  const call = await CallSession.findByPk(req.params.id);
  if (!call) throw createError.notFound('Call session not found');

  const isParticipant = call.callerId === req.user.id || call.calleeId === req.user.id;
  if (!isParticipant) throw createError.forbidden('Not a participant in this call');

  const now = new Date();
  const durationSeconds = call.startedAt
    ? Math.floor((now - new Date(call.startedAt)) / 1000)
    : null;

  await call.update({
    status: req.body.status || 'ended',
    endedAt: now,
    durationSeconds,
  });

  // Notify the other party
  const otherId = call.callerId === req.user.id ? call.calleeId : call.callerId;
  const io = getIO();
  if (io) {
    io.to(`user_${otherId}`).emit('call-ended', { callId: call.id, durationSeconds });
  }

  res.json({ callId: call.id, status: call.status, durationSeconds });
});

// PUT /calls/:id/accept
exports.acceptCall = asyncHandler(async (req, res) => {
  const call = await CallSession.findByPk(req.params.id);
  if (!call) throw createError.notFound('Call session not found');
  if (call.calleeId !== req.user.id) throw createError.forbidden('Not the callee');

  await call.update({ status: 'accepted', startedAt: new Date() });

  const tokenResult = generateRtcToken(call.channelName, 0);

  const io = getIO();
  if (io) {
    io.to(`user_${call.callerId}`).emit('call-accepted', { callId: call.id });
  }

  res.json({
    callId: call.id,
    channelName: call.channelName,
    token: tokenResult?.token || 'DEV_STUB_TOKEN',
    uid: 0,
    expiresAt: tokenResult?.expiresAt || Math.floor(Date.now() / 1000) + 3600,
  });
});

// PUT /calls/:id/decline
exports.declineCall = asyncHandler(async (req, res) => {
  const call = await CallSession.findByPk(req.params.id);
  if (!call) throw createError.notFound('Call session not found');
  if (call.calleeId !== req.user.id) throw createError.forbidden('Not the callee');

  await call.update({ status: 'declined', endedAt: new Date() });

  const io = getIO();
  if (io) {
    io.to(`user_${call.callerId}`).emit('call-declined', { callId: call.id });
  }

  res.json({ callId: call.id, status: 'declined' });
});

// GET /calls/history
exports.getCallHistory = asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const { Op } = require('sequelize');

  const calls = await CallSession.findAndCountAll({
    where: {
      [Op.or]: [{ callerId: req.user.id }, { calleeId: req.user.id }],
    },
    include: [
      {
        model: User,
        as: 'Caller',
        attributes: ['id'],
        include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto'] }],
      },
      {
        model: User,
        as: 'Callee',
        attributes: ['id'],
        include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePhoto'] }],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: Math.min(parseInt(limit, 10), 50),
    offset: parseInt(offset, 10),
  });

  res.json({
    calls: calls.rows,
    total: calls.count,
    hasMore: parseInt(offset, 10) + calls.rows.length < calls.count,
  });
});

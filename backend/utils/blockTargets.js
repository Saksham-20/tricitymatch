'use strict';

/**
 * Who a member may block.
 *
 * Blocking is a defensive action, so it has to work against someone who has
 * already reached the blocker (a message, a like, a profile view) even if that
 * person has since hidden or paused their profile. It must NOT be a way to
 * probe accounts the blocker has never encountered: the blocked-list screen
 * shows the person's name, photo and city, so accepting any UUID turned
 * "block" into a window onto members whose profile visibility says no.
 *
 * Allowed when either:
 *   - there is a prior interaction in either direction (a Match row, a message,
 *     a profile view), or
 *   - the target is an ordinary, active, publicly visible member, i.e. someone
 *     the blocker could already open from search.
 * Anything else answers exactly like an id that does not exist.
 */
const { Op } = require('sequelize');
const { Match, Message, ProfileView, Profile, User } = require('../models');

const eitherWay = (a, b, left, right) => ({
  [Op.or]: [
    { [left]: a, [right]: b },
    { [left]: b, [right]: a },
  ],
});

const hasInteraction = async (blockerId, targetId) => {
  const [match, message, view] = await Promise.all([
    Match.findOne({ where: eitherWay(blockerId, targetId, 'userId', 'matchedUserId'), attributes: ['id'] }),
    Message.findOne({ where: eitherWay(blockerId, targetId, 'senderId', 'receiverId'), attributes: ['id'] }),
    ProfileView.findOne({ where: eitherWay(blockerId, targetId, 'viewerId', 'viewedUserId'), attributes: ['id'] }),
  ]);
  return Boolean(match || message || view);
};

const mayBlock = async (blockerId, targetId) => {
  const target = await User.findByPk(targetId, { attributes: ['id', 'role', 'status'] });
  if (!target) return false;
  if (await hasInteraction(blockerId, targetId)) return true;
  if (target.role !== 'user' || target.status !== 'active') return false;
  const profile = await Profile.findOne({
    where: { userId: targetId, isActive: true, profileVisibility: 'everyone' },
    attributes: ['id'],
  });
  return Boolean(profile);
};

module.exports = { mayBlock, hasInteraction };

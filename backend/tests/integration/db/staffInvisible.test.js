/**
 * Staff accounts are invisible on the member-facing side.
 *
 * Every staff account (admin, sub_admin, marketing, ...) has a Profile row and
 * can browse the member site, and some carry Match / ProfileView / Message rows
 * from before staff were stopped from interacting. To a member none of that may
 * surface: no profile, no like, no view, no chat, no call, no group, no invite.
 * Filtered at READ time — the rows themselves are left alone.
 *
 * An admin's quiet hide (Users.hiddenAt) is a different thing and must NOT be
 * swept up here: a hidden member stays visible to people they contacted.
 */

jest.mock('../../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendMessageNotification: jest.fn(async () => true),
  sendGuardianInvite: jest.fn(async () => true),
  sendAccountHandover: jest.fn(async () => true),
  sendSecurityAlert: jest.fn(async () => true),
}));
jest.mock('../../../utils/emailService', () => ({
  sendMessageNotification: jest.fn(async () => true),
  sendMatchNotification: jest.fn(async () => true),
}));
jest.mock('../../../utils/notifyUser', () => ({ notify: jest.fn(async () => {}) }));

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');
const { describeDb, makeMember, removeMembers, call, uniq } = require('../../helpers/db');

describeDb('staff accounts are invisible to members', (t) => {
  const ids = [];
  let models; let profile; let match; let chat; let calls; let groups; let invites;

  beforeAll(() => {
    models = require('../../../models');
    profile = require('../../../controllers/profileController');
    match = require('../../../controllers/matchController');
    chat = require('../../../controllers/chatController');
    calls = require('../../../controllers/callController');
    groups = require('../../../controllers/groupController');
    invites = require('../../../controllers/inviteController');
  });

  afterAll(async () => {
    const sequelize = require('../../../config/database');
    if (ids.length) {
      const q = (sql) => sequelize.query(sql, { replacements: { ids } }).catch(() => {});
      await q('DELETE FROM "Messages" WHERE "senderId" IN (:ids) OR "receiverId" IN (:ids)');
      await q('DELETE FROM "CallSessions" WHERE "callerId" IN (:ids) OR "calleeId" IN (:ids)');
      await q('DELETE FROM "GuardianLinks" WHERE "candidateId" IN (:ids) OR "guardianId" IN (:ids)');
      await q('DELETE FROM "GroupMessages" WHERE "groupId" IN (SELECT id FROM "Groups" WHERE "createdBy" IN (:ids))');
      await q('DELETE FROM "GroupMembers" WHERE "userId" IN (:ids) OR "groupId" IN (SELECT id FROM "Groups" WHERE "createdBy" IN (:ids))');
      await q('DELETE FROM "Groups" WHERE "createdBy" IN (:ids)');
    }
    await removeMembers(ids);
  });

  const member = async (o = {}) => {
    const m = await makeMember({ user: o.user, profile: { gender: o.gender || 'female', ...(o.profile || {}) } });
    ids.push(m.user.id);
    return m.user;
  };
  // Staff accounts are created with placeholder identity, exactly like prod.
  const staff = async (role = 'admin', user = {}) => {
    const m = await makeMember({ user: { role, ...user }, profile: { gender: 'other', dateOfBirth: '1990-01-01' } });
    ids.push(m.user.id);
    return m.user;
  };
  const mutual = async (a, b) => {
    await models.Match.create({ userId: a.id, matchedUserId: b.id, action: 'like', isMutual: true, mutualMatchDate: new Date() });
    await models.Match.create({ userId: b.id, matchedUserId: a.id, action: 'like', isMutual: true, mutualMatchDate: new Date() });
  };
  const userIds = (rows) => rows.map((r) => r.userId);

  t('a member gets 404 on a staff profile, its compatibility, horoscope and kundli; staff still see themselves', async () => {
    const viewer = await member({ gender: 'male' });
    for (const role of ['admin', 'super_admin', 'sub_admin', 'marketing', 'marketing_manager']) {
      const s = await staff(role);
      const params = { userId: s.id };
      expect((await call(profile.getProfile, { user: viewer, params })).statusCode).toBe(404);
      expect((await call(profile.getCompatibilityBreakdown, { user: viewer, params })).statusCode).toBe(404);
      expect((await call(profile.getHoroscopeMatch, { user: viewer, params })).statusCode).toBe(404);
      expect((await call(profile.downloadKundliReport, { user: viewer, params })).statusCode).toBe(404);
      expect((await call(profile.unlockContact, { user: viewer, params })).statusCode).toBe(404);

      // Self-view is unaffected.
      expect((await call(profile.getProfile, { user: s, params })).statusCode).toBe(200);
      const self = await profile.assertProfileVisible(s.id, s.id, { viewerRole: role });
      expect(self.isSelf).toBe(true);
    }
    // ...and a member's own profile is still visible to another member (control).
    const other = await member();
    expect((await call(profile.getProfile, { user: viewer, params: { userId: other.id } })).statusCode).toBe(200);
  });

  t('a member cannot like or shortlist a staff account, but can still undo their own old row', async () => {
    const me = await member({ gender: 'male' });
    const s = await staff('marketing');
    for (const action of ['like', 'shortlist', 'pass']) {
      const res = await call(match.matchAction, { user: me, params: { userId: s.id }, body: { action } });
      expect(res.statusCode).toBe(404);
    }
    expect(await models.Match.count({ where: { userId: me.id, matchedUserId: s.id } })).toBe(0);

    // A like sent before staff were blocked can still be taken back.
    await models.Match.create({ userId: me.id, matchedUserId: s.id, action: 'like' });
    const undo = await call(match.matchAction, { user: me, params: { userId: s.id }, body: { action: 'undo' } });
    expect(undo.statusCode).toBe(200);
    expect(undo.body.removed).toBe(true);
    expect(await models.Match.count({ where: { userId: me.id, matchedUserId: s.id } })).toBe(0);

    // Control: a member target still works.
    const other = await member();
    expect((await call(match.matchAction, { user: me, params: { userId: other.id }, body: { action: 'like' } })).statusCode).toBe(200);
  });

  t('old staff likes, matches and views do not appear in any relationship list or counter', async () => {
    const { ProfileView, Match } = models;
    const me = await member();
    const s = await staff('admin'); const s2 = await staff('sub_admin');
    const real = await member({ gender: 'male' });

    // Historical rows: staff liked me and viewed me; I liked, matched with,
    // shortlisted and viewed staff.
    await mutual(me, s);
    await Match.create({ userId: s2.id, matchedUserId: me.id, action: 'like' });
    await Match.create({ userId: me.id, matchedUserId: s2.id, action: 'shortlist' });
    await ProfileView.create({ viewerId: s.id, viewedUserId: me.id });
    await ProfileView.create({ viewerId: s2.id, viewedUserId: me.id });
    await ProfileView.create({ viewerId: me.id, viewedUserId: s.id });
    await ProfileView.create({ viewerId: me.id, viewedUserId: s2.id });
    // ...and the same with a real member, so the lists are not simply empty.
    await mutual(me, real);
    await ProfileView.create({ viewerId: real.id, viewedUserId: me.id });
    await ProfileView.create({ viewerId: me.id, viewedUserId: real.id });

    const likes = await call(match.getLikes, { user: me, query: {} });
    expect(userIds(likes.body.likes)).toEqual([real.id]);
    expect(likes.body.pagination.total).toBe(1);

    const mutuals = await call(match.getMutualMatches, { user: me, query: {} });
    expect(userIds(mutuals.body.mutualMatches)).toEqual([real.id]);
    expect(mutuals.body.pagination.total).toBe(1);

    const sent = await call(match.getSentInterests, { user: me, query: {} });
    expect(userIds(sent.body.sent)).toEqual([real.id]);

    const saved = await call(match.getShortlist, { user: me, query: {} });
    expect(saved.body.shortlisted).toEqual([]);
    expect(saved.body.pagination.total).toBe(0);

    const viewers = await call(profile.getProfileViewers, { user: me, query: {} });
    expect(userIds(viewers.body.viewers)).toEqual([real.id]);
    expect(viewers.body.pagination.total).toBe(1);

    const recent = await call(profile.getRecentlyViewed, { user: me, query: {} });
    expect(userIds(recent.body.profiles)).toEqual([real.id]);

    const stats = await call(profile.getProfileStats, { user: me });
    expect(stats.body.stats).toMatchObject({ viewsThisWeek: 1, totalViews: 1, likesReceived: 1 });
    expect(Object.values(stats.body.stats.likesByCity).reduce((a, b) => a + b, 0)).toBe(1);

    // Nothing was deleted: the filter is at read time.
    expect(await Match.count({ where: { matchedUserId: me.id, userId: [s.id, s2.id] } })).toBe(2);
  });

  t('a staff "mutual match" is not a chat partner: send, read and the mutual check all refuse', async () => {
    const { isMutualMatch } = require('../../../utils/entitlements');
    const me = await member(); const s = await staff('admin'); const real = await member({ gender: 'male' });
    await mutual(me, s); await mutual(me, real);

    const toStaff = await call(chat.sendMessage, { user: me, body: { receiverId: s.id, content: 'hello' } });
    expect(toStaff.statusCode).toBe(403);
    const fromStaff = await call(chat.sendMessage, { user: s, body: { receiverId: me.id, content: 'hello' } });
    expect(fromStaff.statusCode).toBe(403);
    expect((await call(chat.getMessages, { user: me, params: { userId: s.id }, query: {} })).statusCode).toBe(403);
    expect(await models.Message.count({ where: { senderId: [me.id, s.id], receiverId: [me.id, s.id] } })).toBe(0);
    expect(await isMutualMatch(me.id, s.id)).toBe(false);

    // Control: the real mutual match chats as before.
    const ok = await call(chat.sendMessage, { user: me, body: { receiverId: real.id, content: 'hello' } });
    expect(ok.statusCode).toBe(200);
    expect(await isMutualMatch(me.id, real.id)).toBe(true);
  });

  t('conversations and the unread badge leave out staff and banned members', async () => {
    const { Message } = models;
    const me = await member();
    const s = await staff('marketing');
    const banned = await member({ gender: 'male', user: { status: 'banned' } });
    const real = await member({ gender: 'male' });
    for (const other of [s, banned, real]) {
      await mutual(me, other);
      await Message.create({ senderId: other.id, receiverId: me.id, content: 'hi', messageType: 'text' });
    }

    const list = await call(chat.getConversations, { user: me, query: {} });
    expect(list.statusCode).toBe(200);
    expect(userIds(list.body.conversations)).toEqual([real.id]);
    expect(list.body.pagination.total).toBe(1);

    const unread = await call(chat.getUnreadMessageCount, { user: me });
    expect(unread.body.count).toBe(1);
  });

  t('a member cannot call a staff "mutual" or a banned account; staff calls leave the history', async () => {
    const { CallSession } = models;
    const me = await member(); const s = await staff('admin');
    const banned = await member({ gender: 'male', user: { status: 'banned' } });
    const real = await member({ gender: 'male' });
    await mutual(me, s); await mutual(me, banned); await mutual(me, real);

    expect((await call(calls.initiateCall, { user: me, body: { calleeId: s.id } })).statusCode).toBe(403);
    expect((await call(calls.initiateCall, { user: me, body: { calleeId: banned.id } })).statusCode).toBe(404);
    const ok = await call(calls.initiateCall, { user: me, body: { calleeId: real.id } });
    expect(ok.statusCode).toBe(201);

    await CallSession.create({ callerId: s.id, calleeId: me.id, channelName: `call_${uniq()}`, type: 'voice', status: 'ended' });
    await CallSession.create({ callerId: me.id, calleeId: s.id, channelName: `call_${uniq()}`, type: 'voice', status: 'ended' });
    const history = await call(calls.getCallHistory, { user: me, query: {} });
    expect(history.body.total).toBe(1);
    expect(history.body.calls.map((c) => [c.callerId, c.calleeId])).toEqual([[me.id, real.id]]);
  });

  t('family groups: staff cannot create or invite, and cannot be invited (same 202 as a miss)', async () => {
    const { Group, GroupMember } = models;
    const owner = await member(); const s = await staff('admin'); const friend = await member({ gender: 'male' });

    expect((await call(groups.createGroup, { user: s, body: { name: 'Staff group' } })).statusCode).toBe(403);
    // A group a staff account already owns (from before) gets no new invitations.
    const old = await Group.create({ name: 'Old', createdBy: s.id });
    await GroupMember.create({ groupId: old.id, userId: s.id, role: 'owner', status: 'active' });
    expect((await call(groups.addMember, { user: s, params: { groupId: old.id }, body: { userId: friend.id } })).statusCode).toBe(403);

    const created = await call(groups.createGroup, { user: owner, body: { name: 'Family' } });
    expect(created.statusCode).toBe(201);
    const groupId = created.body.group.id;
    // A staff account as the group's candidate is refused.
    expect((await call(groups.createGroup, { user: owner, body: { name: 'X', candidateUserId: s.id } })).statusCode).toBe(400);

    const toStaff = await call(groups.addMember, { user: owner, params: { groupId }, body: { userId: s.id } });
    const toFriend = await call(groups.addMember, { user: owner, params: { groupId }, body: { userId: friend.id } });
    expect(toStaff.statusCode).toBe(202);
    expect(toStaff.body).toEqual(toFriend.body);
    expect(await GroupMember.count({ where: { groupId, userId: s.id } })).toBe(0);
    expect(await GroupMember.count({ where: { groupId, userId: friend.id, status: 'pending' } })).toBe(1);
  });

  t('invite links and referral codes never resolve to a staff account', async () => {
    const { resolveCode, getOrCreateMemberCode, ReferralError } = require('../../../utils/referral');
    const { resolveSignupAttribution } = require('../../../utils/signupAttribution');
    const s = await staff('marketing');
    const real = await member();
    const staffToken = crypto.randomBytes(16).toString('hex');
    const staffCode = `TM${uniq().toUpperCase().slice(0, 6)}`;
    await models.User.update({ inviteToken: staffToken, referralCode: staffCode }, { where: { id: s.id } });

    expect((await call(invites.getMyInviteLink, { user: s })).statusCode).toBe(403);
    expect((await call(invites.resolveInvite, { user: null, params: { token: staffToken } })).statusCode).toBe(404);
    await expect(resolveCode(staffCode, null)).rejects.toBeInstanceOf(ReferralError);
    expect(await getOrCreateMemberCode(s.id)).toBeNull();
    expect((await resolveSignupAttribution({ code: staffCode })).invitedBy).toBeNull();
    expect((await resolveSignupAttribution({ invite: staffToken })).invitedBy).toBeNull();

    // Control: a member's own link and code work.
    const link = await call(invites.getMyInviteLink, { user: real });
    expect(link.statusCode).toBe(200);
    expect((await call(invites.resolveInvite, { user: null, params: { token: link.body.invite.token } })).statusCode).toBe(200);
    const memberCode = await getOrCreateMemberCode(real.id);
    expect((await resolveCode(memberCode, null)).referrerUserId).toBe(real.id);
    expect((await resolveSignupAttribution({ code: memberCode })).invitedBy).toBe(real.id);
  });

  t("a guardian's read-only lists leave out staff, banned and blocked people", async () => {
    const config = require('../../../config/env');
    const { errorHandler } = require('../../../middlewares/errorHandler');
    const app = express();
    app.use(express.json());
    app.use('/guardian', require('../../../routes/guardianRoutes'));
    app.use(errorHandler);
    const as = (u) => ({ Authorization: `Bearer ${jwt.sign({ userId: u.id, type: 'access' }, config.auth.jwtSecret, { expiresIn: '5m' })}` });

    const candidate = await member(); const guardian = await member({ gender: 'male' });
    await models.GuardianLink.create({ candidateId: candidate.id, guardianId: guardian.id, inviteEmail: guardian.email, status: 'active' });
    const s = await staff('admin'); const s2 = await staff('marketing');
    const banned = await member({ gender: 'male', user: { status: 'banned' } });
    const blocked = await member({ gender: 'male' });
    const real = await member({ gender: 'male' }); const realSaved = await member({ gender: 'male' });
    for (const o of [s, banned, blocked, real]) await mutual(candidate, o);
    await models.Block.create({ blockerId: candidate.id, blockedUserId: blocked.id });
    await models.Match.create({ userId: candidate.id, matchedUserId: s2.id, action: 'shortlist' });
    await models.Match.create({ userId: candidate.id, matchedUserId: realSaved.id, action: 'shortlist' });

    const matches = await request(app).get(`/guardian/candidate/${candidate.id}/matches`).set(as(guardian));
    expect(matches.status).toBe(200);
    expect(matches.body.matches.map((m) => m.userId)).toEqual([real.id]);
    const saved = await request(app).get(`/guardian/candidate/${candidate.id}/shortlisted`).set(as(guardian));
    expect(saved.body.shortlisted.map((m) => m.userId)).toEqual([realSaved.id]);
  });

  t('a quietly hidden member is still visible to someone they contacted (role only, not hiddenAt)', async () => {
    const me = await member({ gender: 'male' });
    const hidden = await member({ user: { hiddenAt: new Date(), hiddenReason: 'checking details' } });
    await mutual(hidden, me);
    await models.Message.create({ senderId: hidden.id, receiverId: me.id, content: 'hello', messageType: 'text' });

    expect(userIds((await call(match.getLikes, { user: me, query: {} })).body.likes)).toEqual([hidden.id]);
    expect(userIds((await call(match.getMutualMatches, { user: me, query: {} })).body.mutualMatches)).toEqual([hidden.id]);
    expect(userIds((await call(chat.getConversations, { user: me, query: {} })).body.conversations)).toEqual([hidden.id]);
    expect((await call(chat.getUnreadMessageCount, { user: me })).body.count).toBe(1);
    expect((await call(profile.getProfile, { user: me, params: { userId: hidden.id } })).statusCode).toBe(200);
    expect((await call(chat.sendMessage, { user: me, body: { receiverId: hidden.id, content: 'hi back' } })).statusCode).toBe(200);
  });
});

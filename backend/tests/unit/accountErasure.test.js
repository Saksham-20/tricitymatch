/**
 * Account erasure (deep security audit 2026-08-21).
 *
 * DELETE /auth/account used to set User.status='deleted' and destroy the
 * refresh tokens, and nothing else. After a member "deleted" their account the
 * database still held their exact date of birth, birth time, place of birth,
 * caste, income, photos, voice/video intro URLs, the KYC selfie and liveness
 * video, every message they had written, and the name and phone number of a
 * guardian who had never signed up at all.
 *
 * These tests pin which tables erasure must touch. A new table holding personal
 * data should either be added to eraseAccount or consciously listed as retained.
 */

const mockDestroy = () => jest.fn().mockResolvedValue(1);

jest.mock('../../config/database', () => ({
  transaction: jest.fn(async (fn) => fn('TXN')),
  query: jest.fn().mockResolvedValue([[], {}]),
}));

jest.mock('../../models', () => ({
  User: { destroy: jest.fn() },
  Profile: { destroy: jest.fn().mockResolvedValue(1) },
  Verification: { destroy: jest.fn().mockResolvedValue(1) },
  GuardianLink: { destroy: jest.fn().mockResolvedValue(1) },
  ProfileView: { destroy: jest.fn().mockResolvedValue(1) },
  Match: { destroy: jest.fn().mockResolvedValue(1) },
  ContactUnlock: { destroy: jest.fn().mockResolvedValue(1) },
  Notification: { destroy: jest.fn().mockResolvedValue(1) },
  RefreshToken: { destroy: jest.fn().mockResolvedValue(1) },
  CallSession: { destroy: jest.fn().mockResolvedValue(1) },
  AnalyticsEvent: { destroy: jest.fn().mockResolvedValue(1) },
  ChatGrant: { destroy: jest.fn().mockResolvedValue(1) },
  Block: { destroy: jest.fn().mockResolvedValue(1) },
  GroupMember: { destroy: jest.fn().mockResolvedValue(1) },
  Message: { destroy: jest.fn() },
  GroupMessage: { destroy: jest.fn() },
}));

const models = require('../../models');
const sequelize = require('../../config/database');
const { eraseAccount, TOMBSTONE } = require('../../utils/accountErasure');

const USER_ID = '11111111-2222-4333-8444-555555555555';

describe('eraseAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockImplementation(async (fn) => fn('TXN'));
    sequelize.query.mockResolvedValue([[], {}]);
  });

  it('runs entirely inside one transaction', async () => {
    await eraseAccount(USER_ID);
    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
  });

  it('deletes every table that holds this member\'s personal data', async () => {
    await eraseAccount(USER_ID);

    // The profile carries DOB, birth time, place of birth, caste and income.
    expect(models.Profile.destroy).toHaveBeenCalled();
    // The KYC selfie and liveness video.
    expect(models.Verification.destroy).toHaveBeenCalled();
    // A third party's name and phone number, for someone with no account.
    expect(models.GuardianLink.destroy).toHaveBeenCalled();
    for (const m of ['ProfileView', 'Match', 'ContactUnlock', 'Notification',
      'CallSession', 'AnalyticsEvent', 'ChatGrant', 'Block', 'GroupMember',
      'RefreshToken']) {
      expect(models[m].destroy).toHaveBeenCalled();
    }
  });

  it('scopes bidirectional tables to both directions', async () => {
    await eraseAccount(USER_ID);
    // Matches, blocks, views and calls all reference the user from either side;
    // erasing only one direction leaves the counterpart rows behind.
    const where = models.Match.destroy.mock.calls[0][0].where;
    // Op.or is a Symbol key, so JSON.stringify would silently drop it.
    const orSymbol = Object.getOwnPropertySymbols(where)[0];
    expect(orSymbol).toBeDefined();
    const branches = where[orSymbol];
    expect(branches).toHaveLength(2);
    expect(branches[0]).toEqual({ userId: USER_ID });
    expect(branches[1]).toEqual({ matchedUserId: USER_ID });
  });

  it('tombstones message bodies rather than deleting the rows', async () => {
    await eraseAccount(USER_ID);

    const statements = sequelize.query.mock.calls.map((c) => c[0]);
    const msgUpdate = statements.find((s) => s.includes('UPDATE "Messages"'));
    expect(msgUpdate).toBeDefined();
    expect(msgUpdate).toContain('"content" = :tombstone');
    expect(msgUpdate).toContain('"mediaUrl" = NULL');
    // The row must survive so the other participant's thread stays coherent.
    expect(models.Message.destroy).not.toHaveBeenCalled();
    expect(models.GroupMessage.destroy).not.toHaveBeenCalled();
  });

  it('scrubs the identifiers on the User row without deleting it', async () => {
    await eraseAccount(USER_ID);

    const statements = sequelize.query.mock.calls.map((c) => c[0]);
    const userUpdate = statements.find((s) => s.includes('UPDATE "Users"'));
    expect(userUpdate).toBeDefined();
    expect(userUpdate).toContain('"phone" = NULL');
    expect(userUpdate).toContain('"googleId" = NULL');
    expect(userUpdate).toContain('"fcmTokens" = ARRAY[]::text[]');
    expect(userUpdate).toContain('"inviteToken" = NULL');
    expect(userUpdate).toContain(`"status" = 'deleted'`);

    // Five FKs into Users use ON DELETE NO ACTION, so the row must stay.
    expect(models.User.destroy).not.toHaveBeenCalled();
  });

  it('replaces the password with something no password can hash to', async () => {
    await eraseAccount(USER_ID);
    const call = sequelize.query.mock.calls.find(([s]) => s.includes('UPDATE "Users"'));
    expect(call[1].replacements.password).toMatch(/^!erased!/);
    // bcrypt hashes start with $2; this must never look like a usable hash.
    expect(call[1].replacements.password.startsWith('$2')).toBe(false);
  });

  it('gives the scrubbed row a non-identifying tombstone address', async () => {
    await eraseAccount(USER_ID);
    const call = sequelize.query.mock.calls.find(([s]) => s.includes('UPDATE "Users"'));
    expect(call[1].replacements.email).toMatch(/^deleted-[0-9a-f-]{36}@deleted\.invalid$/);
  });

  it('exports the tombstone marker used for message bodies', () => {
    expect(TOMBSTONE).toBe('[deleted]');
  });
});

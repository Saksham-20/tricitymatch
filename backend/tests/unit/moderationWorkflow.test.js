/**
 * Moderation workflow (audit P0-15): reports need priority and an owner, evidence
 * must survive the reported member deleting their account, and a suspended
 * member needs a way to appeal.
 */

jest.mock('../../config/env', () => ({
  email: { support: 'support@example.com' }, isProduction: false, isDevelopment: true,
  features: {}, auth: { jwtSecret: 't' },
}));
const mockSendEmail = jest.fn().mockResolvedValue(undefined);
jest.mock('../../utils/email', () => ({ sendEmail: (...a) => mockSendEmail(...a) }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));
jest.mock('../../models', () => ({
  Block: {}, Report: { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), count: jest.fn() }, User: { findByPk: jest.fn(), findOne: jest.fn(), update: jest.fn() },
  Profile: { findAll: jest.fn() }, Match: {}, ChatGrant: {}, CallSession: {},
  Message: { findAll: jest.fn() }, EvidenceArchive: { create: jest.fn(), destroy: jest.fn() },
  Appeal: { findOne: jest.fn(), create: jest.fn(), findByPk: jest.fn() },
}));
jest.mock('../../config/database', () => ({ transaction: jest.fn(async (fn) => fn('TX')) }));
jest.mock('../../utils/socket', () => ({ getIO: () => null }));

const models = require('../../models');
const { reportUser } = require('../../controllers/blockReportController');
const { submitAppeal, decideAppeal } = require('../../controllers/appealController');
const { preserveEvidence, purgeExpiredEvidence } = require('../../utils/evidencePreservation');

const run = async (handler, req) => {
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  const next = jest.fn();
  handler({ body: {}, params: {}, user: { id: 'admin-1' }, ...req }, res, next);
  await new Promise((r) => setImmediate(r));
  return { res, error: next.mock.calls[0]?.[0] };
};

beforeEach(() => jest.clearAllMocks());

describe('report escalation', () => {
  beforeEach(() => {
    models.User.findByPk.mockResolvedValue({ id: 'bad' });
    models.Report.create.mockImplementation(async (v) => ({ id: 'r1', ...v }));
    // No open report from this reporter, no recent urgent report against the
    // target, and no conversation to snapshot.
    models.Report.findOne.mockResolvedValue(null);
    models.Report.count.mockResolvedValue(0);
    models.Message.findAll.mockResolvedValue([]);
  });
  const file = (reason) => run(reportUser, { user: { id: 'me' }, params: { userId: 'bad' }, body: { reason } });

  it('marks threats, underage and financial-scam reports urgent and mails staff at once', async () => {
    for (const reason of ['threats', 'underage', 'financial_scam']) {
      mockSendEmail.mockClear();
      await file(reason);
      const created = models.Report.create.mock.calls.at(-1)[0];
      expect(created.priority).toBe('urgent');
      expect(created.escalatedAt).toBeInstanceOf(Date);
      expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: ['support@example.com'], subject: expect.stringMatching(/URGENT/) }));
    }
  });

  it('leaves an ordinary report normal and sends nothing', async () => {
    await file('spam');
    const created = models.Report.create.mock.calls[0][0];
    expect(created.priority).toBe('normal');
    expect(created.escalatedAt).toBeNull();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('a failing staff email does not lose the report', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('smtp down'));
    const { res, error } = await file('threats');
    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('evidence preservation', () => {
  it('snapshots the report, the conversation and the profile text before erasure', async () => {
    models.Report.findAll.mockResolvedValue([{ id: 'r1', reporterId: 'rep', reportedUserId: 'bad', reason: 'threats', description: 'd', status: 'pending', createdAt: new Date() }]);
    models.Profile.findAll.mockResolvedValue([{ userId: 'bad', firstName: 'A', bio: 'text' }]);
    models.Message.findAll.mockResolvedValue([{ id: 'm2', content: 'later' }, { id: 'm1', content: 'earlier' }]);

    const out = await preserveEvidence(['bad'], 'TX', { models });

    expect(out.archived).toBe(1);
    const row = models.EvidenceArchive.create.mock.calls[0][0];
    expect(row.subjectUserId).toBe('bad');
    expect(row.payload.messages.map((m) => m.id)).toEqual(['m1', 'm2']); // chronological
    expect(row.payload.subjectProfile.bio).toBe('text');
    const days = (row.preserveUntil - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(179);
    expect(days).toBeLessThan(181);
    expect(models.EvidenceArchive.create.mock.calls[0][1]).toEqual({ transaction: 'TX' });
  });

  it('archives nothing for a member nobody reported', async () => {
    models.Report.findAll.mockResolvedValue([]);
    expect(await preserveEvidence(['clean'], 'TX', { models })).toEqual({ archived: 0 });
    expect(models.EvidenceArchive.create).not.toHaveBeenCalled();
  });

  it('purges only what has expired', async () => {
    models.EvidenceArchive.destroy.mockResolvedValue(3);
    const now = new Date('2027-01-01T00:00:00Z');
    expect(await purgeExpiredEvidence(models, now)).toEqual({ removed: 3 });
    const where = models.EvidenceArchive.destroy.mock.calls[0][0].where;
    expect(where.preserveUntil[Object.getOwnPropertySymbols(where.preserveUntil)[0]]).toBe(now);
  });
});

describe('appeals', () => {
  it('stores an appeal from a suspended account and tells staff', async () => {
    models.User.findOne.mockResolvedValue({ id: 'u1', status: 'banned' });
    models.Appeal.findOne.mockResolvedValue(null);
    models.Appeal.create.mockResolvedValue({ id: 'a1' });
    const { res } = await run(submitAppeal, { body: { email: 'Me@Example.com', statement: 'I believe this suspension was a mistake, please look again.' } });
    expect(models.Appeal.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', email: 'me@example.com' }));
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it('answers identically for an unknown email and stores nothing (no account oracle)', async () => {
    models.User.findOne.mockResolvedValue(null);
    const known = await run(submitAppeal, { body: { email: 'x@example.com', statement: 'A statement long enough to be accepted here.' } });
    expect(models.Appeal.create).not.toHaveBeenCalled();
    models.User.findOne.mockResolvedValue({ id: 'u1' });
    models.Appeal.findOne.mockResolvedValue(null);
    models.Appeal.create.mockResolvedValue({ id: 'a1' });
    const unknown = await run(submitAppeal, { body: { email: 'y@example.com', statement: 'A statement long enough to be accepted here.' } });
    expect(known.res.json.mock.calls[0][0]).toEqual(unknown.res.json.mock.calls[0][0]);
  });

  it('does not stack a second pending appeal', async () => {
    models.User.findOne.mockResolvedValue({ id: 'u1' });
    models.Appeal.findOne.mockResolvedValue({ id: 'existing' });
    await run(submitAppeal, { body: { email: 'x@example.com', statement: 'Another appeal statement that is long enough.' } });
    expect(models.Appeal.create).not.toHaveBeenCalled();
  });

  it('overturning reactivates only a suspended account, records who decided, and emails the member', async () => {
    const appeal = { id: 'a1', userId: 'u1', email: 'm@example.com', status: 'pending', save: jest.fn() };
    models.Appeal.findByPk.mockResolvedValue(appeal);
    models.User.findByPk.mockResolvedValue({ id: 'u1', role: 'user' });
    const { error } = await run(decideAppeal, { params: { id: 'a1' }, body: { decision: 'overturned', note: 'Reviewed the chat; no breach found.' } });
    expect(error).toBeUndefined();
    expect(appeal).toMatchObject({ status: 'overturned', decidedBy: 'admin-1' });
    const args = models.User.update.mock.calls[0];
    expect(args[0]).toEqual({ status: 'active' });
    expect(Object.getOwnPropertySymbols(args[1].where.status).length).toBe(1); // IN [banned, inactive] only
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'm@example.com' }));
  });

  it('upholding leaves the account alone; a decided appeal cannot be decided again', async () => {
    const appeal = { id: 'a1', userId: 'u1', email: 'm@example.com', status: 'pending', save: jest.fn() };
    models.Appeal.findByPk.mockResolvedValue(appeal);
    await run(decideAppeal, { params: { id: 'a1' }, body: { decision: 'upheld', note: 'The evidence is clear; decision stands.' } });
    expect(models.User.update).not.toHaveBeenCalled();
    const again = await run(decideAppeal, { params: { id: 'a1' }, body: { decision: 'overturned', note: 'Changing my mind after review.' } });
    expect(again.error).toMatchObject({ statusCode: 409 });
  });

  it('requires a real note', async () => {
    const { error } = await run(decideAppeal, { params: { id: 'a1' }, body: { decision: 'overturned', note: 'ok' } });
    expect(error).toMatchObject({ statusCode: 400 });
  });
});

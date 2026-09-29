/**
 * P1-7: a photo-verified badge must reflect the CURRENT profile, reviewers cannot
 * approve themselves, and a selfie must come out of a capture session the server
 * started.
 */

jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logAudit: jest.fn(),
}));

const { fingerprintOf, revalidateVerification } = require('../../utils/verificationFingerprint');
const { startSession, consumeSession, MIN_CAPTURE_MS } = require('../../utils/captureSession');

const profile = (over = {}) => ({
  profilePhoto: 'https://x/a.jpg', firstName: 'Asha', lastName: 'Verma',
  dateOfBirth: '1999-04-02', gender: 'female', ...over,
});

describe('fingerprintOf', () => {
  it('changes when the main photo, name, date of birth or gender changes', () => {
    const base = fingerprintOf(profile());
    for (const over of [
      { profilePhoto: 'https://x/b.jpg' }, { firstName: 'Riya' }, { lastName: 'Sharma' },
      { dateOfBirth: '1998-04-02' }, { gender: 'male' },
    ]) {
      expect(fingerprintOf(profile(over))).not.toBe(base);
    }
  });

  it('ignores case, surrounding space and the time part of a date', () => {
    expect(fingerprintOf(profile({ firstName: '  ASHA ', dateOfBirth: '1999-04-02T00:00:00.000Z' })))
      .toBe(fingerprintOf(profile()));
  });

  it('ignores fields the reviewer did not compare', () => {
    expect(fingerprintOf({ ...profile(), photos: ['https://x/other.jpg'], city: 'Mohali' })).toBe(fingerprintOf(profile()));
  });
});

describe('revalidateVerification', () => {
  const make = (verificationRow, profileRow) => {
    const Verification = { findOne: jest.fn(async () => verificationRow) };
    const Profile = { findOne: jest.fn(async () => profileRow) };
    const notify = jest.fn(async () => {});
    const log = { error: jest.fn() };
    return { deps: { Verification, Profile, notify, log }, notify };
  };
  const approved = (fp) => ({
    status: 'approved', approvedFingerprint: fp, adminNotes: null, verifiedAt: new Date(), verifiedBy: 'admin1',
    save: jest.fn(async () => {}),
  });

  it('keeps the badge when nothing the reviewer compared has changed', async () => {
    const v = approved(fingerprintOf(profile()));
    const { deps, notify } = make(v, profile());
    expect(await revalidateVerification('u1', deps)).toBe(false);
    expect(v.status).toBe('approved');
    expect(notify).not.toHaveBeenCalled();
  });

  it('withdraws the badge and queues a re-check when the main photo changes', async () => {
    const v = approved(fingerprintOf(profile()));
    const { deps, notify } = make(v, profile({ profilePhoto: 'https://x/new.jpg' }));
    expect(await revalidateVerification('u1', deps)).toBe(true);
    expect(v.status).toBe('pending');
    expect(v.verifiedAt).toBeNull();
    expect(v.approvedFingerprint).toBeNull();
    expect(v.save).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('u1', 'system', expect.stringContaining('verification'), expect.any(String));
  });

  it('does nothing for a member with no approved verification or no fingerprint', async () => {
    expect(await revalidateVerification('u1', make(null, profile()).deps)).toBe(false);
    expect(await revalidateVerification('u1', make(approved(null), profile()).deps)).toBe(false);
  });
});

describe('captureSession', () => {
  it('accepts a token once, for its own member, after a plausible capture time', async () => {
    const { token } = await startSession('u1');
    const later = Date.now() + MIN_CAPTURE_MS + 500;
    expect(await consumeSession('u1', token, later)).toEqual({ ok: true });
    expect((await consumeSession('u1', token, later)).ok).toBe(false); // single use
  });

  it("refuses another member's token", async () => {
    const { token } = await startSession('u1');
    expect((await consumeSession('u2', token, Date.now() + 5000)).ok).toBe(false);
  });

  it('refuses a token used faster than a person can take a photo', async () => {
    const { token } = await startSession('u1');
    expect(await consumeSession('u1', token, Date.now())).toEqual({ ok: false, reason: 'too_fast' });
  });

  it('refuses missing, malformed and made-up tokens', async () => {
    expect((await consumeSession('u1', undefined)).ok).toBe(false);
    expect((await consumeSession('u1', 'short')).ok).toBe(false);
    expect((await consumeSession('u1', 'a'.repeat(48))).ok).toBe(false);
  });
});

describe('precheckSubmission', () => {
  const load = ({ profilePhoto, required = true }) => {
    jest.resetModules();
    jest.doMock('../../models', () => ({
      Verification: {},
      Profile: { findOne: jest.fn(async () => ({ profilePhoto })) },
    }));
    jest.doMock('../../config/env', () => ({ verification: { requireCaptureToken: required } }));
    return require('../../controllers/verificationController');
  };
  const run = async (ctl, headers = {}) => {
    const next = jest.fn();
    await ctl.precheckSubmission({ user: { id: 'u1' }, get: (h) => headers[h.toLowerCase()] }, {}, next);
    await new Promise((r) => setImmediate(r));
    return next;
  };

  it('refuses a member with no profile photo', async () => {
    const next = await run(load({ profilePhoto: null }));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('refuses a submission with no capture token', async () => {
    const next = await run(load({ profilePhoto: 'p.jpg' }));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('lets a submission through with a fresh capture token', async () => {
    const ctl = load({ profilePhoto: 'p.jpg' });
    const { startSession: start } = require('../../utils/captureSession');
    const { token } = await start('u1');
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);
    const next = await run(ctl, { 'x-capture-token': token });
    Date.now.mockRestore();
    expect(next).toHaveBeenCalledWith();
  });

  it('skips the token when the emergency flag is off, but still needs a photo', async () => {
    expect(await run(load({ profilePhoto: 'p.jpg', required: false }))).toHaveBeenCalledWith();
    const next = await run(load({ profilePhoto: null, required: false }));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});

describe('updateVerification (admin)', () => {
  const load = ({ verification, memberProfile }) => {
    jest.resetModules();
    jest.doMock('../../models', () => ({
      Verification: { findByPk: jest.fn(async () => verification) },
      Profile: { findOne: jest.fn(async () => memberProfile) },
      User: { findByPk: jest.fn(async () => null) },
    }));
    jest.doMock('../../config/env', () => jest.requireActual('../../config/env'));
    jest.doMock('../../config/database', () => ({ query: jest.fn(), transaction: jest.fn(), fn: jest.fn(), col: jest.fn(), literal: jest.fn() }));
    return require('../../controllers/adminController');
  };
  const run = async (ctl, { status = 'approved', adminId = 'admin1' } = {}) => {
    const res = { json: jest.fn() };
    const next = jest.fn();
    await ctl.updateVerification({ params: { verificationId: 'v1' }, body: { status }, user: { id: adminId } }, res, next);
    await new Promise((r) => setImmediate(r));
    return { res, next };
  };
  const row = (over = {}) => ({ id: 'v1', userId: 'member1', status: 'pending', save: jest.fn(async () => {}), ...over });

  it('a reviewer cannot rule on their own verification', async () => {
    const v = row({ userId: 'admin1' });
    const { next } = await run(load({ verification: v, memberProfile: profile() }));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(v.save).not.toHaveBeenCalled();
  });

  it('approval needs a profile photo to compare against', async () => {
    const v = row();
    const { next } = await run(load({ verification: v, memberProfile: profile({ profilePhoto: null }) }));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(v.save).not.toHaveBeenCalled();
  });

  it('approval records what was compared; rejection clears it', async () => {
    const v = row();
    const ctl = load({ verification: v, memberProfile: profile() });
    await run(ctl, { status: 'approved' });
    expect(v.status).toBe('approved');
    expect(v.approvedFingerprint).toBe(fingerprintOf(profile()));

    await run(ctl, { status: 'rejected' });
    expect(v.status).toBe('rejected');
    expect(v.approvedFingerprint).toBeNull();
  });
});

/**
 * Who the optional member mails reach, on a real database:
 *  - the weekly digest and the photo nudge are for MEMBERS. A staff or partner
 *    account (some are promoted personal accounts with a real profile) used to
 *    get "N new profiles for you" and "add a photo" mail;
 *  - a member who left the optional-email box unticked at signup gets neither
 *    (signup records that as the same opt-out the unsubscribe link sets);
 *  - a member with no recorded choice (accounts from before the box existed)
 *    is NOT treated as having declined.
 */

jest.mock('../../../utils/email', () => ({
  sendWeeklyDigest: jest.fn(async () => ({ success: true })),
  sendAddPhotoNudge: jest.fn(async () => ({ success: true })),
}));

const { describeDb, makeMember, removeMembers } = require('../../helpers/db');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// How signup records an unticked "email me reminders" box (authController).
const declinedAtSignup = () => ({
  consent: { termsVersion: '2026-10-10', acceptedAt: new Date().toISOString(), marketing: false, history: [] },
  lifecycleMail: { emailOptOut: new Date().toISOString() },
});
const ticked = () => ({
  consent: { termsVersion: '2026-10-10', acceptedAt: new Date().toISOString(), marketing: true, history: [] },
});
// Consent recorded before the optional box existed: no `marketing` key at all.
const noChoiceRecorded = () => ({
  consent: { termsVersion: '2026-08-26', acceptedAt: new Date().toISOString(), history: [] },
});

describeDb('who the optional member mails reach', (t) => {
  const ids = [];
  let email;

  beforeAll(() => { email = require('../../../utils/email'); });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => { await removeMembers(ids); });

  const mk = async (user, profile) => {
    const m = await makeMember({ user: { emailVerified: true, ...user }, profile });
    ids.push(m.user.id);
    return m.user;
  };
  const male = { gender: 'male', dateOfBirth: '1993-06-01' };

  t('weekly digest: members are mailed, including ones with no recorded choice; staff, partners and decliners are not', async () => {
    // Someone of the other gender for everyone to be told about.
    const woman = await mk({}, { gender: 'female' });
    const plain = await mk({}, male);
    const optedIn = await mk(ticked(), male);
    const noChoice = await mk(noChoiceRecorded(), male);
    const declined = await mk(declinedAtSignup(), male);
    const admin = await mk({ role: 'admin' }, male);
    const partner = await mk({ role: 'marketing' }, { gender: 'female' });

    const { setupCleanupProcessor } = require('../../../utils/queue');
    const handlers = {};
    setupCleanupProcessor({ process: (name, fn) => { handlers[name] = fn; } });
    await handlers['send-weekly-digest']({});

    const mailed = email.sendWeeklyDigest.mock.calls.map(([to]) => to);
    expect(mailed).toEqual(expect.arrayContaining([woman.email, plain.email, optedIn.email, noChoice.email]));
    expect(mailed).not.toContain(declined.email);
    expect(mailed).not.toContain(admin.email);
    expect(mailed).not.toContain(partner.email);
  });

  t('photo nudge: members without a photo are nudged, including ones with no recorded choice; staff and decliners are not', async () => {
    const complete = { onboardingComplete: true, photos: [] };
    const member = await mk({}, { ...complete });
    const noChoice = await mk(noChoiceRecorded(), { ...complete });
    const declined = await mk(declinedAtSignup(), { ...complete });
    const admin = await mk({ role: 'admin' }, { ...male, ...complete });
    const partner = await mk({ role: 'marketing_manager' }, { ...complete });

    // Four days on, at 21:40 IST: inside the send window and past every
    // member's slot, and past the 1-3 day wait for the first nudge.
    const at = new Date(Date.now() + 4 * DAY);
    at.setUTCHours(16, 10, 0, 0);

    const { runPhotoNudge } = require('../../../utils/lifecycleMail');
    await runPhotoNudge(at);

    const nudged = email.sendAddPhotoNudge.mock.calls.map(([to]) => to);
    expect(nudged).toEqual(expect.arrayContaining([member.email, noChoice.email]));
    expect(nudged).not.toContain(declined.email);
    expect(nudged).not.toContain(admin.email);
    expect(nudged).not.toContain(partner.email);
  });
});

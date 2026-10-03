/**
 * Who may unlock a member's contact details, and which number they get.
 *
 * The owner's `contact` level (everyone | matches | hidden) is enforced before
 * any unlock is spent, applies to unlocks already paid for, and the number
 * returned is the separately verified contact number when one is set.
 */

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

const DAY = 24 * 60 * 60 * 1000;

describeDb('contact sharing level', (t) => {
  const ids = [];
  let models;
  beforeAll(() => { models = require('../../../models'); });
  afterAll(() => removeMembers(ids));

  const member = async (o = {}) => { const m = await makeMember(o); ids.push(m.user.id); return m.user; };
  const sub = (userId) => models.Subscription.create({
    userId, planType: 'premium_plus', amount: 109900, status: 'active',
    startDate: new Date(Date.now() - DAY), endDate: new Date(Date.now() + 30 * DAY),
    contactUnlocksAllowed: 5, contactUnlocksUsed: 0,
    razorpayPaymentId: `pay_${Math.random().toString(36).slice(2)}`,
  });
  const phoneOf = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;
  const owner = (level, extra = {}) => member({
    user: { phone: phoneOf(), phoneVerified: true, ...extra },
    profile: level ? { fieldVisibility: { contact: level } } : {},
  });
  const mutual = async (a, b) => {
    await models.Match.create({ userId: a.id, matchedUserId: b.id, action: 'like', isMutual: true });
    await models.Match.create({ userId: b.id, matchedUserId: a.id, action: 'like', isMutual: true });
  };
  const used = async (viewer) => (await models.Subscription.findOne({ where: { userId: viewer.id } })).contactUnlocksUsed;

  // unlockContact reads req.subscription (set by checkContactUnlockLimit); build it the same way.
  const unlockAs = async (viewer, target) => {
    const { unlockContact } = require('../../../controllers/profileController');
    const subscription = await models.Subscription.findOne({ where: { userId: viewer.id } });
    return new Promise((resolve) => {
      const res = {
        statusCode: 200, body: undefined,
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; resolve(this); return this; },
      };
      const next = (err) => { res.statusCode = (err && err.statusCode) || 500; res.body = { error: err }; resolve(res); };
      unlockContact({ user: { id: viewer.id, role: 'user' }, params: { userId: target.id }, subscription, body: {}, query: {}, headers: {}, ip: '127.0.0.1', get: () => '' }, res, next);
    });
  };

  t('default (nothing chosen) still unlocks and spends one', async () => {
    const o = await owner(null); const v = await member(); await sub(v.id);
    const res = await unlockAs(v, o);
    expect(res.statusCode).toBe(200);
    expect(res.body.contact.phone).toBe(o.phone);
    expect(await used(v)).toBe(1);
  });

  t('hidden: refused with CONTACT_NOT_SHARED and nothing is spent', async () => {
    const o = await owner('hidden'); const v = await member(); await sub(v.id);
    const res = await unlockAs(v, o);
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('CONTACT_NOT_SHARED');
    expect(await used(v)).toBe(0);
  });

  t('matches: a stranger is refused without spending, a mutual match gets the number', async () => {
    const o = await owner('matches'); const stranger = await member(); await sub(stranger.id);
    const refused = await unlockAs(stranger, o);
    expect(refused.statusCode).toBe(403);
    expect(refused.body.error.code).toBe('CONTACT_MATCHES_ONLY');
    expect(await used(stranger)).toBe(0);

    const friend = await member(); await sub(friend.id); await mutual(friend, o);
    const ok = await unlockAs(friend, o);
    expect(ok.statusCode).toBe(200);
    expect(ok.body.contact.phone).toBe(o.phone);
    expect(await used(friend)).toBe(1);
  });

  t('tightening the setting later also closes an unlock that was already paid for', async () => {
    const o = await owner(null); const v = await member(); await sub(v.id);
    expect((await unlockAs(v, o)).statusCode).toBe(200);
    await models.Profile.update({ fieldVisibility: { contact: 'hidden' } }, { where: { userId: o.id } });
    const again = await unlockAs(v, o);
    expect(again.statusCode).toBe(403);
    expect(again.body.error.code).toBe('CONTACT_NOT_SHARED');
    // and the profile payload no longer carries the number
    const { getProfile } = require('../../../controllers/profileController');
    const seen = await call(getProfile, { user: { id: v.id, role: 'user' }, params: { userId: o.id } });
    expect(seen.body.contactShare).toEqual({ level: 'hidden', allowed: false });
    expect(seen.body.profile.User?.phone).toBeUndefined();
  });

  t('a separate verified contact number is the one revealed, not the login number', async () => {
    const contact = phoneOf();
    const o = await owner(null, { contactPhone: contact }); const v = await member(); await sub(v.id);
    const res = await unlockAs(v, o);
    expect(res.statusCode).toBe(200);
    expect(res.body.contact.phone).toBe(contact);
    expect(res.body.contact.phone).not.toBe(o.phone);
  });

  t('an owner with no verified number at all: 409 and nothing spent', async () => {
    const o = await member({ user: { phone: null, phoneVerified: false } }); const v = await member(); await sub(v.id);
    const res = await unlockAs(v, o);
    expect(res.statusCode).toBe(409);
    expect(await used(v)).toBe(0);
  });
});

/**
 * Clearing a field from the editor (PROF-04): the web editor now sends '' for a
 * field the member emptied, and the whole chain (validators -> controller -> DB)
 * must store it as empty. Run through the real validator chain, as the route does.
 */

const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('clearing profile fields', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  const validated = async (body) => {
    const { updateProfileValidation } = require('../../../validators');
    const req = { body, headers: {}, query: {}, params: {} };
    for (const rule of updateProfileValidation) {
      if (typeof rule.run === 'function') await rule.run(req);
    }
    return req.body;
  };

  t('bio, gotra, income and an enum emptied by the editor persist as empty after a reload', async () => {
    const { updateProfile } = require('../../../controllers/profileController');
    const { Profile } = require('../../../models');
    const m = await makeMember({ profile: { bio: 'About me', gotra: 'Kashyap', income: 500000, diet: 'vegetarian', weight: 60 } });
    ids.push(m.user.id);

    const res = await call(updateProfile, { user: m.user, body: await validated({
      bio: '', gotra: '', income: '', diet: '', weight: '',
      // identity fields the editor never blanks, but a hand-crafted '' must not break either
      dateOfBirth: '',
    }) });
    expect(res.statusCode).toBe(200);

    const p = await Profile.findOne({ where: { userId: m.user.id } });
    expect(p.bio).toBe('');
    expect(p.gotra).toBe('');
    expect(p.income).toBeNull();
    expect(p.diet).toBeNull();
    expect(p.weight).toBeNull();
    // '' date of birth is ignored, not stored
    expect(p.dateOfBirth).not.toBeNull();
  });
});

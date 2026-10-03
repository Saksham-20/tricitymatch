/** PROF-14: incognito mode can be switched from the privacy endpoint. */
const { describeDb, makeMember, removeMembers, call } = require('../../helpers/db');

describeDb('privacy settings: incognito', (t) => {
  const ids = [];
  afterAll(() => removeMembers(ids));

  t('PUT /profile/privacy persists incognitoMode and echoes it', async () => {
    const { updatePrivacySettings } = require('../../../controllers/profileController');
    const { Profile } = require('../../../models');
    const m = await makeMember(); ids.push(m.user.id);
    const on = await call(updatePrivacySettings, { user: m.user, body: { incognitoMode: true } });
    expect(on.statusCode).toBe(200);
    expect(on.body.profile.incognitoMode).toBe(true);
    expect((await Profile.findOne({ where: { userId: m.user.id } })).incognitoMode).toBe(true);
    // a save that leaves it out must not flip it back
    await call(updatePrivacySettings, { user: m.user, body: { showLastSeen: false } });
    expect((await Profile.findOne({ where: { userId: m.user.id } })).incognitoMode).toBe(true);
    await call(updatePrivacySettings, { user: m.user, body: { incognitoMode: false } });
    expect((await Profile.findOne({ where: { userId: m.user.id } })).incognitoMode).toBe(false);
  });
});

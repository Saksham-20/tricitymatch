/** PROF-18: preferred height, spotify and personality fields return 400, not a DB 500. */
const { validationResult } = require('express-validator');
const { updateProfileValidation } = require('../../validators');

const fieldsWithErrors = async (body) => {
  const req = { body, headers: {}, query: {}, params: {} };
  for (const rule of updateProfileValidation) if (typeof rule.run === 'function') await rule.run(req);
  return validationResult(req).array().map((e) => e.path || e.param);
};

describe('profile validators (PROF-18)', () => {
  it.each([
    [{ preferredHeightMin: 'abc' }, 'preferredHeightMin'],
    [{ preferredHeightMin: '99999999999' }, 'preferredHeightMin'],
    [{ preferredHeightMax: '90' }, 'preferredHeightMax'],
    [{ preferredHeightMin: '180', preferredHeightMax: '160' }, 'preferredHeightMax'],
    [{ spotifyPlaylist: 'x'.repeat(300) }, 'spotifyPlaylist'],
    [{ personalityType: 'y'.repeat(300) }, 'personalityType'],
  ])('rejects %j', async (body, field) => {
    expect(await fieldsWithErrors(body)).toContain(field);
  });

  it('accepts sensible values and cleared fields', async () => {
    expect(await fieldsWithErrors({ preferredHeightMin: '150', preferredHeightMax: '180', spotifyPlaylist: 'https://open.spotify.com/playlist/1', personalityType: 'INFJ' })).toEqual([]);
    expect(await fieldsWithErrors({ preferredHeightMin: '', preferredHeightMax: '', spotifyPlaylist: '' })).toEqual([]);
  });
});

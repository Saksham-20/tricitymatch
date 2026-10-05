/**
 * DELETE /profile/me/photo accepts the photo the member actually has: a
 * Cloudinary (or other absolute) URL, or a relative /uploads/ path for a photo
 * stored on local disk. isURL() alone rejected the latter, so it could never be
 * deleted.
 */
const { validationResult } = require('express-validator');
const { deletePhotoValidation } = require('../../validators');

const check = async (photoUrl) => {
  const req = { body: { photoUrl } };
  for (const rule of deletePhotoValidation) await rule.run(req);
  return validationResult(req);
};

describe('deletePhotoValidation', () => {
  it.each([
    'https://res.cloudinary.com/demo/image/upload/v1/tricitymatch/profiles/a.jpg',
    '/uploads/photos-1700000000000.jpg',
  ])('accepts %s', async (url) => {
    expect((await check(url)).isEmpty()).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['missing', undefined],
    ['not a string', 123],
    ['not a url', 'not a url'],
    ['another local path', '/etc/passwd'],
  ])('refuses %s', async (_label, value) => {
    expect((await check(value)).isEmpty()).toBe(false);
  });
});

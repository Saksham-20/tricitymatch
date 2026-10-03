/**
 * PROF-07: gallery photos must use the gallery storage (1200px limit), not the
 * face-cropped 500px square used for the main photo.
 * PROF-09: only saves that carry a photo count against the 20/hour upload limiter.
 */

jest.mock('../../middlewares/security', () => ({
  uploadLimiter: jest.fn((req, res, next) => next('limited')),
}));

const upload = require('../../middlewares/upload');
const security = require('../../middlewares/security');

describe('perFieldPhotoStorage', () => {
  const spy = (storage) => {
    storage._handleFile = jest.fn((req, file, cb) => cb(null, {}));
    storage._removeFile = jest.fn((req, file, cb) => cb(null));
  };
  beforeEach(() => { spy(upload.profilePhotoStorage); spy(upload.galleryPhotoStorage); });

  it('sends the gallery field to the gallery storage and the main photo to the face-crop storage', () => {
    const cb = jest.fn();
    upload.perFieldPhotoStorage._handleFile({}, { fieldname: 'photos' }, cb);
    expect(upload.galleryPhotoStorage._handleFile).toHaveBeenCalledTimes(1);
    expect(upload.profilePhotoStorage._handleFile).not.toHaveBeenCalled();

    upload.perFieldPhotoStorage._handleFile({}, { fieldname: 'profilePhoto' }, cb);
    expect(upload.profilePhotoStorage._handleFile).toHaveBeenCalledTimes(1);
  });

  it('removes a file from the storage that wrote it', () => {
    upload.perFieldPhotoStorage._removeFile({}, { fieldname: 'photos' }, jest.fn());
    expect(upload.galleryPhotoStorage._removeFile).toHaveBeenCalledTimes(1);
    expect(upload.profilePhotoStorage._removeFile).not.toHaveBeenCalled();
  });

  it('the two storages are distinct (gallery is not squared to the profile crop)', () => {
    expect(upload.galleryPhotoStorage).not.toBe(upload.profilePhotoStorage);
  });
});

describe('uploadLimitWhenPhotos', () => {
  beforeEach(() => security.uploadLimiter.mockClear());
  const run = (headers) => {
    const next = jest.fn();
    upload.uploadLimitWhenPhotos({ headers }, {}, next);
    return next;
  };

  it('lets a small text-only save through without touching the upload limiter', () => {
    const next = run({ 'content-length': '2400' });
    expect(next).toHaveBeenCalledWith();
    expect(security.uploadLimiter).not.toHaveBeenCalled();
  });

  it('applies the upload limiter to a save carrying a photo', () => {
    const next = run({ 'content-length': String(900 * 1024) });
    expect(security.uploadLimiter).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith('limited');
  });

  it('fails closed when the length is not declared', () => {
    run({});
    expect(security.uploadLimiter).toHaveBeenCalledTimes(1);
  });
});

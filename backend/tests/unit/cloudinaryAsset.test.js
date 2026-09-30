/**
 * Media URL parsing (platform audit 2026-09-29, P0-7).
 *
 * The old parser returned only a public_id, so every delete used Cloudinary's
 * default resource_type of `image`. Voice notes and video intros are stored as
 * `video`, so destroying them "succeeded" with `not found` and left the file
 * live on a public URL.
 */

const { parseCloudinaryAsset } = require('../../utils/cloudinaryAsset');

describe('parseCloudinaryAsset', () => {
  it('reads resource type, delivery type and public_id from an image URL', () => {
    expect(parseCloudinaryAsset('https://res.cloudinary.com/demo/image/upload/v1712345/profile-photos/abc123.jpg'))
      .toEqual({ kind: 'cloudinary', publicId: 'profile-photos/abc123', resourceType: 'image', type: 'upload' });
  });

  it('reports VIDEO for voice notes and video intros (the bug: they were destroyed as images)', () => {
    expect(parseCloudinaryAsset('https://res.cloudinary.com/demo/video/upload/v99/voice-intros/note.mp3'))
      .toMatchObject({ resourceType: 'video', publicId: 'voice-intros/note' });
  });

  it('ignores transformation segments, with or without a version', () => {
    expect(parseCloudinaryAsset('https://res.cloudinary.com/demo/image/upload/c_fill,w_500/v1/gallery/z.webp').publicId)
      .toBe('gallery/z');
    expect(parseCloudinaryAsset('https://res.cloudinary.com/demo/image/upload/c_fill,w_500/gallery/z.webp').publicId)
      .toBe('gallery/z');
  });

  it('keeps the extension for raw assets and understands authenticated delivery', () => {
    expect(parseCloudinaryAsset('https://res.cloudinary.com/demo/raw/upload/v1/docs/file.pdf').publicId).toBe('docs/file.pdf');
    expect(parseCloudinaryAsset('https://res.cloudinary.com/demo/image/authenticated/v1/verification-docs/s.jpg'))
      .toMatchObject({ type: 'authenticated', publicId: 'verification-docs/s' });
  });

  it('decodes percent-encoded ids', () => {
    expect(parseCloudinaryAsset('https://res.cloudinary.com/demo/image/upload/v1/folder/my%20photo.jpg').publicId)
      .toBe('folder/my photo');
  });

  it('recognises the local disk fallback', () => {
    expect(parseCloudinaryAsset('/uploads/photos/a.jpg')).toEqual({ kind: 'local', file: 'photos/a.jpg' });
  });

  it.each([
    ['a non-Cloudinary host', 'https://evil.example/demo/image/upload/v1/a.jpg'],
    ['a look-alike host', 'https://cloudinary.com.evil.example/demo/image/upload/v1/a.jpg'],
    ['an unknown resource type', 'https://res.cloudinary.com/demo/audio/upload/v1/a.mp3'],
    ['path traversal in a local path', '/uploads/../../etc/passwd'],
    ['an empty local path', '/uploads/'],
    ['garbage', 'not a url'],
    ['empty', ''],
    ['null', null],
    ['a number', 42],
  ])('returns null for %s', (_label, input) => {
    expect(parseCloudinaryAsset(input)).toBeNull();
  });
});

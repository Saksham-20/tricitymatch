/**
 * Upload magic-byte validation tests (SEC-4 full)
 * Confirms validateUploadedFiles rejects disk-stored files whose real bytes
 * don't match the declared MIME type, and accepts genuine ones.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateUploadedFiles } = require('../../middlewares/upload');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));

const writeTmp = (name, bytes) => {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, Buffer.from(bytes));
  return p;
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const FAKE = [0x3c, 0x3f, 0x70, 0x68, 0x70, 0, 0, 0, 0, 0, 0, 0]; // '<?php'

const run = (file) => {
  const req = { file };
  const next = jest.fn();
  validateUploadedFiles(req, {}, next);
  return next;
};

afterAll(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('validateUploadedFiles magic-byte check', () => {
  it('accepts a genuine PNG on disk', () => {
    const p = writeTmp('real.png', PNG_MAGIC);
    const next = run({ path: p, mimetype: 'image/png', originalname: 'real.png' });
    expect(next).toHaveBeenCalledWith(); // no error
  });

  it('rejects a file whose bytes do not match the declared PNG type', () => {
    const p = writeTmp('fake.png', FAKE);
    const next = run({ path: p, mimetype: 'image/png', originalname: 'fake.png' });
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    // rejected file is removed
    expect(fs.existsSync(p)).toBe(false);
  });

  it('rejects a JPEG-headed file declared as PNG', () => {
    const p = writeTmp('mismatch.png', JPEG_MAGIC);
    const next = run({ path: p, mimetype: 'image/png', originalname: 'mismatch.png' });
    expect(next.mock.calls[0][0]).toBeDefined();
  });

  it('skips magic-byte check for cloudinary-hosted files', () => {
    const next = run({
      path: 'https://res.cloudinary.com/demo/image/upload/v1/x.png',
      mimetype: 'image/png',
      originalname: 'x.png',
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('passes when no files are present', () => {
    const next = jest.fn();
    validateUploadedFiles({}, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});

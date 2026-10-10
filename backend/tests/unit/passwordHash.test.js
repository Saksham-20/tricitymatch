/**
 * utils/passwordHash — native bcrypt and bcryptjs must be interchangeable.
 *
 * Every existing member's hash was made by bcryptjs. Turning BCRYPT_NATIVE on
 * must not lock anyone out, and turning it off again must not lock out anyone
 * who set a password while it was on.
 */

const bcryptjs = require('bcryptjs');
const nativeBcrypt = require('bcrypt');

// config/env.js is deep-frozen at first require, so each case loads a fresh copy
// of the module graph with the env it needs.
const loadWith = (env, mocks = () => {}) => {
  let mod;
  jest.isolateModules(() => {
    Object.assign(process.env, env);
    mocks();
    mod = require('../../utils/passwordHash');
  });
  return mod;
};

const ROUNDS = 4; // the minimum both libraries accept; keeps the suite fast

const PASSWORDS = [
  'Pass@1234',
  // Over bcrypt's 72-byte input limit: both libraries must truncate the same way.
  'A1!' + 'x'.repeat(100),
  // Devanagari is 3 bytes per character in UTF-8, so this crosses 72 bytes early.
  'पासवर्ड@123' + 'अ'.repeat(30),
];

describe('passwordHash', () => {
  const saved = { BCRYPT_NATIVE: process.env.BCRYPT_NATIVE, BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS };
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    jest.dontMock('bcrypt');
    jest.dontMock('../../middlewares/logger');
  });

  test.each(PASSWORDS)('a bcryptjs hash verifies with native bcrypt and back (%#)', async (pw) => {
    const jsHash = await bcryptjs.hash(pw, ROUNDS);
    const nativeHash = await nativeBcrypt.hash(pw, ROUNDS);
    await expect(nativeBcrypt.compare(pw, jsHash)).resolves.toBe(true);
    await expect(bcryptjs.compare(pw, nativeHash)).resolves.toBe(true);
    // Past 72 bytes an extra character is ignored; both libraries must agree on that.
    const longer = pw + '?';
    await expect(nativeBcrypt.compare(longer, jsHash))
      .resolves.toBe(await bcryptjs.compare(longer, jsHash));
  });

  test('uses bcryptjs while BCRYPT_NATIVE is off (the default)', async () => {
    delete process.env.BCRYPT_NATIVE;
    const ph = loadWith({});
    expect(ph.implementationName()).toBe('bcryptjs');
    const hash = await ph.hashPassword('Pass@1234', ROUNDS);
    await expect(ph.verifyPassword('Pass@1234', hash)).resolves.toBe(true);
    await expect(ph.verifyPassword('Pass@12345', hash)).resolves.toBe(false);
  });

  test('uses native bcrypt when BCRYPT_NATIVE is on, and reads old bcryptjs hashes', async () => {
    const ph = loadWith({ BCRYPT_NATIVE: 'true' });
    expect(ph.implementationName()).toBe('bcrypt');
    const legacy = await bcryptjs.hash('Pass@1234', ROUNDS);
    await expect(ph.verifyPassword('Pass@1234', legacy)).resolves.toBe(true);
    await expect(ph.verifyPassword('wrong', legacy)).resolves.toBe(false);
    const fresh = await ph.hashPassword('Pass@1234', ROUNDS);
    await expect(bcryptjs.compare('Pass@1234', fresh)).resolves.toBe(true);
  });

  test('falls back to bcryptjs when the native addon cannot load', async () => {
    const ph = loadWith({ BCRYPT_NATIVE: 'true' }, () => {
      jest.doMock('bcrypt', () => { throw new Error('no prebuild for this platform'); });
      jest.doMock('../../middlewares/logger', () => ({ log: { warn: jest.fn() } }));
    });
    expect(ph.implementationName()).toBe('bcryptjs');
    const hash = await ph.hashPassword('Pass@1234', ROUNDS);
    await expect(ph.verifyPassword('Pass@1234', hash)).resolves.toBe(true);
  });

  test('hashes at the configured cost by default', async () => {
    const ph = loadWith({ BCRYPT_NATIVE: 'true', BCRYPT_ROUNDS: '10' });
    const hash = await ph.hashPassword('Pass@1234');
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
  });
});

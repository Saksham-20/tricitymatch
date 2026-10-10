/**
 * Password hashing — the one place the app hashes or checks a password.
 *
 * bcryptjs is pure JavaScript and runs on the event loop: a cost-12 hash held
 * the loop for ~100 ms at a time, so four logins in the same second stalled
 * every other request on the 1-vCPU box for over a second. Native `bcrypt`
 * hashes on the libuv threadpool, off the event loop, and is 2-3x faster.
 *
 * Both libraries read and write the same `$2a$`/`$2b$` hashes, so switching
 * needs no re-hash and no migration: a hash made by either verifies with the
 * other. Native is used only when BCRYPT_NATIVE is on; if the addon fails to
 * load (wrong platform build), we log once and stay on bcryptjs rather than
 * break every login.
 */

const config = require('../config/env');
const { log } = require('../middlewares/logger');

const bcryptjs = require('bcryptjs');

let nativeImpl;
const loadNative = () => {
  if (nativeImpl !== undefined) return nativeImpl;
  try {
    nativeImpl = require('bcrypt');
  } catch (err) {
    nativeImpl = null;
    log.warn('Native bcrypt unavailable, using bcryptjs', { error: err.message });
  }
  return nativeImpl;
};

const impl = () => (config.auth.nativeBcrypt && loadNative()) || bcryptjs;

const hashPassword = (password, rounds = config.auth.bcryptRounds) =>
  impl().hash(password, rounds);

const verifyPassword = (password, hash) => impl().compare(password, hash);

/** Which library is answering, for the startup log and tests. */
const implementationName = () => (impl() === bcryptjs ? 'bcryptjs' : 'bcrypt');

module.exports = { hashPassword, verifyPassword, implementationName };

'use strict';

/**
 * The one password rule, used by every flow that sets a password (signup, email
 * reset, phone reset, change-password, guardian hand-over, admin-created
 * accounts). It used to exist in three variants: two of them required one of
 * only `@$!%*?&` AND, because the pattern had no closing anchor, that the FIRST
 * character be from `[A-Za-z0-9@$!%*?&]` -- so `Hello#1234` and `_Abcdef1!x`
 * were refused with a message claiming they lacked a special character, while
 * the phone-reset flow accepted the same strings.
 *
 * Rule: 8-100 characters, with an upper-case letter, a lower-case letter, a
 * digit and at least one character that is not a letter, digit or whitespace.
 */

const MIN_LENGTH = 8;
const MAX_LENGTH = 100; // matches the Users.password column validator
const COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])/;

const COMPLEXITY_MESSAGE = 'Password must contain an uppercase letter, a lowercase letter, a number and a special character';

/** null when acceptable, otherwise the reason to show. */
const passwordProblem = (password, { minLength = MIN_LENGTH } = {}) => {
  if (typeof password !== 'string' || !password) return 'Password is required';
  if (password.length < minLength) return `Password must be at least ${minLength} characters`;
  if (password.length > MAX_LENGTH) return `Password must be at most ${MAX_LENGTH} characters`;
  if (!COMPLEXITY.test(password)) return COMPLEXITY_MESSAGE;
  return null;
};

/**
 * express-validator chain for a password body field. `minLength` is raised to
 * 12 for staff accounts by the admin validators.
 */
const passwordField = (field = 'password', { minLength = MIN_LENGTH } = {}) => {
  const { body } = require('express-validator');
  return body(field).custom((value) => {
    const problem = passwordProblem(value, { minLength });
    if (problem) throw new Error(problem);
    return true;
  });
};

module.exports = { MIN_LENGTH, MAX_LENGTH, COMPLEXITY, COMPLEXITY_MESSAGE, passwordProblem, passwordField };

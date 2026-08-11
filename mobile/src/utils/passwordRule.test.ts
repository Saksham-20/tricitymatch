/**
 * The client password rule must agree with the server's, character for
 * character — so this test does not restate the rule, it READS the server's
 * regex out of backend source and compares verdicts over a corpus.
 *
 * Restating the rule would only prove the test author and the screen author
 * made the same assumption. Every previous version of this bug was exactly
 * that: a client rule that looked right, accepted `Passw0rd#`, and got 400ed.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { isAcceptablePassword, MIN_PASSWORD_LENGTH, SERVER_PASSWORD_PATTERN } from './passwordRule';

const ROUTES = join(__dirname, '..', '..', '..', 'backend', 'routes', 'authRoutes.js');

/** Pull the newPassword validator's regex + min length straight out of the route. */
const readServerRule = () => {
  const src = readFileSync(ROUTES, 'utf8');
  const block = src.slice(src.indexOf("router.post('/change-password'"));
  const end = block.indexOf('changePassword\n');
  const scope = end === -1 ? block.slice(0, 1200) : block.slice(0, end);

  const min = scope.match(/isLength\(\{\s*min:\s*(\d+)/);
  const pattern = scope.match(/\.matches\((\/.+?\/)\)/);
  if (!min || !pattern) {
    throw new Error('Could not read the server password rule from authRoutes.js — update this test with it.');
  }
  const body = pattern[1].slice(1, -1);
  return { min: Number(min[1]), regex: new RegExp(body) };
};

const CORPUS = [
  'Passw0rd!',      // canonical valid
  'Passw0rd#',      // symbol OUTSIDE the server's allowed set — the historical false accept
  'Passw0rd!#',     // allowed symbol plus a disallowed one
  'passw0rd!',      // no uppercase
  'PASSW0RD!',      // no lowercase
  'Password!',      // no digit
  'Passw0rdd',      // no symbol
  'Pw0rd!',         // too short
  'Aa1@aaaa',       // exactly the minimum length
  '@Passw0rd',      // allowed symbol first
  '#Passw0rd!',     // disallowed symbol FIRST — the server's unanchored pattern rejects this
  '',
];

describe('client password rule mirrors the server', () => {
  const server = readServerRule();

  it('uses the same minimum length', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(server.min);
  });

  it('uses the same pattern source', () => {
    expect(SERVER_PASSWORD_PATTERN.source).toBe(server.regex.source);
  });

  it.each(CORPUS)('agrees with the server on %p', (password) => {
    const serverAccepts = password.length >= server.min && server.regex.test(password);
    expect(isAcceptablePassword(password)).toBe(serverAccepts);
  });
});

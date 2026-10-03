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

const POLICY = join(__dirname, '..', '..', '..', 'backend', 'utils', 'passwordPolicy.js');

/** Pull the shared policy's min length + complexity regex straight out of the module. */
const readServerRule = () => {
  const src = readFileSync(POLICY, 'utf8');
  const min = src.match(/MIN_LENGTH\s*=\s*(\d+)/);
  const pattern = src.match(/COMPLEXITY\s*=\s*(\/.+\/);/);
  if (!min || !pattern) {
    throw new Error('Could not read the server password rule from utils/passwordPolicy.js — update this test with it.');
  }
  return { min: Number(min[1]), regex: new RegExp(pattern[1].slice(1, -1)) };
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
  '#Passw0rd!',     // symbol first: valid under the shared policy
  'Hello#1234',     // the historical false reject
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

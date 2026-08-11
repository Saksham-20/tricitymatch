/**
 * The app's profile code must be byte-identical to the server's, because the
 * server parses the code back into a userId range. A code this app renders but
 * the server cannot parse is a dead ID a member has written down or read out
 * over the phone.
 *
 * So the test compares against the backend module itself rather than restating
 * the format — the third copy of a format is where the drift starts.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
import { parseProfileCode, toProfileCode } from './profileCode';

const server = require('../../../backend/utils/profileCode.js') as {
  toProfileCode: (id: unknown) => string | null;
  parseProfileCode: (input: unknown) => string | null;
};

const USER_IDS = [
  'a1b2c3d4-e5f6-4789-abcd-0123456789ab',
  '00000000-0000-4000-8000-000000000000',
  'ffffffff-ffff-4fff-bfff-ffffffffffff',
  'DEADBEEF-1234-4567-89ab-cdef01234567', // uppercase input
  'not-a-uuid',
  '',
];

const INPUTS = [
  'TCS-A1B2C3D4',
  'tcs-a1b2c3d4',
  '  TCS-A1B2C3D4  ',
  'TCSA1B2C3D4',
  'TCS--A1B2C3D4',
  'A1B2C3D4',
  'TCS A1B2C3D4',
  'TCS-A1B2C3D',   // one hex short
  'TCS-A1B2C3D4E', // one hex long
  'TCS-G1B2C3D4',  // not hex
  '',
];

describe('profile code matches the server implementation', () => {
  it.each(USER_IDS)('toProfileCode(%p)', (userId) => {
    expect(toProfileCode(userId)).toBe(server.toProfileCode(userId));
  });

  it.each(INPUTS)('parseProfileCode(%p)', (input) => {
    expect(parseProfileCode(input)).toBe(server.parseProfileCode(input));
  });

  it('round-trips a userId through code and back to its prefix', () => {
    const userId = 'a1b2c3d4-e5f6-4789-abcd-0123456789ab';
    const code = toProfileCode(userId);
    expect(code).toBe('TCS-A1B2C3D4');
    expect(parseProfileCode(code)).toBe('a1b2c3d4');
  });

  it('rejects null and undefined without throwing', () => {
    expect(toProfileCode(null)).toBeNull();
    expect(toProfileCode(undefined)).toBeNull();
    expect(parseProfileCode(null)).toBeNull();
    expect(parseProfileCode(undefined)).toBeNull();
  });
});

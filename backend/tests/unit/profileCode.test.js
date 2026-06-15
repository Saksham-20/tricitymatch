/**
 * Profile Code Unit Tests
 * Deterministic public profile code derived from a user's UUID.
 */

const { toProfileCode, parseProfileCode } = require('../../utils/profileCode');

describe('profileCode', () => {
  const uuid = 'a1b2c3d4-1111-2222-3333-444455556666';

  describe('toProfileCode', () => {
    it('builds TCS-<first segment uppercased>', () => {
      expect(toProfileCode(uuid)).toBe('TCS-A1B2C3D4');
    });
    it('returns null for invalid input', () => {
      expect(toProfileCode(null)).toBeNull();
      expect(toProfileCode('')).toBeNull();
      expect(toProfileCode('not-a-uuid')).toBeNull();
      expect(toProfileCode(123)).toBeNull();
    });
  });

  describe('parseProfileCode', () => {
    it('round-trips with toProfileCode', () => {
      expect(parseProfileCode(toProfileCode(uuid))).toBe('a1b2c3d4');
    });
    it('accepts loose user input (case, spaces, missing prefix/dash)', () => {
      expect(parseProfileCode('tcs-a1b2c3d4')).toBe('a1b2c3d4');
      expect(parseProfileCode('TCSA1B2C3D4')).toBe('a1b2c3d4');
      expect(parseProfileCode('  A1B2C3D4 ')).toBe('a1b2c3d4');
    });
    it('rejects codes that are not 8 hex chars', () => {
      expect(parseProfileCode('TCS-XYZ')).toBeNull();
      expect(parseProfileCode('TCS-A1B2C3')).toBeNull();
      expect(parseProfileCode('')).toBeNull();
      expect(parseProfileCode(null)).toBeNull();
    });
  });
});

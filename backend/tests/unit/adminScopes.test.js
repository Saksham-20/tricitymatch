'use strict';

/**
 * Sub-admin permission scopes.
 *
 * The rules worth locking down are the fail-closed ones: a role that is not an
 * admin resolves to NO scopes, a sub-admin with a missing/garbage column
 * resolves to NO scopes (rather than to "everything"), and unknown scope keys
 * from an admin form are dropped instead of stored.
 */

const {
  ALL_SCOPES,
  ADMIN_ROLES,
  scopesFor,
  hasScope,
  sanitizeScopes,
} = require('../../constants/adminScopes');

describe('adminScopes', () => {
  describe('scopesFor', () => {
    it('gives admin and super_admin every scope, including ones added later', () => {
      for (const role of ['admin', 'super_admin']) {
        expect(scopesFor({ role })).toEqual(ALL_SCOPES);
      }
    });

    it('gives a sub_admin exactly what is stored', () => {
      const user = { role: 'sub_admin', adminPermissions: ['support', 'reports'] };
      expect(scopesFor(user).sort()).toEqual(['reports', 'support']);
    });

    it('fails CLOSED for a sub_admin whose column is unset or malformed', () => {
      // A bad write must lock someone out, never hand them the pricing editor.
      expect(scopesFor({ role: 'sub_admin' })).toEqual([]);
      expect(scopesFor({ role: 'sub_admin', adminPermissions: null })).toEqual([]);
      expect(scopesFor({ role: 'sub_admin', adminPermissions: 'support' })).toEqual([]);
      expect(scopesFor({ role: 'sub_admin', adminPermissions: {} })).toEqual([]);
    });

    it('drops scope keys that are not in the catalogue', () => {
      const user = { role: 'sub_admin', adminPermissions: ['support', 'everything', '*'] };
      expect(scopesFor(user)).toEqual(['support']);
    });

    it('gives NO scopes to members and marketing roles', () => {
      for (const role of ['user', 'marketing', 'marketing_manager', undefined]) {
        expect(scopesFor({ role })).toEqual([]);
      }
      expect(scopesFor(null)).toEqual([]);
    });
  });

  describe('hasScope', () => {
    it('is true for a held scope and false for a neighbouring one', () => {
      const user = { role: 'sub_admin', adminPermissions: ['support'] };
      expect(hasScope(user, 'support')).toBe(true);
      expect(hasScope(user, 'pricing')).toBe(false);
      expect(hasScope(user, 'team')).toBe(false);
    });

    it('is true for every scope on a full-access role', () => {
      expect(ALL_SCOPES.every((s) => hasScope({ role: 'admin' }, s))).toBe(true);
    });
  });

  describe('sanitizeScopes', () => {
    it('keeps only known keys and de-duplicates', () => {
      expect(sanitizeScopes(['support', 'support', 'nope'])).toEqual(['support']);
    });

    it('returns an empty list for non-array input', () => {
      expect(sanitizeScopes(undefined)).toEqual([]);
      expect(sanitizeScopes('support')).toEqual([]);
    });

    it('never invents a scope that is not in the catalogue', () => {
      expect(sanitizeScopes(ALL_SCOPES).every((s) => ALL_SCOPES.includes(s))).toBe(true);
    });
  });

  it('lists sub_admin as an admin-family role', () => {
    expect(ADMIN_ROLES).toContain('sub_admin');
    expect(ADMIN_ROLES).not.toContain('user');
    expect(ADMIN_ROLES).not.toContain('marketing');
  });
});

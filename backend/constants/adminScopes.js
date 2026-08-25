'use strict';

/**
 * Admin permission scopes (sub-admin support).
 *
 * WHY SCOPES AND NOT MORE ROLES
 * A role per job title ("support admin", "finance admin") multiplies every
 * time someone needs a slightly different mix. One role — `sub_admin` — plus
 * an explicit list of scopes covers every mix without another enum value, and
 * the enum value on Postgres is the part that is expensive to change later.
 *
 * `admin` and `super_admin` implicitly hold EVERY scope, including ones added
 * after their account was created. Only `sub_admin` carries a stored list, so
 * a scope added in a future release never silently widens a sub-admin.
 *
 * The scope list is the server's, not the client's: `requireAdminScope` gates
 * each route, and the sidebar merely hides what the server would refuse
 * anyway. A hidden nav item is a courtesy, never the boundary.
 */

// scope -> what a holder can do. Keys are persisted in Users.adminPermissions,
// so treat them like enum values: add freely, never rename in place.
const ADMIN_SCOPES = {
  users: 'View members, change account status, create member accounts',
  subscriptions: 'Grant or change a member plan, download invoices',
  verifications: 'Approve or reject photo verifications',
  pricing: 'Edit launch pricing, offers and the founding window',
  revenue: 'View revenue reports and export them',
  reports: 'Work the abuse/report queue',
  support: 'Read and reply to the support inbox',
  marketing: 'Marketing users, referral codes and leads',
  stories: 'Publish and edit success stories',
  team: 'Manage admins: create, promote, set scopes, revoke',
};

const ALL_SCOPES = Object.keys(ADMIN_SCOPES);

// Sensible starting point when someone creates a sub-admin without choosing:
// the day-to-day moderation desk, nothing that moves money or grants power.
const DEFAULT_SUB_ADMIN_SCOPES = ['users', 'verifications', 'reports', 'support'];

// Roles that may reach /api/v1/admin at all.
const ADMIN_ROLES = ['sub_admin', 'admin', 'super_admin'];

// Roles that implicitly hold every scope.
const FULL_ACCESS_ROLES = ['admin', 'super_admin'];

/**
 * Effective scopes for a user row. `admin`/`super_admin` get everything;
 * `sub_admin` gets exactly what is stored (an unset/garbage column reads as
 * NO scopes — fail closed, so a bad write locks someone out rather than
 * handing them the pricing editor).
 */
const scopesFor = (user) => {
  if (!user || !ADMIN_ROLES.includes(user.role)) return [];
  if (FULL_ACCESS_ROLES.includes(user.role)) return [...ALL_SCOPES];
  const stored = user.adminPermissions;
  if (!Array.isArray(stored)) return [];
  return stored.filter((s) => ALL_SCOPES.includes(s));
};

const hasScope = (user, scope) => scopesFor(user).includes(scope);

/** Drop unknown/duplicate scopes from admin input rather than storing junk. */
const sanitizeScopes = (input) => {
  if (!Array.isArray(input)) return [];
  return ALL_SCOPES.filter((s) => input.includes(s));
};

module.exports = {
  ADMIN_SCOPES,
  ALL_SCOPES,
  DEFAULT_SUB_ADMIN_SCOPES,
  ADMIN_ROLES,
  FULL_ACCESS_ROLES,
  scopesFor,
  hasScope,
  sanitizeScopes,
};

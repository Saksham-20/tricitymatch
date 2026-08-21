/**
 * Credential and device-token serialization (deep audit 2026-08-21).
 *
 * User.prototype.toJSON stripped `password` and `inviteToken` but not:
 *   - fcmTokens: every registered push token for that account. Anything holding
 *     these can deliver notifications that appear to come from us, to that
 *     member's devices.
 *   - googleId: a link to an external identity that no API response needs.
 *
 * RefreshToken stored the RAW refresh token beside its SHA-256 hash. Only the
 * hash is ever looked up, so the raw column was dead weight with a live blast
 * radius: a database dump yielded directly replayable session credentials for
 * their full 7-day lifetime. Migration 000056 nulled every row (733 on the
 * development database, including unrevoked and unexpired ones) and the model
 * now refuses to persist one even if a caller supplies it.
 */

const path = require('path');

describe('User serialization', () => {
  const User = require('../../models/User');

  const build = (overrides = {}) => User.build({
    email: 'someone@example.com',
    password: 'hashed-value',
    inviteToken: 'invite-secret',
    googleId: 'google-oauth-subject-id',
    fcmTokens: ['device-token-a', 'device-token-b'],
    role: 'user',
    status: 'active',
    ...overrides,
  });

  it('strips password and inviteToken', () => {
    const json = build().toJSON();
    expect(json).not.toHaveProperty('password');
    expect(json).not.toHaveProperty('inviteToken');
  });

  it('strips fcmTokens so device push tokens never reach a response', () => {
    const json = build().toJSON();
    expect(json).not.toHaveProperty('fcmTokens');
    expect(JSON.stringify(json)).not.toContain('device-token-a');
  });

  it('strips googleId', () => {
    expect(build().toJSON()).not.toHaveProperty('googleId');
  });

  it('still exposes fcmTokens on the instance (push delivery reads them)', () => {
    // utils/notifyUser and notificationController read user.fcmTokens directly.
    // Stripping must happen at serialization only, never on the model instance.
    expect(build().fcmTokens).toEqual(['device-token-a', 'device-token-b']);
  });

  it('keeps the fields the API legitimately returns', () => {
    const json = build().toJSON();
    expect(json.email).toBe('someone@example.com');
    expect(json.role).toBe('user');
    expect(json.status).toBe('active');
  });
});

describe('RefreshToken storage', () => {
  const RefreshToken = require('../../models/RefreshToken');

  it('declares the raw token column nullable', () => {
    expect(RefreshToken.rawAttributes.token.allowNull).toBe(true);
  });

  it('derives the hash from a supplied raw token and then discards it', async () => {
    const raw = RefreshToken.generateToken();
    const row = RefreshToken.build({
      userId: '00000000-0000-4000-8000-000000000000',
      token: raw,
      expiresAt: new Date(Date.now() + 1000),
    });

    // Run the same hook the model registers for beforeCreate.
    await RefreshToken.runHooks('beforeCreate', row);

    expect(row.tokenHash).toBe(RefreshToken.hashToken(raw));
    expect(row.token).toBeNull();
  });

  it('never serializes the token or its hash', () => {
    const row = RefreshToken.build({
      userId: '00000000-0000-4000-8000-000000000000',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 1000),
    });
    const json = row.toJSON();
    expect(json).not.toHaveProperty('token');
    expect(json).not.toHaveProperty('tokenHash');
  });
});

describe('message retention job', () => {
  it('does not filter on deletedAt, a column Messages does not have', () => {
    const src = require('fs').readFileSync(
      path.resolve(__dirname, '../../utils/queue.js'), 'utf8'
    );
    // The job silently matched nothing for its entire life because it filtered
    // on a soft-delete column that was never added to the Messages table.
    expect(src).not.toMatch(/deletedAt:\s*\{\s*\[Op\.lt\]/);
    expect(src).toMatch(/MESSAGE_RETENTION_MONTHS/);
  });
});

/**
 * Notification deep-links (Phase 2, P2.3).
 *
 * A notification type with no destination is a dead tap: the row marks itself
 * read and nothing else happens, which reads as a broken app. This test pins
 * the map to the backend ENUM (backend/models/Notification.js) so adding a type
 * server-side without giving it a destination fails here instead of shipping.
 *
 * `system` is the one deliberate exception — it carries arbitrary admin copy
 * with no single place to land.
 */
import { describe, it, expect } from 'vitest';
import { notifLink } from '../../pages/Notifications';

// Mirrors the Notifications.type ENUM exactly. Update BOTH when the enum moves.
const ENUM_TYPES = [
  'new_match',
  'new_message',
  'verification_approved',
  'verification_rejected',
  'subscription_expiring',
  'profile_view',
  'report_reviewed',
  'system',
];

const NO_DESTINATION = ['system'];

describe('every backend notification type resolves', () => {
  it.each(ENUM_TYPES.filter((t) => !NO_DESTINATION.includes(t)))(
    '%s has a destination',
    (type) => {
      const to = notifLink({ type, relatedId: 'abc' });
      expect(to, `${type} falls through to default — dead tap`).toBeTruthy();
      expect(to.startsWith('/')).toBe(true);
    }
  );

  it('system stays destination-less on purpose', () => {
    expect(notifLink({ type: 'system' })).toBeNull();
  });

  it('an unknown type degrades to mark-read rather than a bad route', () => {
    expect(notifLink({ type: 'something_new' })).toBeNull();
  });
});

describe('destinations point at the right surface', () => {
  it('new_match opens the Mutual tab, not a profile (relatedId is a MATCH id)', () => {
    expect(notifLink({ type: 'new_match', relatedId: 'match-uuid' })).toBe('/matches?tab=mutual');
  });

  it('new_message opens chat', () => {
    expect(notifLink({ type: 'new_message' })).toBe('/chat');
  });

  it('profile_view opens the viewer when known, own profile otherwise', () => {
    expect(notifLink({ type: 'profile_view', relatedId: 'u9' })).toBe('/profile/u9');
    expect(notifLink({ type: 'profile_view' })).toBe('/profile');
  });

  it('both verification outcomes land on the verification screen', () => {
    expect(notifLink({ type: 'verification_approved' })).toBe('/verification');
    expect(notifLink({ type: 'verification_rejected' })).toBe('/verification');
  });

  it('subscription_expiring lands where the member can renew', () => {
    expect(notifLink({ type: 'subscription_expiring' })).toBe('/subscription');
  });
});

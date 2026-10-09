import {
  FiBell, FiHeart, FiMessageCircle, FiEye, FiStar,
  FiCheckCircle, FiShield, FiInfo, FiClock,
} from 'react-icons/fi';
import { formatDate } from '../../utils/formatDate';
import i18n from '../../i18n';

// Shared by the Notifications page and the navbar bell, so a notification
// looks the same and goes to the same place wherever it is opened.

export const TYPE_ICONS = {
  new_match:             FiHeart,
  match:                 FiHeart,
  message:               FiMessageCircle,
  new_message:           FiMessageCircle,
  profile_view:          FiEye,
  interest:              FiStar,
  verification_approved: FiCheckCircle,
  verification_rejected: FiShield,
  verification:          FiShield,
  subscription:          FiCheckCircle,
  subscription_expiring: FiClock,
  report_reviewed:       FiShield,
  system:                FiInfo,
  admin:                 FiShield,
};

const NEUTRAL = 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300';
const PRIMARY = 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400';

export const TYPE_COLORS = {
  new_match:             PRIMARY,
  match:                 PRIMARY,
  // Message is a type-category tag, not a real info/warning/success/error
  // state of the notification — semantic `info` (blue) is reserved for an
  // actual state and is also a banned accent (doctrine §3.1), so this uses
  // the same neutral tone as the other purely-decorative categories below.
  message:               NEUTRAL,
  new_message:           NEUTRAL,
  profile_view:          NEUTRAL,
  // Interest ("someone liked you") is a match signal, not a premium mark —
  // gold is reserved for paid-tier state (doctrine §3.1).
  interest:              PRIMARY,
  verification_approved: 'bg-success-50 dark:bg-success/15 text-success',
  verification_rejected: 'bg-destructive-light dark:bg-destructive/15 text-destructive',
  verification:          'bg-success-50 dark:bg-success/15 text-success',
  subscription:          PRIMARY,
  // The one legitimate gold here: this is specifically about a PAID
  // subscription's own expiry, not a generic event.
  subscription_expiring: 'bg-gold-100 dark:bg-gold-900/30 text-gold-700 dark:text-gold-400',
  report_reviewed:       NEUTRAL,
  system:                NEUTRAL,
  admin:                 'bg-destructive-light dark:bg-destructive/15 text-destructive',
};

export const iconFor = (n) => TYPE_ICONS[n?.type] || FiBell;
export const colorFor = (n) => TYPE_COLORS[n?.type] || NEUTRAL;

export function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  // Read the language at call time, not at import: the member can switch it.
  if (minutes < 1)    return i18n.t('notifications.time.justNow');
  if (minutes < 60)   return i18n.t('notifications.time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24)     return i18n.t('notifications.time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7)       return i18n.t('notifications.time.daysAgo', { count: days });
  return formatDate(date);
}

// Most server notices are type 'system' (the Notifications.type ENUM is narrow
// and a new value needs a migration), so they are told apart by their title.
// Titles come from the backend emitters; keep this list in step with them.
// Order matters: the first match wins.
const SYSTEM_LINKS = [
  [/^Profile \d+% complete/i,                 '/profile/edit'],
  [/verification/i,                           '/verification'],
  [/photo/i,                                  '/profile/edit?section=photos'],
  [/^New sign-in/i,                           '/settings'],
  [/^Refund/i,                                '/payment/history'],
  [/subscription|membership|founding offer/i, '/subscription'],
  [/invite was accepted|referral joined/i,    '/subscription'],
  [/guardian invite/i,                        '/guardian'],
  [/^New match for "/i,                       '/search'],
  [/account has been suspended/i,             '/appeal'],
  [/account has been restored/i,              '/dashboard'],
  [/^Admin access granted/i,                  '/admin/dashboard'],
];

// Where a notification should take the user when tapped.
//
// This map must cover every value of the Notifications.type ENUM
// (backend/models/Notification.js). A type that falls through to `default`
// silently becomes a dead tap: the row marks itself read and nothing happens,
// which reads as a broken app rather than as a deliberate no-destination.
//
// `new_match` carries a MATCH id in relatedId, NOT a userId, so it cannot route
// to a profile. A one-sided like ("Someone liked your profile!") goes to the
// Likes-you tab; a mutual match goes to the Mutual tab.
export const notifLink = (n) => {
  switch (n.type) {
    case 'new_match':
      return /liked your/i.test(n.title || '') ? '/matches?tab=likes' : '/matches?tab=mutual';
    case 'message':
    case 'new_message':          return '/chat';
    case 'profile_view':         return n.relatedId ? `/profile/${n.relatedId}` : '/profile';
    case 'verification_approved':
    case 'verification_rejected':
    case 'verification':         return '/verification';
    case 'subscription_expiring':
    case 'subscription':         return '/subscription';
    // The reporter has no "my reports" view to land on; Safety is where
    // reporting is explained, so the tap at least goes somewhere related.
    case 'report_reviewed':      return '/safety';
    case 'system': {
      const hit = SYSTEM_LINKS.find(([re]) => re.test(n.title || ''));
      return hit ? hit[1] : null;
    }
    default:                     return null; // unknown: just mark read
  }
};

// Tell the navbar badge that something changed the unread count, so it does
// not wait for its 30-second poll.
export const NOTIFICATIONS_CHANGED = 'tm:notifications-changed';
export const announceNotificationsChanged = () => {
  try { window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)); } catch { /* no window */ }
};

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// App/admin routes that render no <Seo> (Helmet). Public pages set their own
// title via <Seo>, so they are intentionally absent here — those routes fall
// through to DEFAULT and are immediately overridden by the page's Helmet.
// Order matters: more specific prefixes first.
const TITLE_RULES = [
  ['/dashboard', 'Dashboard'],
  ['/profile/edit', 'Edit Profile'],
  ['/profile', 'My Profile'], // also covers /profile/:id
  ['/search', 'Find a Match'],
  ['/chat', 'Messages'],
  ['/subscription', 'Plans'],
  ['/payment', 'Payment'],
  ['/settings', 'Settings'],
  ['/notifications', 'Notifications'],
  ['/verification', 'Verification'],
  ['/guardian', 'Guardian & Family'],
  ['/astrologers', 'Astrologers'],
  ['/onboarding', 'Create Your Profile'],
  ['/admin', 'Admin'],
];

// Returns a title for app/admin routes, or null for public routes — which
// render their own <Seo> (Helmet) and must not be clobbered here.
const titleForPath = (pathname) => {
  // Viewing someone else's profile — `/profile/:id` (but NOT `/profile/edit`).
  // Own profile is exactly `/profile`; "My Profile" here would mislabel another
  // member's page. Generic "Profile" also keeps their name out of the tab/history.
  if (/^\/profile\/(?!edit$)[^/]+/.test(pathname)) {
    return 'Profile | TricityShadi';
  }
  const rule = TITLE_RULES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return rule ? `${rule[1]} | TricityShadi` : null;
};

/**
 * Sets document.title for authenticated/app routes that don't render <Seo>,
 * fixing the stale browser-tab title left behind from the previous page
 * (e.g. "Login | TricityShadi" persisting on /admin/dashboard). Public pages
 * keep their <Seo> Helmet titles; this only governs routes that have none.
 */
export default function useRouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = titleForPath(pathname);
    if (title) document.title = title;
  }, [pathname]);
}

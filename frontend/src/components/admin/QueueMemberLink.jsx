import { Link } from 'react-router-dom';
import { useAdminScopes } from './AdminLayout';

// How a queue names a member: their profile name, else their email, else their
// phone (a member who signed up with a phone number has no email).
export const memberLabel = (user) => {
  if (!user) return '—';
  const name = [user.Profile?.firstName, user.Profile?.lastName].filter(Boolean).join(' ');
  return name || user.email || user.phone || '—';
};

// The contact line under a name: email, else phone.
export const memberContact = (user) => (user ? user.email || user.phone || '' : '');

/**
 * A member's name in a moderation queue. It opens the member's admin page when
 * this admin may open member pages (the `users` scope); for anyone else it stays
 * plain text, because the link would only land on "Not your section".
 */
export default function QueueMemberLink({ userId, children, className = '' }) {
  const scopes = useAdminScopes();
  const canOpen = scopes === null || scopes.includes('users');
  if (!userId || !canOpen) return <span className={className}>{children}</span>;
  return (
    <Link
      to={`/admin/users/${userId}`}
      className={`text-primary-700 hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded ${className}`}
    >
      {children}
    </Link>
  );
}

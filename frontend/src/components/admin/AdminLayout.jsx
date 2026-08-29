import React, { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useDarkMode from '../../hooks/useDarkMode';
import {
  FiGrid, FiUsers, FiCheckCircle, FiCreditCard,
  FiTrendingUp, FiFlag, FiLogOut, FiMenu, FiX,
  FiChevronRight, FiTag, FiUserPlus, FiPhoneCall, FiHeart, FiInbox, FiShield,
  FiFilter, FiList, FiMoon, FiSun,
} from 'react-icons/fi';

// `scope` is the permission the server requires for that section. A sub-admin
// only sees what it can actually open — but the hiding is cosmetic: every one
// of these routes is gated again by requireAdminScope on the API.
const navItems = [
  { to: '/admin/dashboard',        label: 'Dashboard',         icon: FiGrid,        scope: 'users' },
  { to: '/admin/funnel',           label: 'Funnel',            icon: FiFilter,      scope: 'users' },
  { to: '/admin/users',            label: 'Users',             icon: FiUsers,       scope: 'users' },
  { to: '/admin/verifications',    label: 'Verifications',     icon: FiCheckCircle, scope: 'verifications' },
  { to: '/admin/subscriptions',    label: 'Subscriptions',     icon: FiCreditCard,  scope: 'subscriptions' },
  { to: '/admin/launch-offer',     label: 'Pricing & Offers',  icon: FiTag,         scope: 'pricing' },
  { to: '/admin/revenue',          label: 'Revenue',           icon: FiTrendingUp,  scope: 'revenue' },
  { to: '/admin/reports',          label: 'Reports',           icon: FiFlag,        scope: 'reports' },
  { to: '/admin/contact-messages', label: 'Support Inbox',     icon: FiInbox,       scope: 'support' },
  { to: '/admin/marketing-users',  label: 'Marketing Users',   icon: FiUserPlus,    scope: 'marketing' },
  { to: '/admin/referral-codes',   label: 'Referral Codes',    icon: FiTag,         scope: 'marketing' },
  { to: '/admin/leads',            label: 'Leads',             icon: FiPhoneCall,   scope: 'marketing' },
  { to: '/admin/success-stories',  label: 'Success Stories',   icon: FiHeart,       scope: 'stories' },
  { to: '/admin/team',             label: 'Admins & Roles',    icon: FiShield,      scope: 'team' },
  { to: '/admin/audit-log',        label: 'Audit Log',         icon: FiList,        scope: 'team' },
];

/**
 * Where /admin should land THIS account.
 *
 * A support-only sub-admin has no `users` scope, so the old hardcoded redirect
 * to the dashboard dropped them on a 403 the moment they signed in. Send
 * everyone to the first section they can actually open.
 */
// Scopes for the signed-in account, or null for a full-access role. A
// `sub_admin` whose list has not arrived yet resolves to [] rather than to
// "everything" — the safe direction while /auth/me is in flight.
export const useAdminScopes = () => {
  const { user } = useAuth();
  if (!user) return [];
  if (user.role === 'sub_admin') return user.adminScopes || [];
  return null;
};

export function AdminIndexRedirect() {
  const scopes = useAdminScopes();
  const first = scopes ? navItems.find((i) => scopes.includes(i.scope)) : navItems[0];
  return <Navigate to={first ? first.to : '/admin/no-access'} replace />;
}

/**
 * Route wrapper for a section a scoped admin may not hold.
 *
 * Without it, opening the URL directly rendered the page anyway and every
 * request inside it 403'd — a dashboard of em-dashes that reads as "the panel
 * is broken" rather than "this is not yours".
 */
export function AdminScopeRoute({ scope, children }) {
  const scopes = useAdminScopes();
  if (scopes && !scopes.includes(scope)) {
    const first = navItems.find((i) => scopes.includes(i.scope));
    return (
      <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center max-w-md mx-auto mt-10">
        <FiShield className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">Not your section</h2>
        <p className="text-sm text-gray-500 mb-5">
          Your admin account does not have the <span className="font-medium">{scope}</span> permission.
          Ask a full admin if you need it.
        </p>
        {first && (
          <Link to={first.to} className="inline-block px-4 py-2 rounded-xl bg-primary-700 text-white text-sm font-medium">
            Go to {first.label}
          </Link>
        )}
      </div>
    );
  }
  return children;
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  // The panel renders no member Navbar — the only thing that applied the saved
  // theme — so a hard load of /admin/* came up light for someone who had chosen
  // dark (same bug the marketing portal had). Mount the hook here and give the
  // rail its own toggle.
  const { isDark, toggle: toggleDark } = useDarkMode();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    // /admin/login only exists as a redirect stub; send people to the real one.
    navigate('/login');
  };

  // Full-access roles have no `adminScopes` restriction; a sub_admin gets the
  // list the server resolved for it on /auth/me.
  const scopes = user?.role === 'sub_admin' ? (user.adminScopes || []) : null;
  const visibleNav = scopes ? navItems.filter((i) => scopes.includes(i.scope)) : navItems;

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full admin-chrome ${mobile ? 'w-72' : 'w-64'}`}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-700 flex items-center justify-center">
            <span className="text-white text-xs font-black">TM</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">TricityMatch</p>
            <p className="text-gray-400 text-[10px] uppercase tracking-widest">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-primary-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {isActive && <FiChevronRight className="w-3 h-3 opacity-60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Admin info + logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="px-3 py-2 rounded-lg bg-gray-800 mb-2">
          <p className="text-xs font-medium text-white truncate">{user?.firstName || 'Admin'} {user?.lastName || ''}</p>
          <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={toggleDark}
          aria-pressed={isDark}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-150"
        >
          {isDark ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-all duration-150"
        >
          <FiLogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin-panel flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 admin-chrome border-b border-gray-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiMenu className="w-6 h-6" />
          </button>
          <span className="text-white text-sm font-semibold">TricityMatch Admin</span>
          <div className="w-6" />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

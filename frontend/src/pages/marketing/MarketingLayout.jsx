import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { FiBarChart2, FiUsers, FiZap, FiBookOpen, FiLogOut, FiGlobe, FiSearch, FiMoon, FiSun, FiMenu, FiX, FiMessageSquare, FiLock, FiAlertCircle, FiGrid } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import useDarkMode from '../../hooks/useDarkMode';
import apiClient from '../../api/apiClient';

// The portal is a second home for a real person who also uses the site: a rep
// showing a prospect a profile should not have to log out and back in, so the
// rail carries a way across to the member site and back.
const navItems = [
  { to: '/marketing/dashboard', label: 'Dashboard', icon: FiBarChart2 },
  { to: '/marketing/leads', label: 'My Members', icon: FiUsers },
  { to: '/marketing/referral-codes', label: 'Referral Codes', icon: FiZap },
  { to: '/marketing/kit', label: 'Outreach Kit', icon: FiMessageSquare },
  { to: '/marketing/guide', label: 'Partner Guide', icon: FiBookOpen },
];

// Only managers (and admins looking in) see the whole team's numbers.
const teamItem = { to: '/marketing/team', label: 'Team', icon: FiGrid };
const canSeeTeam = (role) => ['marketing_manager', 'admin', 'super_admin'].includes(role);

// Settings holds change-password and two-step verification. A partner's password
// was chosen by an admin, so the way to replace it has to be one click from here.
const siteItems = [
  { to: '/settings', label: 'Account & security', icon: FiLock },
  { to: '/search', label: 'Browse Profiles', icon: FiSearch },
  { to: '/dashboard', label: 'Open the Website', icon: FiGlobe },
];

export default function MarketingLayout() {
  const { user, logout } = useAuth();
  // The portal renders no member Navbar, which was the only thing applying the
  // saved theme — so a hard load of /marketing/* came up light even for someone
  // who had chosen dark. Mounting the hook here applies it, and gives the rail
  // its own toggle.
  const { isDark, toggle: toggleDark } = useDarkMode();
  const navigate = useNavigate();
  // Reps do roadshows on a phone; the rail is a slide-in drawer below md so the
  // content gets the full width instead of ~119px beside a fixed 256px sidebar.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  // Setup progress is read once here and handed to every page through the
  // Outlet, so the checklist, the guide's accept button and the strip below all
  // move together the moment something is saved. Admins browsing the portal are
  // not partners and have nothing to set up.
  const isPartner = ['marketing', 'marketing_manager'].includes(user?.role);
  const [onboarding, setOnboarding] = useState(null);
  const refreshOnboarding = useCallback(async () => {
    if (!isPartner) return null;
    try {
      const res = await apiClient.get('/marketing/onboarding');
      setOnboarding(res.data.onboarding);
      return res.data.onboarding;
    } catch {
      // A failed read must not block the portal; the server still enforces the gate.
      return null;
    }
  }, [isPartner]);
  useEffect(() => { refreshOnboarding(); }, [refreshOnboarding]);
  const needsAgreement = isPartner && onboarding && !onboarding.steps.agreement;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
        : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
    }`;

  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-neutral-950">
      {/* Mobile backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] md:hidden"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[70] w-64 flex flex-col bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transform transition-transform md:static md:z-auto md:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-serif font-bold text-neutral-900 dark:text-neutral-100">Marketing</h1>
            {user?.email && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 truncate">{user.email}</p>
            )}
          </div>
          <button
            onClick={closeDrawer}
            aria-label="Close menu"
            className="md:hidden -mr-2 p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <FiX size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {(canSeeTeam(user?.role) ? [...navItems.slice(0, 3), teamItem, ...navItems.slice(3)] : navItems).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkCls} onClick={closeDrawer}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pb-4">
          <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            TricityMatch
          </p>
          {siteItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkCls} onClick={closeDrawer}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto p-4 space-y-1">
          <button
            onClick={toggleDark}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
          >
            {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
          >
            <FiLogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="-ml-2 p-2 rounded-lg text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <FiMenu size={22} />
          </button>
          <span className="font-serif font-bold text-lg text-neutral-900 dark:text-neutral-100">Marketing</span>
        </div>

        <main id="main-content" className="flex-1 overflow-auto">
          {needsAgreement && (
            <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-sm text-amber-900 dark:text-amber-100">
              <FiAlertCircle size={16} className="flex-shrink-0" aria-hidden="true" />
              <p className="flex-1 min-w-[16rem]">
                {onboarding.needsReacceptance
                  ? 'The Partner Guide has changed. Please read and accept the new version to keep creating codes and adding members.'
                  : 'Read and accept the Partner Guide to start generating codes and adding members.'}
              </p>
              <Link to="/marketing/guide" className="inline-flex items-center min-h-[44px] font-semibold underline underline-offset-2">
                Open the guide
              </Link>
            </div>
          )}
          <Outlet context={{ onboarding, refreshOnboarding }} />
        </main>
      </div>
    </div>
  );
}

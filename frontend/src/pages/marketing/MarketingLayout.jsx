import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { BarChart3, Users, Zap, LogOut, Globe, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// The portal is a second home for a real person who also uses the site: a rep
// showing a prospect a profile should not have to log out and back in, so the
// rail carries a way across to the member site and back.
const navItems = [
  { to: '/marketing/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/marketing/leads', label: 'My Members', icon: Users },
  { to: '/marketing/referral-codes', label: 'Referral Codes', icon: Zap },
];

const siteItems = [
  { to: '/search', label: 'Browse Profiles', icon: Search },
  { to: '/dashboard', label: 'Open the Website', icon: Globe },
];

export default function MarketingLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
      <aside className="w-64 flex flex-col bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <h1 className="text-2xl font-serif font-bold text-neutral-900 dark:text-neutral-100">Marketing</h1>
          {user?.email && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 truncate">{user.email}</p>
          )}
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkCls}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pb-4">
          <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            TricityMatch
          </p>
          {siteItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkCls}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto p-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
          >
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import Logo from './Logo';
import api from '../../api/axios';
import useDarkMode from '../../hooks/useDarkMode';
import {
  FiUser, FiLogOut, FiHome, FiSearch, FiMessageCircle,
  FiMenu, FiX, FiBell, FiSettings, FiCreditCard, FiChevronDown,
  FiClock, FiSun, FiMoon,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

// ─── Notification Bell ───────────────────────
const NotificationBell = ({ count = 0 }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
    } catch (_) { /* silent */ }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl text-neutral-600 hover:text-primary-500 hover:bg-primary-50 transition-all duration-200"
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
      >
        <FiBell className="w-5 h-5" />
        {count > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
          >
            {count > 9 ? '9+' : count}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-neutral-100 overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
              <span className="text-sm font-semibold text-neutral-800">Notifications</span>
              {count > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary-500 font-medium hover:text-primary-700 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="divide-y divide-neutral-100 max-h-72 overflow-y-auto">
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-neutral-500">View all notifications below</p>
              </div>
            </div>

            <div className="px-4 py-2.5 border-t border-neutral-100">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-primary-500 hover:text-primary-700 font-medium transition-colors"
              >
                View all notifications
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Profile Dropdown ────────────────────────
const ProfileDropdown = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials =
    ((user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')).toUpperCase() || 'U';

  const menuItems = [
    { icon: FiUser,       label: 'My Profile',      to: '/profile' },
    { icon: FiSettings,   label: 'Settings',         to: '/settings' },
    { icon: FiCreditCard, label: 'Subscription',     to: '/subscription' },
    { icon: FiClock,      label: 'Payment History',  to: '/payment/history' },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-neutral-100 transition-all duration-200"
        aria-label="Profile menu"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
          {initials}
        </div>
        <span className="hidden lg:block text-sm font-medium text-neutral-700 max-w-[100px] truncate">
          {user?.firstName || 'My Account'}
        </span>
        <FiChevronDown
          className={`hidden lg:block w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-2xl border border-neutral-100 overflow-hidden z-50"
          >
            {/* User info */}
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-semibold text-neutral-800 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
              {user?.isPremium && (
                <div className="flex items-center gap-1 mt-1.5">
                  <FaCrown className="w-3 h-3 text-gold" />
                  <span className="text-xs font-semibold text-gold-700">Premium Member</span>
                </div>
              )}
            </div>

            {/* Menu items */}
            <div className="py-1">
              {menuItems.map(({ icon: Icon, label, to }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-primary-500 transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </div>

            <div className="border-t border-neutral-100 py-1">
              <button
                onClick={() => { setOpen(false); onLogout(); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <FiLogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Navbar ──────────────────────────────────
const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { isDark, toggle: toggleDark } = useDarkMode();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCount = () => {
      api.get('/notifications/unread-count')
        .then(r => setUnreadCount(r.data?.count || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: FiHome },
    { path: '/search',    label: 'Find Match', icon: FiSearch },
    { path: '/chat',      label: 'Messages',   icon: FiMessageCircle },
  ];

  return (
    <>
      <a
        href="#main-content"
        className="skip-link focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>

      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        role="navigation"
        aria-label="Main navigation"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/98 backdrop-blur-lg shadow-sm border-b border-neutral-100'
            : 'bg-white/95 backdrop-blur-md'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Logo size="sm" linkTo="/" />

            {/* Desktop nav */}
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-1">
                {navLinks.map(({ path, label, icon: Icon }) => (
                  <Link
                    key={path}
                    to={path}
                    aria-current={isActive(path) ? 'page' : undefined}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive(path)
                        ? 'bg-primary-500 text-white shadow-burgundy'
                        : 'text-neutral-600 hover:text-primary-500 hover:bg-primary-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden lg:inline">{label}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-4">
                <Link
                  to="/login"
                  className="text-sm font-semibold text-neutral-600 hover:text-primary-500 transition-colors px-3 py-2.5 rounded-xl hover:bg-primary-50 min-h-[44px] inline-flex items-center"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="text-sm font-semibold px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 shadow-burgundy hover:-translate-y-0.5"
                >
                  Create Profile
                </Link>
              </div>
            )}

            {/* Right actions */}
            <div className="flex items-center gap-1">
              {isAuthenticated && (
                <>
                  <button
                    onClick={toggleDark}
                    className="hidden md:flex w-10 h-10 items-center justify-center rounded-xl text-neutral-600 hover:text-primary-500 hover:bg-primary-50 transition-all duration-200"
                    aria-label="Toggle dark mode"
                  >
                    {isDark ? <FiSun className="w-5 h-5" /> : <FiMoon className="w-5 h-5" />}
                  </button>
                  <div className="hidden md:block">
                    <NotificationBell count={unreadCount} />
                  </div>
                  <div className="hidden md:block">
                    <ProfileDropdown user={user} onLogout={handleLogout} />
                  </div>
                </>
              )}

              {/* Mobile hamburger */}
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-expanded={isMobileMenuOpen}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                {isMobileMenuOpen
                  ? <FiX className="w-5 h-5" />
                  : <FiMenu className="w-5 h-5" />}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-72 bg-white shadow-2xl z-50 md:hidden flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                <Logo size="xs" linkTo="/" />
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 transition-colors"
                >
                  <FiX className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* User info (auth) */}
              {isAuthenticated && user && (
                <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-800 text-sm truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    {user.isPremium && (
                      <div className="flex items-center gap-1">
                        <FaCrown className="w-3 h-3 text-gold" />
                        <span className="text-xs text-gold-700 font-medium">Premium</span>
                      </div>
                    )}
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    <NotificationBell count={unreadCount} />
                  </div>
                </div>
              )}

              {/* Nav links */}
              <div className="flex-1 overflow-y-auto py-3">
                {isAuthenticated ? (
                  <motion.nav
                    initial="closed"
                    animate="open"
                    variants={{ open: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
                    className="space-y-0.5 px-3"
                  >
                    {navLinks.map(({ path, label, icon: Icon }) => (
                      <motion.div
                        key={path}
                        variants={{ open: { opacity: 1, x: 0 }, closed: { opacity: 0, x: 16 } }}
                      >
                        <Link
                          to={path}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                            isActive(path)
                              ? 'bg-primary-500 text-white shadow-burgundy'
                              : 'text-neutral-700 hover:bg-primary-50 hover:text-primary-600'
                          }`}
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          {label}
                        </Link>
                      </motion.div>
                    ))}

                    {/* Extra links */}
                    <div className="pt-3 mt-3 border-t border-neutral-100 space-y-0.5">
                      {[
                        { path: '/profile', label: 'My Profile', icon: FiUser },
                        { path: '/settings', label: 'Settings', icon: FiSettings },
                        { path: '/subscription', label: 'Subscription', icon: FiCreditCard },
                      ].map(({ path, label, icon: Icon }) => (
                        <Link
                          key={path}
                          to={path}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 transition-colors"
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          {label}
                        </Link>
                      ))}
                    </div>

                    <div className="pt-3 mt-3 border-t border-neutral-100">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <FiLogOut className="w-5 h-5" />
                        Sign Out
                      </button>
                    </div>
                  </motion.nav>
                ) : (
                  <div className="space-y-3 px-5 py-4">
                    <Link
                      to="/login"
                      className="block w-full py-3 text-center rounded-xl font-semibold text-sm text-neutral-700 border-2 border-neutral-200 hover:border-primary-400 hover:text-primary-500 transition-all duration-200"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/signup"
                      className="block w-full py-3 text-center rounded-xl font-semibold text-sm bg-primary-500 text-white hover:bg-primary-600 transition-all duration-200 shadow-burgundy"
                    >
                      Create Free Profile
                    </Link>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-neutral-100 bg-neutral-50">
                <p className="text-xs text-neutral-400 text-center">
                  Chandigarh · Mohali · Panchkula
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spacer */}
      <div className="h-16" />
    </>
  );
};

export default Navbar;

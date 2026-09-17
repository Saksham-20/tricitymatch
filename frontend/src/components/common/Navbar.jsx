import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { popIn, backdrop, DUR, EASE_DRAWER } from '../../utils/animations';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import Logo from './Logo';
import api from '../../api/axios';
import useDarkMode from '../../hooks/useDarkMode';
import useElderMode from '../../hooks/useElderMode';
import {
  FiUser, FiLogOut, FiHome, FiSearch, FiMessageCircle, FiHeart,
  FiMenu, FiX, FiBell, FiSettings, FiCreditCard, FiChevronDown, FiBriefcase,
  FiClock, FiSun, FiMoon,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

// ─── Notification Bell ───────────────────────
const NotificationBell = ({ count = 0 }) => {
  const { t } = useTranslation();
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
        className="relative w-10 h-10 flex items-center justify-center rounded-xl text-neutral-600 hover:text-primary-500 hover:bg-primary-50 transition-[color,background-color] duration-[160ms]"
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
      >
        <FiBell className="w-5 h-5" />
        {count > 0 && (
          <motion.span
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
          >
            {count > 9 ? '9+' : count}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            {...popIn}
            className="absolute right-0 top-12 w-80 bg-white dark:bg-[#1a1f2e] rounded-2xl shadow-2xl dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] border border-neutral-100 dark:border-[#252b3b] overflow-hidden z-60 origin-top-right"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-[#252b3b]">
              <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{t('navbar.notifications')}</span>
              {count > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary-500 font-medium hover:text-primary-700 transition-colors"
                >
                  {t('navbar.markAllRead')}
                </button>
              )}
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-[#252b3b] max-h-72 overflow-y-auto">
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {count > 0 ? t('navbar.unreadCount', { count }) : t('navbar.allCaughtUp')}
                </p>
              </div>
            </div>

            <div className="px-4 py-2.5 border-t border-neutral-100">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-primary-500 hover:text-primary-700 font-medium transition-colors"
              >
                {t('navbar.viewAll')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Profile Dropdown ────────────────────────
// Staff who also hold a member account get a way back to their own portal.
const STAFF_PORTALS = {
  marketing: { to: '/marketing/dashboard', label: 'Marketing portal' },
  marketing_manager: { to: '/marketing/dashboard', label: 'Marketing portal' },
  admin: { to: '/admin/dashboard', label: 'Admin panel' },
  super_admin: { to: '/admin/dashboard', label: 'Admin panel' },
  sub_admin: { to: '/admin/dashboard', label: 'Admin panel' },
};

const ProfileDropdown = ({ user, onLogout }) => {
  const { t } = useTranslation();
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
    { icon: FiUser,       label: t('navbar.myProfile'),      to: '/profile' },
    { icon: FiSettings,   label: t('navbar.settings'),       to: '/settings' },
    { icon: FiCreditCard, label: t('navbar.subscription'),   to: '/subscription' },
    { icon: FiClock,      label: t('navbar.paymentHistory'), to: '/payment/history' },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-[160ms]"
        aria-label="Profile menu"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
          {initials}
        </div>
        <span className="hidden lg:block text-sm font-medium text-neutral-700 max-w-[100px] truncate">
          {user?.firstName || t('navbar.myAccount')}
        </span>
        <FiChevronDown
          className={`hidden lg:block w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            {...popIn}
            className="absolute right-0 top-12 w-56 bg-white dark:bg-[#1a1f2e] rounded-2xl shadow-2xl dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] border border-neutral-100 dark:border-[#252b3b] overflow-hidden z-60 origin-top-right"
          >
            {/* User info */}
            <div className="px-4 py-3 border-b border-neutral-100 dark:border-[#252b3b]">
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user?.email}</p>
              {user?.isPremium && (
                <div className="flex items-center gap-1 mt-1.5">
                  <FaCrown className="w-3 h-3 text-gold" />
                  <span className="text-xs font-semibold text-gold-700 dark:text-gold-400">{t('navbar.premiumMember')}</span>
                </div>
              )}
            </div>

            {/* Back to a staff portal. A marketing rep or admin browsing the
                member site needs one click home; without it the only way back
                was typing the URL. */}
            {STAFF_PORTALS[user?.role] && (
              <div className="border-b border-neutral-100 dark:border-[#252b3b] py-1">
                <Link
                  to={STAFF_PORTALS[user.role].to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <FiBriefcase className="w-4 h-4" />
                  {STAFF_PORTALS[user.role].label}
                </Link>
              </div>
            )}

            {/* Menu items */}
            <div className="py-1">
              {menuItems.map(({ icon: Icon, label, to }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-primary-500 transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </div>

            <div className="border-t border-neutral-100 dark:border-[#252b3b] py-1">
              <button
                onClick={() => { setOpen(false); onLogout(); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive-light dark:hover:bg-destructive/15 transition-colors"
              >
                <FiLogOut className="w-4 h-4" />
                {t('navbar.signOut')}
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
  const { t } = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { isDark, toggle: toggleDark } = useDarkMode();
  // Mount elder mode globally (parallels dark mode) so the .elder class is
  // re-applied from localStorage on every page load — not just on Settings,
  // where the hook used to be the only mount point (elder silently off elsewhere).
  useElderMode();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      // On logout the badge must drop back to 0 immediately — otherwise the
      // stale count lingers until a full reload.
      setUnreadCount(0);
      return;
    }
    const fetchCount = () => {
      api.get('/notifications/unread-count')
        .then(r => setUnreadCount(r.data?.count || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // framer-motion's scroll tracker (doctrine §8: no raw scroll listeners)
  // instead of a hand-rolled window scroll handler.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => setIsScrolled(y > 20));

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { path: '/dashboard', label: t('navbar.dashboard'), icon: FiHome },
    { path: '/search',    label: t('navbar.findMatch'), icon: FiSearch },
    { path: '/matches',   label: t('navbar.matches'),   icon: FiHeart },
    { path: '/chat',      label: t('navbar.messages'),  icon: FiMessageCircle },
  ];

  return (
    <>
      {/* Skip-to-content link is rendered once globally in App.jsx; removed the
          duplicate here so keyboard/SR users get a single skip target (a11y). */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        role="navigation"
        aria-label="Main navigation"
        className={`fixed top-0 left-0 right-0 z-60 transition-[box-shadow,border-color] duration-300 bg-white dark:bg-[#14182a] dark:border-[#252b3b] ${
          isScrolled
            ? 'shadow-sm border-b border-neutral-100 dark:shadow-none dark:border-b'
            : 'border-b border-neutral-100/60'
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
                    viewTransition
                    aria-current={isActive(path) ? 'page' : undefined}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow] duration-[160ms] ${
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
                  {t('navbar.signIn')}
                </Link>
                <Link
                  to="/signup"
                  className="text-sm font-semibold px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-[background-color,transform,box-shadow] duration-[160ms] shadow-burgundy hover:-translate-y-0.5"
                >
                  {t('navbar.createProfile')}
                </Link>
              </div>
            )}

            {/* Right actions */}
            <div className="flex items-center gap-1">
              {isAuthenticated && (
                <>
                  <button
                    onClick={toggleDark}
                    className="hidden md:flex w-10 h-10 items-center justify-center rounded-xl text-neutral-600 hover:text-primary-500 hover:bg-primary-50 transition-[color,background-color] duration-[160ms]"
                    aria-label={t('navbar.toggleDark')}
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
                type="button"
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
              {...backdrop}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-70 md:hidden"
            />

            {/* Side drawer — duration-based on the drawer curve (doctrine
                §4.4 ruling 8): this menu opens on tap, not a drag gesture, so
                it takes the sheet's duration/ease pair, not a spring. */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0, transition: { duration: DUR.sheet, ease: EASE_DRAWER } }}
              exit={{ x: '100%', transition: { duration: DUR.sheetExit, ease: EASE_DRAWER } }}
              className="fixed top-0 right-0 h-full w-72 bg-white dark:bg-[#14182a] shadow-2xl dark:shadow-[0_0_60px_rgba(0,0,0,0.7)] z-70 md:hidden flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-[#252b3b]">
                <Logo size="xs" linkTo="/" />
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#252b3b] transition-colors"
                >
                  <FiX className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* User info (auth) */}
              {isAuthenticated && user && (
                <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100 dark:border-[#252b3b] bg-neutral-50 dark:bg-[#0f1117]">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    {user.isPremium && (
                      <div className="flex items-center gap-1">
                        <FaCrown className="w-3 h-3 text-gold" />
                        <span className="text-xs text-gold-700 dark:text-gold-400 font-medium">{t('navbar.premium')}</span>
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
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-[background-color,color,box-shadow] duration-[160ms] ${
                            isActive(path)
                              ? 'bg-primary-500 text-white shadow-burgundy'
                              : 'text-neutral-700 dark:text-neutral-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600'
                          }`}
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          {label}
                        </Link>
                      </motion.div>
                    ))}

                    {/* Extra links */}
                    <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-[#252b3b] space-y-0.5">
                      {[
                        { path: '/profile', label: t('navbar.myProfile'), icon: FiUser },
                        { path: '/settings', label: t('navbar.settings'), icon: FiSettings },
                        { path: '/subscription', label: t('navbar.subscription'), icon: FiCreditCard },
                      ].map(({ path, label, icon: Icon }) => (
                        <Link
                          key={path}
                          to={path}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          {label}
                        </Link>
                      ))}
                    </div>

                    <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-[#252b3b]">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium text-sm text-destructive hover:bg-destructive-light dark:hover:bg-destructive/15 transition-colors"
                      >
                        <FiLogOut className="w-5 h-5" />
                        {t('navbar.signOut')}
                      </button>
                    </div>
                  </motion.nav>
                ) : (
                  <div className="space-y-3 px-5 py-4">
                    <Link
                      to="/login"
                      className="block w-full py-3 text-center rounded-xl font-semibold text-sm text-neutral-700 dark:text-neutral-300 border-2 border-neutral-200 dark:border-neutral-700 hover:border-primary-400 hover:text-primary-500 transition-[border-color,color] duration-[160ms]"
                    >
                      {t('navbar.signIn')}
                    </Link>
                    <Link
                      to="/signup"
                      className="block w-full py-3 text-center rounded-xl font-semibold text-sm bg-primary-500 text-white hover:bg-primary-600 transition-colors duration-[160ms] shadow-burgundy"
                    >
                      {t('navbar.createFreeProfile')}
                    </Link>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-neutral-100 dark:border-[#252b3b] bg-neutral-50 dark:bg-[#0f1117]">
                <p className="text-xs text-neutral-400 text-center">
                  {t('navbar.region')}
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

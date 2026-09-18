import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiHome, FiSearch, FiMessageCircle, FiUser } from 'react-icons/fi';

const NAV_ITEMS = [
  { path: '/dashboard',  label: 'Home',    icon: FiHome          },
  { path: '/search',     label: 'Search',  icon: FiSearch        },
  { path: '/chat',       label: 'Chat',    icon: FiMessageCircle },
  { path: '/profile',    label: 'Profile', icon: FiUser          },
];

const BottomNav = ({ unreadCount = 0 }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-60 pointer-events-none safe-area-bottom pb-2 px-4"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div
        className="pointer-events-auto max-w-md mx-auto rounded-full border border-primary-500/10 dark:border-white/10 bg-white/90 dark:bg-neutral-900/90"
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 28px rgba(139,35,70,0.14), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center justify-around h-14 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const showBadge = item.path === '/chat' && unreadCount > 0;

            return (
              <Link
                key={item.path}
                to={item.path}
                viewTransition
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className="relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors duration-200"
              >
                {/* Active background pill */}
                {active && (
                  <motion.div
                    layoutId="bottomNavPill"
                    className="absolute inset-x-2 top-1.5 bottom-1.5 bg-primary-50 dark:bg-primary-500/15 rounded-full"
                    // Duration, not a spring (doctrine §4.4 ruling 8): a tab
                    // switch is route-driven, not gesture-driven, so this
                    // matches the "layout shift" row of the duration table.
                    transition={{ duration: 0.25, ease: [0.77, 0, 0.175, 1] }}
                  />
                )}

                <div className="relative z-10">
                  <Icon
                    className={`w-5 h-5 transition-colors duration-200 ${
                      active ? 'text-primary-500' : 'text-neutral-400'
                    }`}
                    aria-hidden="true"
                  />

                  {showBadge && (
                    <motion.span
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                      className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-primary-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </div>

                <span
                  className={`relative z-10 text-[10px] font-medium leading-none transition-colors duration-200 ${
                    active ? 'text-primary-500' : 'text-neutral-400'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;

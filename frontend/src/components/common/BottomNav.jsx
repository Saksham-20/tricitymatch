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
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
      style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(139,35,70,0.08)',
        boxShadow: '0 -4px 20px rgba(139,35,70,0.06)',
      }}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const showBadge = item.path === '/chat' && unreadCount > 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors duration-200"
            >
              {/* Active background pill */}
              {active && (
                <motion.div
                  layoutId="bottomNavPill"
                  className="absolute inset-x-2 top-2 bottom-2 bg-primary-50 rounded-xl"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
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

      {/* iOS safe area spacer */}
      <div className="h-safe-area-inset-bottom" style={{ background: 'rgba(255,255,255,0.95)' }} />
    </nav>
  );
};

export default BottomNav;

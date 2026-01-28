import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiHome, FiSearch, FiHeart, FiMessageCircle, FiUser } from 'react-icons/fi';

/**
 * BottomNav Component - Mobile-only bottom navigation bar
 * Provides thumb-friendly navigation on mobile devices
 */
const BottomNav = ({ unreadCount = 0 }) => {
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;
  
  const navItems = [
    { path: '/dashboard', label: 'Home', icon: FiHome },
    { path: '/search', label: 'Search', icon: FiSearch },
    { path: '/discovery', label: 'Discover', icon: FiHeart },
    { path: '/chat', label: 'Chat', icon: FiMessageCircle, badge: unreadCount },
    { path: '/profile', label: 'Profile', icon: FiUser },
  ];

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 shadow-lg safe-area-bottom"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${
                active ? 'text-primary-500' : 'text-neutral-500'
              }`}
            >
              <div className="relative">
                {active ? (
                  <motion.div
                    layoutId="bottomNavActive"
                    className="absolute -inset-2 bg-primary-50 rounded-xl"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                ) : null}
                <Icon 
                  className={`relative w-6 h-6 ${active ? 'text-primary-500' : ''}`} 
                  aria-hidden="true"
                />
                
                {/* Badge for unread messages */}
                {item.badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                  >
                    {item.badge > 9 ? '9+' : item.badge}
                  </motion.span>
                )}
              </div>
              
              <span className={`text-[10px] mt-1 font-medium ${active ? 'text-primary-500' : ''}`}>
                {item.label}
              </span>
              
              {/* Active indicator dot */}
              {active && (
                <motion.div
                  layoutId="bottomNavDot"
                  className="absolute top-1 w-1 h-1 bg-primary-500 rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
      
      {/* Safe area spacer for iOS */}
      <div className="h-safe-area-inset-bottom bg-white" />
    </nav>
  );
};

export default BottomNav;

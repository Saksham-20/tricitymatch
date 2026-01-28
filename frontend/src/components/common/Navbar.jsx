import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { FiUser, FiLogOut, FiHome, FiSearch, FiMessageCircle, FiHeart, FiMenu, FiX, FiChevronDown } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
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
    { path: '/search', label: 'Find Match', icon: FiSearch },
    { path: '/discovery', label: 'Discover', icon: FiHeart },
    { path: '/chat', label: 'Messages', icon: FiMessageCircle },
    { path: '/profile', label: 'Profile', icon: FiUser },
  ];

  const NavLink = ({ path, label, icon: Icon }) => (
    <Link
      to={path}
      aria-current={isActive(path) ? 'page' : undefined}
      className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
        isActive(path)
          ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-burgundy'
          : 'text-neutral-600 hover:text-primary-500 hover:bg-primary-50'
      }`}
    >
      <Icon className={`w-4 h-4 transition-transform duration-300 ${!isActive(path) && 'group-hover:scale-110'}`} aria-hidden="true" />
      <span className="hidden md:inline">{label}</span>
      <span className="md:hidden sr-only">{label}</span>
      
      {/* Active indicator */}
      {isActive(path) && (
        <motion.div
          layoutId="activeNavIndicator"
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-white rounded-full"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </Link>
  );

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a 
        href="#main-content" 
        className="skip-link focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>
      
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        role="navigation"
        aria-label="Main navigation"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-white/98 backdrop-blur-lg shadow-lg border-b border-neutral-100' 
            : 'bg-white/95 backdrop-blur-md border-b border-neutral-200/80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-18">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 group">
              <motion.div 
                className="relative"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-2xl font-bold font-display bg-gradient-to-r from-primary-500 to-gold-500 bg-clip-text text-transparent transition-all duration-300">
                  TricityMatch
                </span>
                <motion.div 
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gradient-to-r from-primary-500 to-gold-500 rounded-full"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </motion.div>
            </Link>

            {/* Desktop Navigation */}
            {isAuthenticated ? (
              <div className="hidden md:flex items-center space-x-1">
                {navLinks.map((link) => (
                  <NavLink key={link.path} {...link} />
                ))}
                
                <div className="h-6 w-px bg-neutral-200 mx-3" />
                
                {/* Premium Badge (if applicable) */}
                {user?.isPremium && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-50 border border-gold-200 rounded-full mr-2"
                  >
                    <FaCrown className="w-3.5 h-3.5 text-gold-600" />
                    <span className="text-xs font-semibold text-gold-700">Premium</span>
                  </motion.div>
                )}
                
                <motion.button
                  onClick={handleLogout}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  aria-label="Log out of your account"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-neutral-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                >
                  <FiLogOut className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden lg:inline">Logout</span>
                </motion.button>
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-neutral-700 hover:text-primary-500 transition-colors text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-50"
                >
                  Login
                </Link>
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/signup"
                    className="btn-primary text-sm px-6 py-2.5"
                  >
                    Register Profile
                  </Link>
                </motion.div>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              className="md:hidden p-2 rounded-xl text-neutral-600 hover:text-primary-500 hover:bg-primary-50 transition-colors"
            >
              {isMobileMenuOpen ? (
                <FiX className="w-6 h-6" aria-hidden="true" />
              ) : (
                <FiMenu className="w-6 h-6" aria-hidden="true" />
              )}
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            />
            
            {/* Menu Panel */}
            <motion.div
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-80 max-w-full bg-white shadow-2xl z-50 md:hidden"
            >
              <div className="flex flex-col h-full">
                {/* Mobile Menu Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-100">
                  <span className="text-xl font-bold font-display bg-gradient-to-r from-primary-500 to-gold-500 bg-clip-text text-transparent">
                    TricityMatch
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-xl text-neutral-600 hover:text-primary-500 hover:bg-primary-50"
                  >
                    <FiX className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Mobile Menu Content */}
                <div className="flex-1 overflow-y-auto py-4">
                  {isAuthenticated ? (
                    <motion.div 
                      className="space-y-1 px-4"
                      initial="closed"
                      animate="open"
                      variants={{
                        open: {
                          transition: { staggerChildren: 0.05, delayChildren: 0.1 }
                        },
                        closed: {}
                      }}
                    >
                      {navLinks.map((link, index) => (
                        <motion.div
                          key={link.path}
                          variants={{
                            open: { opacity: 1, x: 0 },
                            closed: { opacity: 0, x: 20 }
                          }}
                        >
                          <Link
                            to={link.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                              isActive(link.path)
                                ? 'bg-primary-500 text-white shadow-burgundy'
                                : 'text-neutral-700 hover:bg-primary-50 hover:text-primary-500'
                            }`}
                          >
                            <link.icon className="w-5 h-5" />
                            {link.label}
                          </Link>
                        </motion.div>
                      ))}
                      
                      <motion.div
                        variants={{
                          open: { opacity: 1, x: 0 },
                          closed: { opacity: 0, x: 20 }
                        }}
                        className="pt-4 mt-4 border-t border-neutral-100"
                      >
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium text-red-600 hover:bg-red-50 transition-all duration-200"
                        >
                          <FiLogOut className="w-5 h-5" />
                          Logout
                        </button>
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      className="space-y-3 px-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Link
                        to="/login"
                        className="block w-full px-4 py-3 text-center rounded-xl font-semibold text-neutral-700 border-2 border-neutral-200 hover:border-primary-500 hover:text-primary-500 transition-all duration-200"
                      >
                        Login
                      </Link>
                      <Link
                        to="/signup"
                        className="block w-full btn-primary text-center"
                      >
                        Register Profile
                      </Link>
                    </motion.div>
                  )}
                </div>

                {/* Mobile Menu Footer */}
                <div className="p-4 border-t border-neutral-100 bg-neutral-50">
                  <p className="text-xs text-neutral-500 text-center">
                    India's Trusted Matrimony Platform
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spacer for fixed navbar */}
      <div className="h-16 md:h-18" />
    </>
  );
};

export default Navbar;

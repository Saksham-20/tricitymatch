import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiUser, FiLogOut, FiHome, FiSearch, FiMessageCircle, FiSettings, FiHeart } from 'react-icons/fi';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white/98 backdrop-blur-md border-b border-neutral-200/80 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-18">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent group-hover:from-primary-500 group-hover:to-saffron-500 transition-all duration-300">
                TricityMatch
              </span>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gradient-to-r from-primary-500 to-saffron-500 rounded-full animate-pulse"></div>
            </div>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center space-x-1">
              <Link
                to="/dashboard"
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive('/dashboard')
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                    : 'text-neutral-600 hover:text-primary hover:bg-neutral-50'
                }`}
              >
                <FiHome className="w-4 h-4" />
                <span className="hidden md:inline">Dashboard</span>
              </Link>
              <Link
                to="/search"
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive('/search')
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                    : 'text-neutral-600 hover:text-primary hover:bg-neutral-50'
                }`}
              >
                <FiSearch className="w-4 h-4" />
                <span className="hidden md:inline">Find Match</span>
              </Link>
              <Link
                to="/discovery"
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive('/discovery')
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                    : 'text-neutral-600 hover:text-primary hover:bg-neutral-50'
                }`}
              >
                <FiHeart className="w-4 h-4" />
                <span className="hidden md:inline">Discover</span>
              </Link>
              <Link
                to="/chat"
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 relative ${
                  isActive('/chat')
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                    : 'text-neutral-600 hover:text-primary hover:bg-neutral-50'
                }`}
              >
                <FiMessageCircle className="w-4 h-4" />
                <span className="hidden md:inline">Messages</span>
                {/* Badge for unread messages could go here */}
              </Link>
              <Link
                to="/profile"
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive('/profile')
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                    : 'text-neutral-600 hover:text-primary hover:bg-neutral-50'
                }`}
              >
                <FiUser className="w-4 h-4" />
                <span className="hidden md:inline">Profile</span>
              </Link>
              <div className="h-6 w-px bg-neutral-300 mx-2"></div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-neutral-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
              >
                <FiLogOut className="w-4 h-4" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-neutral-700 hover:text-primary transition-colors text-sm font-semibold px-4 py-2 rounded-lg hover:bg-neutral-50"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
              >
                Register Profile
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

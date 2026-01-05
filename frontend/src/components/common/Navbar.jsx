import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiUser, FiLogOut, FiHome, FiSearch, FiMessageCircle, FiSettings } from 'react-icons/fi';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <span className="text-2xl font-bold text-gray-900 group-hover:text-primary-600 transition-colors">TricityMatch</span>
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary-500 rounded-full"></div>
            </div>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center space-x-6">
              <Link
                to="/dashboard"
                className="flex items-center space-x-1.5 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                <FiHome className="w-4 h-4" />
                <span className="hidden md:inline">Dashboard</span>
              </Link>
              <Link
                to="/search"
                className="flex items-center space-x-1.5 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                <FiSearch className="w-4 h-4" />
                <span className="hidden md:inline">Search</span>
              </Link>
              <Link
                to="/discovery"
                className="flex items-center space-x-1.5 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                <FiSearch className="w-4 h-4" />
                <span className="hidden md:inline">Discover</span>
              </Link>
              <Link
                to="/chat"
                className="flex items-center space-x-1.5 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                <FiMessageCircle className="w-4 h-4" />
                <span className="hidden md:inline">Messages</span>
              </Link>
              <Link
                to="/profile"
                className="flex items-center space-x-1.5 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                <FiUser className="w-4 h-4" />
                <span className="hidden md:inline">Profile</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                <FiLogOut className="w-4 h-4" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="btn-primary text-sm px-6 py-2.5"
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


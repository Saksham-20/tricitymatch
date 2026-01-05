import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiEye, FiHeart, FiUsers, FiTrendingUp, FiMessageCircle } from 'react-icons/fi';
import { formatCompatibilityScore } from '../utils/compatibility';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [mutualMatches, setMutualMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, suggestionsRes, matchesRes] = await Promise.all([
        api.get('/profile/me/stats'),
        api.get('/search/suggestions?limit=6'),
        api.get('/match/mutual')
      ]);

      setStats(statsRes.data.stats);
      setSuggestions(suggestionsRes.data.suggestions);
      setMutualMatches(matchesRes.data.mutualMatches);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">Your Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's your activity overview</p>
        </motion.div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Profile Views</p>
                  <p className="text-3xl font-semibold text-gray-900 mt-1">{stats.viewsThisWeek}</p>
                  <p className="text-xs text-gray-500 mt-1">This week</p>
                </div>
                <FiEye className="w-8 h-8 text-blue-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Total Views</p>
                  <p className="text-3xl font-semibold text-gray-900 mt-1">{stats.totalViews}</p>
                  <p className="text-xs text-gray-500 mt-1">All time</p>
                </div>
                <FiTrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Likes Received</p>
                  <p className="text-3xl font-semibold text-gray-900 mt-1">{stats.likesReceived}</p>
                  <p className="text-xs text-gray-500 mt-1">Total</p>
                </div>
                <FiHeart className="w-8 h-8 text-blue-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Mutual Matches</p>
                  <p className="text-3xl font-semibold text-gray-900 mt-1">{mutualMatches.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Ready to chat</p>
                </div>
                <FiUsers className="w-8 h-8 text-blue-600" />
              </div>
            </motion.div>
          </div>
        )}

        {/* Mutual Matches */}
        {mutualMatches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Mutual Matches</h2>
              <Link to="/chat" className="text-blue-600 hover:text-blue-700 flex items-center space-x-1.5 text-sm font-medium">
                <span>View All</span>
                <FiMessageCircle className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {mutualMatches.slice(0, 3).map((match, index) => (
                <Link
                  key={index}
                  to={`/profile/${match.userId}`}
                  className="card hover:shadow-md transition-shadow"
                >
                  <div className="text-center">
                    {match.profilePhoto ? (
                      <img
                        src={`http://localhost:5000${match.profilePhoto}`}
                        alt={match.firstName}
                        className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-gray-200 flex items-center justify-center text-gray-600 text-xl font-semibold border-2 border-gray-300">
                        {match.firstName[0]}
                      </div>
                    )}
                    <h3 className="text-lg font-semibold mb-1 text-gray-900">
                      {match.firstName} {match.lastName}
                    </h3>
                    <p className="text-gray-600 text-sm mb-2">{match.city}</p>
                    {match.compatibilityScore && (
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        formatCompatibilityScore(match.compatibilityScore).bg
                      } ${formatCompatibilityScore(match.compatibilityScore).color}`}>
                        {match.compatibilityScore}% Match
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Suggested Matches</h2>
              <Link to="/search" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View All
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {suggestions.map((profile, index) => (
                <ProfileCard key={index} profile={profile} />
              ))}
            </div>
          </motion.div>
        )}

        {suggestions.length === 0 && mutualMatches.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Complete your profile to see matches!</p>
            <Link to="/profile" className="btn-primary">
              Complete Profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

const ProfileCard = ({ profile }) => {
  const compatibility = formatCompatibilityScore(profile.compatibilityScore);

  return (
    <Link
      to={`/profile/${profile.userId}`}
      className="card hover:shadow-md transition-shadow group"
    >
      <div className="relative mb-4">
        {profile.profilePhoto ? (
          <img
            src={`http://localhost:5000${profile.profilePhoto}`}
            alt={profile.firstName}
            className="w-full h-48 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-48 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-3xl font-semibold border border-gray-300">
            {profile.firstName[0]}
          </div>
        )}
        {profile.compatibilityScore && (
          <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${compatibility.bg} ${compatibility.color}`}>
            {profile.compatibilityScore}%
          </div>
        )}
      </div>
      <h3 className="text-lg font-semibold mb-1 text-gray-900">
        {profile.firstName} {profile.lastName}
      </h3>
      <p className="text-gray-600 text-sm mb-2">{profile.city}</p>
      {profile.education && (
        <p className="text-gray-500 text-xs">{profile.education}</p>
      )}
    </Link>
  );
};

export default Dashboard;


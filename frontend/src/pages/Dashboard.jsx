import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiEye, FiHeart, FiUsers, FiTrendingUp, FiMessageCircle, FiStar, FiMapPin, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { formatCompatibilityScore } from '../utils/compatibility';
import { staggerContainer, fadeInUp, cardHover, scaleIn } from '../utils/animations';
import { API_BASE_URL } from '../utils/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    viewsThisWeek: 0,
    totalViews: 0,
    likesReceived: 0
  });
  const [suggestions, setSuggestions] = useState([]);
  const [mutualMatches, setMutualMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      setStats({
        viewsThisWeek: 0,
        totalViews: 0,
        likesReceived: 0
      });
      setSuggestions([]);
      setMutualMatches([]);

      const [statsRes, suggestionsRes, matchesRes] = await Promise.allSettled([
        api.get('/profile/me/stats').catch(err => {
          console.warn('Stats API error:', err);
          return { data: { stats: null } };
        }),
        api.get('/search/suggestions?limit=6').catch(err => {
          console.warn('Suggestions API error:', err);
          return { data: { suggestions: [] } };
        }),
        api.get('/match/mutual').catch(err => {
          console.warn('Mutual matches API error:', err);
          return { data: { mutualMatches: [] } };
        })
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.data?.stats) {
        setStats(statsRes.value.data.stats);
      }

      if (suggestionsRes.status === 'fulfilled') {
        let suggestionsData = [];
        const response = suggestionsRes.value?.data;
        
        if (Array.isArray(response)) {
          suggestionsData = response;
        } else if (response?.suggestions && Array.isArray(response.suggestions)) {
          suggestionsData = response.suggestions;
        } else if (response?.data?.suggestions && Array.isArray(response.data.suggestions)) {
          suggestionsData = response.data.suggestions;
        }
        
        const normalized = suggestionsData.map(profile => ({
          ...profile,
          userId: profile.userId || profile.id || profile.User?.id,
          firstName: profile.firstName || profile.first_name || 'Unknown',
          lastName: profile.lastName || profile.last_name || '',
          city: profile.city || profile.location || 'Location not specified',
          profilePhoto: profile.profilePhoto || profile.profile_photo || null,
        })).filter(p => p.userId);
        
        setSuggestions(normalized);
      }

      if (matchesRes.status === 'fulfilled') {
        let matchesData = [];
        const response = matchesRes.value?.data;
        
        if (Array.isArray(response)) {
          matchesData = response;
        } else if (response?.mutualMatches && Array.isArray(response.mutualMatches)) {
          matchesData = response.mutualMatches;
        } else if (response?.data?.mutualMatches && Array.isArray(response.data.mutualMatches)) {
          matchesData = response.data.mutualMatches;
        }
        
        const normalized = matchesData.map(match => ({
          ...match,
          userId: match.userId || match.id || match.User?.id,
          firstName: match.firstName || match.first_name || 'Unknown',
          lastName: match.lastName || match.last_name || '',
          city: match.city || match.location || 'Location not specified',
          profilePhoto: match.profilePhoto || match.profile_photo || null,
        })).filter(m => m.userId);
        
        setMutualMatches(normalized);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsConfig = [
    { 
      key: 'viewsThisWeek', 
      label: 'Profile Views', 
      sublabel: 'This week',
      icon: FiEye, 
      gradient: 'from-primary-500 to-primary-600',
      bgGradient: 'from-primary-50 to-primary-100',
      iconBg: 'bg-primary-100',
      iconColor: 'text-primary-500'
    },
    { 
      key: 'totalViews', 
      label: 'Total Views', 
      sublabel: 'All time',
      icon: FiTrendingUp, 
      gradient: 'from-gold-500 to-gold-600',
      bgGradient: 'from-gold-50 to-gold-100',
      iconBg: 'bg-gold-100',
      iconColor: 'text-gold-600'
    },
    { 
      key: 'likesReceived', 
      label: 'Interests Received', 
      sublabel: 'Total',
      icon: FiHeart, 
      gradient: 'from-pink-500 to-pink-600',
      bgGradient: 'from-pink-50 to-pink-100',
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-500'
    },
    { 
      key: 'mutualMatches', 
      label: 'Mutual Matches', 
      sublabel: 'Ready to chat',
      icon: FiUsers, 
      gradient: 'from-success to-green-600',
      bgGradient: 'from-success-light to-green-100',
      iconBg: 'bg-success-light',
      iconColor: 'text-success',
      customValue: true
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="spinner mx-auto mb-4" />
          <p className="text-neutral-600">Loading your dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-neutral-50 via-white to-primary-50/20"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header Banner */}
        <motion.div 
          variants={fadeInUp}
          className="mb-10"
        >
          <div className="bg-gradient-hero rounded-3xl shadow-burgundy p-8 md:p-10 text-white relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 right-10 w-40 h-40 border border-white rounded-full" />
              <div className="absolute bottom-0 left-20 w-60 h-60 border border-white rounded-full" />
            </div>
            
            <div className="relative z-10">
              <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
                Welcome to Your Dashboard
              </h1>
              <p className="text-white/90 text-lg">
                Track your profile activity and discover potential matches
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          variants={fadeInUp}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10"
        >
          {statsConfig.map((stat, index) => {
            const Icon = stat.icon;
            const value = stat.customValue ? mutualMatches.length : (stats?.[stat.key] ?? 0);
            
            return (
              <motion.div
                key={stat.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="card group cursor-default"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-neutral-600 text-sm font-medium mb-1">{stat.label}</p>
                    <motion.p 
                      className={`text-4xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                    >
                      {value}
                    </motion.p>
                    <p className="text-xs text-neutral-500 mt-1">{stat.sublabel}</p>
                  </div>
                  <div className={`w-14 h-14 ${stat.iconBg} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-7 h-7 ${stat.iconColor}`} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Mutual Matches Section */}
        <AnimatePresence>
          {mutualMatches.length > 0 && (
            <motion.div 
              variants={fadeInUp}
              className="mb-10"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-neutral-800 mb-1">
                    Mutual Matches
                  </h2>
                  <p className="text-neutral-600 text-sm">People who expressed interest in you too</p>
                </div>
                <motion.div whileHover={{ x: 5 }}>
                  <Link 
                    to="/chat" 
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-hero text-white rounded-xl text-sm font-semibold shadow-burgundy hover:shadow-burgundy-lg transition-all duration-300"
                  >
                    <FiMessageCircle className="w-4 h-4" />
                    Start Chatting
                  </Link>
                </motion.div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mutualMatches.slice(0, 3).map((match, index) => (
                  <MatchCard 
                    key={`match-${match.userId}-${index}`}
                    match={match}
                    userId={match.userId}
                    index={index}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Suggestions Section */}
        {suggestions.length > 0 && (
          <motion.div variants={fadeInUp}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-neutral-800 mb-1">
                  Suggested Matches
                </h2>
                <p className="text-neutral-600 text-sm">Profiles based on your preferences</p>
              </div>
              <motion.div whileHover={{ x: 5 }}>
                <Link 
                  to="/search" 
                  className="inline-flex items-center gap-2 text-primary-500 font-semibold hover:text-primary-600 transition-colors"
                >
                  View All
                  <FiArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {suggestions.map((profile, index) => (
                <ProfileCard 
                  key={`suggestion-${profile.userId}-${index}`}
                  profile={profile}
                  userId={profile.userId}
                  index={index}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {suggestions.length === 0 && mutualMatches.length === 0 && (
          <motion.div 
            variants={fadeInUp}
            className="text-center py-16 card"
          >
            <motion.div 
              className="w-24 h-24 bg-gradient-to-br from-primary-100 to-gold-100 rounded-full flex items-center justify-center mx-auto mb-6"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <FiUsers className="w-12 h-12 text-primary-500" />
            </motion.div>
            <h3 className="text-2xl font-display font-bold text-neutral-800 mb-3">
              Complete Your Profile
            </h3>
            <p className="text-neutral-600 mb-8 max-w-md mx-auto">
              Add more details to your profile to get personalized match suggestions
            </p>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link 
                to="/profile" 
                className="btn-primary inline-flex items-center gap-2"
              >
                Complete Profile
                <FiArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// Match Card Component
const MatchCard = ({ match, userId, index }) => {
  const navigate = useNavigate();
  const fullName = `${match.firstName || ''} ${match.lastName || ''}`.trim() || 'Unknown';
  const initials = (match.firstName?.[0] || '') + (match.lastName?.[0] || '') || '?';
  
  const handleClick = () => {
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -6 }}
      onClick={handleClick}
      className="card cursor-pointer group"
    >
      <div className="text-center">
        {/* Profile Image */}
        <div className="relative mx-auto mb-4">
          {match.profilePhoto ? (
            <img
              src={`${API_BASE_URL}${match.profilePhoto}`}
              alt={fullName}
              className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-white shadow-lg group-hover:border-primary-100 transition-colors"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={`w-24 h-24 rounded-full mx-auto bg-gradient-to-br from-primary-100 to-gold-100 flex items-center justify-center text-neutral-600 text-2xl font-semibold border-4 border-white shadow-lg ${match.profilePhoto ? 'hidden' : ''}`}
          >
            {initials}
          </div>
          
          {/* Match Badge */}
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 bg-success text-white text-xs font-semibold rounded-full shadow-md flex items-center gap-1"
          >
            <FiHeart className="w-3 h-3" />
            Mutual
          </motion.div>
        </div>
        
        <h3 className="text-lg font-semibold text-neutral-800 mb-1">
          {fullName}
        </h3>
        <p className="text-neutral-600 text-sm flex items-center justify-center gap-1 mb-3">
          <FiMapPin className="w-3.5 h-3.5" />
          {match.city || 'Location not specified'}
        </p>
        
        {match.compatibilityScore && (
          <span className="inline-block px-3 py-1 bg-gold-50 text-gold-700 text-xs font-semibold rounded-full border border-gold-200">
            {match.compatibilityScore}% Compatible
          </span>
        )}
        
        {/* Chat Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={(e) => {
            e.stopPropagation();
            navigate('/chat');
          }}
          className="mt-4 w-full py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-xl text-sm font-semibold hover:from-gold-600 hover:to-gold-700 transition-all shadow-gold"
        >
          <FiMessageCircle className="w-4 h-4 inline-block mr-2" />
          Message
        </motion.button>
      </div>
    </motion.div>
  );
};

// Profile Card Component
const ProfileCard = ({ profile, userId, index }) => {
  const navigate = useNavigate();
  const compatibility = formatCompatibilityScore(profile.compatibilityScore);
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown';
  const initials = (profile.firstName?.[0] || '') + (profile.lastName?.[0] || '') || '?';

  const handleClick = () => {
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08 }}
      whileHover={{ y: -6 }}
      onClick={handleClick}
      className="card p-0 overflow-hidden cursor-pointer group"
    >
      {/* Profile Image */}
      <div className="relative h-48 overflow-hidden">
        {profile.profilePhoto ? (
          <img
            src={`${API_BASE_URL}${profile.profilePhoto}`}
            alt={fullName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className={`w-full h-full bg-gradient-to-br from-primary-100 via-gold-50 to-primary-50 flex items-center justify-center text-neutral-400 text-4xl font-bold ${profile.profilePhoto ? 'hidden' : ''}`}
        >
          {initials}
        </div>
        
        {/* Compatibility Badge */}
        {profile.compatibilityScore && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold shadow-md ${compatibility.bg} ${compatibility.color}`}
          >
            <FiStar className="w-3 h-3 inline-block mr-1" />
            {Math.round(profile.compatibilityScore)}%
          </motion.div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      {/* Content */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-neutral-800 mb-1 group-hover:text-primary-500 transition-colors">
          {fullName}
        </h3>
        <p className="text-neutral-600 text-sm flex items-center gap-1.5 mb-2">
          <FiMapPin className="w-3.5 h-3.5 text-primary-400" />
          {profile.city || 'Location not specified'}
        </p>
        {profile.education && (
          <p className="text-neutral-500 text-xs">{profile.education}</p>
        )}
        
        {/* Action Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className="mt-4 w-full py-2.5 btn-secondary text-sm"
        >
          View Profile
        </motion.button>
      </div>
    </motion.div>
  );
};

export default Dashboard;

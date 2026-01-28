import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiEye, FiHeart, FiUsers, FiTrendingUp, FiMessageCircle, FiStar, FiMapPin, FiArrowRight, FiCheckCircle, FiSun, FiMoon, FiCoffee } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { formatCompatibilityScore } from '../utils/compatibility';
import { staggerContainer, fadeInUp, cardHover, scaleIn } from '../utils/animations';
import { API_BASE_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ProfileCard, MatchCard } from '../components/cards';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    viewsThisWeek: 0,
    totalViews: 0,
    likesReceived: 0
  });
  const [suggestions, setSuggestions] = useState([]);
  const [mutualMatches, setMutualMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const firstName = user?.firstName || 'there';
    
    if (hour >= 5 && hour < 12) {
      return { text: `Good morning, ${firstName}!`, icon: FiCoffee, subtext: 'Start your day with meaningful connections' };
    } else if (hour >= 12 && hour < 17) {
      return { text: `Good afternoon, ${firstName}!`, icon: FiSun, subtext: 'Perfect time to discover new matches' };
    } else if (hour >= 17 && hour < 21) {
      return { text: `Good evening, ${firstName}!`, icon: FiSun, subtext: 'Wind down with some profile browsing' };
    } else {
      return { text: `Good night, ${firstName}!`, icon: FiMoon, subtext: 'Your perfect match might be just a click away' };
    }
  }, [user]);

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
        {/* Header Banner with Personalized Greeting */}
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
            
            <div className="relative z-10 flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="hidden sm:flex w-16 h-16 bg-white/20 rounded-2xl items-center justify-center"
              >
                <greeting.icon className="w-8 h-8" aria-hidden="true" />
              </motion.div>
              <div>
                <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
                  {greeting.text}
                </h1>
                <p className="text-white/90 text-lg">
                  {greeting.subtext}
                </p>
              </div>
            </div>
            
            {/* Stats celebration if views are high */}
            {stats.viewsThisWeek > 5 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 pt-4 border-t border-white/20"
              >
                <p className="text-white/90 flex items-center gap-2">
                  <FiStar className="w-5 h-5 text-gold" aria-hidden="true" />
                  Congrats! {stats.viewsThisWeek} people viewed your profile this week
                </p>
              </motion.div>
            )}
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
                  onChat={() => navigate('/chat')}
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
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-neutral-800">
                    Suggested Matches
                  </h2>
                  <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs font-semibold rounded-full border border-primary-100">
                    AI Powered
                  </span>
                </div>
                <p className="text-neutral-600 text-sm">Handpicked profiles based on your preferences and activity</p>
              </div>
              <motion.div whileHover={{ x: 5 }}>
                <Link 
                  to="/search" 
                  className="inline-flex items-center gap-2 text-primary-500 font-semibold hover:text-primary-600 transition-colors"
                >
                  View All
                  <FiArrowRight className="w-4 h-4" aria-hidden="true" />
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
                  isAISuggested={profile.compatibilityScore >= 85}
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

export default Dashboard;

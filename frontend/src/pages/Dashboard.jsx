import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiEye, FiHeart, FiUsers, FiTrendingUp, FiMessageCircle, FiStar, FiMapPin } from 'react-icons/fi';
import { formatCompatibilityScore } from '../utils/compatibility';

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
      
      // Set default stats immediately
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

      // Handle stats
      if (statsRes.status === 'fulfilled' && statsRes.value?.data?.stats) {
        setStats(statsRes.value.data.stats);
      }

      // Handle suggestions - normalize data
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
        
        // Normalize suggestions
        const normalized = suggestionsData.map(profile => ({
          ...profile,
          userId: profile.userId || profile.id || profile.User?.id,
          firstName: profile.firstName || profile.first_name || 'Unknown',
          lastName: profile.lastName || profile.last_name || '',
          city: profile.city || profile.location || 'Location not specified',
          profilePhoto: profile.profilePhoto || profile.profile_photo || null,
        })).filter(p => p.userId); // Only include profiles with userId
        
        console.log('Normalized suggestions:', normalized.length, normalized);
        setSuggestions(normalized);
      }

      // Handle mutual matches - normalize data
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
        
        // Normalize mutual matches
        const normalized = matchesData.map(match => ({
          ...match,
          userId: match.userId || match.id || match.User?.id,
          firstName: match.firstName || match.first_name || 'Unknown',
          lastName: match.lastName || match.last_name || '',
          city: match.city || match.location || 'Location not specified',
          profilePhoto: match.profilePhoto || match.profile_photo || null,
        })).filter(m => m.userId); // Only include matches with userId
        
        console.log('Normalized mutual matches:', normalized.length, normalized);
        setMutualMatches(normalized);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-neutral-50 via-white to-neutral-50">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <div className="mb-10">
          <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-saffron-500 rounded-2xl shadow-xl p-8 text-white mb-6">
            <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">Your Dashboard</h1>
            <p className="text-white/90 text-lg">Welcome back! Here's your activity overview</p>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-600 text-sm font-semibold mb-1">Profile Views</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">{stats?.viewsThisWeek ?? 0}</p>
                <p className="text-xs text-neutral-500 mt-2">This week</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center">
                <FiEye className="w-7 h-7 text-primary-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-600 text-sm font-semibold mb-1">Total Views</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-saffron-600 to-saffron-500 bg-clip-text text-transparent">{stats?.totalViews ?? 0}</p>
                <p className="text-xs text-neutral-500 mt-2">All time</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-saffron-100 to-saffron-200 rounded-xl flex items-center justify-center">
                <FiTrendingUp className="w-7 h-7 text-saffron-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-600 text-sm font-semibold mb-1">Likes Received</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent">{stats?.likesReceived ?? 0}</p>
                <p className="text-xs text-neutral-500 mt-2">Total</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-pink-100 to-pink-200 rounded-xl flex items-center justify-center">
                <FiHeart className="w-7 h-7 text-pink-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-600 text-sm font-semibold mb-1">Mutual Matches</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-trust-600 to-trust-500 bg-clip-text text-transparent">{mutualMatches.length}</p>
                <p className="text-xs text-neutral-500 mt-2">Ready to chat</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-trust-100 to-trust-200 rounded-xl flex items-center justify-center">
                <FiUsers className="w-7 h-7 text-trust-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Mutual Matches */}
        {mutualMatches.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-neutral-900 mb-1">Mutual Matches</h2>
                <p className="text-neutral-600 text-sm">People who liked you back</p>
              </div>
              <Link to="/chat" className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2">
                <span>View All</span>
                <FiMessageCircle className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {mutualMatches.slice(0, 3).map((match, index) => {
                const userId = match.userId || match.id;
                if (!userId) {
                  console.warn('Mutual match missing userId:', match);
                  return null;
                }
                
                return (
                  <MatchCard 
                    key={`match-${userId}-${index}`}
                    match={match}
                    userId={userId}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Enhanced Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-neutral-900 mb-1">Suggested Matches</h2>
                <p className="text-neutral-600 text-sm">Based on your preferences</p>
              </div>
              <Link to="/search" className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
                View All
              </Link>
            </div>
            <div 
              className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
            >
              {suggestions.map((profile, index) => {
                const userId = profile.userId || profile.id;
                if (!userId) {
                  console.warn('Suggestion missing userId:', profile);
                  return null;
                }
                
                return (
                  <ProfileCard 
                    key={`suggestion-${userId}-${index}`}
                    profile={profile}
                    userId={userId}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Enhanced Empty State */}
        {suggestions.length === 0 && mutualMatches.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-neutral-200">
            <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-saffron-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiUsers className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 mb-2">Complete your profile to see matches!</h3>
            <p className="text-neutral-600 mb-8 max-w-md mx-auto">Add more details to your profile to get better match suggestions</p>
            <Link to="/profile" className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 inline-block">
              Complete Profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

// Simplified MatchCard component
const MatchCard = ({ match, userId }) => {
  const navigate = useNavigate();
  const fullName = `${match.firstName || ''} ${match.lastName || ''}`.trim() || 'Unknown';
  const initials = (match.firstName?.[0] || '') + (match.lastName?.[0] || '') || '?';
  
  const handleClick = () => {
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  return (
    <div 
      className="bg-white rounded-2xl shadow-lg border border-neutral-200 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
      onClick={handleClick}
    >
      <div className="text-center">
        {match.profilePhoto ? (
          <img
            src={`http://localhost:5000${match.profilePhoto}`}
            alt={fullName}
            className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-2 border-neutral-200"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className={`w-20 h-20 rounded-full mx-auto mb-4 bg-gradient-to-br from-primary-100 to-saffron-100 flex items-center justify-center text-neutral-600 text-xl font-semibold border-2 border-neutral-300 ${match.profilePhoto ? 'hidden' : ''}`}
        >
          {initials}
        </div>
        <h3 className="text-lg font-semibold mb-1 text-neutral-900">
          {fullName}
        </h3>
        <p className="text-neutral-700 text-sm mb-2">{match.city || 'Location not specified'}</p>
        {match.compatibilityScore && (
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
            formatCompatibilityScore(match.compatibilityScore).bg
          } ${formatCompatibilityScore(match.compatibilityScore).color}`}>
            {match.compatibilityScore}% Match
          </span>
        )}
      </div>
    </div>
  );
};

// Simplified ProfileCard component
const ProfileCard = ({ profile, userId }) => {
  const navigate = useNavigate();
  const compatibility = formatCompatibilityScore(profile.compatibilityScore);
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown';
  const initials = (profile.firstName?.[0] || '') + (profile.lastName?.[0] || '') || '?';

  const handleClick = () => {
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  console.log('Dashboard ProfileCard render:', { fullName, userId, hasPhoto: !!profile.profilePhoto });

  return (
    <div 
      className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group"
      onClick={handleClick}
      style={{ minHeight: '320px', display: 'flex', flexDirection: 'column' }}
    >
      <div className="relative mb-4 overflow-hidden rounded-t-2xl" style={{ minHeight: '192px', flexShrink: 0 }}>
        {profile.profilePhoto ? (
          <img
            src={`http://localhost:5000${profile.profilePhoto}`}
            alt={fullName}
            className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className={`w-full h-48 bg-gradient-to-br from-primary-100 via-saffron-100 to-primary-200 flex items-center justify-center text-neutral-500 text-4xl font-bold ${profile.profilePhoto ? 'hidden' : ''}`}
        >
          {initials}
        </div>
        {profile.compatibilityScore && (
          <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold ${compatibility.bg} ${compatibility.color} shadow-lg`}>
            {Math.round(profile.compatibilityScore)}% Match
          </div>
        )}
      </div>
      <div className="p-4" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 className="text-xl font-bold mb-2 text-neutral-900">
          {fullName}
        </h3>
        <p className="text-neutral-600 text-sm mb-3 flex items-center gap-1.5">
          <FiMapPin className="w-3.5 h-3.5 text-primary" />
          {profile.city || 'Location not specified'}
        </p>
        {profile.education && (
          <p className="text-neutral-600 text-xs font-medium">{profile.education}</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

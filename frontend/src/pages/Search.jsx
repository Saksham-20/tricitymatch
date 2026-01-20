import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiFilter, FiHeart, FiStar, FiX, FiBookmark, FiSearch, FiMapPin, FiBriefcase, FiBook, FiUsers, FiCalendar, FiChevronDown, FiArrowRight } from 'react-icons/fi';
import { staggerContainer, fadeInUp, scaleIn } from '../utils/animations';
import { API_BASE_URL } from '../utils/api';

const Search = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    ageMin: '',
    ageMax: '',
    heightMin: '',
    heightMax: '',
    city: '',
    education: '',
    profession: '',
    diet: '',
    smoking: '',
    drinking: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState('compatibility');

  useEffect(() => {
    searchProfiles();
  }, [page]);

  const searchProfiles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });
      params.append('page', page);
      params.append('limit', 20);
      params.append('sortBy', sortBy);

      const response = await api.get(`/search?${params.toString()}`);
      
      let profilesData = [];
      
      if (Array.isArray(response.data)) {
        profilesData = response.data;
      } else if (response.data?.profiles && Array.isArray(response.data.profiles)) {
        profilesData = response.data.profiles;
      } else if (response.data?.data?.profiles && Array.isArray(response.data.data.profiles)) {
        profilesData = response.data.data.profiles;
      } else if (response.data?.results && Array.isArray(response.data.results)) {
        profilesData = response.data.results;
      }
      
      const normalizedProfiles = profilesData.map((profile) => {
        const userId = profile.userId || profile.User?.id || (profile.User && profile.User.id);
        
        let age = profile.age;
        if (!age && profile.dateOfBirth) {
          const birthDate = new Date(profile.dateOfBirth);
          const today = new Date();
          const calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          age = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
            ? calculatedAge - 1 
            : calculatedAge;
        }
        
        return {
          ...profile,
          userId: userId,
          profileId: profile.id,
          id: profile.id,
          age: age,
          firstName: profile.firstName || profile.first_name || 'Unknown',
          lastName: profile.lastName || profile.last_name || '',
          city: profile.city || profile.location || 'Location not specified',
          profilePhoto: profile.profilePhoto || profile.profile_photo || null,
        };
      });
      
      if (page === 1) {
        setProfiles(normalizedProfiles);
      } else {
        setProfiles(prev => [...prev, ...normalizedProfiles]);
      }
      
      const pagination = response.data?.pagination || response.data?.data?.pagination || {};
      setHasMore(pagination.page < pagination.pages);
      
    } catch (error) {
      console.error('Search error:', error);
      if (error.response?.status !== 404) {
        toast.error(error.response?.data?.message || 'Failed to search profiles');
      }
      if (page === 1) {
        setProfiles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleApplyFilters = () => {
    setPage(1);
    searchProfiles();
    setShowFilters(false);
    toast.success('Filters applied!');
  };

  const handleClearFilters = () => {
    setFilters({
      ageMin: '',
      ageMax: '',
      heightMin: '',
      heightMax: '',
      city: '',
      education: '',
      profession: '',
      diet: '',
      smoking: '',
      drinking: '',
    });
    setPage(1);
    searchProfiles();
    toast.success('Filters cleared!');
  };

  const handleMatchAction = async (userId, action) => {
    if (!userId) {
      toast.error('Unable to perform action - profile data incomplete');
      return;
    }
    
    try {
      await api.post(`/match/${userId}`, { action });
      toast.success(action === 'like' ? 'Interest expressed!' : 'Profile shortlisted!');
      setProfiles(profiles.map(p => {
        return p.userId === userId ? { ...p, matchStatus: action } : p;
      }));
    } catch (error) {
      console.error('Match action error:', error);
      toast.error(error.response?.data?.message || 'Failed to perform action');
    }
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setPage(1);
    searchProfiles();
  };

  return (
    <motion.div 
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-neutral-50 via-white to-primary-50/20"
    >
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <motion.div 
          variants={fadeInUp}
          className="relative mb-8 rounded-3xl overflow-hidden bg-gradient-hero shadow-burgundy"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 right-20 w-40 h-40 border border-white rounded-full" />
            <div className="absolute bottom-5 left-10 w-60 h-60 border border-white rounded-full" />
          </div>
          <div className="relative px-8 py-12 md:py-16 text-center">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl md:text-4xl font-display font-bold text-white mb-3"
            >
              Find Your Perfect Match
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-white/90 text-lg max-w-2xl mx-auto"
            >
              Discover meaningful connections from verified profiles in the Tricity area
            </motion.p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <motion.div variants={fadeInUp} className="lg:col-span-1">
            <div className="card sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
                  <FiFilter className="w-5 h-5 text-primary-500" />
                  Search Filters
                </h2>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden p-2 hover:bg-neutral-100 rounded-xl transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-5">
                {/* Age Range */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
                    <FiCalendar className="w-4 h-4 text-primary-500" />
                    Age Range
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      name="ageMin"
                      value={filters.ageMin}
                      onChange={handleFilterChange}
                      className="input-field flex-1 text-center"
                      placeholder="21"
                      min="18"
                      max="100"
                    />
                    <span className="text-neutral-500 text-sm">to</span>
                    <input
                      type="number"
                      name="ageMax"
                      value={filters.ageMax}
                      onChange={handleFilterChange}
                      className="input-field flex-1 text-center"
                      placeholder="35"
                      min="18"
                      max="100"
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
                    <FiMapPin className="w-4 h-4 text-primary-500" />
                    Location
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={filters.city}
                    onChange={handleFilterChange}
                    className="input-field"
                    placeholder="e.g., Chandigarh, Mohali"
                  />
                </div>

                {/* Education */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
                    <FiBook className="w-4 h-4 text-primary-500" />
                    Education
                  </label>
                  <select
                    name="education"
                    value={filters.education}
                    onChange={handleFilterChange}
                    className="input-field"
                  >
                    <option value="">Any Education</option>
                    <option value="Graduate">Graduate</option>
                    <option value="Post Graduate">Post Graduate</option>
                    <option value="Doctorate">Doctorate</option>
                    <option value="Professional">Professional</option>
                  </select>
                </div>

                {/* Profession */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
                    <FiBriefcase className="w-4 h-4 text-primary-500" />
                    Profession
                  </label>
                  <input
                    type="text"
                    name="profession"
                    value={filters.profession}
                    onChange={handleFilterChange}
                    className="input-field"
                    placeholder="e.g., Engineer, Doctor"
                  />
                </div>

                {/* Lifestyle Filters */}
                <div className="pt-4 border-t border-neutral-100">
                  <h3 className="text-sm font-semibold text-neutral-800 mb-4">Lifestyle Preferences</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Diet</label>
                      <select
                        name="diet"
                        value={filters.diet}
                        onChange={handleFilterChange}
                        className="input-field text-sm"
                      >
                        <option value="">Any</option>
                        <option value="vegetarian">Vegetarian</option>
                        <option value="non-vegetarian">Non-Vegetarian</option>
                        <option value="vegan">Vegan</option>
                        <option value="jain">Jain</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Smoking</label>
                      <select
                        name="smoking"
                        value={filters.smoking}
                        onChange={handleFilterChange}
                        className="input-field text-sm"
                      >
                        <option value="">Any</option>
                        <option value="never">Never</option>
                        <option value="occasionally">Occasionally</option>
                        <option value="regularly">Regularly</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Drinking</label>
                      <select
                        name="drinking"
                        value={filters.drinking}
                        onChange={handleFilterChange}
                        className="input-field text-sm"
                      >
                        <option value="">Any</option>
                        <option value="never">Never</option>
                        <option value="occasionally">Occasionally</option>
                        <option value="regularly">Regularly</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-4 border-t border-neutral-100">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleApplyFilters}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <FiSearch className="w-4 h-4" />
                    Apply Filters
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleClearFilters}
                    className="btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    <FiX className="w-4 h-4" />
                    Clear All
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Main Content Area */}
          <motion.div variants={fadeInUp} className="lg:col-span-3">
            {/* Results Header */}
            <div className="card mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-800 mb-1">
                    {profiles.length} {profiles.length === 1 ? 'Profile' : 'Profiles'} Found
                  </h2>
                  <p className="text-sm text-neutral-600">Discover your perfect life partner</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select 
                    value={sortBy}
                    onChange={handleSortChange}
                    className="input-field text-sm flex-1 sm:flex-none sm:min-w-[160px]"
                  >
                    <option value="compatibility">Sort by Match %</option>
                    <option value="age">Sort by Age</option>
                    <option value="location">Sort by Location</option>
                    <option value="recent">Most Recent</option>
                  </select>
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className="lg:hidden p-3 border-2 border-neutral-200 rounded-xl hover:border-primary-500 transition-colors"
                  >
                    <FiFilter className="w-5 h-5 text-neutral-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Profiles Grid */}
            {loading && profiles.length === 0 ? (
              <div className="flex justify-center items-center py-16">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                >
                  <div className="spinner mx-auto mb-4" />
                  <p className="text-neutral-600">Loading profiles...</p>
                </motion.div>
              </div>
            ) : profiles.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 card"
              >
                <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-gold-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FiUsers className="w-10 h-10 text-primary-500" />
                </div>
                <p className="text-neutral-800 mb-2 text-xl font-semibold">No profiles found</p>
                <p className="text-neutral-600 mb-6">Try adjusting your filters to see more results</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClearFilters}
                  className="btn-primary"
                >
                  Clear Filters
                </motion.button>
              </motion.div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  <AnimatePresence mode="popLayout">
                    {profiles.map((profile, index) => {
                      const userId = profile.userId;
                      const profileId = profile.userId || profile.id || profile.profileId;
                      
                      if (!profileId) return null;
                      
                      return (
                        <ProfileCard
                          key={`profile-${profileId}-${index}`}
                          profile={profile}
                          userId={userId}
                          index={index}
                          onLike={() => handleMatchAction(userId, 'like')}
                          onShortlist={() => handleMatchAction(userId, 'shortlist')}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>
                
                {hasMore && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center mt-10"
                  >
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setPage(page + 1)}
                      disabled={loading}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          Load More Profiles
                          <FiArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

// Enhanced ProfileCard component
const ProfileCard = ({ profile, userId, index, onLike, onShortlist }) => {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(profile.matchStatus === 'like');
  const [isShortlisted, setIsShortlisted] = useState(profile.matchStatus === 'shortlist');
  
  const getAge = () => {
    if (profile.age) return profile.age;
    if (profile.dateOfBirth) {
      const birthDate = new Date(profile.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      return monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
        ? age - 1 
        : age;
    }
    return 'N/A';
  };

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Profile';
  const initials = (profile.firstName?.[0] || '') + (profile.lastName?.[0] || '') || '?';
  
  const handleCardClick = () => {
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  const handleLike = (e) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    onLike();
  };

  const handleShortlist = (e) => {
    e.stopPropagation();
    setIsShortlisted(!isShortlisted);
    onShortlist();
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -6 }}
      className="card p-0 overflow-hidden cursor-pointer group"
      onClick={handleCardClick}
    >
      {/* Photo Section */}
      <div className="relative h-52 overflow-hidden">
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
          className={`w-full h-full bg-gradient-to-br from-primary-100 via-gold-50 to-primary-50 flex items-center justify-center ${profile.profilePhoto ? 'hidden' : ''}`}
        >
          <span className="text-4xl font-bold text-primary-300">
            {initials}
          </span>
        </div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Action Icons */}
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleShortlist}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
              isShortlisted 
                ? 'bg-gold text-white' 
                : 'bg-white/95 backdrop-blur-sm text-neutral-700 hover:bg-white'
            }`}
          >
            <FiBookmark className={`w-5 h-5 ${isShortlisted ? 'fill-current' : ''}`} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLike}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
              isLiked 
                ? 'bg-primary-500 text-white' 
                : 'bg-white/95 backdrop-blur-sm text-primary-500 hover:bg-white'
            }`}
          >
            <motion.div
              animate={isLiked ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <FiHeart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </motion.div>
          </motion.button>
        </div>
        
        {/* Match Badge */}
        {profile.compatibilityScore && profile.compatibilityScore >= 80 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="absolute top-3 left-3 px-3 py-1.5 bg-neutral-900/90 backdrop-blur-sm rounded-full text-xs font-bold flex items-center gap-1.5 text-white shadow-lg"
          >
            <FiStar className="w-3.5 h-3.5 text-gold fill-gold" />
            {Math.round(profile.compatibilityScore)}% Match
          </motion.div>
        )}
      </div>
      
      {/* Info Section */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-neutral-800 mb-2 group-hover:text-primary-500 transition-colors">
          {fullName}
        </h3>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-neutral-600">
            <FiCalendar className="w-4 h-4 text-primary-400" />
            <span className="text-sm">{getAge()} years</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-600">
            <FiMapPin className="w-4 h-4 text-primary-400" />
            <span className="text-sm">{profile.city || 'Location not specified'}</span>
          </div>
          {profile.education && (
            <div className="flex items-center gap-2 text-neutral-500">
              <FiBook className="w-4 h-4 text-primary-400" />
              <span className="text-sm">{profile.education}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-neutral-100">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              e.stopPropagation();
              handleLike(e);
            }}
            className="flex-1 btn-gold text-sm py-2.5"
          >
            Express Interest
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCardClick}
            className="flex-1 btn-secondary text-sm py-2.5"
          >
            View Profile
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default Search;

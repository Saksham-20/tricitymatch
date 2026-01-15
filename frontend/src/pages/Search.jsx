import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiFilter, FiHeart, FiStar, FiX, FiBookmark, FiSearch, FiMapPin, FiBriefcase, FiBook, FiUsers, FiCalendar } from 'react-icons/fi';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      // Normalize profile data structure
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
      toast.success(action === 'like' ? 'Profile liked!' : 'Profile shortlisted!');
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
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-neutral-50 via-white to-neutral-50">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section - Smaller */}
        <div className="relative mb-6 rounded-xl overflow-hidden bg-gradient-to-br from-primary-500 via-primary-600 to-saffron-500 shadow-lg">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative px-6 py-10 text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 drop-shadow-lg">
              Find Your Perfect Match
            </h1>
            <p className="text-white/95 text-sm md:text-base max-w-2xl mx-auto">
              Discover meaningful connections in the Tricity area
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Enhanced Filters Sidebar - Smaller sizes */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-4 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                  <FiFilter className="w-4 h-4 text-primary-600" />
                  Search Filters
                </h2>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Age Range - Smaller */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                    <FiCalendar className="w-3.5 h-3.5 text-primary-600" />
                    Age Range
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="ageMin"
                      value={filters.ageMin}
                      onChange={handleFilterChange}
                      className="input-field flex-1 text-center text-sm py-2"
                      placeholder="21"
                      min="18"
                      max="100"
                    />
                    <span className="text-neutral-600 text-xs font-medium">to</span>
                    <input
                      type="number"
                      name="ageMax"
                      value={filters.ageMax}
                      onChange={handleFilterChange}
                      className="input-field flex-1 text-center text-sm py-2"
                      placeholder="35"
                      min="18"
                      max="100"
                    />
                  </div>
                </div>

                {/* Location - Smaller */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                    <FiMapPin className="w-3.5 h-3.5 text-primary-600" />
                    Location
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={filters.city}
                    onChange={handleFilterChange}
                    className="input-field text-sm py-2"
                    placeholder="e.g., Chandigarh, Mohali"
                  />
                </div>

                {/* Education - Smaller */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                    <FiBook className="w-3.5 h-3.5 text-primary-600" />
                    Education
                  </label>
                  <select
                    name="education"
                    value={filters.education}
                    onChange={handleFilterChange}
                    className="input-field text-sm py-2"
                  >
                    <option value="">Any Education</option>
                    <option value="Graduate">Graduate</option>
                    <option value="Post Graduate">Post Graduate</option>
                    <option value="Doctorate">Doctorate</option>
                    <option value="Professional">Professional</option>
                  </select>
                </div>

                {/* Profession - Smaller */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                    <FiBriefcase className="w-3.5 h-3.5 text-primary-600" />
                    Profession
                  </label>
                  <input
                    type="text"
                    name="profession"
                    value={filters.profession}
                    onChange={handleFilterChange}
                    className="input-field text-sm py-2"
                    placeholder="e.g., Engineer, Doctor"
                  />
                </div>

                {/* Lifestyle Filters - Smaller */}
                <div className="pt-3 border-t border-neutral-200">
                  <h3 className="text-xs font-semibold text-neutral-800 mb-2">Lifestyle</h3>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Diet</label>
                      <select
                        name="diet"
                        value={filters.diet}
                        onChange={handleFilterChange}
                        className="input-field text-xs py-1.5"
                      >
                        <option value="">Any</option>
                        <option value="vegetarian">Vegetarian</option>
                        <option value="non-vegetarian">Non-Vegetarian</option>
                        <option value="vegan">Vegan</option>
                        <option value="jain">Jain</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Smoking</label>
                      <select
                        name="smoking"
                        value={filters.smoking}
                        onChange={handleFilterChange}
                        className="input-field text-xs py-1.5"
                      >
                        <option value="">Any</option>
                        <option value="never">Never</option>
                        <option value="occasionally">Occasionally</option>
                        <option value="regularly">Regularly</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Drinking</label>
                      <select
                        name="drinking"
                        value={filters.drinking}
                        onChange={handleFilterChange}
                        className="input-field text-xs py-1.5"
                      >
                        <option value="">Any</option>
                        <option value="never">Never</option>
                        <option value="occasionally">Occasionally</option>
                        <option value="regularly">Regularly</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Smaller */}
                <div className="space-y-2 pt-3 border-t border-neutral-200">
                  <button
                    onClick={handleApplyFilters}
                    className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                  >
                    <FiSearch className="w-3.5 h-3.5" />
                    Apply Filters
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className="w-full bg-white border-2 border-neutral-300 hover:border-neutral-400 text-neutral-700 hover:text-neutral-900 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-1.5"
                  >
                    <FiX className="w-3.5 h-3.5" />
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {/* Results Header - Smaller */}
            <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-4 mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900 mb-0.5">
                    {profiles.length} {profiles.length === 1 ? 'Profile' : 'Profiles'} Found
                  </h2>
                  <p className="text-xs text-neutral-600">Discover your perfect match</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select 
                    value={sortBy}
                    onChange={handleSortChange}
                    className="input-field text-xs py-2 text-neutral-800 bg-white flex-1 sm:flex-none min-w-[140px]"
                  >
                    <option value="compatibility">Sort by Match</option>
                    <option value="age">Sort by Age</option>
                    <option value="location">Sort by Location</option>
                    <option value="recent">Most Recent</option>
                  </select>
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className="lg:hidden p-2 border-2 border-neutral-200 rounded-lg hover:border-primary-600 transition-colors bg-white shadow-sm"
                  >
                    <FiFilter className="w-4 h-4 text-neutral-700" />
                  </button>
                </div>
              </div>
            </div>

            {/* Profiles Grid */}
            {loading && profiles.length === 0 ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-3 border-primary-600 border-t-transparent mx-auto mb-3"></div>
                  <p className="text-neutral-700 text-sm font-medium">Loading profiles...</p>
                </div>
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl shadow-md border border-neutral-200">
                <FiUsers className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                <p className="text-neutral-800 mb-1.5 text-base font-semibold">No profiles found</p>
                <p className="text-xs text-neutral-600 mb-4">Try adjusting your filters to see more results.</p>
                <button
                  onClick={handleClearFilters}
                  className="btn-primary text-white text-sm px-4 py-2"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div 
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
                >
                  {profiles.map((profile, index) => {
                    const userId = profile.userId;
                    const profileId = profile.userId || profile.id || profile.profileId;
                    
                    if (!profileId) {
                      return null;
                    }
                    
                    return (
                      <ProfileCard
                        key={`profile-${profileId}-${index}`}
                        profile={profile}
                        userId={userId}
                        onLike={() => handleMatchAction(userId, 'like')}
                        onShortlist={() => handleMatchAction(userId, 'shortlist')}
                      />
                    );
                  })}
                </div>
                {hasMore && (
                  <div className="text-center mt-6">
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={loading}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      {loading ? 'Loading...' : 'Load More Profiles'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced ProfileCard component
const ProfileCard = ({ profile, userId, onLike, onShortlist }) => {
  const navigate = useNavigate();
  
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

  return (
    <div 
      className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
      style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}
    >
        {/* Photo Section - Fixed colors and sizes */}
      <div 
        className="relative h-56 bg-gradient-to-br from-primary-100 via-saffron-100 to-primary-200 cursor-pointer overflow-hidden group"
        onClick={handleCardClick}
      >
        {profile.profilePhoto ? (
          <img
            src={`http://localhost:5000${profile.profilePhoto}`}
            alt={fullName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : null}
        <div 
          className={`w-full h-full flex items-center justify-center ${profile.profilePhoto ? 'hidden' : ''}`}
          style={{ 
            background: 'linear-gradient(135deg, #f8bbd0 0%, #FFEECC 50%, #f8bbd0 100%)'
          }}
        >
          <span className="text-3xl font-bold" style={{ color: '#7C2D12', textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
            {initials}
          </span>
        </div>
        
        {/* Action Icons - Smaller and better contrast */}
        <div className="absolute top-2 right-2 flex gap-1.5 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShortlist();
            }}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-neutral-50 transition-all duration-200 shadow-md hover:shadow-lg"
            title="Shortlist"
          >
            <FiBookmark className="w-4 h-4 text-neutral-800" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike();
            }}
            className={`w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-neutral-50 transition-all duration-200 shadow-md hover:shadow-lg ${
              profile.matchStatus === 'like' ? 'bg-primary-50' : ''
            }`}
            title="Like"
          >
            <FiHeart className={`w-4 h-4 ${profile.matchStatus === 'like' ? 'text-primary-600 fill-primary-600' : 'text-neutral-800'}`} />
          </button>
        </div>
        
        {/* Match Badge - High contrast */}
        {profile.compatibilityScore && profile.compatibilityScore >= 80 && (
          <div 
            className="absolute top-2 left-2 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 z-10 shadow-xl border-2"
            style={{
              backgroundColor: '#1F2937',
              borderColor: '#FFFFFF',
              color: '#FFFFFF'
            }}
          >
            <FiStar className="w-3.5 h-3.5" style={{ color: '#FCD34D', fill: '#FCD34D' }} />
            <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '11px' }}>
              {Math.round(profile.compatibilityScore)}%
            </span>
            <span style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '10px', opacity: 0.95 }}>
              Match
            </span>
          </div>
        )}
      </div>
      
      {/* Info Section - Smaller sizes */}
      <div className="p-4 bg-white flex-1 flex flex-col">
        <h3 
          className="text-lg font-semibold mb-1.5 text-neutral-900 hover:text-primary-600 transition-colors cursor-pointer"
          onClick={handleCardClick}
        >
          {fullName}
        </h3>
        
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-1.5 text-neutral-700">
            <FiCalendar className="w-3.5 h-3.5 text-primary-600" />
            <span className="text-xs font-medium">{getAge()} years</span>
          </div>
          <div className="flex items-center gap-1.5 text-neutral-600">
            <FiMapPin className="w-3.5 h-3.5 text-primary-600" />
            <span className="text-xs">{profile.city || 'Location not specified'}</span>
          </div>
          {profile.education && (
            <div className="flex items-center gap-1.5 text-neutral-600">
              <FiBook className="w-3.5 h-3.5 text-primary-600" />
              <span className="text-xs">{profile.education}</span>
            </div>
          )}
          {profile.profession && (
            <div className="flex items-center gap-1.5 text-neutral-600">
              <FiBriefcase className="w-3.5 h-3.5 text-primary-600" />
              <span className="text-xs">{profile.profession}</span>
            </div>
          )}
        </div>

        {/* Action Buttons - High contrast text */}
        <div className="flex gap-2 mt-auto pt-3 border-t border-neutral-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (userId) {
                toast.info('Message feature coming soon');
              }
            }}
            className="flex-1 bg-saffron-600 hover:bg-saffron-700 text-white px-3 py-2 rounded-lg font-bold text-xs transition-all duration-200 shadow-md hover:shadow-lg"
            style={{ 
              color: '#FFFFFF', 
              fontWeight: 700,
              backgroundColor: '#D97706',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}
          >
            Message
          </button>
          <button
            onClick={handleCardClick}
            className="flex-1 bg-white border-2 hover:bg-primary-600 hover:text-white px-3 py-2 rounded-lg font-bold text-xs transition-all duration-200 shadow-sm hover:shadow-md"
            style={{ 
              color: '#7C2D12', 
              fontWeight: 700,
              borderColor: '#7C2D12'
            }}
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default Search;

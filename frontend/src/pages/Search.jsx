import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiFilter, FiHeart, FiStar, FiX } from 'react-icons/fi';
import { formatCompatibilityScore } from '../utils/compatibility';

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

      const response = await api.get(`/search?${params.toString()}`);
      if (page === 1) {
        setProfiles(response.data.profiles);
      } else {
        setProfiles(prev => [...prev, ...response.data.profiles]);
      }
      setHasMore(response.data.pagination.page < response.data.pagination.pages);
    } catch (error) {
      toast.error('Failed to search profiles');
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
  };

  const handleMatchAction = async (userId, action) => {
    try {
      await api.post(`/match/${userId}`, { action });
      toast.success(action === 'like' ? 'Profile liked!' : 'Profile shortlisted!');
      // Update local state
      setProfiles(profiles.map(p => 
        p.userId === userId ? { ...p, matchStatus: action } : p
      ));
    } catch (error) {
      toast.error('Failed to perform action');
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">Search Profiles</h1>
            <p className="text-gray-600 mt-1 text-sm">Find your perfect match with advanced filters</p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center space-x-2"
          >
            <FiFilter className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>

        {/* Filters Sidebar */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card mb-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Search Filters</h2>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close filters"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Age Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="ageMin"
                    value={filters.ageMin}
                    onChange={handleFilterChange}
                    className="input-field"
                    placeholder="Min"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="number"
                    name="ageMax"
                    value={filters.ageMax}
                    onChange={handleFilterChange}
                    className="input-field"
                    placeholder="Max"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">City</label>
                <select
                  name="city"
                  value={filters.city}
                  onChange={handleFilterChange}
                  className="input-field"
                >
                  <option value="">All Cities</option>
                  <option value="Chandigarh">Chandigarh</option>
                  <option value="Mohali">Mohali</option>
                  <option value="Panchkula">Panchkula</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Height Range (cm)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="heightMin"
                    value={filters.heightMin}
                    onChange={handleFilterChange}
                    className="input-field"
                    placeholder="Min"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="number"
                    name="heightMax"
                    value={filters.heightMax}
                    onChange={handleFilterChange}
                    className="input-field"
                    placeholder="Max"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Education</label>
                <input
                  type="text"
                  name="education"
                  value={filters.education}
                  onChange={handleFilterChange}
                  className="input-field"
                  placeholder="e.g., B.Tech, MBA"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Profession</label>
                <input
                  type="text"
                  name="profession"
                  value={filters.profession}
                  onChange={handleFilterChange}
                  className="input-field"
                  placeholder="e.g., Software Engineer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Diet Preference</label>
                <select
                  name="diet"
                  value={filters.diet}
                  onChange={handleFilterChange}
                  className="input-field"
                >
                  <option value="">Any</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="non-vegetarian">Non-Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="jain">Jain</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Smoking</label>
                <select
                  name="smoking"
                  value={filters.smoking}
                  onChange={handleFilterChange}
                  className="input-field"
                >
                  <option value="">Any</option>
                  <option value="never">Never</option>
                  <option value="occasionally">Occasionally</option>
                  <option value="regularly">Regularly</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => {
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
                }}
                className="btn-secondary"
              >
                Clear All
              </button>
              <button onClick={handleApplyFilters} className="btn-primary">
                Apply Filters
              </button>
            </div>
          </motion.div>
        )}

      {/* Profiles Grid */}
      {loading && profiles.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No profiles found matching your criteria.</p>
          <p className="text-sm text-gray-500">Try adjusting your filters to see more results.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {profiles.map((profile, index) => (
              <ProfileCard
                key={profile.userId || index}
                profile={profile}
                onLike={() => handleMatchAction(profile.userId, 'like')}
                onShortlist={() => handleMatchAction(profile.userId, 'shortlist')}
              />
            ))}
          </div>
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={loading}
                  className="btn-primary disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ProfileCard = ({ profile, onLike, onShortlist }) => {
  const compatibility = formatCompatibilityScore(profile.compatibilityScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card hover:shadow-md transition-shadow"
    >
      <Link to={`/profile/${profile.userId}`}>
        <div className="relative mb-4">
          {profile.profilePhoto ? (
            <img
              src={`http://localhost:5000${profile.profilePhoto}`}
              alt={profile.firstName}
              className="w-full h-64 object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-64 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-4xl font-semibold border border-gray-300">
              {profile.firstName[0]}
            </div>
          )}
          {profile.compatibilityScore && (
            <div className={`absolute top-2 right-2 px-2.5 py-1 rounded-full text-xs font-medium ${compatibility.bg} ${compatibility.color}`}>
              {profile.compatibilityScore}% Match
            </div>
          )}
        </div>
      </Link>
      
      <div className="mb-4">
        <Link to={`/profile/${profile.userId}`}>
          <h3 className="text-lg font-semibold mb-1 text-gray-900 hover:text-primary-600 transition-colors">
            {profile.firstName} {profile.lastName}
          </h3>
        </Link>
        <p className="text-gray-600 text-sm mb-2">{profile.city}</p>
        {profile.education && (
          <p className="text-gray-600 text-xs mb-1">{profile.education}</p>
        )}
        {profile.profession && (
          <p className="text-gray-600 text-xs mb-2">{profile.profession}</p>
        )}
        {/* Interest Tags Preview */}
        {profile.interestTags && profile.interestTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {profile.interestTags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">
                {tag}
              </span>
            ))}
            {profile.interestTags.length > 3 && (
              <span className="px-2 py-0.5 text-gray-500 text-xs">
                +{profile.interestTags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onLike}
          disabled={profile.matchStatus === 'like'}
          className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
            profile.matchStatus === 'like'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
          }`}
        >
          <FiHeart className="inline mr-1.5 w-4 h-4" />
          {profile.matchStatus === 'like' ? 'Liked' : 'Like'}
        </button>
        <button
          onClick={onShortlist}
          disabled={profile.matchStatus === 'shortlist'}
          className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
            profile.matchStatus === 'shortlist'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <FiStar className="inline mr-1.5 w-4 h-4" />
          {profile.matchStatus === 'shortlist' ? 'Saved' : 'Save'}
        </button>
      </div>
    </motion.div>
  );
};

export default Search;


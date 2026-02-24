import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  FiSearch, FiFilter, FiUsers, FiArrowRight,
  FiSliders, FiRefreshCw,
} from 'react-icons/fi';
import { staggerContainer, fadeInUp } from '../utils/animations';
import { API_BASE_URL } from '../utils/api';
import { getImageUrl } from '../utils/cloudinary';
import { ProfileCard } from '../components/cards';
import { FilterPanel } from '../components/search';

// ─── Card skeleton for loading state ──────────────────────────────────────
const CardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden animate-pulse">
    <div className="h-52 bg-neutral-200" />
    <div className="p-4 space-y-3">
      <div className="h-4 w-3/4 bg-neutral-200 rounded-lg" />
      <div className="h-3 w-1/2 bg-neutral-100 rounded" />
      <div className="h-3 w-2/3 bg-neutral-100 rounded" />
      <div className="flex gap-2 pt-2">
        <div className="flex-1 h-9 bg-neutral-100 rounded-xl" />
        <div className="flex-1 h-9 bg-neutral-100 rounded-xl" />
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
const Search = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [sortBy, setSortBy]       = useState('compatibility');
  const [totalCount, setTotalCount] = useState(0);

  const [filters, setFilters] = useState({
    ageMin: '', ageMax: '',
    heightMin: '', heightMax: '',
    city: '', education: '', profession: '',
    diet: '', smoking: '', drinking: '',
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  useEffect(() => { searchProfiles(); }, [page]);

  const searchProfiles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
      params.append('page', page);
      params.append('limit', 18);
      params.append('sortBy', sortBy);

      const response = await api.get(`/search?${params.toString()}`);

      let raw = [];
      if (Array.isArray(response.data))                                  raw = response.data;
      else if (Array.isArray(response.data?.profiles))                   raw = response.data.profiles;
      else if (Array.isArray(response.data?.data?.profiles))             raw = response.data.data.profiles;
      else if (Array.isArray(response.data?.results))                    raw = response.data.results;

      const normalized = raw.map((p) => {
        const userId = p.userId || p.User?.id;
        let age = p.age;
        if (!age && p.dateOfBirth) {
          const b = new Date(p.dateOfBirth), t = new Date();
          const diff = t.getFullYear() - b.getFullYear();
          age = (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) ? diff - 1 : diff;
        }
        return {
          ...p, userId, profileId: p.id, id: p.id, age,
          firstName:    p.firstName    || p.first_name    || 'Unknown',
          lastName:     p.lastName     || p.last_name     || '',
          city:         p.city         || p.location      || 'India',
          profilePhoto: p.profilePhoto || p.profile_photo || null,
        };
      });

      page === 1 ? setProfiles(normalized) : setProfiles(prev => [...prev, ...normalized]);

      const pagination = response.data?.pagination || response.data?.data?.pagination || {};
      setHasMore(pagination.page < pagination.pages);
      setTotalCount(pagination.total || normalized.length);
    } catch (err) {
      if (err.response?.status !== 404) toast.error('Failed to load profiles');
      if (page === 1) setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (eventOrObj) => {
    const name  = eventOrObj?.target ? eventOrObj.target.name  : eventOrObj.name;
    const value = eventOrObj?.target ? eventOrObj.target.value : eventOrObj.value;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    setPage(1);
    searchProfiles();
    toast.success('Filters applied');
  };

  const handleClearFilters = () => {
    setFilters({ ageMin: '', ageMax: '', heightMin: '', heightMax: '', city: '', education: '', profession: '', diet: '', smoking: '', drinking: '' });
    setPage(1);
    searchProfiles();
  };

  const handleMatchAction = async (userId, action) => {
    if (!userId) return;
    try {
      await api.post(`/match/${userId}`, { action });
      toast.success(action === 'like' ? 'Interest expressed!' : 'Profile shortlisted!');
      setProfiles(prev => prev.map(p => p.userId === userId ? { ...p, matchStatus: action } : p));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
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
      className="min-h-screen bg-neutral-50 pb-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Page Header ────────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-7 bg-primary-500 rounded-full" />
                <h1 className="font-display text-3xl md:text-4xl font-bold text-neutral-900">
                  Find Your Match
                </h1>
              </div>
              <p className="text-neutral-500 text-sm ml-3">
                Verified profiles from Tricity and beyond
                {totalCount > 0 && (
                  <span className="ml-2 px-2.5 py-0.5 bg-primary-50 text-primary-600 text-xs font-semibold rounded-full border border-primary-100">
                    {totalCount}+ profiles
                  </span>
                )}
              </p>
            </div>

            {/* Sort control */}
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={handleSortChange}
                className="input-field text-sm min-w-[160px]"
              >
                <option value="compatibility">Best Match %</option>
                <option value="age">By Age</option>
                <option value="location">By Location</option>
                <option value="recent">Most Recent</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">

          {/* Filter Panel */}
          <motion.div variants={fadeInUp} className="lg:col-span-1">
            <FilterPanel
              filters={filters}
              onFilterChange={handleFilterChange}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
            />
          </motion.div>

          {/* Results area */}
          <motion.div variants={fadeInUp} className="lg:col-span-3">

            {/* Results meta bar */}
            <div className="flex items-center justify-between mb-5 py-3 px-4 bg-white rounded-2xl border border-neutral-100 shadow-card">
              <p className="text-sm text-neutral-600">
                {loading && profiles.length === 0 ? (
                  <span className="text-neutral-400">Loading profiles…</span>
                ) : (
                  <>
                    <span className="font-semibold text-neutral-900">{profiles.length}</span>
                    {' '}{profiles.length === 1 ? 'profile' : 'profiles'} found
                    {activeFilterCount > 0 && (
                      <span className="ml-2 text-primary-500 font-medium">
                        · {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                      </span>
                    )}
                  </>
                )}
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs text-neutral-400 hover:text-destructive transition-colors font-medium"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* ── Loading skeleton ──────────────────────────────────────── */}
            {loading && profiles.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            )}

            {/* ── Empty state ────────────────────────────────────────────── */}
            {!loading && profiles.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 bg-white rounded-3xl border border-neutral-100 shadow-card"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-primary-50 to-gold-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <FiUsers className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="font-display text-xl font-bold text-neutral-900 mb-2">
                  No profiles found
                </h3>
                <p className="text-neutral-500 text-sm mb-6 max-w-xs mx-auto">
                  Try expanding your filters or check back later — new members join every day.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleClearFilters}
                    className="btn-primary inline-flex items-center gap-2 text-sm"
                  >
                    <FiSliders className="w-4 h-4" />
                    Clear Filters
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setPage(1); searchProfiles(); }}
                    className="btn-secondary inline-flex items-center gap-2 text-sm"
                  >
                    <FiRefreshCw className="w-4 h-4" />
                    Refresh
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Profile grid ───────────────────────────────────────────── */}
            {profiles.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  <AnimatePresence mode="popLayout">
                    {profiles.map((profile, i) => {
                      const pid = profile.userId || profile.id || profile.profileId;
                      if (!pid) return null;
                      return (
                        <ProfileCard
                          key={`profile-${pid}-${i}`}
                          profile={profile}
                          userId={profile.userId}
                          index={i}
                          onLike={() => handleMatchAction(profile.userId, 'like')}
                          onShortlist={() => handleMatchAction(profile.userId, 'shortlist')}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Loading more */}
                {loading && profiles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mt-5">
                    {[0, 1, 2].map(i => <CardSkeleton key={i} />)}
                  </div>
                )}

                {/* Load more button */}
                {hasMore && !loading && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center mt-10"
                  >
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setPage(p => p + 1)}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      Load More Profiles
                      <FiArrowRight className="w-4 h-4" />
                    </motion.button>
                  </motion.div>
                )}

                {/* All loaded */}
                {!hasMore && profiles.length > 6 && (
                  <p className="text-center text-neutral-400 text-sm mt-10 py-4 border-t border-neutral-100">
                    You've seen all {profiles.length} profiles
                  </p>
                )}
              </>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default Search;

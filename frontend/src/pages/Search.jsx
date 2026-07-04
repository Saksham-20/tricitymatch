import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  FiSearch, FiUsers, FiArrowRight,
  FiSliders, FiRefreshCw, FiHash, FiX, FiAlertCircle,
} from 'react-icons/fi';

// Readable labels for active-filter chips
const FILTER_LABELS = {
  ageMin: (v) => `Age ≥ ${v}`,
  ageMax: (v) => `Age ≤ ${v}`,
  heightMin: (v) => `Height ≥ ${v}cm`,
  heightMax: (v) => `Height ≤ ${v}cm`,
  city: (v) => v,
  education: (v) => v,
  profession: (v) => v,
  diet: (v) => `Diet: ${v}`,
  smoking: (v) => `Smoking: ${v}`,
  drinking: (v) => `Drinking: ${v}`,
  religion: (v) => v,
  caste: (v) => v,
  maritalStatus: (v) => v.replace(/_/g, ' '),
  motherTongue: (v) => v,
  incomeMin: (v) => `₹${(v / 100000)}L+ income`,
  incomeMax: (v) => `≤ ₹${(v / 100000)}L income`,
  manglikFilter: (v) => v.replace(/_/g, ' '),
};
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
  const [searchError, setSearchError] = useState(false);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [sortBy, setSortBy]       = useState('compatibility');
  const [totalCount, setTotalCount] = useState(0);

  const [filters, setFilters] = useState({
    ageMin: '', ageMax: '',
    heightMin: '', heightMax: '',
    city: '', education: '', profession: '',
    diet: '', smoking: '', drinking: '',
    religion: '', caste: '', maritalStatus: '', motherTongue: '', incomeMin: '', incomeMax: '', manglikFilter: '',
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const [idQuery, setIdQuery]     = useState('');
  const [idLoading, setIdLoading] = useState(false);

  useEffect(() => { searchProfiles(); }, [page]);

  const handleIdSearch = async (e) => {
    e.preventDefault();
    const code = idQuery.trim();
    if (!code) return;
    try {
      setIdLoading(true);
      const res = await api.get(`/search/by-code?code=${encodeURIComponent(code)}`);
      const found = res.data?.profile;
      if (found?.userId) {
        navigate(`/profile/${found.userId}`);
      } else {
        toast.error('No profile found for that ID');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'No profile found for that ID');
    } finally {
      setIdLoading(false);
    }
  };

  const searchProfiles = async (options = {}) => {
    try {
      setLoading(true);
      const currentFilters = options.overrideFilters || filters;
      const currentPage = options.overridePage || page;
      const currentSort = options.overrideSort || sortBy;

      const params = new URLSearchParams();
      Object.entries(currentFilters).forEach(([k, v]) => { if (v) params.append(k, v); });
      params.append('page', currentPage);
      params.append('limit', 18);
      params.append('sortBy', currentSort);

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

      currentPage === 1 ? setProfiles(normalized) : setProfiles(prev => [...prev, ...normalized]);
      setSearchError(false);

      const pagination = response.data?.pagination || response.data?.data?.pagination || {};
      setHasMore(pagination.page < pagination.pages);
      setTotalCount(pagination.total || normalized.length);
    } catch (err) {
      const currentPage = options.overridePage || page;
      // 404 is the backend's "no results for these filters" — that is the EMPTY
      // state, not an error. Anything else renders the distinct error card so a
      // server failure is never blamed on the member's filters.
      if (err.response?.status !== 404) {
        setSearchError(true);
      }
      if (currentPage === 1) setProfiles([]);
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
    searchProfiles({ overridePage: 1 });
    toast.success('Filters applied');
  };

  const handleRemoveFilter = (key) => {
    const updated = { ...filters, [key]: '' };
    setFilters(updated);
    setPage(1);
    searchProfiles({ overrideFilters: updated, overridePage: 1 });
  };

  const handleClearFilters = () => {
    const emptyFilters = { ageMin: '', ageMax: '', heightMin: '', heightMax: '', city: '', education: '', profession: '', diet: '', smoking: '', drinking: '', religion: '', caste: '', maritalStatus: '', motherTongue: '', incomeMin: '', incomeMax: '', manglikFilter: '' };
    setFilters(emptyFilters);
    setPage(1);
    searchProfiles({ overrideFilters: emptyFilters, overridePage: 1 });
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
    const newSort = e.target.value;
    setSortBy(newSort);
    setPage(1);
    searchProfiles({ overrideSort: newSort, overridePage: 1 });
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="min-h-screen bg-neutral-50 dark:bg-[#0f1117] pb-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Page Header ────────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-7 bg-primary-500 rounded-full" />
                <h1 className="font-display text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100">
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
                aria-label="Sort profiles by"
                className="input-field text-sm min-w-[160px]"
              >
                <option value="compatibility">Best Match %</option>
                <option value="age">By Age</option>
                <option value="location">By Location</option>
                <option value="recent">Most Recent</option>
              </select>
            </div>
          </div>

          {/* ── Search by profile ID ─────────────────────────────────────── */}
          <form onSubmit={handleIdSearch} className="mt-5 flex items-stretch gap-2 max-w-md">
            <div className="relative flex-1">
              <FiHash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={idQuery}
                onChange={(e) => setIdQuery(e.target.value)}
                placeholder="Have a profile ID? e.g. TCS-A1B2C3D4"
                className="input-field w-full pl-9 text-sm uppercase placeholder:normal-case placeholder:text-neutral-400"
                aria-label="Search by profile ID"
              />
            </div>
            <button
              type="submit"
              disabled={idLoading || !idQuery.trim()}
              className="btn-primary px-4 text-sm whitespace-nowrap disabled:opacity-50"
            >
              {idLoading ? 'Finding…' : 'Go'}
            </button>
          </form>
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
            <div className="flex items-center justify-between mb-5 py-3 px-4 bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card">
              <p className="text-sm text-neutral-600">
                {loading && profiles.length === 0 ? (
                  <span className="text-neutral-400">Loading profiles…</span>
                ) : (
                  <>
                    <span className="font-semibold text-neutral-900">{Math.max(totalCount, profiles.length)}</span>
                    {' '}{Math.max(totalCount, profiles.length) === 1 ? 'profile' : 'profiles'} found
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

            {/* ── Active filter chips (remove one without opening the panel) ── */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {Object.entries(filters).filter(([, v]) => v).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => handleRemoveFilter(key)}
                    className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-primary-50 text-primary-700 text-xs font-medium rounded-full border border-primary-100 hover:bg-primary-100 transition-colors"
                    aria-label={`Remove filter ${key}`}
                  >
                    {(FILTER_LABELS[key]?.(value)) ?? `${key}: ${value}`}
                    <FiX className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            )}

            {/* ── Loading skeleton ──────────────────────────────────────── */}
            {loading && profiles.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            )}

            {/* ── Error state — distinct from empty: server broke, filters didn't ── */}
            {!loading && searchError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                role="alert"
                className="text-center py-16 bg-white dark:bg-[#1a1f2e] rounded-3xl border border-red-100 dark:border-red-900/40 shadow-card"
              >
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <FiAlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="font-display text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                  Something went wrong
                </h3>
                <p className="text-neutral-500 text-sm mb-6 max-w-xs mx-auto">
                  We couldn't load profiles right now. Your filters are fine — please try again.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setPage(1); searchProfiles({ overridePage: 1 }); }}
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  Try Again
                </motion.button>
              </motion.div>
            )}

            {/* ── Empty state ────────────────────────────────────────────── */}
            {!loading && !searchError && profiles.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 bg-white dark:bg-[#1a1f2e] rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-card"
              >
                <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <FiUsers className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="font-display text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
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
                  <AnimatePresence>
                    {profiles.map((profile, i) => {
                      const pid = profile.userId || profile.id || profile.profileId;
                      if (!pid) return null;
                      return (
                        <ProfileCard
                          key={`profile-${pid}`}
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

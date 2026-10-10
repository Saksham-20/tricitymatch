import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { keptLikeMessage } from '../utils/matchCopy';
import {
  FiSearch, FiUsers, FiArrowRight,
  FiRefreshCw, FiHash, FiX,
} from 'react-icons/fi';

// Readable labels for active-filter chips. Built with the live `t` so a
// language switch re-labels the chips; values the panel knows are translated,
// anything else (free-text city, stored caste/profession) shows as sent.
const chipValue = (t, group, v, fallback = v) => t(`search.chipValue.${group}.${v}`, { defaultValue: fallback });
const FILTER_LABELS = {
  ageMin: (v, t) => t('search.chip.ageMin', { v }),
  ageMax: (v, t) => t('search.chip.ageMax', { v }),
  heightMin: (v, t) => t('search.chip.heightMin', { v }),
  heightMax: (v, t) => t('search.chip.heightMax', { v }),
  city: (v) => v,
  education: (v, t) => chipValue(t, 'education', v),
  profession: (v) => v,
  diet: (v, t) => t('search.chip.diet', { v: chipValue(t, 'diet', v) }),
  smoking: (v, t) => t('search.chip.smoking', { v: chipValue(t, 'habit', v) }),
  drinking: (v, t) => t('search.chip.drinking', { v: chipValue(t, 'habit', v) }),
  religion: (v, t) => t(`search.options.religion.${v}`, { defaultValue: v }),
  caste: (v) => v,
  maritalStatus: (v, t) => chipValue(t, 'maritalStatus', v, v.replace(/_/g, ' ')),
  motherTongue: (v, t) => t(`search.options.motherTongue.${v}`, { defaultValue: v }),
  incomeMin: (v, t) => t('search.chip.incomeMin', { v: (v / 100000) }),
  incomeMax: (v, t) => t('search.chip.incomeMax', { v: (v / 100000) }),
  manglikFilter: (v, t) => chipValue(t, 'manglikFilter', v, v.replace(/_/g, ' ')),
  verifiedOnly: (v, t) => t('search.chip.verifiedOnly'),
};
// The whole filter set in one place: initial state, "clear all" and "apply a
// saved search" all start from this, so none of them can leave a stale value.
const EMPTY_FILTERS = {
  ageMin: '', ageMax: '',
  heightMin: '', heightMax: '',
  city: '', education: '', profession: '',
  diet: '', smoking: '', drinking: '',
  religion: '', caste: '', maritalStatus: '', motherTongue: '', incomeMin: '', incomeMax: '', manglikFilter: '',
  verifiedOnly: '',
};

import { staggerContainer, fadeInUp } from '../utils/animations';
import { API_BASE_URL } from '../utils/api';
import { getImageUrl } from '../utils/cloudinary';
import { ProfileCard } from '../components/cards';
import { useMatchCelebration } from '../context/MatchCelebrationContext';
import { FilterPanel } from '../components/search';
import InviteLink from '../components/common/InviteLink';
import { Skeleton, EmptyState, ErrorState } from '../components/ui';
import StagedLoader, { useStagedReveal } from '../components/ui/StagedLoader';

// ─── Card skeleton for loading state ──────────────────────────────────────
// Two shapes, alternated in the grid below — ProfileCard now renders either a
// ~224px photo hero or a ~76px photoless identity header (audit Part 5 #3),
// and a loading grid of uniformly tall placeholders followed by a real grid
// that's mostly the shorter shape is a visible layout shift on load (doctrine
// §9 Craft, §6 Loading: "skeletons that match the final layout's shape").
const CardSkeleton = ({ compact = false }) => (
  <div className="bg-white rounded-xl shadow-card overflow-hidden">
    {compact ? (
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3.5">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
      </div>
    ) : (
      <Skeleton className="h-56 w-full rounded-none" />
    )}
    <div className="p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="flex-1 h-9 rounded-xl" />
        <Skeleton className="flex-1 h-9 rounded-xl" />
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
const Search = () => {
  const { t } = useTranslation();
  const [confirm, confirmDialog] = useConfirm();
  const { celebrate } = useMatchCelebration();
  const navigate = useNavigate();
  const [profiles, setProfiles]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [searchError, setSearchError] = useState(false);
  // The server refused a filter value (400) — a problem with the filters, not an outage.
  const [filterProblem, setFilterProblem] = useState(false);
  // DS6: on Search the theater only fills the REAL wait (maxHoldMs 0) —
  // results are never delayed; once per day, then plain skeletons.
  const { showTheater, skip: skipTheater } = useStagedReveal({
    key: 'search',
    loading,
    error: searchError,
    maxHoldMs: 0,
  });
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [sortBy, setSortBy]       = useState('compatibility');
  const [totalCount, setTotalCount] = useState(0);
  // Partner preferences the member marked as must-haves shape the results; they
  // can switch them off for a wider look. `mustHaveKeys` remembers which ones
  // applied so the note stays available while they are off.
  const [mustHavesOff, setMustHavesOff] = useState(false);
  const [mustHaveKeys, setMustHaveKeys] = useState([]);

  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  // What the results on screen were actually fetched with. The panel edits a
  // staged copy (`filters`) that only takes effect on Apply; the count and the
  // removable chips above the results used to read the staged copy, so they
  // announced a filter (e.g. "Verified only") the results did not have.
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS });

  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length;

  const [idQuery, setIdQuery]     = useState('');
  const [idLoading, setIdLoading] = useState(false);

  useEffect(() => { searchProfiles(); }, [page]);

  // Apply a saved search: it REPLACES the filter state (leftover filters from
  // the previous search must not leak into it) and runs from page 1 with the
  // merged object passed straight in; state set in the same tick is not visible
  // to a callback created in the previous render.
  const handleApplySavedSearch = (saved) => {
    const next = { ...EMPTY_FILTERS };
    Object.keys(EMPTY_FILTERS).forEach((key) => {
      const v = saved?.[key];
      if (v === undefined || v === null || v === '') return;
      next[key] = Array.isArray(v) ? String(v[0] || '') : String(v);
    });
    const nextSort = ['compatibility', 'age', 'location', 'recent'].includes(saved?.sortBy) ? saved.sortBy : sortBy;
    setFilters(next);
    setSortBy(nextSort);
    setPage(1);
    searchProfiles({ overrideFilters: next, overridePage: 1, overrideSort: nextSort });
  };

  const handleIdSearch = async (e) => {
    e.preventDefault();
    // Profile codes are canonically uppercase (TCS-XXXXXXXX); the field only
    // uppercases visually via CSS, so normalise before sending to by-code.
    const code = idQuery.trim().toUpperCase();
    if (!code) return;
    try {
      setIdLoading(true);
      const res = await api.get(`/search/by-code?code=${encodeURIComponent(code)}`);
      const found = res.data?.profile;
      if (found?.userId) {
        navigate(`/profile/${found.userId}`);
      } else {
        toast.error(t('search.noProfileForId'));
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('search.noProfileForId'));
    } finally {
      setIdLoading(false);
    }
  };

  const searchProfiles = async (options = {}) => {
    try {
      setLoading(true);
      const currentFilters = options.overrideFilters || filters;
      setAppliedFilters(currentFilters);
      const currentPage = options.overridePage || page;
      const currentSort = options.overrideSort || sortBy;

      const params = new URLSearchParams();
      Object.entries(currentFilters).forEach(([k, v]) => { if (v) params.append(k, v); });
      params.append('page', currentPage);
      params.append('limit', 18);
      params.append('sortBy', currentSort);
      const currentMustHavesOff = options.overrideMustHavesOff ?? mustHavesOff;
      if (currentMustHavesOff) params.append('mustHaves', 'off');

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
          const b = new Date(p.dateOfBirth), now = new Date();
          const diff = now.getFullYear() - b.getFullYear();
          age = (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) ? diff - 1 : diff;
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
      setFilterProblem(false);

      const applied = response.data?.mustHaves?.applied;
      if (Array.isArray(applied) && applied.length) setMustHaveKeys(applied);
      const pagination = response.data?.pagination || response.data?.data?.pagination || {};
      setHasMore(pagination.page < pagination.pages);
      setTotalCount(pagination.total || normalized.length);
      return true;
    } catch (err) {
      const currentPage = options.overridePage || page;
      // 404 is the backend's "no results for these filters" — that is the EMPTY
      // state, not an error. Anything else renders the distinct error card so a
      // server failure is never blamed on the member's filters.
      if (err.response?.status === 400) {
        // A filter value the server will not search on (for example an age
        // outside 18-99). Say so instead of calling it a server failure.
        setFilterProblem(true);
        setSearchError(false);
      } else if (err.response?.status !== 404) {
        setSearchError(true);
        setFilterProblem(false);
      } else {
        setFilterProblem(false);
      }
      if (currentPage === 1) setProfiles([]);
      // 404 is "nothing matched": the search itself worked.
      return err.response?.status === 404;
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (eventOrObj) => {
    const name  = eventOrObj?.target ? eventOrObj.target.name  : eventOrObj.name;
    const value = eventOrObj?.target ? eventOrObj.target.value : eventOrObj.value;
    // An on/off switch reads as instant, so it applies straight away; the
    // other fields stay staged until Apply.
    if (name === 'verifiedOnly') {
      const next = { ...filters, [name]: value };
      setFilters(next);
      setPage(1);
      searchProfiles({ overrideFilters: next, overridePage: 1 });
      return;
    }
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // "Filters applied" only once the search has gone through: a refused filter
  // or an outage shows its own card, and a success toast over it said the
  // opposite of what happened.
  const handleApplyFilters = async () => {
    setPage(1);
    if (await searchProfiles({ overridePage: 1 })) toast.success(t('search.filtersApplied'));
  };

  const handleRemoveFilter = (key) => {
    // Remove it from what is showing, keeping any other staged edits.
    const updated = { ...appliedFilters, [key]: '' };
    setFilters((prev) => ({ ...prev, [key]: '' }));
    setPage(1);
    searchProfiles({ overrideFilters: updated, overridePage: 1 });
  };

  const handleClearFilters = () => {
    const emptyFilters = { ...EMPTY_FILTERS };
    setFilters(emptyFilters);
    setPage(1);
    searchProfiles({ overrideFilters: emptyFilters, overridePage: 1 });
  };

  // `next` is the state the member asked for: true = like / save, false = take
  // it back ('undo'). Returns whether the server accepted it, so the card icon
  // can revert when it did not.
  const handleMatchAction = async (userId, action, next = true) => {
    if (!userId) return false;
    const target = profiles.find((p) => p.userId === userId);
      // Taking back a like on a mutual match ends the match and the chat for
      // both members; one stray tap on "Interest Sent" used to do that silently.
      if (!next && action === 'like' && target?.isMutual) {
        const ok = await confirm({
          title: t('matches.endMatch.title', { name: target?.firstName || t('matches.endMatch.thisMember') }),
          body: t('matches.endMatch.body'),
          confirmLabel: t('matches.endMatch.confirm'),
          cancelLabel: t('matches.endMatch.cancel'),
        });
        if (!ok) return false;
      }
    try {
      const res = await api.post(`/match/${userId}`, { action: next ? action : 'undo' });
      // Saving someone you already sent an interest to keeps the interest.
      if (res.data?.keptLike) { toast(keptLikeMessage(res.data)); return false; }
      // A new match gets the celebration instead of a toast underneath it (it
      // used to fall through to "Interest withdrawn").
      if (!next) toast.success(action === 'like' ? t('matches.interestWithdrawn') : t('matches.removedFromShortlist'));
      else if (!res.data?.newMatch) toast.success(action === 'like' ? t('matches.interestExpressed') : t('search.profileShortlisted'));
      setProfiles(prev => prev.map(p => p.userId === userId ? { ...p, matchStatus: next ? action : null } : p));
      if (res.data?.newMatch) celebrate(profiles.find(p => p.userId === userId));
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || t('search.actionFailed'));
      return false;
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
      className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pb-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Page Header ────────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-7 bg-primary-500 rounded-full" />
                <h1 className="font-display text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100">
                  {t('search.title')}
                </h1>
              </div>
              <p className="text-neutral-500 text-sm ml-3">
                {t('search.subtitle')}
                {totalCount > 0 && (
                  <span className="ml-2 px-2.5 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 text-xs font-semibold rounded-full border border-primary-100 dark:border-primary-800">
                    {t('search.profilesBadge', { n: totalCount })}
                  </span>
                )}
              </p>
            </div>

            {/* Sort control */}
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={handleSortChange}
                aria-label={t('search.sortAria')}
                className="input-field min-w-[160px]"
              >
                <option value="compatibility">{t('search.sort.compatibility')}</option>
                <option value="age">{t('search.sort.age')}</option>
                <option value="location">{t('search.sort.location')}</option>
                <option value="recent">{t('search.sort.recent')}</option>
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
                placeholder={t('search.idPlaceholder')}
                className="input-field w-full pl-9 uppercase placeholder:normal-case placeholder:text-neutral-400"
                aria-label={t('search.idAria')}
              />
            </div>
            <button
              type="submit"
              disabled={idLoading || !idQuery.trim()}
              className="btn-primary px-4 text-sm whitespace-nowrap disabled:opacity-50"
            >
              {idLoading ? t('search.finding') : t('search.go')}
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
              onApplySaved={handleApplySavedSearch}
            />
          </motion.div>

          {/* Results area */}
          <motion.div variants={fadeInUp} className="lg:col-span-3">

            {mustHaveKeys.length > 0 && (
              <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm text-neutral-700 dark:text-neutral-300">
                <p>
                  {mustHavesOff
                    ? t('search.mustHavesOff')
                    : t('search.mustHavesOn', { list: mustHaveKeys.join(', ') })}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const next = !mustHavesOff;
                    setMustHavesOff(next);
                    setPage(1);
                    searchProfiles({ overridePage: 1, overrideMustHavesOff: next });
                  }}
                  className="text-xs font-medium text-primary-600 dark:text-primary-300 hover:underline whitespace-nowrap min-h-[2.75rem]"
                >
                  {mustHavesOff ? t('search.applyMustHaves') : t('search.showEveryone')}
                </button>
              </div>
            )}

            {/* Results meta bar */}
            <div className="flex items-center justify-between mb-5 py-3 px-4 bg-white dark:bg-surface-dark-3 rounded-2xl shadow-card">
              <p className="text-sm text-neutral-600">
                {loading && profiles.length === 0 ? (
                  <span className="text-neutral-400">{t('search.loadingProfiles')}</span>
                ) : (
                  <>
                    <span className="font-semibold text-neutral-900">{Math.max(totalCount, profiles.length)}</span>
                    {' '}{t('search.foundSuffix', { count: Math.max(totalCount, profiles.length) })}
                    {activeFilterCount > 0 && (
                      <span className="ml-2 text-primary-500 dark:text-primary-300 font-medium">
                        {t('search.filtersActive', { count: activeFilterCount })}
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
                  {t('search.clearAll')}
                </button>
              )}
            </div>

            {/* ── Active filter chips (remove one without opening the panel) ── */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {Object.entries(appliedFilters).filter(([, v]) => v).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => handleRemoveFilter(key)}
                    className="inline-flex items-center gap-1.5 min-h-[44px] pl-3 pr-2 py-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium rounded-full border border-primary-100 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                    aria-label={t('search.chip.remove', { label: FILTER_LABELS[key]?.(value, t) ?? key })}
                  >
                    {(FILTER_LABELS[key]?.(value, t)) ?? `${key}: ${value}`}
                    <FiX className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            )}

            {/* ── Loading: staged theater once/day, else skeleton ───────── */}
            {loading && profiles.length === 0 && (
              showTheater ? (
                <StagedLoader onSkip={skipTheater} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} compact={i % 2 === 1} />)}
                </div>
              )
            )}

            {/* ── Error state — distinct from empty: server broke, filters didn't ── */}
            {/* ── Filter problem: the server refused a value, the filters need fixing ── */}
            {!loading && filterProblem && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                role="alert"
                className="bg-white dark:bg-surface-dark-3 rounded-3xl shadow-card"
              >
                <ErrorState
                  title={t('search.filterProblemTitle')}
                  description={t('search.filterProblemBody')}
                  onRetry={handleClearFilters}
                  retryLabel={t('search.clearFilters')}
                  className="py-16"
                />
              </motion.div>
            )}

            {!loading && searchError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                role="alert"
                className="bg-white dark:bg-surface-dark-3 rounded-3xl shadow-card"
              >
                <ErrorState
                  title={t('search.errorTitle')}
                  description={t('search.errorBody')}
                  onRetry={() => { setPage(1); searchProfiles({ overridePage: 1 }); }}
                  retryLabel={t('search.tryAgain')}
                  className="py-16"
                />
              </motion.div>
            )}

            {/* ── Empty state ────────────────────────────────────────────── */}
            {/* Supply-aware (Phase S, E3). Two genuinely different dead ends:
                filters that excluded everyone, and a community still being
                built. Saying "new members join every day" in either case was
                a fabricated activity claim — the honest landing page can't be
                followed by a dishonest interior. */}
            {!loading && !searchError && !filterProblem && profiles.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-surface-dark-3 rounded-3xl shadow-card"
              >
                <EmptyState
                  icon={FiUsers}
                  title={activeFilterCount > 0 ? t('search.emptyFilteredTitle') : t('search.emptySmallTitle')}
                  description={activeFilterCount > 0
                    ? t('search.emptyFilteredBody')
                    : t('search.emptySmallBody')}
                  actionLabel={activeFilterCount > 0 ? t('search.clearFilters') : undefined}
                  onAction={activeFilterCount > 0 ? handleClearFilters : undefined}
                  className="py-16"
                />
                <div className="flex flex-col sm:flex-row gap-3 justify-center -mt-4 pb-6">
                  <InviteLink variant="inline" />
                  <button
                    onClick={() => { setPage(1); searchProfiles(); }}
                    className="btn-secondary dark:text-primary-300 inline-flex items-center gap-2 text-sm"
                  >
                    <FiRefreshCw className="w-4 h-4" />
                    {t('search.refresh')}
                  </button>
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
                          onLike={(next) => handleMatchAction(profile.userId, 'like', next)}
                          onShortlist={(next) => handleMatchAction(profile.userId, 'shortlist', next)}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Loading more */}
                {loading && profiles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mt-5">
                    {[0, 1, 2].map(i => <CardSkeleton key={i} compact={i % 2 === 1} />)}
                  </div>
                )}

                {/* Load more button */}
                {hasMore && !loading && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center mt-10"
                  >
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setPage(p => p + 1)}
                      className="btn-secondary dark:text-primary-300 inline-flex items-center gap-2"
                    >
                      {t('search.loadMore')}
                      <FiArrowRight className="w-4 h-4" />
                    </motion.button>
                  </motion.div>
                )}

                {/* All loaded */}
                {!hasMore && profiles.length > 6 && (
                  <p className="text-center text-neutral-400 text-sm mt-10 py-4 border-t border-neutral-100">
                    {t('search.seenAll', { n: profiles.length })}
                  </p>
                )}
              </>
            )}
          </motion.div>
        </div>
      </div>
      {confirmDialog}
    </motion.div>
  );
};

export default Search;

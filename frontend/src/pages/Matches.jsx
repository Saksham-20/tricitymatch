import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBookmark, FiHeart, FiUsers, FiAlertCircle, FiLock, FiSearch } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { ProfileCard } from '../components/cards';
import SectionHeader from '../components/common/SectionHeader';

// Each tab maps to a match endpoint + the response key it returns.
const TABS = [
  {
    id: 'shortlist',
    label: 'Saved',
    icon: FiBookmark,
    endpoint: '/match/shortlist',
    respKey: 'shortlisted',
    empty: { title: 'Nothing saved yet', line: 'Tap the bookmark on a profile to save it here for later.' },
  },
  {
    id: 'mutual',
    label: 'Mutual',
    icon: FiUsers,
    endpoint: '/match/mutual',
    respKey: 'mutualMatches',
    empty: { title: 'No mutual matches yet', line: 'When you and someone both express interest, they show up here.' },
  },
  {
    id: 'likes',
    label: 'Likes You',
    icon: FiHeart,
    endpoint: '/match/likes',
    respKey: 'likes',
    premium: true,
    empty: { title: 'No interests received yet', line: 'Members who like you will appear here.' },
  },
];

const CardSkeleton = () => (
  <div className="bg-white dark:bg-[#1a1f2e] rounded-3xl overflow-hidden shadow-card animate-pulse">
    <div className="h-56 bg-neutral-100 dark:bg-neutral-800" />
    <div className="p-5 space-y-3">
      <div className="h-5 w-2/3 bg-neutral-100 dark:bg-neutral-800 rounded" />
      <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full" />
      <div className="flex gap-2">
        <div className="h-6 w-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
        <div className="h-6 w-20 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
      </div>
    </div>
  </div>
);

export default function Matches() {
  const [active, setActive] = useState('shortlist');
  const [state, setState] = useState('loading'); // loading | ready | empty | error | premium
  const [profiles, setProfiles] = useState([]);

  const tab = TABS.find((t) => t.id === active);

  const load = useCallback(async (tabId) => {
    const cfg = TABS.find((t) => t.id === tabId);
    setState('loading');
    setProfiles([]);
    try {
      const res = await api.get(cfg.endpoint);
      const list = res.data?.[cfg.respKey] || [];
      setProfiles(list);
      setState(list.length ? 'ready' : 'empty');
    } catch (err) {
      const code = err.response?.status;
      const apiCode = err.response?.data?.error?.code;
      if (cfg.premium && (code === 403 || apiCode === 'PREMIUM_REQUIRED')) {
        setState('premium');
      } else {
        setState('error');
      }
    }
  }, []);

  useEffect(() => { load(active); }, [active, load]);

  // Match actions on the cards — optimistic, then reconcile.
  const handleAction = async (userId, action) => {
    try {
      await api.post(`/match/${userId}`, { action });
      if (action === 'like') toast.success('Interest expressed!');
      // On the Saved tab, un-shortlisting should drop the card.
      if (active === 'shortlist' && action === 'shortlist') {
        setProfiles((prev) => {
          const next = prev.filter((p) => (p.userId || p.id) !== userId);
          if (!next.length) setState('empty');
          return next;
        });
      }
    } catch {
      toast.error('Could not perform that action');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1117] pb-24 md:pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SectionHeader
          title="My Matches"
          subtitle="Everyone you’ve saved, matched with, or who’s shown interest."
        />

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-1.5 mb-6 mt-5 w-full sm:w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.premium && <FaCrown className="w-3 h-3 text-gold-400" />}
              </button>
            );
          })}
        </div>

        {/* ── Loading ─────────────────────────────────────────────── */}
        {state === 'loading' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────── */}
        {state === 'error' && (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-destructive-light flex items-center justify-center mb-4">
              <FiAlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100 mb-1">Couldn’t load this list</h3>
            <p className="text-sm text-neutral-500 mb-5">Something went wrong. Give it another try.</p>
            <button
              onClick={() => load(active)}
              className="px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Premium gate (Likes You) ────────────────────────────── */}
        {state === 'premium' && (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-gold-50 border border-gold-200 flex items-center justify-center mb-4">
              <FiLock className="w-7 h-7 text-gold-500" />
            </div>
            <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100 mb-1">See who likes you</h3>
            <p className="text-sm text-neutral-500 max-w-sm mb-5">
              Upgrade to Premium to reveal every member who’s already expressed interest in your profile.
            </p>
            <Link
              to="/subscription"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-neutral-900 rounded-xl text-sm font-bold hover:bg-gold-400 shadow-gold"
            >
              <FaCrown className="w-4 h-4" /> Upgrade to Premium
            </Link>
          </div>
        )}

        {/* ── Empty ───────────────────────────────────────────────── */}
        {state === 'empty' && (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
              {tab?.icon ? React.createElement(tab.icon, { className: 'w-7 h-7 text-primary-300' }) : null}
            </div>
            <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100 mb-1">{tab?.empty.title}</h3>
            <p className="text-sm text-neutral-500 max-w-sm mb-5">{tab?.empty.line}</p>
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600"
            >
              <FiSearch className="w-4 h-4" /> Discover profiles
            </Link>
          </div>
        )}

        {/* ── List ────────────────────────────────────────────────── */}
        {state === 'ready' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            <AnimatePresence>
              {profiles.map((profile, i) => {
                const pid = profile.userId || profile.id;
                if (!pid) return null;
                return (
                  <ProfileCard
                    key={`match-${pid}`}
                    profile={profile}
                    userId={pid}
                    index={i}
                    onLike={() => handleAction(pid, 'like')}
                    onShortlist={() => handleAction(pid, 'shortlist')}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

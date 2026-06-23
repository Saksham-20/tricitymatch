import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  FiHeart, FiStar, FiInstagram, FiLinkedin, FiFacebook, FiTwitter,
  FiMusic, FiLock, FiCheck, FiMapPin, FiCalendar, FiBook, FiBriefcase,
  FiGlobe, FiChevronLeft, FiMessageCircle, FiShield, FiPhone, FiMail,
  FiUnlock, FiUser, FiGrid, FiSun, FiHome, FiHeart as FiHeartOutline,
  FiInfo, FiDollarSign, FiDownload, FiVideo,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { agora as agoraConfig } from '../config';
import { API_BASE_URL } from '../utils/api';
import { getImageUrl } from '../utils/cloudinary';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize';
import { ImageLightbox } from '../components/ui/ImageLightbox';
import FloatingActionBar from '../components/profile/FloatingActionBar';
import UpgradeModal from '../components/common/UpgradeModal';

// ─── Compatibility Ring ──────────────────────────────────────────────────────
const CompatRing = ({ score }) => {
  const size = 88;
  const sw = 5;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 90 ? '#2E7D32' : score >= 75 ? '#C9A227' : '#8B2346';
  const bg = score >= 90 ? '#E8F5E9' : score >= 75 ? '#FEFCF3' : '#FDF2F5';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8E8E8" strokeWidth={sw} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: bg, borderRadius: '50%', margin: 4 }}>
          <span className="text-lg font-bold leading-none" style={{ color }}>{score}%</span>
          <span className="text-[9px] text-neutral-400 mt-0.5 font-medium uppercase tracking-wide">match</span>
        </div>
      </div>
      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Compatibility</p>
    </div>
  );
};

// ─── Info Pill ───────────────────────────────────────────────────────────────
const Pill = ({ icon: Icon, label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-xl border border-neutral-100">
      {Icon && <Icon className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />}
      <div className="min-w-0">
        <p className="text-[10px] text-neutral-400 uppercase tracking-wide font-semibold leading-none mb-0.5">{label}</p>
        <p className="text-xs font-semibold text-neutral-700 capitalize truncate">{value}</p>
      </div>
    </div>
  );
};

// ─── Section Card ────────────────────────────────────────────────────────────
const Card = ({ title, icon: Icon, children, className = '' }) => (
  <div className={`bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card overflow-hidden ${className}`}>
    {title && (
      <div className="px-5 pt-4 pb-3 border-b border-neutral-50 dark:border-neutral-800 flex items-center gap-2.5">
        {Icon && <div className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary-500" />
        </div>}
        <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">{title}</h2>
      </div>
    )}
    <div className="px-5 py-4">{children}</div>
  </div>
);

// ─── Detail Row ──────────────────────────────────────────────────────────────
const DetailRow = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-neutral-50 last:border-b-0">
      <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-neutral-700 capitalize text-right max-w-[55%]">{String(value).replace(/_/g, ' ')}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const ProfileDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { startCall } = useCall();
  const [profile, setProfile] = useState(null);
  const [compatScore, setCompatScore] = useState(null);
  const [numerology, setNumerology] = useState(null);
  const [premiumAccess, setPremiumAccess] = useState(false);
  const [isContactUnlocked, setIsContactUnlocked] = useState(false);
  const [contactUnlocksRemaining, setContactUnlocksRemaining] = useState(0);
  const [unlockedContact, setUnlockedContact] = useState(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [kundliLoading, setKundliLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');
  const [lightbox, setLightbox] = useState({ open: false, src: null, alt: '' });
  const [activeTab, setActiveTab] = useState('about');

  useEffect(() => { loadProfile(); }, [userId]);

  const loadProfile = async () => {
    try {
      const res = await api.get(`/profile/${userId}`);
      setProfile(res.data.profile);
      setCompatScore(res.data.compatibilityScore);
      setPremiumAccess(res.data.hasPremiumAccess);
      setIsContactUnlocked(res.data.isContactUnlocked || false);
      setContactUnlocksRemaining(res.data.contactUnlocksRemaining || 0);
      setIsLiked(res.data.isLiked || false);
      setIsShortlisted(res.data.isShortlisted || false);
      if (res.data.isContactUnlocked && res.data.profile?.User) {
        setUnlockedContact({
          phone: res.data.profile.User.phone,
          email: res.data.profile.User.email,
        });
      }
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }

    // Numerology (life-path) compatibility — best-effort, non-blocking
    try {
      const horo = await api.get(`/profile/${userId}/horoscope-match`);
      if (horo.data?.numerology) setNumerology(horo.data.numerology);
    } catch {
      /* astro add-on is optional; ignore */
    }
  };

  const handleMessage = () => {
    if (!premiumAccess) {
      setUpgradeFeature('Messaging');
      setShowUpgradeModal(true);
      return;
    }
    navigate('/chat');
  };

  const handleCall = (type) => {
    if (!premiumAccess) {
      setUpgradeFeature(type === 'video' ? 'Video Calls' : 'Voice Calls');
      setShowUpgradeModal(true);
      return;
    }
    if (!agoraConfig.isConfigured) {
      toast.error('Calling is not available right now.');
      return;
    }
    startCall(
      { id: userId, name: profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : 'Member', photo: profile?.profilePhoto || null },
      type
    );
  };

  const handleUnlockContact = async () => {
    if (!premiumAccess) {
      setUpgradeFeature('View Contact Details');
      setShowUpgradeModal(true);
      return;
    }
    try {
      setUnlockLoading(true);
      const res = await api.post(`/profile/${userId}/unlock-contact`);
      setUnlockedContact(res.data.contact);
      setIsContactUnlocked(true);
      if (res.data.contactUnlocksRemaining !== undefined) {
        setContactUnlocksRemaining(res.data.contactUnlocksRemaining);
      }
      toast.success(res.data.alreadyUnlocked ? 'Contact already unlocked' : 'Contact unlocked!');
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'CONTACT_UNLOCK_LIMIT_REACHED') {
        toast.error('No unlocks remaining. Upgrade your plan!');
        setUpgradeFeature('More Contact Unlocks');
        setShowUpgradeModal(true);
      } else if (code === 'PREMIUM_REQUIRED') {
        setUpgradeFeature('View Contact Details');
        setShowUpgradeModal(true);
      } else {
        toast.error('Failed to unlock contact');
      }
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleDownloadKundli = async () => {
    if (!premiumAccess) {
      setUpgradeFeature('Kundli Report');
      setShowUpgradeModal(true);
      return;
    }
    try {
      setKundliLoading(true);
      const res = await api.get(`/profile/${userId}/horoscope-match/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `kundli-match-${profile?.firstName || 'report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'PREMIUM_REQUIRED') {
        setUpgradeFeature('Kundli Report');
        setShowUpgradeModal(true);
      } else {
        toast.error('Failed to generate Kundli report');
      }
    } finally {
      setKundliLoading(false);
    }
  };

  const handleAction = async (action) => {
    try {
      await api.post(`/match/${userId}`, { action });
      if (action === 'like') {
        setIsLiked(true);
        toast.success('Interest expressed!');
      } else if (action === 'shortlist') {
        setIsShortlisted(!isShortlisted);
        toast.success(isShortlisted ? 'Removed from shortlist' : 'Saved to shortlist!');
      }
    } catch {
      toast.error('Failed to perform action');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin" />
          <p className="text-sm text-neutral-400 font-medium">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <FiUser className="w-8 h-8 text-primary-300" />
          </div>
          <h2 className="text-xl font-bold text-neutral-800 mb-2">Profile not found</h2>
          <Link to="/search" className="text-primary-500 hover:text-primary-700 font-semibold text-sm transition-colors">
            ← Back to search
          </Link>
        </div>
      </div>
    );
  }

  const firstName = profile.firstName || 'Profile';
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const age = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const isVerified = profile.User?.Verification?.status === 'approved';
  const allPhotos = profile.profilePhoto
    ? [profile.profilePhoto, ...(profile.photos || []).filter(p => p !== profile.profilePhoto)]
    : (profile.photos || []);

  const formatHeight = (cm) => {
    if (!cm) return null;
    const totalIn = Math.round(cm / 2.54);
    const ft = Math.floor(totalIn / 12);
    const inches = totalIn % 12;
    return `${ft}'${inches}" (${cm} cm)`;
  };

  const formatIncome = (inc) => {
    if (!inc) return null;
    if (inc >= 100000) return `₹${(inc / 100000).toFixed(1)}L/yr`;
    return `₹${(inc / 1000).toFixed(0)}K/yr`;
  };

  const socialPlatforms = [
    { key: 'instagram', label: 'Instagram', icon: FiInstagram, color: '#E1306C' },
    { key: 'linkedin', label: 'LinkedIn', icon: FiLinkedin, color: '#0077B5' },
    { key: 'facebook', label: 'Facebook', icon: FiFacebook, color: '#1877F2' },
    { key: 'twitter', label: 'Twitter', icon: FiTwitter, color: '#1DA1F2' },
  ];

  const tabs = [
    { id: 'about', label: 'About' },
    { id: 'lifestyle', label: 'Lifestyle' },
    { id: 'family', label: 'Family' },
    { id: 'preferences', label: 'Looking For' },
  ];

  const profilePrompts = profile.profilePrompts
    ? Object.entries(profile.profilePrompts)
        .filter(([k]) => k.startsWith('prompt'))
        .map(([k, q]) => ({ q, a: profile.profilePrompts[k.replace('prompt', 'answer')] }))
        .filter(({ a }) => a)
    : [];

  return (
    <>
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1117] pb-28 md:pb-12">

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#1a1f2e]/95 backdrop-blur-sm border-b border-neutral-100 dark:border-neutral-800 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-primary-500 transition-colors cursor-pointer"
            >
              <FiChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => handleAction('shortlist')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${isShortlisted ? 'bg-gold-50 text-gold-700 border border-gold-200' : 'border border-neutral-200 text-neutral-600 hover:border-gold-300 hover:text-gold-700'}`}
              >
                <FiStar className="w-3.5 h-3.5" />
                {isShortlisted ? 'Saved' : 'Save'}
              </button>
              <button
                onClick={() => handleAction('like')}
                disabled={isLiked}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${isLiked ? 'bg-success-50 text-success border border-success-100' : 'bg-primary-500 text-white hover:bg-primary-600 shadow-sm hover:-translate-y-0.5'}`}
              >
                {isLiked ? <><FiCheck className="w-3.5 h-3.5" /> Interested</> : <><FiHeart className="w-3.5 h-3.5" /> Express Interest</>}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* ── Hero section ─────────────────────────────────────────── */}
          <div className="bg-white dark:bg-[#1a1f2e] rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-card overflow-hidden mb-5">

            {/* Photo grid */}
            {allPhotos.length > 0 ? (
              <div className={`grid gap-0.5 ${allPhotos.length === 1 ? 'grid-cols-1' : allPhotos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
                style={{ height: allPhotos.length >= 3 ? '340px' : '280px' }}>
                {allPhotos.slice(0, allPhotos.length >= 3 ? 5 : allPhotos.length).map((photo, i) => {
                  const url = getImageUrl(photo, API_BASE_URL, 'full');
                  const isFirst = i === 0;
                  const isOverlay = i === 4 && allPhotos.length > 5;
                  return (
                    <button
                      key={photo}
                      type="button"
                      onClick={() => setLightbox({ open: true, src: url, alt: `${firstName} ${i + 1}` })}
                      className={`relative overflow-hidden bg-primary-100 dark:bg-primary-900/40 hover:brightness-95 transition-all focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-inset cursor-pointer ${isFirst && allPhotos.length >= 3 ? 'row-span-2 col-span-1' : ''}`}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-7xl font-display font-semibold text-primary-700/40 dark:text-primary-300/40 select-none">{firstName[0]}</span>
                      <img src={url} alt={`${firstName} ${i + 1}`} className="relative w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      {isOverlay && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white text-xl font-bold">+{allPhotos.length - 5}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                <span className="text-8xl font-display font-semibold text-primary-700/40 dark:text-primary-300/40 select-none">{firstName[0]}</span>
              </div>
            )}

            {/* Identity row */}
            <div className="p-5 md:p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                      {firstName}
                      {profile.lastName ? ` ${profile.lastName[0]}.` : ''}
                      {age && <span className="font-normal text-neutral-400">, {age}</span>}
                    </h1>
                    {isVerified && (
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-success-50 border border-success-100 rounded-full">
                        <FiShield className="w-3 h-3 text-success" />
                        <span className="text-[11px] font-bold text-success">Verified</span>
                      </div>
                    )}
                    {profile.isPremium && (
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-gold-50 border border-gold-200 rounded-full">
                        <FaCrown className="w-3 h-3 text-gold-500" />
                        <span className="text-[11px] font-bold text-gold-700">Premium</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500 mb-4">
                    {(profile.city || profile.state) && (
                      <span className="flex items-center gap-1.5 font-medium">
                        <FiMapPin className="w-3.5 h-3.5 text-primary-400" />
                        {[profile.city, profile.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {profile.profession && (
                      <span className="flex items-center gap-1.5">
                        <FiBriefcase className="w-3.5 h-3.5 text-primary-400" />
                        {profile.profession}
                      </span>
                    )}
                    {profile.education && (
                      <span className="flex items-center gap-1.5">
                        <FiBook className="w-3.5 h-3.5 text-primary-400" />
                        {profile.education}
                      </span>
                    )}
                    {profile.income && (
                      <span className="flex items-center gap-1.5">
                        <FiDollarSign className="w-3.5 h-3.5 text-primary-400" />
                        {formatIncome(profile.income)}
                      </span>
                    )}
                  </div>

                  {/* Quick pills */}
                  <div className="flex flex-wrap gap-2">
                    {profile.height && <Pill icon={FiUser} label="Height" value={formatHeight(profile.height)} />}
                    {profile.religion && <Pill icon={FiSun} label="Religion" value={profile.religion} />}
                    {profile.maritalStatus && <Pill icon={FiHeartOutline} label="Status" value={profile.maritalStatus.replace(/_/g, ' ')} />}
                    {profile.motherTongue && <Pill label="Mother Tongue" value={profile.motherTongue} />}
                    {profile.diet && <Pill label="Diet" value={profile.diet} />}
                    {profile.personalityType && <Pill label="Personality" value={profile.personalityType} />}
                  </div>
                </div>

                {/* Compat ring desktop */}
                {compatScore && (
                  <div className="hidden md:flex flex-col items-center gap-3 flex-shrink-0">
                    <CompatRing score={compatScore} />
                    <div className="flex flex-col gap-2 w-full">
                      <button
                        onClick={() => handleAction('like')}
                        disabled={isLiked}
                        className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${isLiked ? 'bg-success-50 text-success border border-success-100' : 'bg-primary-500 text-white hover:bg-primary-600 shadow-sm hover:-translate-y-0.5'}`}
                      >
                        {isLiked ? <><FiCheck className="w-4 h-4" /> Interested</> : <><FiHeart className="w-4 h-4" /> Express Interest</>}
                      </button>
                      <button
                        onClick={handleMessage}
                        className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer ${premiumAccess ? 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50' : 'border border-gold-200 bg-gold-50 text-gold-700 hover:bg-gold-100'}`}
                      >
                        {premiumAccess ? <FiMessageCircle className="w-4 h-4" /> : <FiLock className="w-4 h-4" />} {premiumAccess ? 'Message' : 'Message (Premium)'}
                      </button>
                    </div>
                    {agoraConfig.isConfigured && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          onClick={() => handleCall('voice')}
                          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-all cursor-pointer"
                        >
                          {premiumAccess ? <FiPhone className="w-4 h-4" /> : <FiLock className="w-4 h-4" />} Voice Call
                        </button>
                        <button
                          onClick={() => handleCall('video')}
                          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-all cursor-pointer"
                        >
                          {premiumAccess ? <FiVideo className="w-4 h-4" /> : <FiLock className="w-4 h-4" />} Video Call
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="mt-4 text-neutral-600 leading-relaxed text-sm border-t border-neutral-50 pt-4">
                  {sanitizeText(profile.bio)}
                </p>
              )}

              {/* Video intro */}
              {profile.videoIntroUrl && (
                <div className="mt-4 border-t border-neutral-50 pt-4">
                  <p className="text-[11px] font-bold text-primary-400 uppercase tracking-wide mb-2">Video intro</p>
                  <video
                    src={getImageUrl(profile.videoIntroUrl, API_BASE_URL, 'full')}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-80 rounded-xl bg-black"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Two-column layout ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Left: Content tabs ─────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Tab nav */}
              <div className="flex gap-1 bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-1.5">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === tab.id ? 'bg-primary-500 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >

                  {/* ── About tab ──────────────────────────────────── */}
                  {activeTab === 'about' && (
                    <>
                      {/* Profile prompts */}
                      {profilePrompts.length > 0 && (
                        <Card title="Get to Know Me" icon={FiUser}>
                          <div className="space-y-3">
                            {profilePrompts.map(({ q, a }, i) => (
                              <div key={i} className="p-4 bg-primary-50/60 rounded-xl border border-primary-100">
                                <p className="text-[11px] font-bold text-primary-400 uppercase tracking-wide mb-1.5">{sanitizeText(q)}</p>
                                <p className="text-sm text-neutral-700 leading-relaxed">{sanitizeText(a)}</p>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {/* Interests */}
                      {profile.interestTags?.length > 0 && (
                        <Card title="Interests & Hobbies" icon={FiGrid}>
                          <div className="flex flex-wrap gap-2">
                            {profile.interestTags.map((tag, i) => (
                              <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-xs font-semibold cursor-default">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </Card>
                      )}

                      {/* Spotify */}
                      {profile.spotifyPlaylist && sanitizeUrl(profile.spotifyPlaylist) && (
                        <Card title="Music Taste" icon={FiMusic}>
                          <a
                            href={sanitizeUrl(profile.spotifyPlaylist)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-100 hover:border-[#1DB954]/40 hover:bg-[#1DB954]/5 transition-all group cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-xl bg-[#1DB954]/15 flex items-center justify-center flex-shrink-0">
                              <FiMusic className="w-4.5 h-4.5 text-[#1DB954]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-neutral-700 group-hover:text-[#1DB954] transition-colors truncate">
                                {sanitizeText(firstName)}'s Spotify Playlist
                              </p>
                              <p className="text-xs text-neutral-400">Open in Spotify</p>
                            </div>
                            <FiGlobe className="w-4 h-4 text-neutral-300 flex-shrink-0" />
                          </a>
                        </Card>
                      )}

                      {/* Languages */}
                      {profile.languages?.length > 0 && (
                        <Card title="Languages" icon={FiGlobe}>
                          <div className="flex flex-wrap gap-2">
                            {profile.languages.map((l, i) => (
                              <span key={i} className="px-3 py-1.5 bg-neutral-100 rounded-xl text-xs font-semibold text-neutral-700">{l}</span>
                            ))}
                          </div>
                        </Card>
                      )}

                      {/* Horoscope */}
                      {(profile.manglikStatus || profile.zodiacSign || profile.rashi || profile.nakshatra || profile.placeOfBirth || profile.birthTime) && (
                        <Card title="Horoscope & Kundli" icon={FiSun}>
                          <div className="grid grid-cols-2 gap-3">
                            {profile.zodiacSign && <Pill label="Zodiac Sign" value={profile.zodiacSign} />}
                            {profile.rashi && <Pill label="Rashi" value={profile.rashi} />}
                            {profile.nakshatra && <Pill label="Nakshatra" value={profile.nakshatra} />}
                            {profile.manglikStatus && <Pill label="Manglik" value={profile.manglikStatus.replace(/_/g, ' ')} />}
                            {profile.placeOfBirth && <Pill label="Place of Birth" value={profile.placeOfBirth} />}
                            {profile.birthTime && <Pill label="Birth Time" value={profile.birthTime} />}
                          </div>
                          <button
                            type="button"
                            onClick={handleDownloadKundli}
                            disabled={kundliLoading}
                            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-50 hover:bg-primary-100 border border-primary-100 text-primary-700 text-sm font-semibold transition disabled:opacity-60"
                          >
                            {kundliLoading ? (
                              <span className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                            ) : (
                              <FiDownload className="w-4 h-4" />
                            )}
                            {kundliLoading ? 'Generating…' : 'Download Kundli Match Report (PDF)'}
                          </button>
                        </Card>
                      )}

                      {/* Numerology (life-path) */}
                      {numerology?.compatibility && (
                        <Card title="Numerology" icon={FiSun}>
                          <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="text-center flex-1">
                              <div className="w-11 h-11 mx-auto rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center text-lg font-black text-primary-600">
                                {numerology.person1?.number}
                              </div>
                              <p className="text-[11px] text-neutral-500 mt-1">You · {numerology.person1?.title}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-black text-primary-500">{numerology.compatibility.score}%</p>
                              <p className="text-[11px] font-semibold text-neutral-600">{numerology.compatibility.label}</p>
                            </div>
                            <div className="text-center flex-1">
                              <div className="w-11 h-11 mx-auto rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center text-lg font-black text-primary-600">
                                {numerology.person2?.number}
                              </div>
                              <p className="text-[11px] text-neutral-500 mt-1">{profile.firstName} · {numerology.person2?.title}</p>
                            </div>
                          </div>
                          <p className="text-xs text-neutral-500 leading-relaxed border-t border-neutral-50 pt-3">
                            {numerology.compatibility.note}
                          </p>
                        </Card>
                      )}
                    </>
                  )}

                  {/* ── Lifestyle tab ──────────────────────────────── */}
                  {activeTab === 'lifestyle' && (
                    <Card title="Lifestyle" icon={FiInfo}>
                      <div className="grid grid-cols-2 gap-3">
                        {profile.diet && <Pill label="Diet" value={profile.diet} />}
                        {profile.smoking && <Pill label="Smoking" value={profile.smoking} />}
                        {profile.drinking && <Pill label="Drinking" value={profile.drinking} />}
                        {profile.skinTone && <Pill label="Skin Tone" value={profile.skinTone} />}
                        {profile.personalityType && <Pill label="Personality" value={profile.personalityType} />}
                        {profile.height && <Pill label="Height" value={formatHeight(profile.height)} />}
                        {profile.weight && <Pill label="Weight" value={`${profile.weight} kg`} />}
                      </div>
                      {profile.lifestylePreferences && Object.keys(profile.lifestylePreferences).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-neutral-50">
                          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-3">Lifestyle Preferences</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(profile.lifestylePreferences).map(([k, v]) => {
                              if (!v && v !== 0) return null;
                              if (typeof v === 'boolean') return v ? (
                                <span key={k} className="px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-xs font-semibold capitalize">
                                  {k.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                              ) : null;
                              if (Array.isArray(v) && v.length > 0) return v.map(item => (
                                <span key={`${k}-${item}`} className="px-3 py-1.5 bg-neutral-100 rounded-full text-xs font-semibold text-neutral-700 capitalize">{item}</span>
                              ));
                              return (
                                <span key={k} className="px-3 py-1.5 bg-neutral-100 rounded-full text-xs font-semibold text-neutral-700 capitalize">
                                  {k.replace(/([A-Z])/g, ' $1').trim()}: {v}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* ── Family tab ─────────────────────────────────── */}
                  {activeTab === 'family' && (
                    <Card title="Family Background" icon={FiHome}>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {profile.familyType && <Pill label="Family Type" value={profile.familyType.replace(/_/g, ' ')} />}
                        {profile.familyStatus && <Pill label="Family Status" value={profile.familyStatus.replace(/_/g, ' ')} />}
                        {profile.numberOfSiblings > 0 && <Pill label="Siblings" value={profile.numberOfSiblings} />}
                        {profile.numberOfChildren > 0 && <Pill label="Children" value={profile.numberOfChildren} />}
                      </div>
                      <div className="space-y-0 border border-neutral-100 rounded-xl overflow-hidden">
                        {profile.fatherOccupation && <DetailRow label="Father's Occupation" value={profile.fatherOccupation} />}
                        {profile.motherOccupation && <DetailRow label="Mother's Occupation" value={profile.motherOccupation} />}
                        {profile.caste && <DetailRow label="Caste" value={profile.caste} />}
                        {profile.subCaste && <DetailRow label="Sub Caste" value={profile.subCaste} />}
                        {profile.gotra && <DetailRow label="Gotra" value={profile.gotra} />}
                      </div>
                      {profile.familyPreferences && Object.keys(profile.familyPreferences).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-neutral-50">
                          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-3">Family Preferences</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(profile.familyPreferences).map(([k, v]) => {
                              if (!v && v !== 0) return null;
                              const label = k.replace(/([A-Z])/g, ' $1').trim();
                              if (typeof v === 'boolean') return v ? <span key={k} className="px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-xs font-semibold capitalize">{label}</span> : null;
                              return <span key={k} className="px-3 py-1.5 bg-neutral-100 rounded-full text-xs font-semibold text-neutral-700 capitalize">{label}: {v}</span>;
                            })}
                          </div>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* ── Looking For tab ────────────────────────────── */}
                  {activeTab === 'preferences' && (
                    <Card title="Looking For" icon={FiHeartOutline}>
                      <div className="space-y-3">
                        {(profile.preferredAgeMin || profile.preferredAgeMax) && (
                          <div className="flex items-center justify-between py-2.5 border-b border-neutral-50">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Age Range</span>
                            <span className="text-sm font-bold text-neutral-700">
                              {profile.preferredAgeMin || '—'} – {profile.preferredAgeMax || '—'} years
                            </span>
                          </div>
                        )}
                        {(profile.preferredHeightMin || profile.preferredHeightMax) && (
                          <div className="flex items-center justify-between py-2.5 border-b border-neutral-50">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Height Range</span>
                            <span className="text-sm font-bold text-neutral-700">
                              {profile.preferredHeightMin ? `${profile.preferredHeightMin} cm` : '—'} – {profile.preferredHeightMax ? `${profile.preferredHeightMax} cm` : '—'}
                            </span>
                          </div>
                        )}
                        {profile.preferredEducation && (
                          <div className="flex items-center justify-between py-2.5 border-b border-neutral-50">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Education</span>
                            <span className="text-sm font-bold text-neutral-700">{profile.preferredEducation}</span>
                          </div>
                        )}
                        {profile.preferredProfession && (
                          <div className="flex items-center justify-between py-2.5 border-b border-neutral-50">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Profession</span>
                            <span className="text-sm font-bold text-neutral-700">{profile.preferredProfession}</span>
                          </div>
                        )}
                        {profile.preferredCity?.length > 0 && (
                          <div className="py-2.5">
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Preferred Cities</p>
                            <div className="flex flex-wrap gap-1.5">
                              {profile.preferredCity.map((c, i) => (
                                <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-xs font-semibold">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {profile.personalityValues && Object.keys(profile.personalityValues).length > 0 && (
                          <div className="pt-3 border-t border-neutral-50">
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-3">Values</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(profile.personalityValues).map(([k, v]) => {
                                if (!v) return null;
                                const label = k.replace(/([A-Z])/g, ' $1').trim();
                                if (typeof v === 'boolean') return <span key={k} className="px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-xs font-semibold capitalize">{label}</span>;
                                return <span key={k} className="px-3 py-1.5 bg-neutral-100 rounded-full text-xs font-semibold text-neutral-700 capitalize">{label}: {v}</span>;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Right sidebar ─────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Compat ring mobile */}
              {compatScore && (
                <div className="md:hidden bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 flex justify-center">
                  <CompatRing score={compatScore} />
                </div>
              )}

              {/* Core details */}
              <Card title="Details" icon={FiUser}>
                <div>
                  {age && <DetailRow label="Age" value={`${age} years`} />}
                  {profile.height && <DetailRow label="Height" value={formatHeight(profile.height)} />}
                  {profile.weight && <DetailRow label="Weight" value={`${profile.weight} kg`} />}
                  <DetailRow label="Location" value={[profile.city, profile.state].filter(Boolean).join(', ') || null} />
                  <DetailRow label="Education" value={profile.education} />
                  {profile.degree && <DetailRow label="Degree" value={profile.degree} />}
                  <DetailRow label="Profession" value={profile.profession} />
                  {profile.income && <DetailRow label="Income" value={formatIncome(profile.income)} />}
                  <DetailRow label="Religion" value={profile.religion} />
                  <DetailRow label="Caste" value={profile.caste} />
                  <DetailRow label="Mother Tongue" value={profile.motherTongue} />
                  <DetailRow label="Marital Status" value={profile.maritalStatus} />
                  <DetailRow label="Diet" value={profile.diet} />
                  <DetailRow label="Smoking" value={profile.smoking} />
                  <DetailRow label="Drinking" value={profile.drinking} />
                </div>
              </Card>

              {/* Contact unlock */}
              <Card title="Contact Details" icon={FiPhone}>
                {isContactUnlocked && unlockedContact ? (
                  <div className="space-y-2.5">
                    {unlockedContact.phone && (
                      <a href={`tel:${unlockedContact.phone}`} className="flex items-center gap-3 p-3.5 bg-success-50 border border-success-100 rounded-xl hover:bg-success-100 transition-colors cursor-pointer">
                        <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center flex-shrink-0">
                          <FiPhone className="w-4 h-4 text-success" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-success uppercase tracking-wide">Phone</p>
                          <p className="text-sm font-bold text-neutral-800">{unlockedContact.phone}</p>
                        </div>
                      </a>
                    )}
                    {unlockedContact.email && (
                      <a href={`mailto:${unlockedContact.email}`} className="flex items-center gap-3 p-3.5 bg-success-50 border border-success-100 rounded-xl hover:bg-success-100 transition-colors cursor-pointer">
                        <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center flex-shrink-0">
                          <FiMail className="w-4 h-4 text-success" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-success uppercase tracking-wide">Email</p>
                          <p className="text-sm font-bold text-neutral-800">{unlockedContact.email}</p>
                        </div>
                      </a>
                    )}
                    {!unlockedContact.phone && !unlockedContact.email && (
                      <p className="text-sm text-neutral-400 text-center py-2">No contact details available</p>
                    )}
                    {/* Social links when unlocked */}
                    {profile.socialMediaLinks && socialPlatforms.some(p => profile.socialMediaLinks[p.key]) && (
                      <div className="pt-2 mt-2 border-t border-neutral-100">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-2">Social Media</p>
                        <div className="grid grid-cols-2 gap-2">
                          {socialPlatforms.map(({ key, label, icon: Icon, color }) => {
                            const url = profile.socialMediaLinks[key];
                            if (!url) return null;
                            return (
                              <a
                                key={key}
                                href={sanitizeUrl(url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer"
                              >
                                <Icon className="w-3.5 h-3.5" style={{ color }} />
                                <span className="text-xs font-semibold text-neutral-600">{label}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-3">
                      <FiLock className="w-5 h-5 text-neutral-400" />
                    </div>
                    <p className="text-sm font-bold text-neutral-700 mb-1">Contact is private</p>
                    <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                      {premiumAccess
                        ? `Use 1 of your ${contactUnlocksRemaining > 0 ? contactUnlocksRemaining : 'remaining'} unlock${contactUnlocksRemaining !== 1 ? 's' : ''} to view phone & email`
                        : 'Upgrade to Premium to view phone, email, and social links'}
                    </p>
                    {premiumAccess && contactUnlocksRemaining > 0 && (
                      <p className="text-xs font-bold text-primary-400 mb-3">{contactUnlocksRemaining} unlock{contactUnlocksRemaining !== 1 ? 's' : ''} remaining</p>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleUnlockContact}
                      disabled={unlockLoading}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${premiumAccess
                          ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-sm'
                          : 'bg-gold text-neutral-900 hover:bg-gold-400 shadow-gold'
                        }`}
                    >
                      {unlockLoading ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : premiumAccess ? (
                        <><FiUnlock className="w-4 h-4" /> Unlock Contact</>
                      ) : (
                        <><FaCrown className="w-3.5 h-3.5" /> Upgrade to Premium</>
                      )}
                    </motion.button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>

      <FloatingActionBar
        isInterestSent={isLiked}
        isShortlisted={isShortlisted}
        onSendInterest={() => handleAction('like')}
        onShortlist={() => handleAction('shortlist')}
        onMessage={handleMessage}
      />

      <ImageLightbox
        src={lightbox.src}
        alt={lightbox.alt}
        open={lightbox.open}
        onClose={() => setLightbox(p => ({ ...p, open: false }))}
      />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeFeature}
      />
    </>
  );
};

export default ProfileDetail;

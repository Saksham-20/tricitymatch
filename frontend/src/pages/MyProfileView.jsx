import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { ProfileStrengthPanel } from '../components/profile/ProfileCompletionMeter';
import {
  FiEdit2, FiInstagram, FiLinkedin, FiFacebook, FiTwitter,
  FiMusic, FiCheck, FiMapPin, FiBook, FiBriefcase, FiUser,
  FiGlobe, FiShield, FiHome, FiSun, FiHeart, FiInfo,
  FiCamera, FiChevronRight, FiEye, FiDollarSign, FiGrid,
  FiHash, FiCopy, FiAlertCircle, FiYoutube, FiLink,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { API_BASE_URL } from '../utils/api';
import { getImageUrl } from '../utils/cloudinary';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize';
import { toProfileCode } from '../utils/profileCode';
import VideoIntroManager from '../components/profile/VideoIntroManager';
import { ImageLightbox } from '../components/ui/ImageLightbox';
import { friendlyLabel, formatEnum } from '../constants/profileOptions';

// ─── Card wrapper ────────────────────────────────────────────────────────────
const Card = ({ title, icon: Icon, children, action, className = '' }) => (
  <div className={`bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card overflow-hidden ${className}`}>
    {title && (
      <div className="px-5 pt-4 pb-3 border-b border-neutral-50 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary-500" />
            </div>
          )}
          <h2 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">{title}</h2>
        </div>
        {action}
      </div>
    )}
    <div className="px-5 py-4">{children}</div>
  </div>
);

// ─── Info Pill ───────────────────────────────────────────────────────────────
const Pill = ({ label, value, highlight }) => {
  if (!value && value !== 0) return null;
  return (
    <div className={`flex flex-col px-3 py-2.5 rounded-xl border ${highlight ? 'bg-primary-50 border-primary-100' : 'bg-neutral-50 border-neutral-100'}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5">{label}</span>
      <span className={`text-xs font-bold capitalize ${highlight ? 'text-primary-700' : 'text-neutral-700'}`}>{String(value).replace(/_/g, ' ')}</span>
    </div>
  );
};

// ─── Detail Row ──────────────────────────────────────────────────────────────
const DetailRow = ({ label, value, isLast }) => {
  if (!value && value !== 0) return null;
  return (
    <div className={`flex justify-between items-center py-2.5 ${!isLast ? 'border-b border-neutral-50' : ''}`}>
      <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-neutral-700 capitalize text-right max-w-[55%] truncate">{String(value).replace(/_/g, ' ')}</span>
    </div>
  );
};

// ─── Stat Badge ──────────────────────────────────────────────────────────────
const StatBadge = ({ label, value, color = 'rose' }) => (
  <div className={`flex flex-col items-center px-4 py-3 rounded-2xl border ${color === 'rose' ? 'bg-primary-50 border-primary-100' : color === 'amber' ? 'bg-gold-50 border-gold-200' : 'bg-success-50 border-success-100'}`}>
    <span className={`font-display text-xl font-bold ${color === 'rose' ? 'text-primary-600' : color === 'amber' ? 'text-gold-700' : 'text-success'}`}>{value}</span>
    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mt-0.5">{label}</span>
  </div>
);

const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: FiInstagram, color: '#E1306C' },
  { key: 'linkedin', label: 'LinkedIn', icon: FiLinkedin, color: '#0077B5' },
  { key: 'facebook', label: 'Facebook', icon: FiFacebook, color: '#1877F2' },
  { key: 'twitter', label: 'X (Twitter)', icon: FiTwitter, color: '#1DA1F2' },
  { key: 'youtube', label: 'YouTube', icon: FiYoutube, color: '#FF0000' },
  { key: 'website', label: 'Website', icon: FiLink, color: '#8B2346' },
];

// Links can be a legacy string or the new { url, visibility } shape.
const socialUrl = (entry) => (typeof entry === 'string' ? entry : entry?.url) || null;
const socialVisibilityLabel = (entry) => {
  const v = typeof entry === 'object' && entry ? entry.visibility : 'matches_only';
  if (v === 'everyone') return 'Public';
  if (v === 'hidden') return 'Hidden';
  return 'Matches only';
};

const EditBtn = ({ to, small }) => (
  <Link
    to={to || '/profile/edit'}
    className={`inline-flex items-center gap-1.5 font-semibold text-primary-500 hover:text-primary-700 transition-colors cursor-pointer ${small ? 'text-xs' : 'text-sm'}`}
  >
    <FiEdit2 className="w-3 h-3" />
    Edit
  </Link>
);

// ─────────────────────────────────────────────────────────────────────────────
const MyProfileView = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState({ open: false, src: null, alt: '' });

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get('/profile/me');
      setProfile(res.data.profile);
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin" />
        <p className="text-sm text-neutral-400 font-medium">Loading your profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <FiUser className="w-8 h-8 text-primary-300" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Set up your profile</h2>
          <p className="text-neutral-500 mb-6 text-sm leading-relaxed">
            Add your details and photos so potential matches can find you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/profile/edit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 text-white font-semibold text-sm hover:bg-primary-600 transition-colors shadow-sm cursor-pointer">
              <FiEdit2 className="w-4 h-4" /> Build your profile
            </Link>
            <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-medium text-sm hover:bg-neutral-50 transition-colors cursor-pointer">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const age = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const location = [profile.city, profile.state].filter(Boolean).join(', ') || null;
  const allPhotos = profile.profilePhoto
    ? [profile.profilePhoto, ...(profile.photos || []).filter(p => p !== profile.profilePhoto)]
    : (profile.photos || []);
  const completionPct = Number(profile.completionPercentage) || 0;
  const isVerified = profile.User?.Verification?.status === 'approved';
  const profileCode = toProfileCode(profile.userId || profile.User?.id);
  const copyProfileCode = async () => {
    if (!profileCode) return;
    try {
      await navigator.clipboard.writeText(profileCode);
      toast.success('Profile ID copied');
    } catch {
      toast.error('Could not copy');
    }
  };
  const activeSocials = SOCIAL_PLATFORMS.filter(p => socialUrl(profile.socialMediaLinks?.[p.key]));

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

  const profilePrompts = profile.profilePrompts
    ? Object.entries(profile.profilePrompts)
        .filter(([k]) => k.startsWith('prompt'))
        .map(([k, q]) => ({ q, a: profile.profilePrompts[k.replace('prompt', 'answer')] }))
        .filter(({ a }) => a)
    : [];


  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1117] pb-16">

      {/* ── Sticky top bar ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#1a1f2e]/95 backdrop-blur-sm border-b border-neutral-100 dark:border-neutral-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/dashboard" className="text-sm font-semibold text-neutral-500 hover:text-primary-500 transition-colors flex items-center gap-1.5 cursor-pointer">
            ← Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 hidden sm:block">
              <FiEye className="inline w-3 h-3 mr-1" />
              This is how matches see you
            </span>
            <Link to="/profile/edit" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-500 text-white font-semibold text-sm hover:bg-primary-600 transition-colors shadow-sm cursor-pointer">
              <FiEdit2 className="w-3.5 h-3.5" />
              Edit Profile
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Profile strength — always shown on My Profile ────────── */}
        <div className="mb-5">
          <ProfileStrengthPanel profile={profile} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Left column ──────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Hero card */}
            <div className="bg-white dark:bg-[#1a1f2e] rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-card overflow-hidden">

              {/* Photos */}
              {allPhotos.length === 0 ? (
                <div className="relative h-48 bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                  <span className="text-7xl font-display font-semibold text-primary-700/40 dark:text-primary-300/40 select-none">{profile.firstName?.[0] || '?'}</span>
                  <Link
                    to="/profile/edit"
                    className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-xl text-xs font-bold text-neutral-700 hover:bg-white shadow-sm border border-neutral-100 transition-all cursor-pointer"
                  >
                    <FiCamera className="w-3.5 h-3.5 text-primary-500" />
                    Add Photos
                  </Link>
                </div>
              ) : (
                <div className={`grid gap-0.5 ${allPhotos.length === 1 ? 'grid-cols-1' : allPhotos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
                  style={{ height: allPhotos.length >= 3 ? '300px' : '240px' }}>
                  {allPhotos.slice(0, allPhotos.length >= 3 ? 5 : allPhotos.length).map((photo, i) => {
                    const src = getImageUrl(photo, API_BASE_URL, 'full');
                    const alt = i === 0 ? profile.firstName : `${profile.firstName} ${i + 1}`;
                    return (
                      <button
                        key={photo}
                        type="button"
                        onClick={() => setLightbox({ open: true, src, alt })}
                        className={`relative overflow-hidden bg-primary-100 dark:bg-primary-900/40 hover:brightness-95 transition-all focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-inset cursor-pointer ${i === 0 && allPhotos.length >= 3 ? 'row-span-2 col-span-1' : ''}`}
                      >
                        <span className="absolute inset-0 flex items-center justify-center text-6xl font-display font-semibold text-primary-700/40 dark:text-primary-300/40 select-none">{profile.firstName?.[0] || '?'}</span>
                        <img src={src} alt={alt} className="relative w-full h-full object-cover pointer-events-none" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Identity */}
              <div className="p-5 md:p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h1 className="font-display text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                        {profile.firstName} {profile.lastName}
                        {age && <span className="font-normal text-neutral-400">, {age}</span>}
                      </h1>
                      {isVerified && (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-success-50 border border-success-100 rounded-full">
                          <FiShield className="w-3 h-3 text-success" />
                          <span className="text-[11px] font-bold text-success">Verified</span>
                        </div>
                      )}
                      {profileCode && (
                        <button
                          type="button"
                          onClick={copyProfileCode}
                          title="Copy your profile ID to share"
                          className="group flex items-center gap-1 px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-full hover:bg-neutral-100 transition-colors"
                        >
                          <FiHash className="w-3 h-3 text-neutral-400" />
                          <span className="text-[11px] font-bold text-neutral-600 tracking-wide">{profileCode}</span>
                          <FiCopy className="w-3 h-3 text-neutral-400 group-hover:text-neutral-600" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-neutral-500">
                      {location && <span className="flex items-center gap-1.5 font-medium"><FiMapPin className="w-3.5 h-3.5 text-primary-400" />{location}</span>}
                      {profile.profession && <span className="flex items-center gap-1.5"><FiBriefcase className="w-3.5 h-3.5 text-primary-400" />{profile.profession}</span>}
                      {profile.education && <span className="flex items-center gap-1.5"><FiBook className="w-3.5 h-3.5 text-primary-400" />{profile.education}</span>}
                      {profile.income && <span className="flex items-center gap-1.5"><FiDollarSign className="w-3.5 h-3.5 text-primary-400" />{formatIncome(profile.income)}</span>}
                    </div>
                  </div>
                  <EditBtn to="/profile/edit" />
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <StatBadge label="Profile" value={`${completionPct}%`} color="rose" />
                  <StatBadge label={allPhotos.length === 1 ? 'Photo' : 'Photos'} value={allPhotos.length} color="amber" />
                  <StatBadge label={isVerified ? 'Verified' : 'Unverified'} value={isVerified ? <FiCheck className="w-5 h-5" /> : <FiAlertCircle className="w-5 h-5" />} color={isVerified ? 'emerald' : 'rose'} />
                </div>

                {/* Bio */}
                {profile.bio ? (
                  <p className="text-neutral-600 leading-relaxed text-sm border-t border-neutral-50 pt-4">
                    {sanitizeText(profile.bio)}
                  </p>
                ) : (
                  <div className="border-t border-neutral-50 pt-4">
                    <Link to="/profile/edit?section=about" className="text-sm text-neutral-400 hover:text-primary-500 transition-colors cursor-pointer">
                      + Add a bio to help matches get to know you
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Video intro */}
            <div className="bg-white rounded-2xl border border-neutral-100 p-5">
              <VideoIntroManager
                videoUrl={profile.videoIntroUrl}
                onChange={(url) => setProfile((p) => ({ ...p, videoIntroUrl: url }))}
              />
            </div>

            {/* Profile prompts */}
            {profilePrompts.length > 0 ? (
              /* Prompts have no dedicated editor yet — display-only (no dead Edit link). */
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
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-neutral-200 p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-700">Add profile prompts</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Answer fun questions to stand out</p>
                </div>
                <Link to="/profile/edit" className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white rounded-xl text-xs font-bold hover:bg-primary-600 transition-colors cursor-pointer">
                  <FiEdit2 className="w-3 h-3" /> Add
                </Link>
              </div>
            )}

            {/* Interests */}
            {profile.interestTags?.length > 0 ? (
              <Card title="Interests & Hobbies" icon={FiGrid} action={<EditBtn small to="/profile/edit?section=about" />}>
                <div className="flex flex-wrap gap-2">
                  {profile.interestTags.map((tag, i) => (
                    <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-xs font-semibold cursor-default">
                      {tag}
                    </span>
                  ))}
                </div>
              </Card>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-neutral-200 p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-700">Add interests</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Help matches find common ground</p>
                </div>
                <Link to="/profile/edit" className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white rounded-xl text-xs font-bold hover:bg-primary-600 transition-colors cursor-pointer">
                  <FiEdit2 className="w-3 h-3" /> Add
                </Link>
              </div>
            )}

            {/* Spotify */}
            {profile.spotifyPlaylist && sanitizeUrl(profile.spotifyPlaylist) && (
              <Card title="Music Taste" icon={FiMusic} action={<EditBtn small to="/profile/edit?section=social" />}>
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
                    <p className="text-sm font-semibold text-neutral-700 group-hover:text-[#1DB954] transition-colors truncate">My Spotify Playlist</p>
                    <p className="text-xs text-neutral-400">Open in Spotify</p>
                  </div>
                  <FiChevronRight className="w-4 h-4 text-neutral-300" />
                </a>
              </Card>
            )}

            {/* Social Media */}
            {activeSocials.length > 0 && (
              <Card title="Social Media" icon={FiGlobe} action={<EditBtn small to="/profile/edit?section=social" />}>
                <div className="grid grid-cols-2 gap-2.5">
                  {activeSocials.map(({ key, label, icon: Icon, color }) => {
                    const entry = profile.socialMediaLinks[key];
                    const url = sanitizeUrl(socialUrl(entry));
                    if (!url) return null;
                    return (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener nofollow noreferrer"
                        className="flex items-center gap-2.5 p-3 border border-neutral-100 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer"
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-neutral-700 truncate">{label}</span>
                          <span className="block text-[10px] text-neutral-400">{socialVisibilityLabel(entry)}</span>
                        </div>
                        <FiChevronRight className="w-3 h-3 text-neutral-300 ml-auto flex-shrink-0" />
                      </a>
                    );
                  })}
                </div>
              </Card>
            )}

          </div>

          {/* ── Right column ─────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Core details */}
            <Card title="Details" icon={FiUser} action={<EditBtn small to="/profile/edit?section=religion" />}>
              <div>
                {age != null && <DetailRow label="Age" value={`${age} years`} />}
                {location && <DetailRow label="Location" value={location} />}
                {profile.height && <DetailRow label="Height" value={formatHeight(profile.height)} />}
                {profile.weight && <DetailRow label="Weight" value={`${profile.weight} kg`} />}
                {profile.education && <DetailRow label="Education" value={profile.education} />}
                {profile.degree && <DetailRow label="Degree" value={profile.degree} />}
                {profile.profession && <DetailRow label="Profession" value={profile.profession} />}
                {profile.income && <DetailRow label="Income" value={formatIncome(profile.income)} />}
                {profile.religion && <DetailRow label="Religion" value={profile.religion} />}
                {profile.caste && <DetailRow label="Caste" value={profile.caste} />}
                {profile.subCaste && <DetailRow label="Sub Caste" value={profile.subCaste} />}
                {profile.gotra && <DetailRow label="Gotra" value={profile.gotra} />}
                {profile.motherTongue && <DetailRow label="Mother Tongue" value={profile.motherTongue} />}
                {profile.maritalStatus && <DetailRow label="Marital Status" value={friendlyLabel('maritalStatus', profile.maritalStatus)} />}
                {/* Diet/Smoking/Drinking/Skin tone live in the dedicated Lifestyle
                    card below — not repeated here. */}
                {profile.personalityType && <DetailRow label="Personality" value={profile.personalityType} isLast />}
              </div>
            </Card>

            {/* Lifestyle pills */}
            {(profile.diet || profile.smoking || profile.drinking || profile.skinTone) && (
              <Card title="Lifestyle" icon={FiInfo} action={<EditBtn small to="/profile/edit?section=lifestyle" />}>
                <div className="grid grid-cols-2 gap-2">
                  {profile.diet && <Pill label="Diet" value={formatEnum(profile.diet)} />}
                  {profile.smoking && <Pill label="Smoking" value={formatEnum(profile.smoking)} highlight={profile.smoking !== 'never'} />}
                  {profile.drinking && <Pill label="Drinking" value={formatEnum(profile.drinking)} highlight={profile.drinking !== 'never'} />}
                  {profile.skinTone && <Pill label="Skin Tone" value={formatEnum(profile.skinTone)} />}
                </div>
              </Card>
            )}

            {/* Horoscope */}
            {(profile.manglikStatus || profile.zodiacSign || profile.rashi || profile.nakshatra) && (
              <Card title="Horoscope & Kundli" icon={FiSun} action={<EditBtn small to="/profile/edit?section=horoscope" />}>
                <div>
                  {profile.zodiacSign && <DetailRow label="Zodiac Sign" value={profile.zodiacSign} />}
                  {profile.rashi && <DetailRow label="Rashi" value={profile.rashi} />}
                  {profile.nakshatra && <DetailRow label="Nakshatra" value={profile.nakshatra} />}
                  {profile.manglikStatus && <DetailRow label="Manglik" value={friendlyLabel('manglikStatus', profile.manglikStatus)} />}
                  {profile.placeOfBirth && <DetailRow label="Place of Birth" value={profile.placeOfBirth} />}
                  {profile.birthTime && <DetailRow label="Birth Time" value={profile.birthTime} isLast />}
                </div>
              </Card>
            )}

            {/* Family */}
            {(profile.familyType || profile.familyStatus || profile.fatherOccupation || profile.motherOccupation || profile.numberOfSiblings > 0) && (
              <Card title="Family Background" icon={FiHome} action={<EditBtn small to="/profile/edit?section=family" />}>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {profile.familyType && <Pill label="Family Type" value={friendlyLabel('familyType', profile.familyType)} />}
                  {profile.familyStatus && <Pill label="Family Status" value={friendlyLabel('familyStatus', profile.familyStatus)} />}
                  {profile.numberOfSiblings > 0 && <Pill label="Siblings" value={profile.numberOfSiblings} />}
                  {profile.numberOfChildren > 0 && <Pill label="Children" value={profile.numberOfChildren} />}
                </div>
                <div>
                  {profile.fatherOccupation && <DetailRow label="Father's Job" value={profile.fatherOccupation} />}
                  {profile.motherOccupation && <DetailRow label="Mother's Job" value={profile.motherOccupation} isLast />}
                </div>
              </Card>
            )}

            {/* Languages */}
            {profile.languages?.length > 0 && (
              <Card title="Languages" icon={FiGlobe} action={<EditBtn small to="/profile/edit?section=about" />}>
                <div className="flex flex-wrap gap-1.5">
                  {profile.languages.map((lang, i) => (
                    <span key={i} className="px-2.5 py-1.5 bg-neutral-100 rounded-xl text-xs font-bold text-neutral-600">{lang}</span>
                  ))}
                </div>
              </Card>
            )}

            {/* Partner preferences */}
            {(profile.preferredAgeMin || profile.preferredAgeMax || profile.preferredEducation || profile.preferredProfession || profile.preferredCity?.length) && (
              <Card title="Looking For" icon={FiHeart} action={<EditBtn small to="/profile/edit?section=preferences" />}>
                <div>
                  {(profile.preferredAgeMin || profile.preferredAgeMax) && (
                    <DetailRow label="Age Range" value={`${profile.preferredAgeMin || '—'} – ${profile.preferredAgeMax || '—'} yrs`} />
                  )}
                  {(profile.preferredHeightMin || profile.preferredHeightMax) && (
                    <DetailRow label="Height Range" value={`${profile.preferredHeightMin || '—'} – ${profile.preferredHeightMax || '—'} cm`} />
                  )}
                  {profile.preferredEducation && <DetailRow label="Education" value={profile.preferredEducation} />}
                  {profile.preferredProfession && <DetailRow label="Profession" value={profile.preferredProfession} />}
                </div>
                {profile.preferredCity?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-neutral-50">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-2">Cities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.preferredCity.map((c, i) => (
                        <span key={i} className="px-2.5 py-1 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-xs font-semibold">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Verification nudge */}
            {!isVerified && (
              <div className="bg-gold-50 border border-gold-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiShield className="w-4 h-4 text-gold-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gold-700 mb-1">Get Verified</p>
                    <p className="text-xs text-gold-700/80 leading-relaxed mb-3">
                      Verified profiles get 3x more responses. Take a quick selfie to get the verified badge.
                    </p>
                    <Link to="/verification" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold text-neutral-900 text-xs font-bold rounded-lg hover:bg-gold-400 transition-colors cursor-pointer">
                      <FiShield className="w-3 h-3" /> Verify Now
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ImageLightbox
        src={lightbox.src}
        alt={lightbox.alt}
        open={lightbox.open}
        onClose={() => setLightbox(p => ({ ...p, open: false }))}
      />
    </div>
  );
};

export default MyProfileView;

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
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { API_BASE_URL } from '../utils/api';
import { getImageUrl } from '../utils/cloudinary';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize';
import { ImageLightbox } from '../components/ui/ImageLightbox';

// ─── Card wrapper ────────────────────────────────────────────────────────────
const Card = ({ title, icon: Icon, children, action, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
    {title && (
      <div className="px-5 pt-4 pb-3 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-3.5 h-3.5 text-rose-500" />
            </div>
          )}
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h2>
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
    <div className={`flex flex-col px-3 py-2.5 rounded-xl border ${highlight ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">{label}</span>
      <span className={`text-xs font-bold capitalize ${highlight ? 'text-rose-700' : 'text-slate-700'}`}>{String(value).replace(/_/g, ' ')}</span>
    </div>
  );
};

// ─── Detail Row ──────────────────────────────────────────────────────────────
const DetailRow = ({ label, value, isLast }) => {
  if (!value && value !== 0) return null;
  return (
    <div className={`flex justify-between items-center py-2.5 ${!isLast ? 'border-b border-slate-50' : ''}`}>
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-slate-700 capitalize text-right max-w-[55%] truncate">{String(value).replace(/_/g, ' ')}</span>
    </div>
  );
};

// ─── Stat Badge ──────────────────────────────────────────────────────────────
const StatBadge = ({ label, value, color = 'rose' }) => (
  <div className={`flex flex-col items-center px-4 py-3 rounded-2xl border ${color === 'rose' ? 'bg-rose-50 border-rose-100' : color === 'amber' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
    <span className={`text-xl font-black ${color === 'rose' ? 'text-rose-600' : color === 'amber' ? 'text-amber-600' : 'text-emerald-600'}`}>{value}</span>
    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{label}</span>
  </div>
);

const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: FiInstagram, color: '#E1306C' },
  { key: 'linkedin', label: 'LinkedIn', icon: FiLinkedin, color: '#0077B5' },
  { key: 'facebook', label: 'Facebook', icon: FiFacebook, color: '#1877F2' },
  { key: 'twitter', label: 'Twitter', icon: FiTwitter, color: '#1DA1F2' },
];

const EditBtn = ({ to, small }) => (
  <Link
    to={to || '/profile/edit'}
    className={`inline-flex items-center gap-1.5 font-semibold text-rose-500 hover:text-rose-700 transition-colors cursor-pointer ${small ? 'text-xs' : 'text-sm'}`}
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-rose-200 border-t-rose-500 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Loading your profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
            <FiUser className="w-8 h-8 text-rose-300" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Set up your profile</h2>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">
            Add your details and photos so potential matches can find you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/profile/edit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 text-white font-semibold text-sm hover:bg-rose-600 transition-colors shadow-sm cursor-pointer">
              <FiEdit2 className="w-4 h-4" /> Build your profile
            </Link>
            <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors cursor-pointer">
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
  const activeSocials = SOCIAL_PLATFORMS.filter(p => profile.socialMediaLinks?.[p.key]);

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
    <div className="min-h-screen bg-slate-50 pb-16">

      {/* ── Sticky top bar ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/dashboard" className="text-sm font-semibold text-slate-500 hover:text-rose-500 transition-colors flex items-center gap-1.5 cursor-pointer">
            ← Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:block">
              <FiEye className="inline w-3 h-3 mr-1" />
              This is how matches see you
            </span>
            <Link to="/profile/edit" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 text-white font-semibold text-sm hover:bg-rose-600 transition-colors shadow-sm cursor-pointer">
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
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">

              {/* Photos */}
              {allPhotos.length === 0 ? (
                <div className="relative h-48 bg-gradient-to-br from-rose-100 via-rose-50 to-pink-50 flex items-center justify-center">
                  <span className="text-7xl font-black text-rose-200 select-none">{profile.firstName?.[0] || '?'}</span>
                  <Link
                    to="/profile/edit"
                    className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-xl text-xs font-bold text-slate-700 hover:bg-white shadow-sm border border-slate-100 transition-all cursor-pointer"
                  >
                    <FiCamera className="w-3.5 h-3.5 text-rose-500" />
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
                        className={`relative overflow-hidden bg-slate-100 hover:brightness-90 transition-all focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-inset cursor-pointer ${i === 0 && allPhotos.length >= 3 ? 'row-span-2 col-span-1' : ''}`}
                      >
                        <img src={src} alt={alt} className="w-full h-full object-cover pointer-events-none" loading="lazy" decoding="async" />
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
                      <h1 className="text-2xl md:text-3xl font-black text-slate-900">
                        {profile.firstName} {profile.lastName}
                        {age && <span className="font-normal text-slate-400">, {age}</span>}
                      </h1>
                      {isVerified && (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
                          <FiShield className="w-3 h-3 text-emerald-500" />
                          <span className="text-[11px] font-bold text-emerald-600">Verified</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                      {location && <span className="flex items-center gap-1.5 font-medium"><FiMapPin className="w-3.5 h-3.5 text-rose-400" />{location}</span>}
                      {profile.profession && <span className="flex items-center gap-1.5"><FiBriefcase className="w-3.5 h-3.5 text-rose-400" />{profile.profession}</span>}
                      {profile.education && <span className="flex items-center gap-1.5"><FiBook className="w-3.5 h-3.5 text-rose-400" />{profile.education}</span>}
                      {profile.income && <span className="flex items-center gap-1.5"><FiDollarSign className="w-3.5 h-3.5 text-rose-400" />{formatIncome(profile.income)}</span>}
                    </div>
                  </div>
                  <EditBtn to="/profile/edit" />
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <StatBadge label="Profile" value={`${completionPct}%`} color="rose" />
                  <StatBadge label="Photos" value={allPhotos.length} color="amber" />
                  <StatBadge label={isVerified ? 'Verified' : 'Unverified'} value={isVerified ? '✓' : '!'} color={isVerified ? 'emerald' : 'rose'} />
                </div>

                {/* Bio */}
                {profile.bio ? (
                  <p className="text-slate-600 leading-relaxed text-sm border-t border-slate-50 pt-4">
                    {sanitizeText(profile.bio)}
                  </p>
                ) : (
                  <div className="border-t border-slate-50 pt-4">
                    <Link to="/profile/edit" className="text-sm text-slate-400 hover:text-rose-500 transition-colors cursor-pointer">
                      + Add a bio to help matches get to know you
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Profile prompts */}
            {profilePrompts.length > 0 ? (
              <Card title="Get to Know Me" icon={FiUser} action={<EditBtn small />}>
                <div className="space-y-3">
                  {profilePrompts.map(({ q, a }, i) => (
                    <div key={i} className="p-4 bg-rose-50/60 rounded-xl border border-rose-100">
                      <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wide mb-1.5">{sanitizeText(q)}</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{sanitizeText(a)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Add profile prompts</p>
                  <p className="text-xs text-slate-400 mt-0.5">Answer fun questions to stand out</p>
                </div>
                <Link to="/profile/edit" className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition-colors cursor-pointer">
                  <FiEdit2 className="w-3 h-3" /> Add
                </Link>
              </div>
            )}

            {/* Interests */}
            {profile.interestTags?.length > 0 ? (
              <Card title="Interests & Hobbies" icon={FiGrid} action={<EditBtn small />}>
                <div className="flex flex-wrap gap-2">
                  {profile.interestTags.map((tag, i) => (
                    <span key={i} className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-full text-xs font-semibold cursor-default">
                      {tag}
                    </span>
                  ))}
                </div>
              </Card>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Add interests</p>
                  <p className="text-xs text-slate-400 mt-0.5">Help matches find common ground</p>
                </div>
                <Link to="/profile/edit" className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition-colors cursor-pointer">
                  <FiEdit2 className="w-3 h-3" /> Add
                </Link>
              </div>
            )}

            {/* Spotify */}
            {profile.spotifyPlaylist && sanitizeUrl(profile.spotifyPlaylist) && (
              <Card title="Music Taste" icon={FiMusic} action={<EditBtn small />}>
                <a
                  href={sanitizeUrl(profile.spotifyPlaylist)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-[#1DB954]/40 hover:bg-[#1DB954]/5 transition-all group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1DB954]/15 flex items-center justify-center flex-shrink-0">
                    <FiMusic className="w-4.5 h-4.5 text-[#1DB954]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-[#1DB954] transition-colors truncate">My Spotify Playlist</p>
                    <p className="text-xs text-slate-400">Open in Spotify</p>
                  </div>
                  <FiChevronRight className="w-4 h-4 text-slate-300" />
                </a>
              </Card>
            )}

            {/* Social Media */}
            {activeSocials.length > 0 && (
              <Card title="Social Media" icon={FiGlobe} action={<EditBtn small />}>
                <div className="grid grid-cols-2 gap-2.5">
                  {activeSocials.map(({ key, label, icon: Icon, color }) => {
                    const url = profile.socialMediaLinks[key];
                    return (
                      <a
                        key={key}
                        href={sanitizeUrl(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                        <span className="text-sm font-semibold text-slate-700">{label}</span>
                        <FiChevronRight className="w-3 h-3 text-slate-300 ml-auto" />
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
            <Card title="Details" icon={FiUser} action={<EditBtn small />}>
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
                {profile.maritalStatus && <DetailRow label="Marital Status" value={profile.maritalStatus} />}
                {profile.diet && <DetailRow label="Diet" value={profile.diet} />}
                {profile.smoking && <DetailRow label="Smoking" value={profile.smoking} />}
                {profile.drinking && <DetailRow label="Drinking" value={profile.drinking} />}
                {profile.skinTone && <DetailRow label="Skin Tone" value={profile.skinTone} />}
                {profile.personalityType && <DetailRow label="Personality" value={profile.personalityType} isLast />}
              </div>
            </Card>

            {/* Lifestyle pills */}
            {(profile.diet || profile.smoking || profile.drinking || profile.skinTone) && (
              <Card title="Lifestyle" icon={FiInfo} action={<EditBtn small />}>
                <div className="grid grid-cols-2 gap-2">
                  {profile.diet && <Pill label="Diet" value={profile.diet} />}
                  {profile.smoking && <Pill label="Smoking" value={profile.smoking} highlight={profile.smoking !== 'never'} />}
                  {profile.drinking && <Pill label="Drinking" value={profile.drinking} highlight={profile.drinking !== 'never'} />}
                  {profile.skinTone && <Pill label="Skin Tone" value={profile.skinTone} />}
                </div>
              </Card>
            )}

            {/* Horoscope */}
            {(profile.manglikStatus || profile.zodiacSign || profile.rashi || profile.nakshatra) && (
              <Card title="Horoscope & Kundli" icon={FiSun} action={<EditBtn small />}>
                <div>
                  {profile.zodiacSign && <DetailRow label="Zodiac Sign" value={profile.zodiacSign} />}
                  {profile.rashi && <DetailRow label="Rashi" value={profile.rashi} />}
                  {profile.nakshatra && <DetailRow label="Nakshatra" value={profile.nakshatra} />}
                  {profile.manglikStatus && <DetailRow label="Manglik" value={profile.manglikStatus} />}
                  {profile.placeOfBirth && <DetailRow label="Place of Birth" value={profile.placeOfBirth} />}
                  {profile.birthTime && <DetailRow label="Birth Time" value={profile.birthTime} isLast />}
                </div>
              </Card>
            )}

            {/* Family */}
            {(profile.familyType || profile.familyStatus || profile.fatherOccupation || profile.motherOccupation || profile.numberOfSiblings) && (
              <Card title="Family Background" icon={FiHome} action={<EditBtn small />}>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {profile.familyType && <Pill label="Family Type" value={profile.familyType} />}
                  {profile.familyStatus && <Pill label="Family Status" value={profile.familyStatus} />}
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
              <Card title="Languages" icon={FiGlobe} action={<EditBtn small />}>
                <div className="flex flex-wrap gap-1.5">
                  {profile.languages.map((lang, i) => (
                    <span key={i} className="px-2.5 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">{lang}</span>
                  ))}
                </div>
              </Card>
            )}

            {/* Partner preferences */}
            {(profile.preferredAgeMin || profile.preferredAgeMax || profile.preferredEducation || profile.preferredProfession || profile.preferredCity?.length) && (
              <Card title="Looking For" icon={FiHeart} action={<EditBtn small />}>
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
                  <div className="mt-3 pt-3 border-t border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Cities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.preferredCity.map((c, i) => (
                        <span key={i} className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-full text-xs font-semibold">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Verification nudge */}
            {!isVerified && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiShield className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-amber-800 mb-1">Get Verified</p>
                    <p className="text-xs text-amber-600 leading-relaxed mb-3">
                      Verified profiles get 3x more responses. Submit your ID to get the verified badge.
                    </p>
                    <Link to="/settings" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors cursor-pointer">
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

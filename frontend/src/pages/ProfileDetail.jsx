import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  FiHeart, FiStar, FiInstagram, FiLinkedin, FiFacebook, FiTwitter,
  FiMusic, FiLock, FiCheck, FiMapPin, FiCalendar, FiBook, FiBriefcase,
  FiGlobe, FiChevronLeft, FiMessageCircle, FiShield,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../utils/api';
import { getImageUrl } from '../utils/cloudinary';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize';
import { ImageLightbox } from '../components/ui/ImageLightbox';
import FloatingActionBar from '../components/profile/FloatingActionBar';

// ─── Inline Compatibility Ring ───────────────
const CompatRing = ({ score }) => {
  const size = 96;
  const sw = 6;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 90 ? '#2E7D32' : score >= 75 ? '#C9A227' : '#8B2346';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F5F5F5" strokeWidth={sw} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.6, ease: 'easeOut', delay: 0.4 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold leading-none" style={{ color }}>{score}%</span>
          <span className="text-[10px] text-neutral-400 mt-0.5">match</span>
        </div>
      </div>
      <p className="text-xs font-medium text-neutral-600">Compatibility Score</p>
    </div>
  );
};

// ─── Detail Row ──────────────────────────────
const DetailRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-b-0">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-800 capitalize">{value}</span>
    </div>
  );
};

// ─── Section card wrapper ────────────────────
const Section = ({ title, children, badge }) => (
  <div className="bg-white rounded-2xl border border-neutral-100 shadow-card p-5 md:p-6">
    {title && (
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-neutral-800">{title}</h2>
        {badge}
      </div>
    )}
    {children}
  </div>
);

// ─────────────────────────────────────────────
const ProfileDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [compatScore, setCompatScore] = useState(null);
  const [premiumAccess, setPremiumAccess] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState({ open: false, src: null, alt: '' });

  useEffect(() => { loadProfile(); }, [userId]);

  const loadProfile = async () => {
    try {
      const res = await api.get(`/profile/${userId}`);
      setProfile(res.data.profile);
      setCompatScore(res.data.compatibilityScore);
      setPremiumAccess(res.data.hasPremiumAccess);
      setIsLiked(res.data.isLiked || false);
      setIsShortlisted(res.data.isShortlisted || false);
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
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
        toast.success(isShortlisted ? 'Removed from shortlist' : 'Profile shortlisted!');
      }
    } catch {
      toast.error('Failed to perform action');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin" />
          <p className="text-sm text-neutral-500">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <h2 className="text-2xl font-display font-semibold text-neutral-800 mb-3">Profile Not Found</h2>
          <Link to="/search" className="text-primary-500 hover:text-primary-700 font-medium transition-colors">
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  const firstName = profile.firstName || 'Profile';
  const age = profile.dateOfBirth
    ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()
    : null;
  const isVerified = profile.User?.Verification?.status === 'approved';

  const allPhotos = profile.profilePhoto
    ? [profile.profilePhoto, ...(profile.photos || []).filter(p => p !== profile.profilePhoto)]
    : (profile.photos || []);

  const socialPlatforms = [
    { key: 'instagram', label: 'Instagram', icon: FiInstagram },
    { key: 'linkedin', label: 'LinkedIn', icon: FiLinkedin },
    { key: 'facebook', label: 'Facebook', icon: FiFacebook },
    { key: 'twitter', label: 'Twitter', icon: FiTwitter },
  ];

  return (
    <>
      <div className="min-h-screen bg-neutral-50 pb-28 md:pb-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Back nav */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-primary-500 transition-colors mb-6 group"
          >
            <FiChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>

          {/* ── Hero identity row ────────────────── */}
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden mb-5">
            {/* Photo — masonry-style hero */}
            {allPhotos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 h-72 sm:h-80">
                {allPhotos.slice(0, 5).map((photo, i) => {
                  const url = getImageUrl(photo, API_BASE_URL, 'full');
                  return (
                    <button
                      key={photo}
                      type="button"
                      onClick={() => setLightbox({ open: true, src: url, alt: `${firstName} ${i + 1}` })}
                      className={`overflow-hidden bg-neutral-100 hover:brightness-95 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${i === 0 ? 'col-span-2 row-span-2 sm:row-span-1' : ''
                        }`}
                    >
                      <img
                        src={url}
                        alt={`${firstName} ${i + 1}`}
                        className="w-full h-full object-cover"
                        loading={i === 0 ? 'eager' : 'lazy'}
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 bg-gradient-to-br from-primary-100 via-primary-50 to-gold-50 flex items-center justify-center">
                <span className="text-8xl font-bold text-primary-300">{firstName[0]}</span>
              </div>
            )}

            {/* Name + meta */}
            <div className="p-5 md:p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-neutral-900">
                      {firstName}{profile.lastName ? ` ${profile.lastName[0]}.` : ''}
                      {age && <span className="text-neutral-500">, {age}</span>}
                    </h1>
                    {isVerified && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-success-50 rounded-full border border-success-100">
                        <FiShield className="w-3 h-3 text-success" />
                        <span className="text-[11px] font-semibold text-success">Verified</span>
                      </div>
                    )}
                    {profile.isPremium && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-gold-50 rounded-full border border-gold-200">
                        <FaCrown className="w-3 h-3 text-gold" />
                        <span className="text-[11px] font-semibold text-gold-700">Premium</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-neutral-500">
                    {(profile.city || profile.state) && (
                      <span className="flex items-center gap-1">
                        <FiMapPin className="w-3.5 h-3.5" />
                        {[profile.city, profile.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {profile.profession && (
                      <span className="flex items-center gap-1">
                        <FiBriefcase className="w-3.5 h-3.5" />
                        {profile.profession}
                      </span>
                    )}
                    {profile.education && (
                      <span className="flex items-center gap-1">
                        <FiBook className="w-3.5 h-3.5" />
                        {profile.education}
                      </span>
                    )}
                  </div>
                </div>

                {/* Compatibility ring — desktop */}
                {compatScore && (
                  <div className="hidden md:block flex-shrink-0">
                    <CompatRing score={compatScore} />
                  </div>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="mt-4 text-neutral-600 leading-relaxed text-sm md:text-base border-t border-neutral-100 pt-4">
                  {sanitizeText(profile.bio)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* ── Left column ─────────────────── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Profile prompts */}
              {profile.profilePrompts && Object.keys(profile.profilePrompts).length > 0 && (() => {
                const prompts = Object.entries(profile.profilePrompts)
                  .filter(([k]) => k.startsWith('prompt'))
                  .map(([k, q]) => ({ q, a: profile.profilePrompts[k.replace('prompt', 'answer')] }))
                  .filter(({ a }) => a);
                return prompts.length > 0 ? (
                  <Section title="Get to Know Me">
                    <div className="space-y-3">
                      {prompts.map(({ q, a }, i) => (
                        <div key={i} className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                          <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide mb-1.5">
                            {sanitizeText(q)}
                          </p>
                          <p className="text-sm text-neutral-700 leading-relaxed">{sanitizeText(a)}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                ) : null;
              })()}

              {/* Interest tags */}
              {profile.interestTags?.length > 0 && (
                <Section title="Interests & Hobbies">
                  <div className="flex flex-wrap gap-2">
                    {profile.interestTags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Spotify */}
              {profile.spotifyPlaylist && sanitizeUrl(profile.spotifyPlaylist) && (
                <Section title="Music Taste">
                  <a
                    href={sanitizeUrl(profile.spotifyPlaylist)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100 hover:border-primary-200 hover:bg-primary-50 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#1DB954]/10 flex items-center justify-center">
                      <FiMusic className="w-4 h-4 text-[#1DB954]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-700 group-hover:text-primary-600 transition-colors truncate">
                        Listen to {sanitizeText(firstName)}'s playlist
                      </p>
                      <p className="text-xs text-neutral-400">Spotify</p>
                    </div>
                    <FiGlobe className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  </a>
                </Section>
              )}

              {/* Social links */}
              {profile.socialMediaLinks && (
                premiumAccess ? (
                  <Section title="Social Media">
                    <div className="grid grid-cols-2 gap-3">
                      {socialPlatforms.map(({ key, label, icon: Icon }) => {
                        const url = profile.socialMediaLinks[key];
                        if (!url) return null;
                        return (
                          <a
                            key={key}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 border border-neutral-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all text-neutral-700 hover:text-primary-600"
                          >
                            <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                            <span className="text-sm font-medium">{label}</span>
                          </a>
                        );
                      })}
                    </div>
                  </Section>
                ) : (
                  <div className="bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-3">
                      <FiLock className="w-5 h-5 text-neutral-400" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-700 mb-1">
                      Social media links are Premium-only
                    </p>
                    <p className="text-xs text-neutral-400 mb-4">
                      Upgrade to view and connect on social platforms
                    </p>
                    <Link
                      to="/subscription"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-neutral-900 text-sm font-semibold rounded-xl hover:bg-gold-400 transition-colors"
                    >
                      <FaCrown className="w-3.5 h-3.5" />
                      Upgrade to Premium
                    </Link>
                  </div>
                )
              )}
            </div>

            {/* ── Right column ────────────────── */}
            <div className="space-y-5">

              {/* Compat ring — mobile */}
              {compatScore && (
                <div className="md:hidden bg-white rounded-2xl border border-neutral-100 shadow-card p-5 flex justify-center">
                  <CompatRing score={compatScore} />
                </div>
              )}

              {/* Desktop action buttons */}
              <div className="hidden md:block bg-white rounded-2xl border border-neutral-100 shadow-card p-5 space-y-3">
                <button
                  onClick={() => handleAction('like')}
                  disabled={isLiked}
                  className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${isLiked
                      ? 'bg-success-50 text-success border border-success-100 cursor-default'
                      : 'bg-primary-500 text-white hover:bg-primary-600 shadow-burgundy hover:-translate-y-0.5'
                    }`}
                >
                  {isLiked
                    ? <><FiCheck className="w-4 h-4" /> Interest Expressed</>
                    : <><FiHeart className="w-4 h-4" /> Express Interest</>}
                </button>

                <button
                  onClick={() => handleAction('shortlist')}
                  className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${isShortlisted
                      ? 'bg-gold-50 text-gold-700 border border-gold-200'
                      : 'border-2 border-neutral-200 text-primary-500 hover:border-primary-300 hover:bg-primary-50'
                    }`}
                >
                  {isShortlisted
                    ? <><FiCheck className="w-4 h-4" /> Saved</>
                    : <><FiStar className="w-4 h-4" /> Save Profile</>}
                </button>

                <button
                  onClick={() => navigate(`/chat`)}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl border-2 border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 transition-all"
                >
                  <FiMessageCircle className="w-4 h-4" />
                  Send Message
                </button>
              </div>

              {/* Details */}
              <Section title="Details">
                <div>
                  {age && (
                    <div className="flex items-center justify-between py-2.5 border-b border-neutral-100">
                      <span className="text-sm text-neutral-500 flex items-center gap-2">
                        <FiCalendar className="w-3.5 h-3.5 text-primary-400" /> Age
                      </span>
                      <span className="text-sm font-medium text-neutral-800">{age} years</span>
                    </div>
                  )}
                  {(profile.city || profile.state) && (
                    <div className="flex items-center justify-between py-2.5 border-b border-neutral-100">
                      <span className="text-sm text-neutral-500 flex items-center gap-2">
                        <FiMapPin className="w-3.5 h-3.5 text-primary-400" /> Location
                      </span>
                      <span className="text-sm font-medium text-neutral-800">
                        {[profile.city, profile.state].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {profile.height && (
                    <DetailRow label="Height" value={`${profile.height} cm`} />
                  )}
                  <DetailRow label="Education" value={profile.education} />
                  <DetailRow label="Profession" value={profile.profession} />
                  <DetailRow label="Religion" value={profile.religion} />
                  <DetailRow label="Caste" value={profile.caste} />
                  <DetailRow label="Mother Tongue" value={profile.motherTongue} />
                  <DetailRow label="Marital Status" value={profile.maritalStatus?.replace(/_/g, ' ')} />
                  <DetailRow label="Diet" value={profile.diet} />
                  <DetailRow label="Smoking" value={profile.smoking} />
                  <DetailRow label="Drinking" value={profile.drinking} />
                  <DetailRow label="Personality" value={profile.personalityType} />
                </div>

                {/* Horoscope / Kundli */}
                {(profile.manglikStatus || profile.zodiacSign || profile.rashi || profile.nakshatra) && (
                  <div className="mt-3 pt-3 border-t border-neutral-100">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                      Horoscope & Kundli
                    </p>
                    <DetailRow label="Manglik" value={profile.manglikStatus?.replace(/_/g, ' ')} />
                    <DetailRow label="Zodiac Sign" value={profile.zodiacSign} />
                    <DetailRow label="Rashi" value={profile.rashi} />
                    <DetailRow label="Nakshatra" value={profile.nakshatra} />
                    <DetailRow label="Place of Birth" value={profile.placeOfBirth} />
                    <DetailRow label="Birth Time" value={profile.birthTime} />
                  </div>
                )}

                {/* Family Background */}
                {(profile.familyType || profile.familyStatus || profile.fatherOccupation || profile.motherOccupation) && (
                  <div className="mt-3 pt-3 border-t border-neutral-100">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                      Family Background
                    </p>
                    <DetailRow label="Family Type" value={profile.familyType?.replace(/_/g, ' ')} />
                    <DetailRow label="Family Status" value={profile.familyStatus?.replace(/_/g, ' ')} />
                    <DetailRow label="Father's Occupation" value={profile.fatherOccupation} />
                    <DetailRow label="Mother's Occupation" value={profile.motherOccupation} />
                    {profile.numberOfSiblings > 0 && (
                      <DetailRow label="Siblings" value={profile.numberOfSiblings} />
                    )}
                  </div>
                )}

                {/* Languages */}
                {profile.languages?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-neutral-100">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                      Languages
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.languages.map((l, i) => (
                        <span key={i} className="px-2.5 py-1 bg-neutral-100 rounded-lg text-xs font-medium text-neutral-700">
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile floating action bar */}
      <FloatingActionBar
        isInterestSent={isLiked}
        isShortlisted={isShortlisted}
        onSendInterest={() => handleAction('like')}
        onShortlist={() => handleAction('shortlist')}
        onMessage={() => navigate('/chat')}
      />

      {/* Lightbox */}
      <ImageLightbox
        src={lightbox.src}
        alt={lightbox.alt}
        open={lightbox.open}
        onClose={() => setLightbox(p => ({ ...p, open: false }))}
      />
    </>
  );
};

export default ProfileDetail;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  FiEdit2, FiInstagram, FiLinkedin, FiFacebook, FiTwitter,
  FiMusic, FiCheck, FiMapPin, FiBook, FiBriefcase, FiUser,
} from 'react-icons/fi';
import { API_BASE_URL } from '../utils/api';
import { getImageUrl } from '../utils/cloudinary';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize';
import { ImageLightbox } from '../components/ui/ImageLightbox';

// ─── Reusable section wrapper ───────────────────────────────────────────────
const Section = ({ title, children, icon: Icon }) => (
  <div className="bg-white border border-neutral-100 rounded-2xl shadow-card overflow-hidden">
    <div className="px-5 pt-5 pb-1 flex items-center gap-2 border-b border-neutral-50">
      {Icon && <Icon className="w-4 h-4 text-primary-400 flex-shrink-0" />}
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
    </div>
    <div className="px-5 py-5">{children}</div>
  </div>
);

// ─── Detail row ─────────────────────────────────────────────────────────────
const DetailRow = ({ label, value, isLast }) => (
  <div className={`flex justify-between items-baseline py-2.5 ${!isLast ? 'border-b border-neutral-100' : ''}`}>
    <span className="text-sm text-neutral-500">{label}</span>
    <span className="text-sm font-medium text-neutral-900 text-right max-w-[55%] truncate capitalize">{value}</span>
  </div>
);

const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: FiInstagram },
  { key: 'linkedin',  label: 'LinkedIn',  icon: FiLinkedin  },
  { key: 'facebook',  label: 'Facebook',  icon: FiFacebook  },
  { key: 'twitter',   label: 'Twitter',   icon: FiTwitter   },
];

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

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin" />
        <p className="text-sm text-neutral-500">Loading your profile…</p>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <FiUser className="w-8 h-8 text-primary-400" />
          </div>
          <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Set up your profile</h2>
          <p className="text-neutral-500 mb-6">
            Add your details and photos so potential matches can find you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/profile/edit"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 transition-colors shadow-burgundy"
            >
              <FiEdit2 className="w-4 h-4" />
              Edit profile
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-medium text-sm hover:bg-neutral-50 transition-colors"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Computed values ────────────────────────────────────────────────────────
  const age = profile.dateOfBirth
    ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()
    : null;
  const location = [profile.city, profile.state].filter(Boolean).join(', ') || null;
  const allPhotos = profile.profilePhoto
    ? [profile.profilePhoto, ...(profile.photos || []).filter((p) => p !== profile.profilePhoto)]
    : (profile.photos || []);
  const completionPct = profile.completionPercentage != null
    ? Number(profile.completionPercentage)
    : 0;
  const isVerified = profile.User?.Verification?.status === 'approved';
  const activeSocials = SOCIAL_PLATFORMS.filter((p) => profile.socialMediaLinks?.[p.key]);

  const detailRows = [
    age != null             && { label: 'Age',              value: `${age} years`    },
    location                && { label: 'Location',         value: location           },
    profile.height          && { label: 'Height',           value: `${profile.height} cm` },
    profile.education       && { label: 'Education',        value: profile.education  },
    profile.profession      && { label: 'Profession',       value: profile.profession },
    profile.diet            && { label: 'Diet',             value: profile.diet       },
    profile.smoking         && { label: 'Smoking',          value: profile.smoking    },
    profile.drinking        && { label: 'Drinking',         value: profile.drinking   },
    profile.personalityType && { label: 'Personality',      value: profile.personalityType },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Top navigation */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="text-primary-600 hover:text-primary-700 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            ← Dashboard
          </Link>
          <Link
            to="/profile/edit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 transition-colors shadow-burgundy"
          >
            <FiEdit2 className="w-3.5 h-3.5" />
            Edit profile
          </Link>
        </div>

        <p className="text-sm text-neutral-400 mb-6">
          This is exactly how your profile appears to potential matches.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Photos */}
            <div className="bg-white border border-neutral-100 rounded-2xl shadow-card overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-neutral-50">
                <h2 className="text-base font-semibold text-neutral-900">Photos</h2>
              </div>
              <div className="p-4">
                {allPhotos.length === 0 ? (
                  <div className="w-full h-56 bg-neutral-100 rounded-xl flex items-center justify-center">
                    <span className="text-5xl font-semibold text-neutral-300">
                      {profile.firstName?.[0] || '?'}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {allPhotos.slice(0, 6).map((photo, i) => {
                      const src = getImageUrl(photo, API_BASE_URL, 'full');
                      const alt = i === 0 ? profile.firstName : `${profile.firstName} ${i + 1}`;
                      return (
                        <button
                          key={photo}
                          type="button"
                          onClick={() => setLightbox({ open: true, src, alt })}
                          className={`block w-full rounded-xl border border-neutral-100 overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 transition-transform hover:scale-[1.02] ${
                            i === 0 ? 'sm:col-span-2 sm:row-span-2 h-64 sm:h-80' : 'h-44'
                          }`}
                        >
                          <img
                            src={src} alt={alt}
                            className="w-full h-full object-cover pointer-events-none"
                            loading="lazy" decoding="async"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <ImageLightbox
              src={lightbox.src} alt={lightbox.alt}
              open={lightbox.open}
              onClose={() => setLightbox((p) => ({ ...p, open: false }))}
            />

            {/* About */}
            <div className="bg-white border border-neutral-100 rounded-2xl shadow-card overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-neutral-50 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FiUser className="w-4 h-4 text-primary-400" />
                  <h2 className="text-base font-semibold text-neutral-900">
                    About {profile.firstName || 'you'}
                  </h2>
                </div>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-success-50 border border-success-100 text-success text-xs font-semibold rounded-full">
                    <FiCheck className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
              <div className="px-5 py-5">
                {profile.bio && (
                  <p className="text-neutral-700 mb-6 leading-relaxed text-sm">
                    {sanitizeText(profile.bio)}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {age != null && (
                    <div>
                      <p className="text-xs text-neutral-400 mb-0.5">Age</p>
                      <p className="text-sm font-medium text-neutral-900">{age} years</p>
                    </div>
                  )}
                  {location && (
                    <div>
                      <p className="text-xs text-neutral-400 mb-0.5 flex items-center gap-1">
                        <FiMapPin className="w-3 h-3" /> Location
                      </p>
                      <p className="text-sm font-medium text-neutral-900">{location}</p>
                    </div>
                  )}
                  {profile.education && (
                    <div className="mt-3">
                      <p className="text-xs text-neutral-400 mb-0.5 flex items-center gap-1">
                        <FiBook className="w-3 h-3" /> Education
                      </p>
                      <p className="text-sm font-medium text-neutral-900">{profile.education}</p>
                    </div>
                  )}
                  {profile.profession && (
                    <div className="mt-3">
                      <p className="text-xs text-neutral-400 mb-0.5 flex items-center gap-1">
                        <FiBriefcase className="w-3 h-3" /> Profession
                      </p>
                      <p className="text-sm font-medium text-neutral-900">{profile.profession}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Prompts */}
            {profile.profilePrompts && Object.keys(profile.profilePrompts).length > 0 && (() => {
              const pairs = Object.entries(profile.profilePrompts)
                .filter(([k]) => k.startsWith('prompt'))
                .map(([k, prompt]) => ({ prompt, answer: profile.profilePrompts[k.replace('prompt', 'answer')] }))
                .filter((p) => p.answer);
              return pairs.length > 0 ? (
                <Section title="Get to Know Me">
                  <div className="space-y-4">
                    {pairs.map(({ prompt, answer }, i) => (
                      <div key={i} className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                        <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide mb-1.5">
                          {sanitizeText(prompt)}
                        </p>
                        <p className="text-sm text-neutral-700 leading-relaxed">{sanitizeText(answer)}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null;
            })()}

            {/* Interest Tags */}
            {profile.interestTags?.length > 0 && (
              <Section title="Interests & Hobbies">
                <div className="flex flex-wrap gap-2">
                  {profile.interestTags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-xs font-medium border border-neutral-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Spotify */}
            {profile.spotifyPlaylist && sanitizeUrl(profile.spotifyPlaylist) && (
              <Section title="Music Taste" icon={FiMusic}>
                <a
                  href={sanitizeUrl(profile.spotifyPlaylist)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-primary-600 hover:bg-primary-50 hover:border-primary-200 transition-colors font-medium"
                >
                  Listen to my playlist →
                </a>
              </Section>
            )}

            {/* Social Media */}
            {activeSocials.length > 0 && (
              <Section title="Social Media">
                <div className="grid grid-cols-2 gap-3">
                  {activeSocials.map((platform) => {
                    const Icon = platform.icon;
                    const url = profile.socialMediaLinks[platform.key];
                    return (
                      <a
                        key={platform.key}
                        href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 border border-neutral-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-colors"
                      >
                        <Icon className="w-4 h-4 text-neutral-500" />
                        <span className="font-medium text-sm text-neutral-700">{platform.label}</span>
                      </a>
                    );
                  })}
                </div>
              </Section>
            )}
          </div>

          {/* ── Right column ─────────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Completion card */}
            <div className="bg-white border border-neutral-100 rounded-2xl shadow-card overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-neutral-50">
                <h3 className="text-base font-semibold text-neutral-900">Profile strength</h3>
              </div>
              <div className="px-5 py-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-500">Completion</span>
                  <span className="text-sm font-bold text-primary-600">{completionPct}%</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden mb-4">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPct}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                </div>
                {completionPct < 100 && (
                  <p className="text-xs text-neutral-400 mb-4">
                    {100 - completionPct}% more to unlock full visibility
                  </p>
                )}
                <Link
                  to="/profile/edit"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 transition-colors shadow-burgundy"
                >
                  <FiEdit2 className="w-3.5 h-3.5" />
                  Edit profile
                </Link>
              </div>
            </div>

            {/* Additional details */}
            {detailRows.length > 0 && (
              <Section title="Details">
                <div>
                  {detailRows.map((row, i) => (
                    <DetailRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      isLast={i === detailRows.length - 1}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* Languages */}
            {profile.languages?.length > 0 && (
              <Section title="Languages">
                <div className="flex flex-wrap gap-2">
                  {profile.languages.map((lang, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-700 font-medium"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfileView;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiEdit2, FiInstagram, FiLinkedin, FiFacebook, FiTwitter, FiMusic, FiCheck } from 'react-icons/fi';
import { API_BASE_URL } from '../utils/api';
import { getImageUrl } from '../utils/cloudinary';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize';
import { ImageLightbox } from '../components/ui/ImageLightbox';

const MyProfileView = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState({ open: false, src: null, alt: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/profile/me');
      setProfile(response.data.profile);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Set up your profile</h2>
          <p className="text-gray-600 mb-6">
            Add your details and photos so others can find you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/profile/edit"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
            >
              <FiEdit2 className="w-4 h-4" />
              Edit profile
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const socialPlatforms = [
    { key: 'instagram', label: 'Instagram', icon: FiInstagram },
    { key: 'linkedin', label: 'LinkedIn', icon: FiLinkedin },
    { key: 'facebook', label: 'Facebook', icon: FiFacebook },
    { key: 'twitter', label: 'Twitter', icon: FiTwitter },
  ];

  const age = profile.dateOfBirth
    ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()
    : null;
  const location = [profile.city, profile.state].filter(Boolean).join(', ') || null;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/dashboard"
            className="text-primary-600 hover:text-primary-700 inline-flex items-center gap-1.5 text-sm font-medium"
          >
            ← Dashboard
          </Link>
          <Link
            to="/profile/edit"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 transition-colors"
          >
            <FiEdit2 className="w-4 h-4" />
            Edit profile
          </Link>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          This is how your profile appears to others.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Photos & Basic Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo Gallery */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Photos</h2>
              {(() => {
                const allPhotos = profile.profilePhoto
                  ? [profile.profilePhoto, ...(profile.photos || []).filter((p) => p !== profile.profilePhoto)]
                  : (profile.photos || []);
                if (!allPhotos.length) {
                  return (
                    <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-5xl font-semibold border border-gray-300">
                      {profile.firstName?.[0] || '?'}
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {allPhotos.slice(0, 6).map((photo, index) => {
                      const fullUrl = getImageUrl(photo, API_BASE_URL, 'full');
                      const altText = index === 0 ? profile.firstName : `${profile.firstName} ${index + 1}`;
                      return (
                        <button
                          key={photo}
                          type="button"
                          onClick={() => setLightbox({ open: true, src: fullUrl, alt: altText })}
                          className={`block w-full text-left rounded-lg border border-gray-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${index === 0 ? 'sm:col-span-2 sm:row-span-2 h-64 sm:h-80' : 'h-48'}`}
                        >
                          <img
                            src={fullUrl}
                            alt={altText}
                            className="w-full h-full object-cover pointer-events-none"
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <ImageLightbox
              src={lightbox.src}
              alt={lightbox.alt}
              open={lightbox.open}
              onClose={() => setLightbox((p) => ({ ...p, open: false }))}
            />

            {/* Basic Info */}
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">About {profile.firstName || 'you'}</h2>
                {profile.User?.Verification?.status === 'approved' && (
                  <span className="trust-badge inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs font-medium">
                    <FiCheck className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
              {profile.bio && (
                <p className="text-gray-700 mb-6 leading-relaxed">{sanitizeText(profile.bio)}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                {age != null && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Age</p>
                    <p className="font-medium text-gray-900">{age} years</p>
                  </div>
                )}
                {location && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Location</p>
                    <p className="font-medium text-gray-900">{location}</p>
                  </div>
                )}
                {profile.height && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Height</p>
                    <p className="font-medium text-gray-900">{profile.height} cm</p>
                  </div>
                )}
                {profile.education && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Education</p>
                    <p className="font-medium text-gray-900">{profile.education}</p>
                  </div>
                )}
                {profile.profession && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Profession</p>
                    <p className="font-medium text-gray-900">{profile.profession}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Prompts */}
            {profile.profilePrompts && Object.keys(profile.profilePrompts).length > 0 && (
              <div className="card">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Get to Know Me</h2>
                <div className="space-y-4">
                  {Object.entries(profile.profilePrompts)
                    .filter(([key]) => key.startsWith('prompt'))
                    .map(([key, prompt]) => {
                      const answerKey = key.replace('prompt', 'answer');
                      const answer = profile.profilePrompts[answerKey];
                      if (!answer) return null;
                      return (
                        <div key={key} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="font-medium text-gray-900 mb-2">{sanitizeText(prompt)}</p>
                          <p className="text-gray-700 leading-relaxed">{sanitizeText(answer)}</p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Interest Tags */}
            {profile.interestTags && profile.interestTags.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Interests & Hobbies</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.interestTags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Spotify Playlist */}
            {profile.spotifyPlaylist && sanitizeUrl(profile.spotifyPlaylist) && (
              <div className="card">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-900">
                  <FiMusic className="w-5 h-5 text-gray-600" />
                  Music Taste
                </h2>
                <a
                  href={sanitizeUrl(profile.spotifyPlaylist)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 underline text-sm"
                >
                  Listen to my playlist →
                </a>
              </div>
            )}

            {/* Social Media Links */}
            {profile.socialMediaLinks && Object.values(profile.socialMediaLinks).some(Boolean) && (
              <div className="card">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Social Media</h2>
                <div className="grid grid-cols-2 gap-4">
                  {socialPlatforms.map((platform) => {
                    const Icon = platform.icon;
                    const url = profile.socialMediaLinks[platform.key];
                    if (!url) return null;
                    return (
                      <a
                        key={platform.key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-gray-700"
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium text-sm">{platform.label}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Edit CTA & Additional Details */}
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-3 text-gray-900">Profile completion</h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${profile.completionPercentage || 0}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 tabular-nums">
                  {profile.completionPercentage || 0}%
                </span>
              </div>
              <Link
                to="/profile/edit"
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 transition-colors"
              >
                <FiEdit2 className="w-4 h-4" />
                Edit profile
              </Link>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Additional Details</h3>
              <div className="space-y-3 text-sm">
                {profile.diet && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Diet</span>
                    <span className="font-medium text-gray-900 capitalize">{profile.diet}</span>
                  </div>
                )}
                {profile.smoking && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Smoking</span>
                    <span className="font-medium text-gray-900 capitalize">{profile.smoking}</span>
                  </div>
                )}
                {profile.drinking && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Drinking</span>
                    <span className="font-medium text-gray-900 capitalize">{profile.drinking}</span>
                  </div>
                )}
                {profile.languages && profile.languages.length > 0 && (
                  <div className="py-2 border-b border-gray-100">
                    <span className="text-gray-600 block mb-2">Languages</span>
                    <div className="flex flex-wrap gap-2">
                      {profile.languages.map((lang, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.personalityType && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Personality Type</span>
                    <span className="font-medium text-gray-900">{profile.personalityType}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfileView;

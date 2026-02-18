import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiHeart, FiStar, FiX, FiInstagram, FiLinkedin, FiFacebook, FiTwitter, FiMusic, FiLock, FiCheck } from 'react-icons/fi';
import CompatibilityMeter from '../components/matching/CompatibilityMeter';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../utils/api';
import { getImageUrl } from '../utils/cloudinary';
import { sanitizeText, sanitizeUrl } from '../utils/sanitize';

const ProfileDetail = () => {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [compatibilityScore, setCompatibilityScore] = useState(null);
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const response = await api.get(`/profile/${userId}`);
      setProfile(response.data.profile);
      setCompatibilityScore(response.data.compatibilityScore);
      setHasPremiumAccess(response.data.hasPremiumAccess);
      setIsLiked(response.data.isLiked || false);
      setIsShortlisted(response.data.isShortlisted || false);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleMatchAction = async (action) => {
    try {
      await api.post(`/match/${userId}`, { action });
      if (action === 'like') {
        setIsLiked(true);
        setIsShortlisted(false);
        toast.success('Profile liked!');
      } else if (action === 'shortlist') {
        setIsShortlisted(true);
        toast.success('Profile shortlisted!');
      }
    } catch (error) {
      toast.error('Failed to perform action');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Profile Not Found</h2>
          <Link to="/search" className="text-blue-600 hover:text-blue-700">
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  const socialPlatforms = [
    { key: 'instagram', label: 'Instagram', icon: FiInstagram, color: 'text-pink-600' },
    { key: 'linkedin', label: 'LinkedIn', icon: FiLinkedin, color: 'text-blue-600' },
    { key: 'facebook', label: 'Facebook', icon: FiFacebook, color: 'text-blue-700' },
    { key: 'twitter', label: 'Twitter', icon: FiTwitter, color: 'text-blue-400' }
  ];

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link to="/search" className="text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
            ← Back to Search
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Photos & Basic Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo Gallery */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Photos</h2>
              {profile.profilePhoto ? (
                <div className="grid grid-cols-2 gap-4">
                  <img
                    src={getImageUrl(profile.profilePhoto, API_BASE_URL, 'full')}
                    alt={profile.firstName}
                    className="w-full h-64 object-cover rounded-lg border border-gray-200"
                  />
                  {profile.photos && profile.photos.slice(0, 3).map((photo, index) => (
                    <img
                      key={index}
                      src={getImageUrl(photo, API_BASE_URL, 'full')}
                      alt={`${profile.firstName} ${index + 1}`}
                      className="w-full h-64 object-cover rounded-lg border border-gray-200"
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-5xl font-semibold border border-gray-300">
                  {profile.firstName[0]}
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">About {profile.firstName}</h2>
                {profile.User?.Verification?.status === 'approved' && (
                  <span className="trust-badge">
                    <FiCheck className="w-3 h-3" />
                    Verified Profile
                  </span>
                )}
              </div>
              {profile.bio && (
                <p className="text-gray-700 mb-6 leading-relaxed">{sanitizeText(profile.bio)}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Age</p>
                  <p className="font-medium text-gray-900">
                    {new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()} years
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Location</p>
                  <p className="font-medium text-gray-900">{profile.city}, {profile.state}</p>
                </div>
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
                  className="text-blue-600 hover:text-blue-700 underline text-sm"
                >
                  Listen to {sanitizeText(profile.firstName)}'s playlist →
                </a>
              </div>
            )}

            {/* Social Media Links (Premium Only) */}
            {hasPremiumAccess && profile.socialMediaLinks ? (
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
                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700"
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium text-sm">{platform.label}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ) : profile.socialMediaLinks && !hasPremiumAccess && (
              <div className="card border-2 border-dashed border-gray-300 bg-gray-50">
                <div className="text-center py-8">
                  <FiLock className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-2">
                    Social media links are available for Premium members
                  </p>
                  <Link to="/subscription" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                    Upgrade to Premium →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Compatibility & Actions */}
          <div className="space-y-6">
            {/* Compatibility Meter */}
            {compatibilityScore && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 text-center text-gray-900">Compatibility</h3>
                <CompatibilityMeter score={compatibilityScore} />
              </div>
            )}

            {/* Action Buttons */}
            <div className="card space-y-3">
              <button
                onClick={() => handleMatchAction('like')}
                disabled={isLiked}
                className={`w-full flex items-center justify-center gap-2 transition-all duration-200 ${
                  isLiked
                    ? 'bg-green-500 hover:bg-green-600 text-white cursor-default'
                    : 'btn-primary'
                }`}
              >
                {isLiked ? (
                  <>
                    <FiCheck className="w-4 h-4" />
                    Interest Expressed
                  </>
                ) : (
                  <>
                    <FiHeart className="w-4 h-4" />
                    Express Interest
                  </>
                )}
              </button>
              <button
                onClick={() => handleMatchAction('shortlist')}
                disabled={isShortlisted}
                className={`w-full flex items-center justify-center gap-2 transition-all duration-200 ${
                  isShortlisted
                    ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-default'
                    : 'btn-secondary'
                }`}
              >
                {isShortlisted ? (
                  <>
                    <FiCheck className="w-4 h-4" />
                    Profile Saved
                  </>
                ) : (
                  <>
                    <FiStar className="w-4 h-4" />
                    Save Profile
                  </>
                )}
              </button>
            </div>

            {/* Additional Info */}
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

export default ProfileDetail;




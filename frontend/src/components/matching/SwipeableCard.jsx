import React, { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { FiHeart, FiStar, FiX, FiInfo, FiCheck } from 'react-icons/fi';
import { formatCompatibilityScore } from '../../utils/compatibility';
import { API_BASE_URL } from '../../utils/api';
import { getImageUrl } from '../../utils/cloudinary';

const SwipeableCard = ({ profile, onSwipe, onLike, onShortlist, onPass, onViewDetails }) => {
  const [exitX, setExitX] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (event, info) => {
    if (Math.abs(info.offset.x) > 100) {
      setExitX(info.offset.x > 0 ? 200 : -200);
      if (onSwipe) {
        onSwipe(info.offset.x > 0 ? 'right' : 'left');
      }
    }
  };

  const compatibility = formatCompatibilityScore(profile.compatibilityScore);

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      animate={{ x: exitX, opacity: exitX !== 0 ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ x, rotate, opacity }}
      className="absolute w-full h-full"
    >
      <div className="card h-full flex flex-col overflow-hidden">
        {/* Photo Section */}
        <div className="relative h-96 bg-gray-200 overflow-hidden">
          {(profile.profilePhoto || profile.profile_photo) ? (
            <>
              <img
                src={getImageUrl(profile.profilePhoto || profile.profile_photo, API_BASE_URL, 'full')}
                alt={profile.firstName || 'Profile'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-5xl font-semibold border border-gray-300 bg-gray-100 hidden" aria-hidden="true">
                {profile.firstName?.[0]?.toUpperCase() || profile.lastName?.[0]?.toUpperCase() || '?'}
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-5xl font-semibold border border-gray-300">
              {profile.firstName?.[0]?.toUpperCase() || profile.lastName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          
          {/* Compatibility Badge */}
          {profile.compatibilityScore && (
            <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full ${compatibility.bg} ${compatibility.color} font-medium text-sm shadow-sm`}>
              {profile.compatibilityScore}% Match
            </div>
          )}

          {/* Verified Badge - Check if user has verification */}
          {profile.User?.Verification?.status === 'approved' && (
            <div className="absolute top-4 left-4 bg-green-600 text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-sm">
              <FiCheck className="w-3 h-3" />
              Verified
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="flex-1 p-6 flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {profile.firstName} {profile.lastName}
              </h3>
              <p className="text-gray-600 text-sm mt-0.5">{profile.city}</p>
            </div>
            <button
              onClick={onViewDetails}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="View details"
            >
              <FiInfo className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Quick Info */}
          <div className="space-y-1.5 mb-4 text-sm text-gray-600">
            {profile.education && <p>{profile.education}</p>}
            {profile.profession && <p>{profile.profession}</p>}
            {profile.height && <p>{profile.height} cm</p>}
          </div>

          {/* Interest Tags */}
          {profile.interestTags && profile.interestTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {profile.interestTags.slice(0, 5).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Profile Prompts Preview */}
          {profile.profilePrompts && Object.keys(profile.profilePrompts).length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              {Object.entries(profile.profilePrompts)
                .filter(([key]) => key.startsWith('prompt'))
                .slice(0, 1)
                .map(([key, prompt]) => {
                  const answerKey = key.replace('prompt', 'answer');
                  const answer = profile.profilePrompts[answerKey];
                  return (
                    <div key={key}>
                      <p className="text-xs font-medium text-gray-900 mb-1">{prompt}</p>
                      <p className="text-sm text-gray-700 line-clamp-2">{answer}</p>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-auto">
            <button
              onClick={onPass}
              className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <FiX className="w-4 h-4" />
              Pass
            </button>
            <button
              onClick={onShortlist}
              className="flex-1 py-2.5 px-4 bg-white border border-amber-300 text-amber-700 rounded-lg font-medium hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
            >
              <FiStar className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={onLike}
              className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <FiHeart className="w-4 h-4" />
              Interest
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeableCard;


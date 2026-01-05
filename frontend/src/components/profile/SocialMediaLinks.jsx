import React from 'react';
import { FiInstagram, FiLinkedin, FiFacebook, FiTwitter, FiLock } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const SocialMediaLinks = ({ links = {}, onChange, isPremium = false }) => {
  const socialPlatforms = [
    { key: 'instagram', label: 'Instagram', icon: FiInstagram, color: 'text-pink-600' },
    { key: 'linkedin', label: 'LinkedIn', icon: FiLinkedin, color: 'text-blue-600' },
    { key: 'facebook', label: 'Facebook', icon: FiFacebook, color: 'text-blue-700' },
    { key: 'twitter', label: 'Twitter', icon: FiTwitter, color: 'text-blue-400' }
  ];

  const handleChange = (platform, value) => {
    onChange({
      ...links,
      [platform]: value
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Social Media Links
        </label>
        {!isPremium && (
          <span className="text-xs text-purple-600 flex items-center gap-1">
            <FiLock className="w-3 h-3" />
            Premium Feature
          </span>
        )}
      </div>

      {!isPremium ? (
        <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
          <FiLock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-2">
            Social media links are available for Premium and Elite members
          </p>
          <p className="text-xs text-gray-500">
            Upgrade to share your social profiles and increase trust
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {socialPlatforms.map((platform) => {
            const Icon = platform.icon;
            return (
              <div key={platform.key} className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center ${platform.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">
                    {platform.label}
                  </label>
                  <input
                    type="url"
                    value={links[platform.key] || ''}
                    onChange={(e) => handleChange(platform.key, e.target.value)}
                    placeholder={`https://${platform.key}.com/yourprofile`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                  />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-gray-500 mt-2">
            Your social media links will only be visible to Premium and Elite members
          </p>
        </div>
      )}
    </div>
  );
};

export default SocialMediaLinks;




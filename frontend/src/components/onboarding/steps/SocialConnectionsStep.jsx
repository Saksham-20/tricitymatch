import React from 'react';
import { useOnboarding } from '../../../context/OnboardingContext';
import {
  FiInstagram, FiLinkedin, FiFacebook, FiTwitter, FiYoutube, FiLink, FiEye, FiUsers, FiEyeOff,
} from 'react-icons/fi';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: FiInstagram, color: '#E1306C', placeholder: '@handle or profile link' },
  { key: 'linkedin', label: 'LinkedIn', icon: FiLinkedin, color: '#0077B5', placeholder: 'linkedin.com/in/you' },
  { key: 'facebook', label: 'Facebook', icon: FiFacebook, color: '#1877F2', placeholder: 'facebook.com/you' },
  { key: 'twitter', label: 'X (Twitter)', icon: FiTwitter, color: '#1DA1F2', placeholder: '@handle' },
  { key: 'youtube', label: 'YouTube', icon: FiYoutube, color: '#FF0000', placeholder: 'Channel link' },
  { key: 'website', label: 'Website', icon: FiLink, color: '#8B2346', placeholder: 'yoursite.com' },
];

const VISIBILITY = [
  { value: 'everyone', label: 'Everyone', icon: FiEye },
  { value: 'matches_only', label: 'Matches only', icon: FiUsers },
  { value: 'hidden', label: 'Hidden', icon: FiEyeOff },
];

// Read a link entry that may be a legacy string or the new { url, visibility }.
const readEntry = (entry) => {
  if (!entry) return { url: '', visibility: 'matches_only' };
  if (typeof entry === 'string') return { url: entry, visibility: 'matches_only' };
  return { url: entry.url || '', visibility: entry.visibility || 'matches_only' };
};

/**
 * SocialConnectionsStep — member adds/edits social links with a per-link
 * visibility choice. Display-only links (no ownership proof); they add
 * credibility and visibility, they are not a verification tier.
 */
export default function SocialConnectionsStep() {
  const { formData, updateFormData } = useOnboarding();
  const links = formData.socialMediaLinks || {};

  const setLink = (key, patch) => {
    const current = readEntry(links[key]);
    const nextEntry = { ...current, ...patch };
    const next = { ...links };
    if (!nextEntry.url || !nextEntry.url.trim()) {
      // Empty url → drop the whole entry so we don't persist blank links.
      delete next[key];
    } else {
      next[key] = nextEntry;
    }
    updateFormData('socialMediaLinks', next);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">Social Connections</h2>
      <p className="text-neutral-500 mb-6 text-sm">
        Add your social profiles to look more real and approachable. Optional — you
        choose who sees each one. These are shown as links only; we never post or
        read anything.
      </p>

      <div className="space-y-4">
        {PLATFORMS.map(({ key, label, icon: Icon, color, placeholder }) => {
          const { url, visibility } = readEntry(links[key]);
          return (
            <div key={key} className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{label}</span>
              </div>

              <input
                type="text"
                value={url}
                onChange={(e) => setLink(key, { url: e.target.value })}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all"
              />

              {url.trim() && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {VISIBILITY.map(({ value, label: vLabel, icon: VIcon }) => {
                    const active = visibility === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLink(key, { visibility: value })}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          active
                            ? 'border-primary-400 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <VIcon className="w-3.5 h-3.5" /> {vLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-neutral-400 mt-5">
        Default visibility is <span className="font-semibold">Matches only</span>. Set a link to
        <span className="font-semibold"> Hidden</span> to keep it just for you.
      </p>
    </div>
  );
}

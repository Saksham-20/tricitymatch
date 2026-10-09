import React from 'react';
import { motion } from 'framer-motion';
import { Trans, useTranslation } from 'react-i18next';
import { useOnboarding } from '../../../context/OnboardingContext';
import {
  FiInstagram, FiLinkedin, FiFacebook, FiTwitter, FiYoutube, FiLink, FiUsers, FiEyeOff, FiMusic,
} from 'react-icons/fi';
import { staggerContainer, fadeRise } from '../../../utils/animations';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: FiInstagram, color: '#E1306C', placeholder: '@handle or profile link', placeholderKey: 'handleOrLink' },
  { key: 'linkedin', label: 'LinkedIn', icon: FiLinkedin, color: '#0077B5', placeholder: 'linkedin.com/in/you' },
  { key: 'facebook', label: 'Facebook', icon: FiFacebook, color: '#1877F2', placeholder: 'facebook.com/you' },
  { key: 'twitter', label: 'X (Twitter)', icon: FiTwitter, color: '#1DA1F2', placeholder: '@handle', placeholderKey: 'handle' },
  { key: 'youtube', label: 'YouTube', icon: FiYoutube, color: '#FF0000', placeholder: 'Channel link', placeholderKey: 'channelLink' },
  { key: 'website', label: 'Website', labelKey: 'website', icon: FiLink, color: '#8B2346', placeholder: 'yoursite.com' },
];

// No "Everyone": a social link is a way to reach someone off the site, so it
// is shown only to mutual matches (the server applies the same rule).
const VISIBILITY = [
  { value: 'matches_only', label: 'Matches only', icon: FiUsers },
  { value: 'hidden', label: 'Hidden', icon: FiEyeOff },
];

// Read a link entry that may be a legacy string or the new { url, visibility }.
const readEntry = (entry) => {
  if (!entry) return { url: '', visibility: 'matches_only' };
  if (typeof entry === 'string') return { url: entry, visibility: 'matches_only' };
  return { url: entry.url || '', visibility: entry.visibility === 'hidden' ? 'hidden' : 'matches_only' };
};

/**
 * SocialConnectionsStep — member adds/edits social links with a per-link
 * visibility choice. Display-only links (no ownership proof); they add
 * credibility and visibility, they are not a verification tier.
 */
export default function SocialConnectionsStep() {
  const { t } = useTranslation();
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
    <motion.div className="max-w-2xl mx-auto" initial="initial" animate="animate" variants={staggerContainer}>
      {/* No in-body <h2> — the editor stepper already labels this section, and a
          second heading duplicated it. */}
      <p className="text-neutral-500 mb-6 text-sm">
        {t('onboarding.social.intro')}
      </p>

      {/* Spotify playlist — surfaced on the profile as a "my vibe" link. */}
      <motion.div variants={fadeRise} className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 mb-4">
        <label htmlFor="social-spotify" className="flex items-center gap-2 mb-2.5 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          <FiMusic className="w-4 h-4 flex-shrink-0" style={{ color: '#1DB954' }} />
          {t('onboarding.social.spotify')}
        </label>
        <input
          id="social-spotify"
          type="url"
          inputMode="url"
          autoComplete="off"
          value={formData.spotifyPlaylist || ''}
          onChange={(e) => updateFormData('spotifyPlaylist', e.target.value)}
          placeholder="open.spotify.com/playlist/…"
          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-colors duration-[160ms]"
        />
      </motion.div>

      <motion.div variants={fadeRise} className="space-y-4">
        {PLATFORMS.map(({ key, label, labelKey, icon: Icon, color, placeholder, placeholderKey }) => {
          const { url, visibility } = readEntry(links[key]);
          return (
            <div key={key} className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{labelKey ? t(`onboarding.social.${labelKey}`) : label}</span>
              </div>

              <input
                type="text"
                value={url}
                onChange={(e) => setLink(key, { url: e.target.value })}
                placeholder={placeholderKey ? t(`onboarding.social.${placeholderKey}`) : placeholder}
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-colors duration-[160ms]"
              />

              {url.trim() && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {VISIBILITY.map(({ value, label: vLabel, icon: VIcon }) => {
                    const active = visibility === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setLink(key, { visibility: value })}
                        className={`inline-flex items-center gap-1.5 px-2.5 min-h-[2.75rem] rounded-lg text-xs font-medium border transition-colors duration-[160ms] active:scale-[0.97] ${
                          active
                            ? 'border-primary-400 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <VIcon className="w-3.5 h-3.5" /> {t(`profileOptions.socialVisibility.${value}`, { defaultValue: vLabel })}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      <p className="text-xs text-neutral-400 mt-5">
        <Trans i18nKey="onboarding.social.footer" components={{ b: <span className="font-semibold" /> }} />
      </p>
    </motion.div>
  );
}

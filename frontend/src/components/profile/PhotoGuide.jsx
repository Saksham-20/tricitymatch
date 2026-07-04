import React from 'react';
import { FiUser, FiSun, FiSmile, FiUsers, FiEyeOff, FiSliders, FiCheck, FiX } from 'react-icons/fi';

/**
 * Visual DO/DON'T photo guide (benchmark: both Shaadi & Jeevansathi ship an
 * example grid; ours was a text-only bullet list). Icon tiles keep it
 * asset-free while still scanning visually instead of reading.
 */
const TILES = [
  { good: true,  icon: FiUser,   label: 'Clear, recent photo of just you' },
  { good: true,  icon: FiSun,    label: 'Bright, natural lighting' },
  { good: true,  icon: FiSmile,  label: 'Face visible, natural smile' },
  { good: false, icon: FiUsers,  label: 'Group photos' },
  { good: false, icon: FiEyeOff, label: 'Sunglasses or side profile' },
  { good: false, icon: FiSliders, label: 'Heavy filters or editing' },
];

const PhotoGuide = ({ className = '' }) => (
  <div className={className}>
    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-3">
      What makes a great profile photo
    </p>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {TILES.map(({ good, icon: Icon, label }) => (
        <div
          key={label}
          className="relative flex flex-col items-center gap-2 px-3 py-4 rounded-xl border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-center"
        >
          <span
            className={`absolute top-2 right-2 w-[18px] h-[18px] rounded-full flex items-center justify-center ${
              good ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
            }`}
            aria-label={good ? 'Do' : "Don't"}
          >
            {good ? <FiCheck className="w-3 h-3" /> : <FiX className="w-3 h-3" />}
          </span>
          <Icon className={`w-6 h-6 ${good ? 'text-primary-500' : 'text-neutral-300 dark:text-neutral-600'}`} />
          <span className="text-[11px] leading-snug text-neutral-600 dark:text-neutral-300">{label}</span>
        </div>
      ))}
    </div>
    <p className="text-xs text-neutral-400 mt-2.5">
      Profiles with a clear photo get many more responses.
    </p>
  </div>
);

export default PhotoGuide;

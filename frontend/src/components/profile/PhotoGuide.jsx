import React from 'react';
import { useTranslation } from 'react-i18next';
import { FiUser, FiSun, FiSmile, FiUsers, FiEyeOff, FiSliders, FiCheck, FiX } from 'react-icons/fi';

/**
 * Visual DO/DON'T photo guide (benchmark: both Shaadi & Jeevansathi ship an
 * example grid; ours was a text-only bullet list). Icon tiles keep it
 * asset-free while still scanning visually instead of reading.
 */
const TILES = [
  { good: true,  icon: FiUser,   key: 'clearRecent' },
  { good: true,  icon: FiSun,    key: 'brightLight' },
  { good: true,  icon: FiSmile,  key: 'faceVisible' },
  { good: false, icon: FiUsers,  key: 'groupPhotos' },
  { good: false, icon: FiEyeOff, key: 'sunglasses' },
  { good: false, icon: FiSliders, key: 'filters' },
];

const PhotoGuide = ({ className = '' }) => {
  const { t } = useTranslation();
  return (
  <div className={className}>
    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-3">
      {t('photos.guide.title')}
    </p>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {TILES.map(({ good, icon: Icon, key }) => (
        <div
          key={key}
          className="relative flex flex-col items-center gap-2 px-3 py-4 rounded-xl border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-center"
        >
          <span
            className={`absolute top-2 right-2 w-[18px] h-[18px] rounded-full flex items-center justify-center ${
              good ? 'bg-success-50 text-success' : 'bg-destructive-light text-destructive'
            }`}
            aria-label={good ? t('photos.guide.do') : t('photos.guide.dont')}
          >
            {good ? <FiCheck className="w-3 h-3" /> : <FiX className="w-3 h-3" />}
          </span>
          <Icon className={`w-6 h-6 ${good ? 'text-primary-500' : 'text-neutral-300 dark:text-neutral-600'}`} />
          <span className="text-[11px] leading-snug text-neutral-600 dark:text-neutral-300">{t(`photos.guide.${key}`)}</span>
        </div>
      ))}
    </div>
    <p className="text-xs text-neutral-400 mt-2.5">
      {t('photos.guide.footer')}
    </p>
  </div>
  );
};

export default PhotoGuide;

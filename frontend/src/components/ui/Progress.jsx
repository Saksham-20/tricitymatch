import React from 'react';
import { useTranslation } from 'react-i18next';

const Progress = ({ value = 0, max = 100, showLabel = true, label }) => {
  const { t } = useTranslation();
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const rounded = Math.round(percentage);

  return (
    <div className="w-full">
      <div
        className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || t('ui.progress')}
      >
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-[width] duration-300 ease-[var(--ease-in-out)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 text-center tabular-nums">
          {rounded}%
        </p>
      )}
    </div>
  );
};

export default Progress;

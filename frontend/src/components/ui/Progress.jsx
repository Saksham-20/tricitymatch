import React from 'react';

const Progress = ({ value = 0, max = 100, showLabel = true }) => {
  const percentage = (value / max) * 100;

  return (
    <div className="w-full">
      <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-neutral-600 mt-1 text-center">
          {Math.round(percentage)}%
        </p>
      )}
    </div>
  );
};

export default Progress;

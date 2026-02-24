import React from 'react';
import { motion } from 'framer-motion';
import { formatCompatibilityScore } from '../../utils/compatibility';

const CompatibilityMeter = ({ score, breakdown = null }) => {
  const compatibility = formatCompatibilityScore(score);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  // Map compatibility color class to a hex for breakdown bars
  const barColor =
    score >= 85 ? '#2E7D32' :
    score >= 65 ? '#C9A227' :
    '#8B2346';

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Circular progress */}
      <div className="relative w-32 h-32">
        <svg className="transform -rotate-90 w-32 h-32">
          <circle
            cx="64" cy="64" r="45"
            stroke="currentColor" strokeWidth="8" fill="none"
            className="text-neutral-200"
          />
          <motion.circle
            cx="64" cy="64" r="45"
            stroke="currentColor" strokeWidth="8" fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={compatibility.color.replace('text-', 'stroke-')}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className={`text-3xl font-bold ${compatibility.color}`}
            >
              {score}%
            </motion.div>
            <div className={`text-xs font-semibold ${compatibility.color}`}>
              {compatibility.text}
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown bars */}
      {breakdown && (
        <div className="w-full space-y-2.5">
          {Object.entries(breakdown).map(([category, value]) => (
            <div key={category} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 capitalize">{category}</span>
                <span className="font-semibold text-neutral-800">{value}%</span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="h-2 rounded-full"
                  style={{ backgroundColor: barColor }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompatibilityMeter;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown, FiChevronUp, FiCheck, FiCamera, FiUser, FiBook, FiBriefcase, FiHeart } from 'react-icons/fi';

/**
 * ProfileCompletionMeter
 *
 * Shows a horizontal progress bar with percentage + expandable tips.
 *
 * Usage:
 *   <ProfileCompletionMeter profile={profile} />
 *
 * @param {Object} profile — user profile data
 */
const ProfileCompletionMeter = ({ profile = {} }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  // Tasks mirror the backend's calculateCompletion() logic exactly.
  // Each task shows users what they need to fill to increase their score.
  const tasks = [
    {
      id:     'photo',
      icon:   FiCamera,
      label:  'Add a profile photo',
      points: 10,
      done:   !!(profile.profilePhoto || profile.profile_photo),
    },
    {
      id:     'bio',
      icon:   FiUser,
      label:  'Write about yourself (20+ characters)',
      points: 10,
      done:   !!(profile.bio && profile.bio.trim().length >= 20),
    },
    {
      id:     'career',
      icon:   FiBriefcase,
      label:  'Add education & career details',
      points: 15,
      done:   !!(profile.education && profile.profession),
    },
    {
      id:     'physical',
      icon:   FiUser,
      label:  'Add height & weight',
      points: 10,
      done:   !!(profile.height && profile.weight),
    },
    {
      id:     'lifestyle',
      icon:   FiHeart,
      label:  'Set lifestyle preferences (diet, smoking, drinking)',
      points: 5,
      done:   !!(profile.diet || profile.smoking || profile.drinking),
    },
    {
      id:     'interests',
      icon:   FiBook,
      label:  'Add your interests & hobbies',
      points: 3,
      done:   !!(profile.interestTags && profile.interestTags.length > 0),
    },
  ];

  // Local fallback percentage (mirrors backend weights, capped at 100)
  const earned       = tasks.filter(t => t.done).reduce((s, t) => s + t.points, 0);
  const localPercent = Math.min(100, Math.round((earned / 53) * 100)); // 53 = sum of above points

  // Always prefer the backend's authoritative completionPercentage
  const backendPct = (profile.completionPercentage != null && !isNaN(Number(profile.completionPercentage)))
    ? Number(profile.completionPercentage)
    : null;
  const percent = backendPct !== null ? backendPct : localPercent;
  const pending = tasks.filter(t => !t.done);

  const barColor =
    percent >= 80 ? '#2E7D32' :
    percent >= 50 ? '#C9A227' :
    '#8B2346';

  const label =
    percent === 100 ? 'Profile Complete!' :
    percent >= 80   ? 'Almost there!'     :
    percent >= 50   ? 'Looking good'      :
    'Complete your profile';

  if (percent === 100) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-success-50 border border-success-100 rounded-2xl">
        <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center flex-shrink-0">
          <FiCheck className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-success">Profile 100% Complete</p>
          <p className="text-xs text-success-600">You're getting more matches now!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-100 rounded-2xl shadow-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors text-left"
        aria-expanded={expanded}
      >
        {/* Circular mini indicator */}
        <div className="relative w-10 h-10 flex-shrink-0">
          <svg width={40} height={40} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={20} cy={20} r={16} fill="none" stroke="#F5F5F5" strokeWidth={3.5} />
            <motion.circle
              cx={20} cy={20} r={16}
              fill="none"
              stroke={barColor}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 16}
              initial={{ strokeDashoffset: 2 * Math.PI * 16 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 16 * (1 - percent / 100) }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold" style={{ color: barColor }}>{percent}%</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-800">{label}</p>
          {pending.length > 0 && (
            <p className="text-xs text-neutral-400 mt-0.5">
              {pending.length} step{pending.length > 1 ? 's' : ''} left to boost visibility
            </p>
          )}
        </div>

        <div className="flex-shrink-0 text-neutral-400">
          {expanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            className="h-full rounded-full"
            style={{ backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* Expanded tips */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-neutral-100 pt-3 space-y-2.5">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                What to complete
              </p>
              {tasks.map((task) => {
                const Icon = task.icon;
                return (
                  <div
                    key={task.id}
                    onClick={() => !task.done && navigate('/profile/edit')}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                      task.done
                        ? 'bg-success-50 opacity-60'
                        : 'bg-neutral-50 hover:bg-primary-50 cursor-pointer'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        task.done ? 'bg-success text-white' : 'bg-white border border-neutral-200 text-primary-500'
                      }`}
                    >
                      {task.done ? <FiCheck className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.done ? 'line-through text-neutral-400' : 'text-neutral-700'}`}>
                        {task.label}
                      </p>
                    </div>
                    {!task.done && (
                      <span className="text-[10px] font-bold text-primary-400 flex-shrink-0">
                        +{task.points}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileCompletionMeter;

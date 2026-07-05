import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiCheck, FiCamera, FiUser, FiBook, FiBriefcase,
  FiHeart, FiMapPin, FiChevronDown, FiChevronUp,
  FiAlertCircle, FiArrowRight,
} from 'react-icons/fi';

// ─── Field definitions — mirrors backend calculateCompletion exactly ─────────
// "important" = required (35%) + important (50%) fields only. "optional" = the 15%.
// hideThreshold: when ALL important fields done → hide from dashboard, show success.

// Map each completion field to the editor section that collects it, so a nudge
// deep-links straight to the right step instead of dumping the user on Basic Info.
const FIELD_SECTION = {
  firstName: 'basic', lastName: 'basic', gender: 'basic', dateOfBirth: 'basic',
  height: 'basic', weight: 'basic', city: 'location', profilePhoto: 'photos',
  bio: 'about', education: 'education', profession: 'education',
  religion: 'religion', motherTongue: 'religion', maritalStatus: 'marital',
  lifestyle: 'lifestyle',
};
const editLink = (id) => `/profile/edit${FIELD_SECTION[id] ? `?section=${FIELD_SECTION[id]}` : ''}`;

const getFields = (p) => [
  // Required (35%)
  {
    id: 'firstName',
    label: 'First name',
    group: 'required',
    points: 7,
    done: !!(p.firstName?.trim()),
    icon: FiUser,
    tip: null, // always filled (set during signup)
  },
  {
    id: 'lastName',
    label: 'Last name',
    group: 'required',
    points: 7,
    done: !!(p.lastName?.trim()),
    icon: FiUser,
    tip: null,
  },
  {
    id: 'gender',
    label: 'Gender',
    group: 'required',
    points: 7,
    done: !!(p.gender),
    icon: FiUser,
    tip: null,
  },
  {
    id: 'dateOfBirth',
    label: 'Date of birth',
    group: 'required',
    points: 7,
    done: !!(p.dateOfBirth),
    icon: FiUser,
    tip: null,
  },
  {
    id: 'city',
    label: 'City',
    group: 'required',
    points: 7,
    done: !!(p.city?.trim()),
    icon: FiMapPin,
    tip: null,
  },
  // Important (50%)
  {
    id: 'profilePhoto',
    label: 'Profile photo',
    group: 'important',
    points: 10,
    done: !!(p.profilePhoto),
    icon: FiCamera,
    tip: 'Profiles with photos get 8x more views',
  },
  {
    id: 'bio',
    label: 'Write about yourself',
    cta: 'Write about yourself',
    group: 'important',
    points: 8,
    done: !!(p.bio && p.bio.trim().length >= 20),
    icon: FiUser,
    tip: 'A short bio helps matches connect with you',
  },
  {
    id: 'education',
    label: 'Education',
    group: 'important',
    points: 6,
    done: !!(p.education?.trim()),
    icon: FiBook,
    tip: null,
  },
  {
    id: 'profession',
    label: 'Profession',
    group: 'important',
    points: 6,
    done: !!(p.profession?.trim()),
    icon: FiBriefcase,
    tip: null,
  },
  {
    id: 'height',
    label: 'Height',
    group: 'important',
    points: 4,
    done: !!(p.height),
    icon: FiUser,
    tip: null,
  },
  {
    id: 'weight',
    label: 'Weight',
    group: 'important',
    points: 4,
    done: !!(p.weight),
    icon: FiUser,
    tip: null,
  },
  {
    id: 'religion',
    label: 'Religion',
    group: 'important',
    points: 3,
    done: !!(p.religion?.trim()),
    icon: FiHeart,
    tip: null,
  },
  {
    id: 'maritalStatus',
    label: 'Marital status',
    group: 'important',
    points: 2,
    done: !!(p.maritalStatus),
    icon: FiHeart,
    tip: null,
  },
  {
    id: 'motherTongue',
    label: 'Mother tongue',
    group: 'important',
    points: 3,
    done: !!(p.motherTongue?.trim()),
    icon: FiUser,
    tip: null,
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle preferences',
    group: 'important',
    points: 4,
    done: !!(p.diet || p.smoking || p.drinking),
    icon: FiHeart,
    tip: 'Add diet, smoking & drinking preferences',
  },
];

// Total important points = 35 (required) + 50 (important) = 85
const IMPORTANT_TOTAL = 85;
// Hide dashboard banner when all important fields done
const HIDE_THRESHOLD = IMPORTANT_TOTAL;

export const getCompletionData = (profile = {}) => {
  const fields = getFields(profile);
  const importantFields = fields.filter(f => f.group === 'required' || f.group === 'important');
  const pending = importantFields.filter(f => !f.done);
  const earnedImportant = importantFields.filter(f => f.done).reduce((s, f) => s + f.points, 0);
  const allImportantDone = pending.length === 0;

  // Use backend percentage if available, else compute locally (total 100pts)
  const backendPct = (profile.completionPercentage != null && !isNaN(Number(profile.completionPercentage)))
    ? Number(profile.completionPercentage)
    : null;

  // Local fallback: important score / 85 * 85, capped (optional fields add the remaining 15)
  const localPct = Math.min(100, Math.round((earnedImportant / IMPORTANT_TOTAL) * IMPORTANT_TOTAL));
  const percent = backendPct !== null ? backendPct : localPct;

  return { fields, importantFields, pending, allImportantDone, percent };
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard variant: compact banner, hidden when all important fields done
// ─────────────────────────────────────────────────────────────────────────────
export const DashboardCompletionBanner = ({ profile = {} }) => {
  const { pending, allImportantDone, percent } = getCompletionData(profile);
  const [expanded, setExpanded] = useState(false);

  // Hide entirely when all important fields done
  if (allImportantDone) return null;

  const topMissing = pending.slice(0, 3);
  const remaining = pending.length;

  const barColor = percent >= 70 ? '#2E7D32' : percent >= 45 ? '#C9A227' : '#8B2346';
  const bgColor  = percent >= 70 ? 'bg-success-50 border-success-100' : percent >= 45 ? 'bg-gold-50 border-gold-100' : 'bg-primary-50 border-primary-100';
  const textColor = percent >= 70 ? 'text-success' : percent >= 45 ? 'text-gold-700' : 'text-primary-700';

  return (
    <div className={`rounded-2xl border overflow-hidden ${bgColor}`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:brightness-95 transition-all text-left cursor-pointer"
        aria-expanded={expanded}
      >
        {/* Mini ring */}
        <div className="relative w-10 h-10 flex-shrink-0">
          <svg width={40} height={40} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={20} cy={20} r={15} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={3} />
            <motion.circle
              cx={20} cy={20} r={15}
              fill="none" stroke={barColor} strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 15}
              initial={{ strokeDashoffset: 2 * Math.PI * 15 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 15 * (1 - percent / 100) }}
              transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black" style={{ color: barColor }}>{percent}%</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${textColor}`}>
            {remaining} field{remaining !== 1 ? 's' : ''} missing — complete your profile
          </p>
          <p className="text-xs text-neutral-500 mt-0.5 truncate">
            {topMissing.map(f => f.label).join(', ')}{remaining > 3 ? ` +${remaining - 3} more` : ''}
          </p>
        </div>

        <div className={`flex-shrink-0 ${textColor} opacity-60`}>
          {expanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.1 }}
            className="h-full rounded-full"
            style={{ backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* Expanded field list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-black/5 pt-3">
              {pending.map(field => {
                const Icon = field.icon;
                return (
                  <Link
                    key={field.id}
                    to={editLink(field.id)}
                    className="flex items-center gap-3 p-2.5 bg-white/70 rounded-xl hover:bg-white transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-700">{field.label}</p>
                      {field.tip && <p className="text-xs text-neutral-400 mt-0.5">{field.tip}</p>}
                    </div>
                    <FiArrowRight className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                  </Link>
                );
              })}
              <Link
                to="/profile/edit"
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer mt-1 ${
                  percent >= 70 ? 'bg-success text-white hover:bg-success-600'
                  : percent >= 45 ? 'bg-gold text-neutral-900 hover:brightness-95'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                Complete Profile
                <FiArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MyProfileView variant: always shown, smart nudges per missing field
// Renders as individual actionable cards for what's missing
// ─────────────────────────────────────────────────────────────────────────────
export const ProfileStrengthPanel = ({ profile = {} }) => {
  const { pending, allImportantDone, percent } = getCompletionData(profile);

  const barColor = percent >= 85 ? '#2E7D32' : percent >= 60 ? '#C9A227' : '#8B2346';
  const label = percent >= 85 ? 'Strong profile' : percent >= 60 ? 'Almost complete' : 'Needs attention';
  const labelClass = percent >= 85 ? 'bg-success-50 text-success'
    : percent >= 60 ? 'bg-gold-50 text-gold-700'
    : 'bg-primary-50 text-primary-700';

  if (allImportantDone) {
    return (
      <div className="bg-success-50 border border-success-100 rounded-2xl px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-success flex items-center justify-center flex-shrink-0">
          <FiCheck className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-success">Profile complete</p>
          <p className="text-xs text-success/80 mt-0.5">You're appearing in full search results</p>
        </div>
        <span className="text-xl font-black text-success">{percent}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress bar card */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-neutral-800">Profile strength</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${labelClass}`}>{label}</span>
          </div>
          <span className="text-lg font-black" style={{ color: barColor }}>{percent}%</span>
        </div>
        <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden mb-2">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: barColor }}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-neutral-400">
          {pending.length} important field{pending.length !== 1 ? 's' : ''} missing · complete them to appear in more searches
        </p>
      </div>

      {/* Per-field nudge cards */}
      {pending.map(field => {
        const Icon = field.icon;
        return (
          <Link
            key={field.id}
            to={editLink(field.id)}
            className="flex items-center gap-3 bg-white border border-neutral-100 rounded-2xl shadow-sm px-4 py-3.5 hover:border-primary-200 hover:bg-primary-50/40 transition-all group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
              <FiAlertCircle className="w-4 h-4 text-primary-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-neutral-700 group-hover:text-primary-600 transition-colors">
                {field.cta || `Add ${field.label.toLowerCase()}`}
              </p>
              {field.tip && (
                <p className="text-xs text-neutral-400 mt-0.5">{field.tip}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs font-bold text-primary-500">+{field.points}%</span>
              <FiArrowRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-primary-500 transition-colors" />
            </div>
          </Link>
        );
      })}
    </div>
  );
};

// ─── Default export: legacy full meter (kept for compatibility) ──────────────
const ProfileCompletionMeter = ({ profile = {} }) => {
  return <DashboardCompletionBanner profile={profile} />;
};

export default ProfileCompletionMeter;

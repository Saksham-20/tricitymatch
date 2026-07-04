import React from 'react';
import { FiCheck, FiX, FiMinus, FiHeart } from 'react-icons/fi';

/**
 * Reverse partner-preference checklist — "You match X of N of their
 * preferences". Takes the TARGET's stated partner preferences and checks each
 * one against the VIEWER's own profile, line by line. (Benchmark: Jeevansathi's
 * standout profile-detail panel; the data already existed on the Profile model,
 * only this UI was missing.)
 *
 * Each item: ok=true (green check), ok=false (miss), ok=null (viewer hasn't
 * filled that field — neutral, excluded from the score denominator).
 */
const ageFromDob = (dob) => {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (365.25 * 24 * 60 * 60 * 1000));
};

const cmToFeet = (cm) => {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
};

const looseMatch = (pref, own) =>
  String(own).toLowerCase().includes(String(pref).toLowerCase()) ||
  String(pref).toLowerCase().includes(String(own).toLowerCase());

export const buildPreferenceChecks = (target, viewer) => {
  if (!target || !viewer) return [];
  const checks = [];

  if (target.preferredAgeMin || target.preferredAgeMax) {
    const age = ageFromDob(viewer.dateOfBirth);
    const min = target.preferredAgeMin, max = target.preferredAgeMax;
    checks.push({
      label: 'Age',
      want: `${min || '—'} – ${max || '—'} years`,
      ok: age == null ? null : (!min || age >= min) && (!max || age <= max),
    });
  }

  if (target.preferredHeightMin || target.preferredHeightMax) {
    const h = viewer.height;
    const min = target.preferredHeightMin, max = target.preferredHeightMax;
    checks.push({
      label: 'Height',
      want: `${min ? cmToFeet(min) : '—'} – ${max ? cmToFeet(max) : '—'}`,
      ok: !h ? null : (!min || h >= min) && (!max || h <= max),
    });
  }

  if (target.preferredEducation) {
    checks.push({
      label: 'Education',
      want: target.preferredEducation,
      ok: !viewer.education ? null : looseMatch(target.preferredEducation, viewer.education),
    });
  }

  if (target.preferredProfession) {
    checks.push({
      label: 'Profession',
      want: target.preferredProfession,
      ok: !viewer.profession ? null : looseMatch(target.preferredProfession, viewer.profession),
    });
  }

  const cities = Array.isArray(target.preferredCity)
    ? target.preferredCity.filter(Boolean)
    : target.preferredCity ? [target.preferredCity] : [];
  if (cities.length > 0) {
    checks.push({
      label: 'City',
      want: cities.join(', '),
      ok: !viewer.city ? null : cities.some((c) => looseMatch(c, viewer.city)),
    });
  }

  return checks;
};

const PreferenceMatch = ({ target, viewer, targetName = 'them' }) => {
  const checks = buildPreferenceChecks(target, viewer);
  if (checks.length === 0) return null;

  const scored = checks.filter((c) => c.ok !== null);
  const matched = scored.filter((c) => c.ok).length;

  return (
    <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-neutral-50 dark:border-neutral-800 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          <FiHeart className="w-3.5 h-3.5 text-primary-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
            Do you fit what {targetName} is looking for?
          </h2>
        </div>
        {scored.length > 0 && (
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
            matched === scored.length
              ? 'bg-green-100 text-green-700'
              : matched > 0
              ? 'bg-primary-50 text-primary-700 border border-primary-100'
              : 'bg-neutral-100 text-neutral-500'
          }`}>
            {matched}/{scored.length}
          </span>
        )}
      </div>
      <div className="px-5 py-2">
        {checks.map(({ label, want, ok }) => (
          <div key={label} className="flex items-center gap-3 py-2.5 border-b border-neutral-50 dark:border-neutral-800 last:border-b-0">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              ok === true ? 'bg-green-100 text-green-600'
              : ok === false ? 'bg-neutral-100 text-neutral-400'
              : 'bg-neutral-50 text-neutral-300'
            }`}>
              {ok === true ? <FiCheck className="w-3 h-3" /> : ok === false ? <FiX className="w-3 h-3" /> : <FiMinus className="w-3 h-3" />}
            </span>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide w-20 flex-shrink-0">{label}</span>
            <span className="text-sm text-neutral-700 dark:text-neutral-300 capitalize flex-1 min-w-0 truncate">{want}</span>
            {ok === null && <span className="text-[11px] text-neutral-400 flex-shrink-0">add yours to compare</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PreferenceMatch;

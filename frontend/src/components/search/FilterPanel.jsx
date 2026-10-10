import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import SavedSearches from './SavedSearches';
import { CASTE_OPTIONS, PROFESSION_GROUPS } from '../../constants/profileOptions';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiFilter, FiX, FiMapPin, FiBriefcase, FiBook, FiCalendar,
  FiChevronDown, FiSearch, FiCheck, FiHeart, FiShield, FiUser,
} from 'react-icons/fi';

// 4'6" – 7'0" in one-inch steps, valued in cm: the same list the profile
// editor offers (onboarding BasicInfoStep), so a filter value lands exactly on
// a height members can have.
export const HEIGHT_OPTIONS = (() => {
  const opts = [];
  for (let ft = 4; ft <= 7; ft++) {
    for (let inch = 0; inch <= 11; inch++) {
      if (ft === 4 && inch < 6) continue;
      if (ft === 7 && inch > 0) break;
      const cm = Math.round(ft * 30.48 + inch * 2.54);
      opts.push({ value: String(cm), label: `${ft}'${inch}" (${cm} cm)` });
    }
  }
  return opts;
})();

/**
 * A minimum above its maximum can match nobody (and the server refuses it), so
 * Apply stops and says which pair is the wrong way round. Returns the
 * `search.panel.*` message key per group, empty when both are fine.
 */
export const rangeErrors = (filters = {}) => {
  const out = {};
  const inverted = (lo, hi) => lo !== '' && lo != null && hi !== '' && hi != null && Number(lo) > Number(hi);
  if (inverted(filters.ageMin, filters.ageMax)) out.age = 'ageOrder';
  if (inverted(filters.heightMin, filters.heightMax)) out.height = 'heightOrder';
  return out;
};

// ─── Filter Section (collapsible) ───────────
const FilterSection = ({ title, icon: Icon, sectionKey, expanded, onToggle, children }) => (
  <div className="border-b border-neutral-100 last:border-b-0">
    <button
      type="button"
      onClick={() => onToggle(sectionKey)}
      className="w-full flex items-center justify-between py-3.5 px-1 text-left hover:bg-neutral-50 rounded-lg transition-colors"
      aria-expanded={expanded}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
        <Icon className="w-4 h-4 text-primary-500" aria-hidden="true" />
        {title}
      </span>
      <FiChevronDown
        className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        aria-hidden="true"
      />
    </button>
    <AnimatePresence initial={false}>
      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden"
        >
          <div className="pb-4 pt-1 space-y-4 px-1">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// ─── Field label ─────────────────────────────
const FieldLabel = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
    {children}
  </label>
);

// ─── Styled select ───────────────────────────
const StyledSelect = ({ id, name, value, onChange, children, ...rest }) => (
  <div className="relative">
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      {...rest}
      className="w-full pl-3 pr-9 py-2.5 text-base bg-white border border-neutral-200 rounded-xl text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-[border-color,box-shadow] duration-[160ms] appearance-none cursor-pointer"
    >
      {children}
    </select>
    {/* Explicit chevron: `appearance-none` hides the native arrow, so without
        this a <select> looked identical to the typeable text inputs beside it. */}
    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" aria-hidden="true" />
  </div>
);

// ─── Styled input ─────────────────────────────
const StyledInput = ({ id, name, value, onChange, placeholder, type = 'text', min, max, ...rest }) => (
  <input
    id={id}
    type={type}
    name={name}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    min={min}
    max={max}
    className="w-full px-3 py-2.5 text-base bg-white border border-neutral-200 rounded-xl text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-[border-color,box-shadow] duration-[160ms]"
    {...rest}
  />
);

// ─── Filter content (shared between both modes) ──
// Option values are what the server filters on and stay as they are; only the
// text shown for each comes from the locale files.
const MARITAL = ['never_married', 'divorced', 'widowed', 'awaiting_divorce'];
const RELIGIONS = ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Jain', 'Buddhist', 'Parsi', 'Jewish', 'Other'];
const MOTHER_TONGUES = ['Punjabi', 'Hindi', 'English', 'Haryanvi', 'Urdu', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Other'];
const MANGLIK = ['manglik_only', 'non_manglik_only', 'exclude_incompatible'];
const EDUCATION = ['High School', 'Graduate', 'Post Graduate', 'Doctorate', 'Professional'];
const INCOME_MIN = [200000, 500000, 1000000, 2000000, 5000000];
const INCOME_MAX = [500000, 1000000, 2000000, 5000000];
const DIETS = ['vegetarian', 'non-vegetarian', 'vegan', 'jain'];
const HABITS = ['never', 'occasionally', 'regularly'];

const FilterContent = ({ filters, onChange, errors = {} }) => {
  const { t } = useTranslation();
  const [sections, setSections] = useState({
    basic: true,
    height: true,
    location: true,
    background: false,
    education: false,
    lifestyle: false,
  });

  const toggle = (key) => setSections(p => ({ ...p, [key]: !p[key] }));

  const verifiedOn = filters.verifiedOnly === 'true';
  const toggleVerified = () =>
    onChange({ target: { name: 'verifiedOnly', value: verifiedOn ? '' : 'true' } });

  return (
    <div className="space-y-0">
      {/* Verified-only quick toggle — trust filter, kept above the fold */}
      <button
        type="button"
        onClick={toggleVerified}
        aria-pressed={verifiedOn}
        className={`w-full flex items-center justify-between gap-2 mb-2 px-3 py-3 rounded-xl border transition-colors ${
          verifiedOn
            ? 'border-success bg-success-50 text-success'
            : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <FiShield className={`w-4 h-4 ${verifiedOn ? 'text-success' : 'text-primary-500'}`} />
          {t('search.panel.verifiedOnly')}
        </span>
        <span
          className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
            verifiedOn ? 'bg-success' : 'bg-neutral-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              verifiedOn ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>

      {/* Age Range */}
      <FilterSection title={t('search.panel.ageRange')} icon={FiCalendar} sectionKey="basic" expanded={sections.basic} onToggle={toggle}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <FieldLabel htmlFor="ageMin">{t('search.panel.minAge')}</FieldLabel>
            <StyledInput
              id="ageMin" name="ageMin" type="number"
              value={filters.ageMin || ''} onChange={onChange}
              placeholder="21" min="18" max="99"
              aria-label={t('search.panel.minAgeAria')}
              aria-invalid={errors.age ? true : undefined}
              aria-describedby={errors.age ? 'ageRangeError' : undefined}
            />
          </div>
          <div className="flex-shrink-0 mt-5 text-neutral-400 text-xs font-medium">{t('search.panel.to')}</div>
          <div className="flex-1">
            <FieldLabel htmlFor="ageMax">{t('search.panel.maxAge')}</FieldLabel>
            <StyledInput
              id="ageMax" name="ageMax" type="number"
              value={filters.ageMax || ''} onChange={onChange}
              placeholder="40" min="18" max="99"
              aria-label={t('search.panel.maxAgeAria')}
              aria-invalid={errors.age ? true : undefined}
              aria-describedby={errors.age ? 'ageRangeError' : undefined}
            />
          </div>
        </div>
        {errors.age && (
          <p id="ageRangeError" role="alert" className="text-xs text-destructive">{t(`search.panel.${errors.age}`)}</p>
        )}
      </FilterSection>

      {/* Height */}
      <FilterSection title={t('search.panel.height')} icon={FiUser} sectionKey="height" expanded={sections.height} onToggle={toggle}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <FieldLabel htmlFor="heightMin">{t('search.panel.minHeight')}</FieldLabel>
            <StyledSelect
              id="heightMin" name="heightMin" value={filters.heightMin || ''} onChange={onChange}
              aria-invalid={errors.height ? true : undefined}
              aria-describedby={errors.height ? 'heightRangeError' : undefined}
            >
              <option value="">{t('search.panel.any')}</option>
              {HEIGHT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </StyledSelect>
          </div>
          <div className="flex-shrink-0 mt-5 text-neutral-400 text-xs font-medium">{t('search.panel.to')}</div>
          <div className="flex-1 min-w-0">
            <FieldLabel htmlFor="heightMax">{t('search.panel.maxHeight')}</FieldLabel>
            <StyledSelect
              id="heightMax" name="heightMax" value={filters.heightMax || ''} onChange={onChange}
              aria-invalid={errors.height ? true : undefined}
              aria-describedby={errors.height ? 'heightRangeError' : undefined}
            >
              <option value="">{t('search.panel.any')}</option>
              {HEIGHT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </StyledSelect>
          </div>
        </div>
        {errors.height && (
          <p id="heightRangeError" role="alert" className="text-xs text-destructive">{t(`search.panel.${errors.height}`)}</p>
        )}
      </FilterSection>

      {/* Location */}
      <FilterSection title={t('search.panel.location')} icon={FiMapPin} sectionKey="location" expanded={sections.location} onToggle={toggle}>
        <div>
          <FieldLabel htmlFor="city">{t('search.panel.city')}</FieldLabel>
          <StyledInput
            id="city" name="city"
            value={filters.city || ''} onChange={onChange}
            placeholder={t('search.panel.cityPlaceholder')}
            aria-label={t('search.panel.cityAria')}
          />
        </div>
      </FilterSection>

      {/* Background */}
      <FilterSection title={t('search.panel.background')} icon={FiHeart} sectionKey="background" expanded={sections.background} onToggle={toggle}>
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="maritalStatus">{t('search.panel.maritalStatus')}</FieldLabel>
            <StyledSelect id="maritalStatus" name="maritalStatus" value={filters.maritalStatus || ''} onChange={onChange}>
              <option value="">{t('search.panel.any')}</option>
              {MARITAL.map((v) => <option key={v} value={v}>{t(`search.options.maritalStatus.${v}`)}</option>)}
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="religion">{t('search.panel.religion')}</FieldLabel>
            <StyledSelect id="religion" name="religion" value={filters.religion || ''} onChange={onChange}>
              <option value="">{t('search.panel.any')}</option>
              {RELIGIONS.map((v) => <option key={v} value={v}>{t(`search.options.religion.${v}`)}</option>)}
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="caste">{t('search.panel.caste')}</FieldLabel>
            <StyledSelect id="caste" name="caste" value={filters.caste || ''} onChange={onChange}>
              <option value="">{t('search.panel.any')}</option>
              {CASTE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="motherTongue">{t('search.panel.motherTongue')}</FieldLabel>
            <StyledSelect id="motherTongue" name="motherTongue" value={filters.motherTongue || ''} onChange={onChange}>
              <option value="">{t('search.panel.any')}</option>
              {MOTHER_TONGUES.map((v) => <option key={v} value={v}>{t(`search.options.motherTongue.${v}`)}</option>)}
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="manglikFilter">{t('search.panel.manglik')}</FieldLabel>
            <StyledSelect id="manglikFilter" name="manglikFilter" value={filters.manglikFilter || ''} onChange={onChange}>
              <option value="">{t('search.panel.any')}</option>
              {MANGLIK.map((v) => <option key={v} value={v}>{t(`search.options.manglik.${v}`)}</option>)}
            </StyledSelect>
          </div>
        </div>
      </FilterSection>

      {/* Education & Career */}
      <FilterSection title={t('search.panel.educationCareer')} icon={FiBook} sectionKey="education" expanded={sections.education} onToggle={toggle}>
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="education">{t('search.panel.educationLevel')}</FieldLabel>
            <StyledSelect id="education" name="education" value={filters.education || ''} onChange={onChange}>
              <option value="">{t('search.panel.anyEducation')}</option>
              {EDUCATION.map((v) => <option key={v} value={v}>{t(`search.options.education.${v}`)}</option>)}
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="profession">{t('search.panel.profession')}</FieldLabel>
            <StyledSelect id="profession" name="profession" value={filters.profession || ''} onChange={onChange}>
              <option value="">{t('search.panel.anyProfession')}</option>
              {PROFESSION_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="incomeMin">{t('search.panel.minIncome')}</FieldLabel>
            <StyledSelect id="incomeMin" name="incomeMin" value={filters.incomeMin || ''} onChange={onChange}>
              <option value="">{t('search.panel.noMinimum')}</option>
              {INCOME_MIN.map((v) => <option key={v} value={String(v)}>{t('search.panel.lakhPlus', { n: v / 100000 })}</option>)}
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="incomeMax">{t('search.panel.maxIncome')}</FieldLabel>
            <StyledSelect id="incomeMax" name="incomeMax" value={filters.incomeMax || ''} onChange={onChange}>
              <option value="">{t('search.panel.noMaximum')}</option>
              {INCOME_MAX.map((v) => <option key={v} value={String(v)}>{t('search.panel.lakhOrLess', { n: v / 100000 })}</option>)}
            </StyledSelect>
          </div>
        </div>
      </FilterSection>

      {/* Lifestyle */}
      <FilterSection title={t('search.panel.lifestyle')} icon={FiBriefcase} sectionKey="lifestyle" expanded={sections.lifestyle} onToggle={toggle}>
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="diet">{t('search.panel.diet')}</FieldLabel>
            <StyledSelect id="diet" name="diet" value={filters.diet || ''} onChange={onChange}>
              <option value="">{t('search.panel.any')}</option>
              {DIETS.map((v) => <option key={v} value={v}>{t(`search.options.diet.${v}`)}</option>)}
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="smoking">{t('search.panel.smoking')}</FieldLabel>
            <StyledSelect id="smoking" name="smoking" value={filters.smoking || ''} onChange={onChange}>
              <option value="">{t('search.panel.any')}</option>
              {HABITS.map((v) => <option key={v} value={v}>{t(`search.options.habit.${v}`)}</option>)}
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="drinking">{t('search.panel.drinking')}</FieldLabel>
            <StyledSelect id="drinking" name="drinking" value={filters.drinking || ''} onChange={onChange}>
              <option value="">{t('search.panel.any')}</option>
              {HABITS.map((v) => <option key={v} value={v}>{t(`search.options.habit.${v}`)}</option>)}
            </StyledSelect>
          </div>
        </div>
      </FilterSection>
    </div>
  );
};

// ─────────────────────────────────────────────
// FilterPanel — desktop sidebar + mobile bottom sheet
// ─────────────────────────────────────────────

/**
 * FilterPanel Component
 *
 * Desktop: sticky sidebar rendered inline.
 * Mobile:  floating trigger button at bottom-right → full-height bottom sheet.
 *
 * @param {Object}   filters          - current filter state
 * @param {function} onFilterChange   - called with { name, value } on each change
 * @param {function} onApply          - called when Apply is tapped
 * @param {function} onClear          - called when Clear All is tapped
 * @param {number}   activeCount      - number of active filters (for mobile badge)
 */
const FilterPanel = ({
  filters = {},
  onFilterChange,
  onApply,
  onClear,
  onApplySaved,
  activeCount = 0,
}) => {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  // An inverted min/max pair, shown under the pair until the member fixes it.
  const [errors, setErrors] = useState({});
  const sheetRef = useRef(null);
  const dragStartY = useRef(null);

  // Count applied filters
  const applied = activeCount || Object.values(filters).filter(Boolean).length;

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Editing either end of a flagged pair clears its message; Apply re-checks.
    const group = name.startsWith('age') ? 'age' : name.startsWith('height') ? 'height' : null;
    if (group && errors[group]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[group];
        return next;
      });
    }
    onFilterChange?.({ name, value });
  };

  const handleApply = () => {
    const found = rangeErrors(filters);
    setErrors(found);
    // Nothing is searched (and no "Filters applied") until the pair is fixed;
    // the sheet stays open on the message.
    if (Object.keys(found).length) return;
    onApply?.();
    setSheetOpen(false);
  };

  const handleClear = () => {
    setErrors({});
    onClear?.();
  };

  // Drag-to-close on the handle
  const onDragStart = (e) => {
    dragStartY.current = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
  };
  const onDragEnd = (e) => {
    const endY = e.type === 'touchend' ? e.changedTouches[0].clientY : e.clientY;
    if (endY - dragStartY.current > 80) setSheetOpen(false);
  };

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sheetOpen]);

  return (
    <>
      {/* ── Desktop sidebar ─────────────────── */}
      <div className="hidden lg:block">
        <div className="sticky top-24 bg-white rounded-2xl shadow-card p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-neutral-800 flex items-center gap-2">
              <FiFilter className="w-4 h-4 text-primary-500" />
              {t('search.panel.filters')}
              {applied > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-primary-500 text-white text-[10px] font-bold rounded-full">
                  {applied}
                </span>
              )}
            </h2>
            {applied > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-neutral-400 hover:text-primary-500 transition-colors font-medium"
              >
                {t('search.panel.clearAll')}
              </button>
            )}
          </div>

          {onApplySaved && <SavedSearches filters={filters} onApplySaved={onApplySaved} />}
          <FilterContent filters={filters} onChange={handleChange} errors={errors} />

          {/* Apply */}
          <div className="mt-5 pt-4 border-t border-neutral-100 space-y-2.5">
            <button
              onClick={handleApply}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-[transform,background-color] duration-[160ms] shadow-burgundy hover:-translate-y-0.5"
            >
              <FiSearch className="w-4 h-4" />
              {t('search.panel.applyFilters')}
            </button>
            {applied > 0 && (
              <button
                onClick={handleClear}
                className="w-full py-2.5 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:border-neutral-300 hover:bg-neutral-50 transition-colors duration-[160ms]"
              >
                {t('search.panel.clearAllCaps')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile: Floating trigger ─────────── */}
      <div className="lg:hidden">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setSheetOpen(true)}
          className="fixed bottom-24 right-4 z-30 flex items-center gap-2 px-4 py-3 bg-primary-500 text-white text-sm font-semibold rounded-2xl shadow-burgundy-lg"
          aria-label={t('search.panel.openFilters')}
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <FiFilter className="w-4 h-4" />
          {t('search.panel.filters')}
          {applied > 0 && (
            <span className="w-5 h-5 bg-white text-primary-500 text-[10px] font-bold rounded-full flex items-center justify-center">
              {applied}
            </span>
          )}
        </motion.button>
      </div>

      {/* ── Mobile: Bottom Sheet ─────────────── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 bg-black/35 backdrop-blur-sm z-70 lg:hidden"
            />

            {/* Sheet — spring is doctrine-correct here (§4.4): this is a
                finger-draggable bottom sheet, the one case springs are for. */}
            <motion.div
              key="sheet"
              ref={sheetRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-70 lg:hidden flex flex-col"
              style={{ maxHeight: '90vh' }}
            >
              {/* Drag handle */}
              <div
                className="flex-shrink-0 flex items-center justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
                onMouseDown={onDragStart}
                onMouseUp={onDragEnd}
                onTouchStart={onDragStart}
                onTouchEnd={onDragEnd}
              >
                <div className="w-10 h-1 bg-neutral-200 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0 border-b border-neutral-100">
                <h2 className="text-base font-semibold text-neutral-800 flex items-center gap-2">
                  <FiFilter className="w-4 h-4 text-primary-500" />
                  {t('search.panel.searchFilters')}
                  {applied > 0 && (
                    <span className="px-2 py-0.5 bg-primary-500 text-white text-[10px] font-bold rounded-full">
                      {applied}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-neutral-100 transition-colors"
                  aria-label={t('search.panel.closeFilters')}
                >
                  <FiX className="w-4 h-4 text-neutral-600" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-5 py-2">
                {onApplySaved && <SavedSearches filters={filters} onApplySaved={onApplySaved} />}
          <FilterContent filters={filters} onChange={handleChange} errors={errors} />
              </div>

              {/* Sticky apply */}
              <div className="flex-shrink-0 px-5 py-4 border-t border-neutral-100 bg-white space-y-2.5 pb-safe">
                <button
                  onClick={handleApply}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 active:bg-primary-700 transition-colors duration-[160ms] shadow-burgundy"
                >
                  <FiCheck className="w-4 h-4" />
                  {t('search.panel.applyFilters')}
                  {applied > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-white/30 text-white text-[10px] font-bold rounded-full">
                      {t('search.panel.nActive', { n: applied })}
                    </span>
                  )}
                </button>
                {applied > 0 && (
                  <button
                    onClick={() => { handleClear(); setSheetOpen(false); }}
                    className="w-full py-3 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors"
                  >
                    {t('search.panel.clearAllFilters')}
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default FilterPanel;

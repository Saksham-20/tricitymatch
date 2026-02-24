import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiFilter, FiX, FiMapPin, FiBriefcase, FiBook, FiCalendar,
  FiChevronDown, FiSearch, FiCheck,
} from 'react-icons/fi';

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
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22 }}
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
const StyledSelect = ({ id, name, value, onChange, children }) => (
  <select
    id={id}
    name={name}
    value={value}
    onChange={onChange}
    className="w-full px-3 py-2.5 text-sm bg-white border border-neutral-200 rounded-xl text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all duration-200 appearance-none cursor-pointer"
  >
    {children}
  </select>
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
    className="w-full px-3 py-2.5 text-sm bg-white border border-neutral-200 rounded-xl text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all duration-200"
    {...rest}
  />
);

// ─── Filter content (shared between both modes) ──
const FilterContent = ({ filters, onChange }) => {
  const [sections, setSections] = useState({
    basic: true,
    location: true,
    education: false,
    lifestyle: false,
  });

  const toggle = (key) => setSections(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="space-y-0">
      {/* Age Range */}
      <FilterSection title="Age Range" icon={FiCalendar} sectionKey="basic" expanded={sections.basic} onToggle={toggle}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <FieldLabel htmlFor="ageMin">Min Age</FieldLabel>
            <StyledInput
              id="ageMin" name="ageMin" type="number"
              value={filters.ageMin || ''} onChange={onChange}
              placeholder="21" min="18" max="100"
              aria-label="Minimum age"
            />
          </div>
          <div className="flex-shrink-0 mt-5 text-neutral-400 text-xs font-medium">to</div>
          <div className="flex-1">
            <FieldLabel htmlFor="ageMax">Max Age</FieldLabel>
            <StyledInput
              id="ageMax" name="ageMax" type="number"
              value={filters.ageMax || ''} onChange={onChange}
              placeholder="40" min="18" max="100"
              aria-label="Maximum age"
            />
          </div>
        </div>
      </FilterSection>

      {/* Location */}
      <FilterSection title="Location" icon={FiMapPin} sectionKey="location" expanded={sections.location} onToggle={toggle}>
        <div>
          <FieldLabel htmlFor="city">City</FieldLabel>
          <StyledInput
            id="city" name="city"
            value={filters.city || ''} onChange={onChange}
            placeholder="e.g. Chandigarh, Mohali"
            aria-label="City or location"
          />
        </div>
      </FilterSection>

      {/* Education & Career */}
      <FilterSection title="Education & Career" icon={FiBook} sectionKey="education" expanded={sections.education} onToggle={toggle}>
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="education">Education Level</FieldLabel>
            <StyledSelect id="education" name="education" value={filters.education || ''} onChange={onChange}>
              <option value="">Any education</option>
              <option value="High School">High School</option>
              <option value="Graduate">Graduate</option>
              <option value="Post Graduate">Post Graduate</option>
              <option value="Doctorate">Doctorate</option>
              <option value="Professional">Professional Degree</option>
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="profession">Profession</FieldLabel>
            <StyledInput
              id="profession" name="profession"
              value={filters.profession || ''} onChange={onChange}
              placeholder="e.g. Engineer, Doctor"
            />
          </div>
        </div>
      </FilterSection>

      {/* Lifestyle */}
      <FilterSection title="Lifestyle" icon={FiBriefcase} sectionKey="lifestyle" expanded={sections.lifestyle} onToggle={toggle}>
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="diet">Diet</FieldLabel>
            <StyledSelect id="diet" name="diet" value={filters.diet || ''} onChange={onChange}>
              <option value="">Any</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="non-vegetarian">Non-Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="jain">Jain</option>
              <option value="eggetarian">Eggetarian</option>
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="smoking">Smoking</FieldLabel>
            <StyledSelect id="smoking" name="smoking" value={filters.smoking || ''} onChange={onChange}>
              <option value="">Any</option>
              <option value="never">Never</option>
              <option value="occasionally">Occasionally</option>
              <option value="regularly">Regularly</option>
            </StyledSelect>
          </div>
          <div>
            <FieldLabel htmlFor="drinking">Drinking</FieldLabel>
            <StyledSelect id="drinking" name="drinking" value={filters.drinking || ''} onChange={onChange}>
              <option value="">Any</option>
              <option value="never">Never</option>
              <option value="occasionally">Occasionally</option>
              <option value="socially">Socially</option>
              <option value="regularly">Regularly</option>
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
  activeCount = 0,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef(null);
  const dragStartY = useRef(null);

  // Count applied filters
  const applied = activeCount || Object.values(filters).filter(Boolean).length;

  const handleChange = (e) => {
    const { name, value } = e.target;
    onFilterChange?.({ name, value });
  };

  const handleApply = () => {
    onApply?.();
    setSheetOpen(false);
  };

  const handleClear = () => {
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
        <div className="sticky top-24 bg-white rounded-2xl border border-neutral-100 shadow-card p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-neutral-800 flex items-center gap-2">
              <FiFilter className="w-4 h-4 text-primary-500" />
              Filters
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
                Clear all
              </button>
            )}
          </div>

          <FilterContent filters={filters} onChange={handleChange} />

          {/* Apply */}
          <div className="mt-5 pt-4 border-t border-neutral-100 space-y-2.5">
            <button
              onClick={handleApply}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-all duration-200 shadow-burgundy hover:-translate-y-0.5"
            >
              <FiSearch className="w-4 h-4" />
              Apply Filters
            </button>
            {applied > 0 && (
              <button
                onClick={handleClear}
                className="w-full py-2.5 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:border-neutral-300 hover:bg-neutral-50 transition-all duration-200"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile: Floating trigger ─────────── */}
      <div className="lg:hidden">
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setSheetOpen(true)}
          className="fixed bottom-24 right-4 z-30 flex items-center gap-2 px-4 py-3 bg-primary-500 text-white text-sm font-semibold rounded-2xl shadow-burgundy-lg"
          aria-label="Open search filters"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <FiFilter className="w-4 h-4" />
          Filters
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
              className="fixed inset-0 bg-black/35 backdrop-blur-sm z-40 lg:hidden"
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              ref={sheetRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 lg:hidden flex flex-col"
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
                  Search Filters
                  {applied > 0 && (
                    <span className="px-2 py-0.5 bg-primary-500 text-white text-[10px] font-bold rounded-full">
                      {applied}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-neutral-100 transition-colors"
                  aria-label="Close filters"
                >
                  <FiX className="w-4 h-4 text-neutral-600" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-5 py-2">
                <FilterContent filters={filters} onChange={handleChange} />
              </div>

              {/* Sticky apply */}
              <div className="flex-shrink-0 px-5 py-4 border-t border-neutral-100 bg-white space-y-2.5 pb-safe">
                <button
                  onClick={handleApply}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 active:bg-primary-700 transition-all duration-200 shadow-burgundy"
                >
                  <FiCheck className="w-4 h-4" />
                  Apply Filters
                  {applied > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-white/30 text-white text-[10px] font-bold rounded-full">
                      {applied} active
                    </span>
                  )}
                </button>
                {applied > 0 && (
                  <button
                    onClick={() => { handleClear(); setSheetOpen(false); }}
                    className="w-full py-3 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors"
                  >
                    Clear All Filters
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

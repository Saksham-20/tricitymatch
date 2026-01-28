import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFilter, FiX, FiMapPin, FiBriefcase, FiBook, FiCalendar, FiChevronDown, FiSearch } from 'react-icons/fi';

/**
 * FilterPanel Component - Reusable filter panel for search functionality
 * 
 * @param {Object} filters - Current filter values
 * @param {function} onFilterChange - Callback when a filter value changes
 * @param {function} onApply - Callback when filters are applied
 * @param {function} onClear - Callback when filters are cleared
 * @param {boolean} isCollapsed - Whether the panel is collapsed (mobile)
 * @param {function} onToggleCollapse - Callback to toggle collapsed state
 */
const FilterPanel = ({ 
  filters = {}, 
  onFilterChange, 
  onApply, 
  onClear,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    location: true,
    education: true,
    lifestyle: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    onFilterChange?.({ ...filters, [name]: value });
  };

  const FilterSection = ({ title, icon: Icon, sectionKey, children }) => (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button
        type="button"
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center justify-between py-3 text-left hover:bg-neutral-50 px-1 rounded-lg transition-colors"
        aria-expanded={expandedSections[sectionKey]}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <Icon className="w-4 h-4 text-primary-500" aria-hidden="true" />
          {title}
        </span>
        <FiChevronDown 
          className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${
            expandedSections[sectionKey] ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence>
        {expandedSections[sectionKey] && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-4 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const content = (
    <div className="space-y-2">
      {/* Basic Filters - Age */}
      <FilterSection title="Age Range" icon={FiCalendar} sectionKey="basic">
        <div className="flex items-center gap-3">
          <input
            type="number"
            name="ageMin"
            value={filters.ageMin || ''}
            onChange={handleChange}
            className="input-field flex-1 text-center"
            placeholder="21"
            min="18"
            max="100"
            aria-label="Minimum age"
          />
          <span className="text-neutral-500 text-sm">to</span>
          <input
            type="number"
            name="ageMax"
            value={filters.ageMax || ''}
            onChange={handleChange}
            className="input-field flex-1 text-center"
            placeholder="35"
            min="18"
            max="100"
            aria-label="Maximum age"
          />
        </div>
      </FilterSection>

      {/* Location */}
      <FilterSection title="Location" icon={FiMapPin} sectionKey="location">
        <input
          type="text"
          name="city"
          value={filters.city || ''}
          onChange={handleChange}
          className="input-field"
          placeholder="e.g., Chandigarh, Mohali"
          aria-label="City or location"
        />
      </FilterSection>

      {/* Education & Career */}
      <FilterSection title="Education & Career" icon={FiBook} sectionKey="education">
        <div className="space-y-3">
          <div>
            <label htmlFor="education" className="block text-xs font-medium text-neutral-600 mb-1.5">
              Education
            </label>
            <select
              id="education"
              name="education"
              value={filters.education || ''}
              onChange={handleChange}
              className="input-field text-sm"
            >
              <option value="">Any Education</option>
              <option value="High School">High School</option>
              <option value="Graduate">Graduate</option>
              <option value="Post Graduate">Post Graduate</option>
              <option value="Doctorate">Doctorate</option>
              <option value="Professional">Professional Degree</option>
            </select>
          </div>

          <div>
            <label htmlFor="profession" className="block text-xs font-medium text-neutral-600 mb-1.5">
              Profession
            </label>
            <input
              type="text"
              id="profession"
              name="profession"
              value={filters.profession || ''}
              onChange={handleChange}
              className="input-field text-sm"
              placeholder="e.g., Engineer, Doctor"
            />
          </div>
        </div>
      </FilterSection>

      {/* Lifestyle Preferences */}
      <FilterSection title="Lifestyle" icon={FiBriefcase} sectionKey="lifestyle">
        <div className="space-y-3">
          <div>
            <label htmlFor="diet" className="block text-xs font-medium text-neutral-600 mb-1.5">
              Diet
            </label>
            <select
              id="diet"
              name="diet"
              value={filters.diet || ''}
              onChange={handleChange}
              className="input-field text-sm"
            >
              <option value="">Any</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="non-vegetarian">Non-Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="jain">Jain</option>
              <option value="eggetarian">Eggetarian</option>
            </select>
          </div>

          <div>
            <label htmlFor="smoking" className="block text-xs font-medium text-neutral-600 mb-1.5">
              Smoking
            </label>
            <select
              id="smoking"
              name="smoking"
              value={filters.smoking || ''}
              onChange={handleChange}
              className="input-field text-sm"
            >
              <option value="">Any</option>
              <option value="never">Never</option>
              <option value="occasionally">Occasionally</option>
              <option value="regularly">Regularly</option>
            </select>
          </div>

          <div>
            <label htmlFor="drinking" className="block text-xs font-medium text-neutral-600 mb-1.5">
              Drinking
            </label>
            <select
              id="drinking"
              name="drinking"
              value={filters.drinking || ''}
              onChange={handleChange}
              className="input-field text-sm"
            >
              <option value="">Any</option>
              <option value="never">Never</option>
              <option value="occasionally">Occasionally</option>
              <option value="socially">Socially</option>
              <option value="regularly">Regularly</option>
            </select>
          </div>
        </div>
      </FilterSection>

      {/* Action Buttons */}
      <div className="space-y-3 pt-4">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onApply}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <FiSearch className="w-4 h-4" aria-hidden="true" />
          Apply Filters
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onClear}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          <FiX className="w-4 h-4" aria-hidden="true" />
          Clear All
        </motion.button>
      </div>
    </div>
  );

  return (
    <div className="card sticky top-24">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
          <FiFilter className="w-5 h-5 text-primary-500" aria-hidden="true" />
          Search Filters
        </h2>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="lg:hidden p-2 hover:bg-neutral-100 rounded-xl transition-colors"
            aria-label={isCollapsed ? "Show filters" : "Hide filters"}
          >
            <FiX className="w-5 h-5" />
          </button>
        )}
      </div>
      
      {content}
    </div>
  );
};

export default FilterPanel;

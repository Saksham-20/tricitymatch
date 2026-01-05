import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiPlus } from 'react-icons/fi';

const INTEREST_OPTIONS = [
  'Travel', 'Music', 'Reading', 'Cooking', 'Fitness', 'Photography',
  'Dancing', 'Movies', 'Sports', 'Art', 'Writing', 'Gaming',
  'Yoga', 'Meditation', 'Technology', 'Business', 'Fashion',
  'Foodie', 'Adventure', 'Nature', 'Pets', 'Volunteering',
  'Shopping', 'Gardening', 'Singing', 'Painting', 'Cycling',
  'Swimming', 'Trekking', 'Blogging', 'Podcasts', 'Theater'
];

const InterestTags = ({ tags = [], onChange, maxTags = 10 }) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredOptions = INTEREST_OPTIONS.filter(
    option => 
      option.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(option)
  );

  const handleAddTag = (tag) => {
    if (tags.length < maxTags && !tags.includes(tag)) {
      onChange([...tags, tag]);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim() && filteredOptions.length > 0) {
      e.preventDefault();
      handleAddTag(filteredOptions[0]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Interests & Hobbies ({tags.length}/{maxTags})
      </label>
      
      {/* Selected Tags */}
      <div className="flex flex-wrap gap-2 min-h-[60px] p-3 border-2 border-gray-200 rounded-lg">
        <AnimatePresence>
          {tags.map((tag, index) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-pink-100 to-purple-100 text-purple-700 rounded-full text-sm font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-red-600 transition-colors"
              >
                <FiX className="w-4 h-4" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>

        {/* Add Tag Input */}
        {tags.length < maxTags && (
          <div className="relative flex-1 min-w-[150px]">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleInputKeyDown}
              placeholder="Add interest..."
              className="w-full px-3 py-1 border-0 focus:outline-none text-sm"
            />
            
            {/* Suggestions Dropdown */}
            {showSuggestions && inputValue && filteredOptions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                {filteredOptions.slice(0, 5).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleAddTag(option)}
                    className="w-full text-left px-4 py-2 hover:bg-purple-50 transition-colors text-sm"
                  >
                    {option}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Quick Add Buttons */}
      {tags.length < maxTags && (
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.slice(0, 8).map((option) => {
            if (tags.includes(option)) return null;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleAddTag(option)}
                className="px-3 py-1 text-xs border border-gray-300 rounded-full hover:border-purple-500 hover:bg-purple-50 transition-colors"
              >
                <FiPlus className="inline w-3 h-3 mr-1" />
                {option}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Add interests to help others find you and improve match quality
      </p>
    </div>
  );
};

export default InterestTags;




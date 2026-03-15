import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi';

const Select = ({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  error,
  required = false,
  searchable = false,
  disabled = false,
  clearable = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const filteredOptions = searchable
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    if (isOpen && searchable) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
    setFocusedIndex(0);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className="space-y-2 relative">
      {label && (
        <label className="block text-sm font-medium text-neutral-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`relative w-full px-4 py-3 border rounded-lg cursor-pointer flex items-center justify-between transition-all ${
          error
            ? 'border-red-500 focus:ring-red-500/20'
            : 'border-neutral-300 hover:border-neutral-400 focus:ring-primary-500/20'
        } ${disabled ? 'bg-neutral-100 cursor-not-allowed opacity-60' : 'bg-white'} ${
          isOpen ? 'ring-2 ring-primary-500 border-primary-500' : ''
        }`}
      >
        <span className={selectedOption ? 'text-neutral-900 font-medium' : 'text-neutral-500'}>
          {selectedOption?.label || placeholder}
        </span>

        <div className="flex items-center gap-2">
          {clearable && selectedOption && (
            <button
              onClick={handleClear}
              className="text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <FiX size={18} />
            </button>
          )}
          <FiChevronDown
            size={20}
            className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-300 rounded-lg shadow-lg z-50 max-h-60 overflow-auto">
          {searchable && (
            <div className="sticky top-0 bg-white border-b border-neutral-200 p-3">
              <div className="relative flex items-center">
                <FiSearch className="absolute left-3 text-neutral-400" size={18} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setFocusedIndex(0);
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    option.value === value
                      ? 'bg-primary-100 text-primary-900 font-medium'
                      : index === focusedIndex
                      ? 'bg-neutral-100 text-neutral-900'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-neutral-500">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Select;

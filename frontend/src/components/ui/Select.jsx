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
  id,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Stable ids so the label/error/listbox are programmatically associated.
  const reactId = React.useId();
  const fieldId = id || name || reactId;
  const labelId = `${fieldId}-label`;
  const listboxId = `${fieldId}-listbox`;
  const errorId = `${fieldId}-error`;

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

  const openMenu = () => {
    if (disabled) return;
    setIsOpen(true);
    // Focus the currently-selected option, or the first.
    const selIdx = filteredOptions.findIndex(opt => opt.value === value);
    setFocusedIndex(selIdx >= 0 ? selIdx : 0);
  };

  const closeMenu = (refocusTrigger = true) => {
    setIsOpen(false);
    setSearchTerm('');
    if (refocusTrigger) triggerRef.current?.focus();
  };

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
    setFocusedIndex(0);
    triggerRef.current?.focus();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  // Keyboard support on the combobox trigger — open/close + arrow navigation
  // so keyboard and screen-reader users can operate the control.
  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen) {
          const opt = filteredOptions[focusedIndex];
          if (opt) handleSelect(opt.value);
        } else {
          openMenu();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          openMenu();
        } else {
          setFocusedIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          closeMenu();
        }
        break;
      case 'Tab':
        if (isOpen) setIsOpen(false);
        break;
      default:
        break;
    }
  };

  // Keep the focused option scrolled into view.
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${focusedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex, isOpen]);

  return (
    <div ref={containerRef} className="space-y-2 relative">
      {label && (
        <label id={labelId} htmlFor={fieldId} className="block text-sm font-medium text-neutral-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        ref={triggerRef}
        id={fieldId}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-labelledby={label ? labelId : undefined}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        aria-disabled={disabled || undefined}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        className={`relative w-full px-4 py-3 border rounded-lg cursor-pointer flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-neutral-300 hover:border-neutral-400 focus:ring-primary-500'
        } ${disabled ? 'bg-neutral-100 cursor-not-allowed opacity-60' : 'bg-white'} ${
          isOpen ? 'ring-2 ring-primary-500 border-primary-500' : ''
        }`}
      >
        <span className={(selectedOption || value) ? 'text-neutral-900 font-medium' : 'text-neutral-500'}>
          {selectedOption?.label || (value ? String(value) : placeholder)}
        </span>

        <div className="flex items-center gap-2">
          {clearable && (selectedOption || value) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={`Clear ${label || 'selection'}`}
              className="text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              <FiX size={18} />
            </button>
          )}
          <FiChevronDown
            size={20}
            aria-hidden="true"
            className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {error && <p id={errorId} className="text-sm text-red-600 font-medium">{error}</p>}

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-300 rounded-lg shadow-lg z-50 max-h-60 overflow-auto">
          {searchable && (
            <div className="sticky top-0 bg-white border-b border-neutral-200 p-3">
              <div className="relative flex items-center">
                <FiSearch className="absolute left-3 text-neutral-400" size={18} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="text"
                  aria-label={`Search ${label || 'options'}`}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setFocusedIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setFocusedIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setFocusedIndex((i) => Math.max(i - 1, 0));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      const opt = filteredOptions[focusedIndex];
                      if (opt) handleSelect(opt.value);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      closeMenu();
                    }
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div ref={listRef} role="listbox" id={listboxId} aria-labelledby={label ? labelId : undefined}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <button
                  type="button"
                  key={option.value}
                  data-index={index}
                  role="option"
                  aria-selected={option.value === value}
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

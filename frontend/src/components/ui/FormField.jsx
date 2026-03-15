import React from 'react';

const FormField = ({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  type = 'text',
  error,
  required = false,
  hint,
  disabled = false,
  min,
  max,
  maxLength,
}) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-neutral-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        min={min}
        max={max}
        maxLength={maxLength}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
          error
            ? 'border-red-500 focus:ring-red-500/20 focus:ring-red-500'
            : 'border-neutral-300 focus:ring-primary-500/20 focus:ring-primary-500'
        } ${disabled ? 'bg-neutral-100 cursor-not-allowed opacity-60' : ''}`}
      />
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
};

export default FormField;

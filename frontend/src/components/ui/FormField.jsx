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
  optional = false,
  hint,
  disabled = false,
  min,
  max,
  maxLength,
  name,
  id,
  autoComplete,
  inputMode,
}) => {
  // Stable id so the <label> is programmatically associated with the input
  // (clicking the label focuses the field; screen readers announce the name).
  const reactId = React.useId();
  const fieldId = id || name || reactId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-neutral-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
          {optional && !required && <span className="ml-1.5 text-xs font-normal text-neutral-400">(optional)</span>}
        </label>
      )}
      <input
        id={fieldId}
        name={name}
        autoComplete={autoComplete}
        inputMode={inputMode}
        type={type}
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        min={min}
        max={max}
        maxLength={maxLength}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
          error
            ? 'border-red-500 focus:ring-red-500/20 focus:ring-red-500'
            : 'border-neutral-300 focus:ring-primary-500/20 focus:ring-primary-500'
        } ${disabled ? 'bg-neutral-100 cursor-not-allowed opacity-60' : ''}`}
      />
      {error && <p id={errorId} className="text-sm text-red-600 font-medium">{error}</p>}
      {hint && !error && <p id={hintId} className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
};

export default FormField;

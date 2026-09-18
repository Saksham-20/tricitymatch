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
        <label htmlFor={fieldId} className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
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
        className={`w-full px-4 py-3 text-base border rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-transparent transition-[border-color,box-shadow] duration-[160ms] ${
          error
            ? 'border-destructive focus:ring-destructive/20 focus:ring-destructive'
            : 'border-neutral-300 dark:border-neutral-700 focus:ring-primary-500/20 focus:ring-primary-500'
        } ${disabled ? 'bg-neutral-100 dark:bg-neutral-800 cursor-not-allowed opacity-60' : ''}`}
      />
      {error && <p id={errorId} className="text-sm text-destructive font-medium">{error}</p>}
      {hint && !error && <p id={hintId} className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
};

export default FormField;

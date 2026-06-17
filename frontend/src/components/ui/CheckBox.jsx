import React from 'react';
import { FiCheck } from 'react-icons/fi';

const CheckBox = ({
  checked = false,
  onChange,
  label,
  disabled = false,
  size = 'md',
  error,
  hint,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const labelSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Native <input> drives state so the control is keyboard-operable
          (Tab + Space) and announced by screen readers as a checkbox.
          The label wraps it, so clicking the box OR the text toggles it. */}
      <label
        className={`flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          type="checkbox"
          className="sr-only peer"
          checked={!!checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`${sizeClasses[size]} rounded border-2 flex items-center justify-center transition-all flex-shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 ${
            checked
              ? 'bg-primary-600 border-primary-600'
              : 'border-neutral-300 bg-white hover:border-neutral-400'
          }`}
        >
          {checked && <FiCheck className="text-white" strokeWidth={3} size={16} />}
        </div>
        {label && (
          <span className={`${labelSizeClasses[size]} text-neutral-900 font-medium`}>
            {label}
          </span>
        )}
      </label>
      {error && <p className="text-sm text-red-600 ml-8 font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-neutral-500 ml-8">{hint}</p>}
    </div>
  );
};

export default CheckBox;

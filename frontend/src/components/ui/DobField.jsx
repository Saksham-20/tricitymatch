import React, { useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';

/**
 * Date-of-birth entry as three explicit Day / Month / Year dropdowns.
 *
 * Replaces the native <input type="date">, which was a real problem on Android:
 * the OS calendar dialog opens clamped to the max (18 years back) and users had
 * to page backwards through decades — and some Android WebViews render an empty
 * date input as a blank box. For memorable dates like a birthday, the standard
 * guidance (GOV.UK date pattern) is explicit part fields, never a picker.
 * Native <select>s get the platform wheel on Android/iOS with zero custom JS.
 *
 * `value` is the canonical `YYYY-MM-DD` string (or '') the rest of the app
 * already uses; `onChange` receives the composed date only when all three
 * parts are chosen, else '' so required-validation still fires.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const daysInMonth = (year, month) => {
  // month is 1-12; year may be '' → assume 31/30/29 style upper bound
  if (!month) return 31;
  const y = Number(year) || 2000; // leap-friendly default until a year is picked
  return new Date(y, Number(month), 0).getDate();
};

const parseValue = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!m) return { year: '', month: '', day: '' };
  return { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) };
};

const selectCls = (hasError) =>
  `w-full pl-3 pr-8 py-3 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all appearance-none ${
    hasError
      ? 'border-red-500 focus:ring-red-500'
      : 'border-neutral-300 focus:ring-primary-500'
  }`;

// appearance-none strips the native arrow, so each select gets an explicit
// chevron — without one the boxes read as text inputs, not dropdowns.
const PartSelect = ({ id, name, srLabel, value, onChange, hasError, children }) => (
  <div className="relative">
    <label htmlFor={id} className="sr-only">{srLabel}</label>
    <select
      id={id}
      name={name}
      autoComplete={name}
      value={value}
      onChange={onChange}
      aria-invalid={hasError ? true : undefined}
      className={selectCls(hasError)}
    >
      {children}
    </select>
    <FiChevronDown className="w-4 h-4 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

const DobField = ({ label = 'Date of Birth', value, onChange, error, hint, required = false, minAge = 18, maxAge = 100 }) => {
  const [parts, setParts] = useState(() => parseValue(value));
  // Re-sync when an outside value arrives (e.g. edit-mode hydration after mount).
  const [lastValue, setLastValue] = useState(value || '');
  if ((value || '') !== lastValue) {
    setLastValue(value || '');
    setParts(parseValue(value));
  }

  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - minAge; y >= currentYear - maxAge; y--) years.push(y);

  const maxDay = daysInMonth(parts.year, parts.month);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const update = (patch) => {
    const next = { ...parts, ...patch };
    // Month/year change can invalidate the chosen day (e.g. 31 → February).
    if (next.day && Number(next.day) > daysInMonth(next.year, next.month)) next.day = '';
    setParts(next);
    if (next.year && next.month && next.day) {
      const composed = `${next.year}-${String(next.month).padStart(2, '0')}-${String(next.day).padStart(2, '0')}`;
      setLastValue(composed);
      onChange(composed);
    } else {
      setLastValue('');
      onChange('');
    }
  };

  const errorId = 'dob-error';
  const hintId = 'dob-hint';

  return (
    <div className="space-y-2">
      <span id="dob-label" className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </span>
      <div className="grid grid-cols-3 gap-2.5" role="group" aria-labelledby="dob-label" aria-describedby={error ? errorId : hint ? hintId : undefined}>
        <PartSelect id="dob-day" name="bday-day" srLabel="Day" value={parts.day} onChange={(e) => update({ day: e.target.value })} hasError={!!error}>
          <option value="">Day</option>
          {days.map((d) => <option key={d} value={d}>{d}</option>)}
        </PartSelect>
        <PartSelect id="dob-month" name="bday-month" srLabel="Month" value={parts.month} onChange={(e) => update({ month: e.target.value })} hasError={!!error}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </PartSelect>
        <PartSelect id="dob-year" name="bday-year" srLabel="Year" value={parts.year} onChange={(e) => update({ year: e.target.value })} hasError={!!error}>
          <option value="">Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </PartSelect>
      </div>
      {error && <p id={errorId} className="text-sm text-red-600 font-medium">{error}</p>}
      {hint && !error && <p id={hintId} className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
};

export default DobField;

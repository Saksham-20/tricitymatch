import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';
import { getPasswordStrength } from '../../utils/validators';

/**
 * Live password requirement checklist + strength bar.
 * Renders nothing until the user starts typing, then ticks each rule
 * in real time so users fix issues before submitting (no type→reject→retype).
 */
const RULES = [
  { key: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'num', label: 'One number', test: (p) => /[0-9]/.test(p) },
  { key: 'sym', label: 'One symbol (!@#$…)', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

const STRENGTH = [
  { label: '', color: '' },
  { label: 'Weak', color: 'bg-destructive' },
  { label: 'Fair', color: 'bg-gold-500' },
  { label: 'Good', color: 'bg-gold-600' },
  { label: 'Strong', color: 'bg-success' },
];

const PasswordRequirements = ({ password = '' }) => {
  if (!password) return null;
  const strength = getPasswordStrength(password);
  const meta = STRENGTH[strength] || STRENGTH[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="mt-2 space-y-2 overflow-hidden"
      >
        {/* Strength bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${meta.color}`}
              initial={false}
              animate={{ width: `${(strength / 4) * 100}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
          {meta.label && (
            <span className="text-[11px] font-medium text-neutral-500 w-12 text-right">{meta.label}</span>
          )}
        </div>

        {/* Requirement checklist */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
          {RULES.map((rule) => {
            const ok = rule.test(password);
            return (
              <li
                key={rule.key}
                className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                  ok ? 'text-success' : 'text-neutral-400'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border ${
                    ok ? 'bg-success border-success text-white' : 'border-neutral-300'
                  }`}
                >
                  {ok && <FiCheck className="w-2.5 h-2.5" strokeWidth={3} />}
                </span>
                {rule.label}
              </li>
            );
          })}
        </ul>
      </motion.div>
    </AnimatePresence>
  );
};

export default PasswordRequirements;

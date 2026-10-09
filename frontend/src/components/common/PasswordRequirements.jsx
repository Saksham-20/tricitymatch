import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiCheck } from 'react-icons/fi';
import { getPasswordStrength } from '../../utils/validators';

/**
 * Live password requirement checklist + strength bar.
 * Renders nothing until the user starts typing, then ticks each rule
 * in real time so users fix issues before submitting (no type→reject→retype).
 */
// `labelKey` values are i18n keys, translated at render.
const RULES = [
  { key: 'len', labelKey: 'validation.atLeast8', test: (p) => p.length >= 8 },
  { key: 'upper', labelKey: 'validation.oneUpper', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', labelKey: 'validation.oneLower', test: (p) => /[a-z]/.test(p) },
  { key: 'num', labelKey: 'validation.oneNumber', test: (p) => /[0-9]/.test(p) },
  { key: 'sym', labelKey: 'validation.oneSymbol', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

const STRENGTH = [
  { labelKey: '', color: '' },
  { labelKey: 'signup.strengthWeak', color: 'bg-destructive' },
  { labelKey: 'signup.strengthFair', color: 'bg-warning' },
  { labelKey: 'signup.strengthGood', color: 'bg-warning' },
  { labelKey: 'signup.strengthStrong', color: 'bg-success' },
];

const PasswordRequirements = ({ password = '' }) => {
  const { t } = useTranslation();
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
        {/* Strength bar — transform, not width, so this fires cleanly on
            every keystroke without triggering layout (doctrine §4.5). */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <motion.div
              className={`h-full w-full rounded-full origin-left ${meta.color}`}
              initial={false}
              animate={{ scaleX: strength / 4 }}
              transition={{ duration: 0.25, ease: [0.77, 0, 0.175, 1] }}
            />
          </div>
          {meta.labelKey && (
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 min-w-[3rem] text-right">{t(meta.labelKey)}</span>
          )}
        </div>

        {/* Requirement checklist */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
          {RULES.map((rule) => {
            const ok = rule.test(password);
            return (
              <li
                key={rule.key}
                className={`flex items-center gap-1.5 text-[11px] transition-colors duration-[160ms] ${
                  ok ? 'text-success' : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border ${
                    ok ? 'bg-success border-success text-white' : 'border-neutral-300 dark:border-neutral-600'
                  }`}
                >
                  {ok && <FiCheck className="w-2.5 h-2.5" strokeWidth={3} />}
                </span>
                {t(rule.labelKey)}
              </li>
            );
          })}
        </ul>
      </motion.div>
    </AnimatePresence>
  );
};

export default PasswordRequirements;

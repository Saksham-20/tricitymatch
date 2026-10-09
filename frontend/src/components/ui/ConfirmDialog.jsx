// A yes/no confirmation for actions that are hard to take back, styled like the
// block confirmation in components/safety/SafetyMenu.jsx.
//
//   const [confirm, confirmDialog] = useConfirm();
//   if (!(await confirm({ title, body, confirmLabel }))) return;
//   ...render {confirmDialog} somewhere in the tree.
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { backdrop, modal } from '../../utils/animations';

const ConfirmDialog = ({ open, title, body, confirmLabel, cancelLabel, onAnswer }) => {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const returnTo = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = document.activeElement;
    const t = setTimeout(() => dialogRef.current?.focus(), 0);
    const onKey = (e) => { if (e.key === 'Escape') onAnswer(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      if (returnTo.current && typeof returnTo.current.focus === 'function') returnTo.current.focus();
    };
  }, [open, onAnswer]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          {...backdrop}
          className="fixed inset-0 z-70 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => onAnswer(false)}
        >
          <motion.div
            {...modal}
            ref={dialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            className="w-full sm:max-w-md [color-scheme:light] dark:[color-scheme:dark] bg-white dark:bg-surface-dark-3 rounded-t-3xl sm:rounded-3xl shadow-xl p-5 focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="font-display text-lg font-bold text-neutral-900 dark:text-neutral-100">
              {title}
            </h2>
            <p id="confirm-desc" className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{body}</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => onAnswer(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {cancelLabel ?? t('ui.cancel')}
              </button>
              <button
                type="button"
                onClick={() => onAnswer(true)}
                className="min-h-[44px] flex-1 rounded-xl bg-primary-600 text-sm font-semibold text-white transition-colors duration-[160ms] hover:bg-primary-700"
              >
                {confirmLabel ?? t('ui.confirm')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const useConfirm = () => {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setState(opts);
  }), []);

  const onAnswer = useCallback((yes) => {
    resolver.current?.(yes);
    resolver.current = null;
    setState(null);
  }, []);

  const dialog = <ConfirmDialog open={!!state} {...(state || {})} onAnswer={onAnswer} />;
  return [confirm, dialog];
};

export default ConfirmDialog;

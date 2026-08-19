/**
 * LikeNoteModal — D3/DS5: like-with-note. Layout: [the liked thing — photo
 * thumbnail or quoted prompt] → optional 280-char note → "Send like".
 * Only opened from an explicit like-with-note affordance; the plain one-tap
 * like elsewhere is unchanged.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiHeart } from 'react-icons/fi';
import { sanitizeText } from '../../utils/sanitize';

const MAX_NOTE = 280;

const LikeNoteModal = ({ open, target, name, photoSrc, onClose, onSend }) => {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(note.trim());
      setNote('');
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Like ${name} with a note`}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full sm:max-w-md bg-white dark:bg-[#1a1f2e] rounded-t-3xl sm:rounded-3xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Like {name?.split(' ')[0]}&apos;s {target.type === 'photo' ? 'photo' : 'answer'}
              </h3>
              <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* The liked thing */}
            {target.type === 'photo' ? (
              <img src={photoSrc} alt="" className="w-full h-44 object-cover rounded-2xl mb-4" />
            ) : (
              <div className="p-4 bg-primary-50/60 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800 mb-4">
                <p className="text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed line-clamp-4">
                  “{sanitizeText(target.promptText)}”
                </p>
              </div>
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
              rows={3}
              placeholder="Add a note (optional) — say what caught your eye…"
              aria-label="Note to send with your like"
              className="w-full px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-[#14182a] text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-neutral-400 tabular-nums">{note.length}/{MAX_NOTE}</span>
              <button
                onClick={handleSend}
                disabled={sending}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-hero text-white rounded-full font-semibold text-sm hover:shadow-burgundy transition-all disabled:opacity-60"
              >
                <FiHeart className="w-4 h-4" />
                {sending ? 'Sending…' : 'Send like'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LikeNoteModal;

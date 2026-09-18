import React, { useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';

/**
 * Full-screen lightbox: shows image at larger scale with blurred background.
 * Close via backdrop click, close button, or Escape.
 *
 * Doctrine §6: "sheets and modals trap focus, restore it on close." This is
 * a real full-screen modal (role="dialog" aria-modal="true"), so it moves
 * focus in on open, keeps Tab from leaving it while open, and restores focus
 * to whatever opened it on close — none of which happened before (nothing
 * ever stole focus from the trigger, so it only *looked* handled).
 */
export function ImageLightbox({ src, alt = '', open, onClose }) {
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (typeof triggerRef.current?.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="View image"
    >
      <button
        ref={closeBtnRef}
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close"
      >
        <FiX className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[95vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/**
 * Full-screen lightbox: shows image at larger scale with blurred background.
 * Close via backdrop click, close button, or Escape.
 *
 * Two call shapes:
 *   - single image:  <ImageLightbox src={..} alt={..} open onClose={..} />
 *   - photo set:      <ImageLightbox photos={[..]} initialIndex={0} open onClose={..} alt={..} />
 * `photos` (2+ items) adds arrow buttons, left/right-arrow-key + swipe
 * navigation, and a "N / total" counter — this used to only ever show the
 * one photo that was tapped, with no way to see the rest of a profile's
 * gallery without leaving the page.
 */
export function ImageLightbox({ src, alt = '', photos, initialIndex = 0, open, onClose }) {
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const triggerRef = useRef(null);
  const touchStartX = useRef(null);

  const gallery = Array.isArray(photos) && photos.length > 0 ? photos : (src ? [src] : []);
  const count = gallery.length;
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) setIndex(Math.min(Math.max(initialIndex, 0), Math.max(count - 1, 0)));
  }, [open, initialIndex, count]);

  const goTo = (next) => {
    if (count === 0) return;
    setIndex(((next % count) + count) % count);
  };

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (count > 1 && e.key === 'ArrowLeft') {
        goTo(index - 1);
        return;
      }
      if (count > 1 && e.key === 'ArrowRight') {
        goTo(index + 1);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, index, count]);

  if (!open || count === 0) return null;

  const currentSrc = gallery[index];
  const currentAlt = count > 1 ? `${alt} ${index + 1}` : alt;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="View image"
      onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null || count <= 1) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) < 40) return;
        goTo(dx > 0 ? index - 1 : index + 1);
      }}
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

      {count > 1 && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/50 text-white text-sm font-medium"
          aria-live="polite"
        >
          {index + 1} / {count}
        </div>
      )}

      {count > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goTo(index - 1); }}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Previous photo"
        >
          <FiChevronLeft className="w-6 h-6" />
        </button>
      )}

      <img
        key={currentSrc}
        src={currentSrc}
        alt={currentAlt}
        className="max-w-[95vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {count > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goTo(index + 1); }}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Next photo"
        >
          <FiChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

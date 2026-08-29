import { useEffect, useRef, useState } from 'react';

/**
 * Drop-in <img> that survives a transient CDN error.
 *
 * Cloudinary's edge returned 503 on four cached profile-photo transforms for
 * about a second (2026-08-29); every onError in the app hid the photo for good
 * and showed initials until a reload. This retries ONE time after a short
 * delay with a cache-busting query, and only then hands the error to the
 * caller's own fallback. Genuine 404s still fall back — they just take 1.5s.
 */
const RETRY_DELAY_MS = 1500;
const MAX_RETRIES = 1;

export default function RetryImage({ src, onError, ...rest }) {
  const [attempt, setAttempt] = useState(0);
  const timer = useRef(null);

  // A new src means a new asset: start the retry budget over.
  useEffect(() => { setAttempt(0); }, [src]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleError = (e) => {
    if (attempt < MAX_RETRIES && src) {
      e.persist?.();
      timer.current = setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAY_MS);
      return;
    }
    onError?.(e);
  };

  const effectiveSrc = attempt === 0 || !src
    ? src
    : `${src}${src.includes('?') ? '&' : '?'}r=${attempt}`;

  return <img {...rest} src={effectiveSrc} onError={handleError} />;
}

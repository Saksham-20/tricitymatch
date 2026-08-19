/**
 * StagedLoader — the "labor illusion" loader (DS6), with hard bounds:
 *   - stage copy is fixed and advances on a 500ms clock (3 stages = 1.5s);
 *   - it NEVER delays real data beyond `maxHoldMs` (0 = pure fill of real wait);
 *   - it runs at most once per day per key (sessionStorage) — afterwards the
 *     caller falls back to its plain skeleton;
 *   - it is skippable, and reduced-motion collapses it to one static line;
 *   - on fetch error the caller unmounts it instantly (no completing animation).
 */
import { useEffect, useRef, useState } from 'react';
import { FiLoader } from 'react-icons/fi';

export const STAGES = [
  'Scanning Tricity profiles…',
  'Matching 36 gunas…',
  'Checking family preferences…',
];
const STAGE_MS = 500;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

const dayKey = (key) => `staged:${key}:${new Date().toDateString()}`;

/**
 * Orchestrates the once-per-day theater around a loading flag.
 *
 * @param key       sessionStorage discriminator ('daily', 'search', …)
 * @param loading   the real fetch state
 * @param error     kills the theater instantly when truthy
 * @param maxHoldMs 0 = never outlast the fetch; 1500 = may hold the reveal
 * @returns showTheater — render <StagedLoader onSkip> while true
 */
export function useStagedReveal({ key, loading, error = false, maxHoldMs = 0 }) {
  const [eligible] = useState(() => {
    try {
      if (sessionStorage.getItem(dayKey(key))) return false;
      sessionStorage.setItem(dayKey(key), '1');
      return true;
    } catch {
      return false;
    }
  });
  const [skipped, setSkipped] = useState(false);
  const [holdDone, setHoldDone] = useState(maxHoldMs === 0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (maxHoldMs === 0) return undefined;
    const remaining = Math.max(0, maxHoldMs - (Date.now() - startedAt.current));
    const t = setTimeout(() => setHoldDone(true), remaining);
    return () => clearTimeout(t);
  }, [maxHoldMs]);

  const showTheater = eligible && !skipped && !error && (loading || !holdDone);
  return { showTheater, skip: () => setSkipped(true) };
}

export default function StagedLoader({ onSkip, className = '' }) {
  const reduced = prefersReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (reduced) return undefined;
    const timers = STAGES.map((_, i) =>
      setTimeout(() => setStageIndex(i), i * STAGE_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-10 ${className}`}
      role="status"
      data-testid="staged-loader"
    >
      <FiLoader className="w-6 h-6 text-primary-600 animate-spin" aria-hidden="true" />
      <p className="text-sm text-neutral-600 dark:text-neutral-300" aria-live="polite">
        {reduced ? 'Finding matches…' : STAGES[stageIndex]}
      </p>
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 underline min-h-[44px] px-3"
        >
          Skip
        </button>
      )}
    </div>
  );
}

import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The OS "reduce motion" accessibility setting, held in ONE module-level store.
 *
 * It used to be a per-instance hook: every PressableScale, StaggeredEntrance,
 * skeleton and TabIcon made its own async `isReduceMotionEnabled()` call and its
 * own listener (one ProfileCard mounted four), and every one of them rendered
 * `false` on its first frame — so a Reduce Motion member saw each of them
 * animate once, then snap. Now there is a single subscription taken when this
 * module is first imported (well before the first screen renders), and
 * `useSyncExternalStore` hands every consumer the same value synchronously.
 *
 * The listener is deliberately never removed: the store lives as long as the JS
 * runtime and there is exactly one of it.
 */
let current = false;
const listeners = new Set<() => void>();

function publish(next: boolean): void {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

try {
  AccessibilityInfo.isReduceMotionEnabled()
    .then(publish)
    .catch(() => {
      /* best-effort — the default (motion on) stands */
    });
  AccessibilityInfo.addEventListener('reduceMotionChanged', publish);
} catch {
  /* a test renderer without the accessibility module: motion stays on */
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = (): boolean => current;
const getServerSnapshot = (): boolean => false;

/**
 * Tracks the OS "reduce motion" accessibility setting (live). Motion
 * primitives use this to drop translation/scale and keep opacity (doctrine
 * §10.2 ruling 18).
 */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

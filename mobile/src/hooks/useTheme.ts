import { useColorScheme } from 'react-native';
import { colours, darkColours } from '@shared/constants/theme';
import { useUIStore } from '../stores/uiStore';

/**
 * Returns the active colour palette, dark-mode flag and elder-mode flag.
 * Respects: explicit dark-mode override in uiStore → falls back to system
 * scheme. `elder` drives the `Text` primitive's type-scale bump and
 * `tapSize()`'s hit-target floor (doctrine §10.6) — read it here, not
 * `useUIStore` directly, so every consumer of theme state comes through one
 * hook.
 *
 * Usage:
 *   const { c, isDark, elder } = useTheme();
 *   <View style={{ backgroundColor: c.background }} />
 */
export function useTheme() {
  const systemScheme = useColorScheme();
  const darkModeOverride = useUIStore((s) => s.darkModeOverride);
  const elder = useUIStore((s) => s.elderMode);

  const isDark =
    darkModeOverride !== null ? darkModeOverride : systemScheme === 'dark';

  return {
    isDark,
    elder,
    c: isDark ? darkColours : colours,
  };
}

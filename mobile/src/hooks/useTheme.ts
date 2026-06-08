import { useColorScheme } from 'react-native';
import { colours, darkColours } from '@shared/constants/theme';
import { useUIStore } from '../stores/uiStore';

/**
 * Returns the active colour palette.
 * Respects: explicit override in uiStore → falls back to system scheme.
 *
 * Usage:
 *   const { c, isDark } = useTheme();
 *   <View style={{ backgroundColor: c.background }} />
 */
export function useTheme() {
  const systemScheme = useColorScheme();
  const darkModeOverride = useUIStore((s) => s.darkModeOverride);

  const isDark =
    darkModeOverride !== null ? darkModeOverride : systemScheme === 'dark';

  return {
    isDark,
    c: isDark ? darkColours : colours,
  };
}

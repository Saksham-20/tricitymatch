import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUIStore } from '../stores/uiStore';
import { TAB_BAR_PILL_HEIGHT } from '../components/navigation/FloatingTabBar';

/** Breathing room above the pill's own edge, beyond its footprint. */
const TRAILING_GAP = 12;

/**
 * Bottom padding a TAB screen's scroll content needs so its last row clears
 * the floating pill tab bar. Elder mode uses the docked bar (part of layout),
 * so no extra clearance there.
 *
 * Computed from insets, never a flat constant: the pill sits
 * `max(insets.bottom, 12)` above the screen edge (`FloatingTabBar`'s own
 * `wrap.paddingBottom`), then the pill itself is `TAB_BAR_PILL_HEIGHT` tall.
 * The two numbers must stay in sync with `FloatingTabBar`'s actual styles —
 * that is the whole point of importing the constant instead of duplicating it.
 */
export function useTabBarClearance(): number {
  const elderMode = useUIStore((s) => s.elderMode);
  const insets = useSafeAreaInsets();
  if (elderMode) return 0;
  return Math.max(insets.bottom, 12) + TAB_BAR_PILL_HEIGHT + TRAILING_GAP;
}

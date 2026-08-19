import { useUIStore } from '../stores/uiStore';
import { TAB_BAR_CLEARANCE } from '../components/navigation/FloatingTabBar';

/**
 * Bottom padding a TAB screen's scroll content needs so its last row clears
 * the floating pill tab bar. Elder mode uses the docked bar (part of layout),
 * so no extra clearance there.
 */
export function useTabBarClearance(): number {
  const elderMode = useUIStore((s) => s.elderMode);
  return elderMode ? 0 : TAB_BAR_CLEARANCE;
}

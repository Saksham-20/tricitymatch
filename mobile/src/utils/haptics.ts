// Thin haptics wrapper. expo-haptics is an optional native module — it may not
// be installed / linked in Expo Go or a stale dev client. We dynamically require
// it and no-op if unavailable, so screens can call haptics unconditionally.
//
// Usage:  import { haptics } from '../utils/haptics';  haptics.success();
import type { HapticKind } from '@shared/constants/motion';

type HapticsModule = {
  selectionAsync: () => Promise<void>;
  impactAsync: (style: unknown) => Promise<void>;
  notificationAsync: (type: unknown) => Promise<void>;
  ImpactFeedbackStyle: { Light: unknown; Medium: unknown; Heavy: unknown };
  NotificationFeedbackType: { Success: unknown; Warning: unknown; Error: unknown };
};

let mod: HapticsModule | null | undefined;

function get(): HapticsModule | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('expo-haptics') as HapticsModule;
  } catch {
    mod = null;
  }
  return mod;
}

function fire(kind: HapticKind): void {
  const h = get();
  if (!h) return;
  try {
    switch (kind) {
      case 'light':
        h.selectionAsync();
        break;
      case 'medium':
        h.impactAsync(h.ImpactFeedbackStyle.Medium);
        break;
      case 'success':
        h.notificationAsync(h.NotificationFeedbackType.Success);
        break;
      case 'warning':
        h.notificationAsync(h.NotificationFeedbackType.Warning);
        break;
    }
  } catch {
    /* ignore — haptics are best-effort */
  }
}

export const haptics = {
  light:   () => fire('light'),
  medium:  () => fire('medium'),
  success: () => fire('success'),
  warning: () => fire('warning'),
};

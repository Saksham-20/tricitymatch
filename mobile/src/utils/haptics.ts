// Thin haptics wrapper. expo-haptics is an OPTIONAL native module that is NOT a
// declared dependency of this app, and is not linked into the current dev client.
//
// A *static* `require('expo-haptics')` is resolved by Metro at BUILD time even when
// wrapped in try/catch or a dead branch; for an unresolved module it emits a dev
// "Requiring unknown module 'undefined'" LogBox overlay on the first haptic call.
// Haptics fire on a hot path (every button press) so that overlay blocked the UI.
//
// Haptics never actually worked here (module absent), so we resolve the native
// module via expo-modules-core's optional loader — which returns null instead of
// throwing — and drive it through that native handle. No static expo-haptics
// require, so no LogBox overlay; real feedback lights up automatically once
// `npx expo install expo-haptics` is run and the dev client is rebuilt.
//
// Usage:  import { haptics } from '../utils/haptics';  haptics.success();
import type { HapticKind } from '@shared/constants/motion';

// Native ExpoHaptics module surface (subset we use).
type NativeHaptics = {
  selectionAsync?: () => Promise<void>;
  impactAsync?: (style: string) => Promise<void>;
  notificationAsync?: (type: string) => Promise<void>;
};

let mod: NativeHaptics | null | undefined;

function get(): NativeHaptics | null {
  if (mod !== undefined) return mod;
  mod = null;
  try {
    // expo-modules-core is always present (core Expo dependency). Its optional
    // loader returns null for a missing native module rather than throwing.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const core = require('expo-modules-core');
    mod = (core.requireOptionalNativeModule?.('ExpoHaptics') as NativeHaptics) ?? null;
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
        h.selectionAsync?.();
        break;
      case 'medium':
        h.impactAsync?.('medium');
        break;
      case 'success':
        h.notificationAsync?.('success');
        break;
      case 'warning':
        h.notificationAsync?.('warning');
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

import { Platform } from 'react-native';

/**
 * Virtualization settings for every long vertical list (doctrine §10.8):
 * render a screenful up front, keep the window small, and let Android drop
 * off-screen views. `removeClippedSubviews` is Android-only because on iOS it
 * clips views that are still visible during fast scrolls.
 */
export const LIST_PERF = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 6,
  windowSize: 7,
  removeClippedSubviews: Platform.OS === 'android',
} as const;

/**
 * Chat threads are `inverted` and their rows vary a lot in height, which is
 * where `removeClippedSubviews` misplaces items on Android — keep the rest.
 */
export const CHAT_LIST_PERF = {
  initialNumToRender: 15,
  maxToRenderPerBatch: 10,
  windowSize: 9,
} as const;

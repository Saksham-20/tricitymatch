import { useCallback } from 'react';
import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useReduceMotion } from '../components/motion';
import { useUIStore } from '../stores/uiStore';

type StackAnimation = NonNullable<NativeStackNavigationOptions['animation']>;

/**
 * The push animation for a hierarchical screen. iOS keeps the native slide
 * (the interactive edge-swipe pop comes free); Android's stock "default" is an
 * abrupt fade-zoom, and a slide-from-right reads as hierarchy on both.
 */
export const PUSH_ANIMATION: StackAnimation = Platform.OS === 'android' ? 'slide_from_right' : 'default';

/**
 * ONE place that decides how a stack navigator moves (doctrine §10.2 ruling
 * 18 / §10.4): elder mode drops navigation animation outright (`'none'`);
 * Reduce Motion keeps a gentle cross-fade (`'fade'`, gentler not zero, so the
 * app still visibly hears the tap); otherwise the caller's intended animation.
 * Every stack navigator in the app resolves its `animation` through this, so
 * the first screens a Reduce Motion member meets (splash, welcome, sign-in)
 * behave the same as the rest.
 *
 * ```ts
 * const anim = useNavAnimation();
 * <Stack.Navigator screenOptions={{ animation: anim() }} />                  // the stock default
 * <Stack.Screen options={{ animation: anim('slide_from_bottom') }} />        // a sheet-like screen
 * ```
 */
export function useNavAnimation(): (normal?: StackAnimation) => StackAnimation {
  const elderMode = useUIStore((s) => s.elderMode);
  const reduceMotion = useReduceMotion();
  return useCallback(
    (normal: StackAnimation = 'default') => (elderMode ? 'none' : reduceMotion ? 'fade' : normal),
    [elderMode, reduceMotion],
  );
}

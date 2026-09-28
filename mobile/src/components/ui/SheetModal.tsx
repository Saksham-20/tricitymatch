import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Modal, Pressable, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { duration, EASE_DRAWER, EASE_OUT } from '@shared/constants/motion';
import { useReduceMotion } from '../motion';
import { useUIStore } from '../../stores/uiStore';

const OUT = Easing.bezier(...EASE_OUT);
const DRAWER = Easing.bezier(...EASE_DRAWER);

/** A neutral scrim. Callers with a solid Reduce-Transparency variant pass their own. */
export const SHEET_SCRIM = 'rgba(0,0,0,0.4)';

interface SheetModalProps {
  visible: boolean;
  /** Scrim tap and the Android hardware back button. */
  onRequestClose: () => void;
  /** The sheet's own style: radius, background, padding, maxHeight. It is bottom-anchored. */
  sheetStyle?: StyleProp<ViewStyle>;
  scrimColor?: string;
  /** Screen-reader label for the scrim's dismiss target. */
  closeLabel?: string;
  children: React.ReactNode;
}

/**
 * The single bottom-sheet shell for simple, non-draggable RN-Modal sheets.
 *
 * Why not `<Modal animationType="slide">`: that slides the WHOLE modal window,
 * scrim included, so a dark curtain rises with the sheet and nothing fades. Here
 * the Modal is `animationType="none"` and the two layers move independently —
 * the scrim FADES (`duration.modal` in / `modalExit` out, ease-out) and the
 * sheet SLIDES from its own measured height (`duration.sheet` / `sheetExit`,
 * `EASE_DRAWER`). No spring: no finger is on it. Occasional tier, purpose
 * "spatial consistency" — the sheet arrives from where it will leave to.
 *
 * Exit: `mounted` outlives `visible` so the exit can play, and the Modal is
 * unmounted from the sheet's `withTiming` completion (one `runOnJS`, never per
 * frame). Reopening mid-exit reverses from the current position; the cancelled
 * exit reports `finished === false`, so it cannot unmount a sheet that came back.
 *
 * Reduce Motion and elder mode: opacity only, no translation.
 *
 * A draggable, detented sheet is gorhom (doctrine §10.7); this is for the
 * single-select / simple-content case, where a drag handle would promise a
 * gesture the sheet does not have.
 */
export default function SheetModal({
  visible,
  onRequestClose,
  sheetStyle,
  scrimColor = SHEET_SCRIM,
  closeLabel,
  children,
}: SheetModalProps) {
  const { t } = useTranslation();
  // Elder mode carries no motion beyond opacity, same as the OS setting.
  const osReduced = useReduceMotion();
  const elderMode = useUIStore((s) => s.elderMode);
  const reduced = osReduced || elderMode;
  const { height: windowHeight } = useWindowDimensions();

  const [mounted, setMounted] = useState(visible);
  const mountedRef = useRef(visible);
  const wantOpen = useRef(visible);
  const measured = useRef(false);
  const enterStarted = useRef(false);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const scrim = useSharedValue(0);
  const sheet = useSharedValue(0);
  // Until the first layout the sheet is parked a full screen below — always off-screen.
  const sheetHeight = useSharedValue(windowHeight);

  const unmount = useCallback(() => {
    // Reopened while the exit was finishing: nothing to tear down.
    if (wantOpen.current) return;
    mountedRef.current = false;
    measured.current = false;
    enterStarted.current = false;
    setMounted(false);
  }, []);

  const enter = useCallback(() => {
    enterStarted.current = true;
    const r = reducedRef.current;
    scrim.value = withTiming(1, { duration: duration.modal, easing: OUT });
    sheet.value = withTiming(1, r ? { duration: duration.modal, easing: OUT } : { duration: duration.sheet, easing: DRAWER });
  }, [scrim, sheet]);

  const exit = useCallback(() => {
    enterStarted.current = false;
    const r = reducedRef.current;
    scrim.value = withTiming(0, { duration: duration.modalExit, easing: OUT });
    sheet.value = withTiming(
      0,
      r ? { duration: duration.modalExit, easing: OUT } : { duration: duration.sheetExit, easing: DRAWER },
      (finished) => {
        'worklet';
        if (finished) runOnJS(unmount)();
      },
    );
  }, [scrim, sheet, unmount]);

  useEffect(() => {
    wantOpen.current = visible;
    if (visible) {
      if (!mountedRef.current) {
        // First open: mount hidden; the enter starts from the sheet's first
        // layout, once its height is known.
        mountedRef.current = true;
        setMounted(true);
      } else if (measured.current && !enterStarted.current) {
        // Reopened during an exit: reverse from wherever the sheet is.
        enter();
      }
    } else if (mountedRef.current) {
      if (enterStarted.current) exit();
      else if (!measured.current) unmount(); // closed before it ever appeared
    }
  }, [visible, enter, exit, unmount]);

  const onSheetLayout = (e: LayoutChangeEvent) => {
    sheetHeight.value = e.nativeEvent.layout.height;
    measured.current = true;
    if (wantOpen.current && !enterStarted.current) enter();
  };

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  const sheetAnimStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: sheet.value }
      : { transform: [{ translateY: (1 - sheet.value) * sheetHeight.value }] },
  );

  // `visible ||` so the render that flips visible on already carries the Modal.
  if (!visible && !mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onRequestClose}>
      <View style={styles.root} accessibilityViewIsModal>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }, scrimStyle]} />
        {/* Plain Pressable: a full-bleed scrim must not scale. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onRequestClose}
          disabled={!visible}
          accessibilityRole="button"
          accessibilityLabel={closeLabel ?? t('common.close', 'Close')}
        />
        {/* Inert while leaving, so a second tap cannot land on a sheet that is already closing. */}
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          onLayout={onSheetLayout}
          style={[sheetStyle, sheetAnimStyle]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
});

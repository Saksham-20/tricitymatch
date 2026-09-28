import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  Modal,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Text from '../../../components/ui/Text';
import Button from '../../../components/ui/Button';
import FastImage from 'react-native-fast-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius } from '@shared/constants/theme';
import { resolveImageUri } from '../../../components/common/SmartImage';
import { PressableScale, useReduceMotion, useReduceTransparency } from '../../../components/motion';
import { useTheme } from '../../../hooks/useTheme';
import { tapSize } from '../../../utils/elderTheme';

/**
 * The viewer is a photo lightbox: black canvas, white chrome, in both themes.
 * These are deliberate theme-invariant colours, not a light palette leaking
 * into dark mode (the chrome sits on the photo, not on an app surface).
 */
const CANVAS = '#000';
const CHROME = '#fff';
/**
 * Translucent chrome fills, and the solid stand-ins for Reduce Transparency.
 * Both are DARK fills: a lightening fill (white at 16%) under white caption
 * text sinks to about 3:1 over a bright photo, and the counter sits on the
 * photo whenever its aspect fills the screen. The counter carries text, so it
 * takes 60% black (4.5:1+ even over a pure-white pixel); the round buttons
 * carry glyphs, which only need 3:1, so 45% holds.
 */
const CHROME_FILL = { counter: 'rgba(0,0,0,0.6)', button: 'rgba(0,0,0,0.45)' } as const;
const CHROME_SOLID = { counter: '#2d2d2d', button: '#1a1a1a' } as const;
/** Touch may drift this far off a control before the press cancels (doctrine §10.8). */
const RETENTION = { top: 10, bottom: 10, left: 10, right: 10 } as const;

interface PhotoGalleryViewerProps {
  photos: string[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

/** One full-screen page. A failed photo gets an explanation and a working retry. */
function GalleryPage({ uri, width, height, label }: { uri: string; width: number; height: number; label: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (failed) {
    return (
      <View style={[s.failedPage, { width, height }]}>
        <Ionicons name="image-outline" size={40} color={CHROME} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <Text variant="subhead" style={{ color: CHROME }}>Couldn't load this photo</Text>
        <Button
          title="Try again"
          variant="ghost"
          size="sm"
          haptic={false}
          onPress={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
          testID="gallery-retry"
        />
      </View>
    );
  }

  return (
    <View style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <FastImage
        key={attempt}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={FastImage.resizeMode.contain}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

/**
 * Full-screen photo viewer for the story scroll: swipe between all of a
 * profile's (viewable) photos in one place, with arrow buttons (the visible
 * tap path for every swipe), an index counter, and a close button. Opens from
 * any photo tap or the hero's photo-count chip.
 */
export default function PhotoGalleryViewer({ photos, initialIndex, visible, onClose }: PhotoGalleryViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { elder } = useTheme();
  const reduceMotion = useReduceMotion();
  const reduceTransparency = useReduceTransparency();
  const listRef = useRef<FlatList<string>>(null);
  const announced = useRef<number | null>(null);
  const [index, setIndex] = useState(initialIndex);

  const resolved = photos.map((p) => resolveImageUri(p)).filter((p): p is string => !!p);
  const count = resolved.length;
  const tap = tapSize(elder);
  const fill = reduceTransparency ? CHROME_SOLID : CHROME_FILL;

  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  // Swiping changes the photo without a tap on any control, so say which one
  // is showing. The first value after opening is what the screen reader reads
  // anyway; only later changes are announced.
  useEffect(() => {
    if (!visible) {
      announced.current = null;
      return;
    }
    if (announced.current === null) {
      announced.current = index;
      return;
    }
    if (announced.current !== index) {
      announced.current = index;
      AccessibilityInfo.announceForAccessibility(`Photo ${index + 1} of ${count}`);
    }
  }, [index, visible, count]);

  if (count === 0) return null;

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(count - 1, next));
    if (clamped === index) return;
    listRef.current?.scrollToIndex({ index: clamped, animated: !reduceMotion });
    setIndex(clamped);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.wrap, { backgroundColor: CANVAS }]}>
        <FlatList
          ref={listRef}
          data={resolved}
          horizontal
          pagingEnabled
          initialScrollIndex={Math.min(initialIndex, count - 1)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(item, i) => `${i}:${item}`}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <GalleryPage uri={item} width={width} height={height} label={`Photo ${i + 1} of ${count}`} />
          )}
        />

        {/* Top bar: counter + close */}
        <View style={[s.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
          <View
            style={[s.counter, { backgroundColor: fill.counter }]}
            accessible
            accessibilityLabel={`Photo ${index + 1} of ${count}`}
          >
            <Text variant="caption" style={{ color: CHROME }}>
              {index + 1} / {count}
            </Text>
          </View>
          <PressableScale
            scaleTo={0.9}
            onPress={onClose}
            style={[s.circleBtn, { width: tap, height: tap, borderRadius: tap / 2, backgroundColor: fill.button }]}
            accessibilityRole="button"
            accessibilityLabel="Close gallery"
            pressRetentionOffset={RETENTION}
            testID="gallery-close"
          >
            <Ionicons name="close" size={24} color={CHROME} />
          </PressableScale>
        </View>

        {/* Arrows */}
        {index > 0 && (
          <PressableScale
            scaleTo={0.9}
            onPress={() => goTo(index - 1)}
            style={[
              s.circleBtn,
              s.arrow,
              { left: spacing.md, width: tap, height: tap, borderRadius: tap / 2, marginTop: -tap / 2, backgroundColor: fill.button },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Previous photo"
            pressRetentionOffset={RETENTION}
            testID="gallery-prev"
          >
            <Ionicons name="chevron-back" size={26} color={CHROME} />
          </PressableScale>
        )}
        {index < count - 1 && (
          <PressableScale
            scaleTo={0.9}
            onPress={() => goTo(index + 1)}
            style={[
              s.circleBtn,
              s.arrow,
              { right: spacing.md, width: tap, height: tap, borderRadius: tap / 2, marginTop: -tap / 2, backgroundColor: fill.button },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Next photo"
            pressRetentionOffset={RETENTION}
            testID="gallery-next"
          >
            <Ionicons name="chevron-forward" size={26} color={CHROME} />
          </PressableScale>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  counter: {
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  circleBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
  },
  failedPage: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});

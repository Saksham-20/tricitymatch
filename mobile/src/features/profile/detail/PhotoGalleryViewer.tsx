import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, type, borderRadius } from '@shared/constants/theme';
import { resolveImageUri } from '../../../components/common/SmartImage';
import { PressableScale } from '../../../components/motion';
import { haptics } from '../../../utils/haptics';

interface PhotoGalleryViewerProps {
  photos: string[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

/**
 * Full-screen photo viewer for the story scroll: swipe between all of a
 * profile's (viewable) photos in one place, with arrow buttons, an index
 * counter, and a close button. Opens from any photo tap or the hero's
 * photo-count chip.
 */
export default function PhotoGalleryViewer({ photos, initialIndex, visible, onClose }: PhotoGalleryViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  const resolved = photos.map((p) => resolveImageUri(p)).filter((p): p is string => !!p);
  if (resolved.length === 0) return null;

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(resolved.length - 1, next));
    if (clamped === index) return;
    haptics.light();
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
    setIndex(clamped);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View style={s.wrap}>
        <FlatList
          ref={listRef}
          data={resolved}
          horizontal
          pagingEnabled
          initialScrollIndex={Math.min(initialIndex, resolved.length - 1)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width, height }}>
              <FastImage
                source={{ uri: item }}
                style={StyleSheet.absoluteFill}
                resizeMode={FastImage.resizeMode.contain}
              />
            </View>
          )}
        />

        {/* Top bar: counter + close */}
        <View style={[s.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
          <View style={s.counter}>
            <Text style={s.counterText}>
              {index + 1} / {resolved.length}
            </Text>
          </View>
          <PressableScale
            scaleTo={0.9}
            onPress={onClose}
            style={s.circleBtn}
            accessibilityRole="button"
            accessibilityLabel="Close gallery"
            testID="gallery-close"
          >
            <Ionicons name="close" size={24} color="#fff" />
          </PressableScale>
        </View>

        {/* Arrows */}
        {index > 0 && (
          <PressableScale
            scaleTo={0.9}
            onPress={() => goTo(index - 1)}
            style={[s.circleBtn, s.arrow, { left: spacing.md }]}
            accessibilityRole="button"
            accessibilityLabel="Previous photo"
            testID="gallery-prev"
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </PressableScale>
        )}
        {index < resolved.length - 1 && (
          <PressableScale
            scaleTo={0.9}
            onPress={() => goTo(index + 1)}
            style={[s.circleBtn, s.arrow, { right: spacing.md }]}
            accessibilityRole="button"
            accessibilityLabel="Next photo"
            testID="gallery-next"
          >
            <Ionicons name="chevron-forward" size={26} color="#fff" />
          </PressableScale>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  counterText: { ...type.caption, color: '#fff' },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
  },
});

import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Text from '../../../components/ui/Text';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import GoldLock from '../../../components/ui/GoldLock';
import FastImage from 'react-native-fast-image';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { resolveImageUri } from '../../../components/common/SmartImage';
import { PressableScale } from '../../../components/motion';
import { useTheme } from '../../../hooks/useTheme';
import { haptics } from '../../../utils/haptics';

interface PhotoBlockProps {
  uri: string;
  /** Plain functional caption under the photo, e.g. "Photo 2 of 4". */
  caption?: string;
  /** Premium gate: the photo is blurred behind a gold lock for non-premium viewers. */
  locked?: boolean;
  /** Unlock CTA on the lock overlay. Without it the lock shows no button. */
  onLockedPress?: () => void;
  /** Tap to open the full-screen gallery viewer (unlocked photos only). */
  onPress?: () => void;
  /**
   * Mention this photo in a first message. Reachable by long-press AND by the
   * visible "Mention this photo" button, so the gesture is never the only path.
   */
  onAppreciate?: () => void;
}

/**
 * Full-width 4:5 photo woven into the story scroll. A locked photo renders
 * through the shared `GoldLock` (real blur, opaque under Reduce Transparency),
 * so a free viewer never sees the unblurred image. A photo that fails to load
 * shows an error tile with a working retry instead of silently vanishing.
 */
export default function PhotoBlock({ uri, caption, locked = false, onLockedPress, onPress, onAppreciate }: PhotoBlockProps) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const { width } = useWindowDimensions();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const resolved = resolveImageUri(uri);
  if (!resolved) return null;

  const photoW = width - spacing.gutter * 2;
  const photoH = Math.round((photoW * 5) / 4);

  const image = (
    <FastImage
      key={attempt}
      source={{ uri: resolved }}
      style={StyleSheet.absoluteFill}
      resizeMode={FastImage.resizeMode.cover}
      onError={() => setFailed(true)}
    />
  );

  if (locked) {
    return (
      <View style={s.wrap}>
        <GoldLock title="Photo locked" ctaLabel="Upgrade to view" onUnlock={onLockedPress} testID="photo-locked">
          {/* The real image sits behind the blur; screen readers must not read it. */}
          <View
            style={[s.photoHolder, { width: photoW, height: photoH }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {image}
          </View>
        </GoldLock>
      </View>
    );
  }

  // The error tile holds its own button, so it must not sit inside the photo's
  // Pressable (an accessible Pressable swallows its children for screen readers).
  if (failed) {
    return (
      <View style={s.wrap}>
        <View style={[s.photoHolder, s.failed, { width: photoW, height: photoH }]}>
          <EmptyState
            variant="error"
            icon="image-outline"
            title="Couldn't load this photo"
            actionLabel="Try again"
            onAction={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
            testID="photo-error"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <PressableScale
        scaleTo={0.98}
        onPress={onPress}
        // Long-press reveals the sheet: the one place this screen fires a haptic
        // for opening something, because a held press has no other confirmation.
        onLongPress={
          onAppreciate
            ? () => {
                haptics.medium();
                onAppreciate();
              }
            : undefined
        }
        delayLongPress={350}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        disabled={!onPress && !onAppreciate}
        accessibilityRole={onPress ? 'imagebutton' : 'image'}
        accessibilityLabel={caption ?? 'Profile photo'}
        style={[s.photoHolder, { width: photoW, height: photoH }]}
      >
        {image}
      </PressableScale>
      {(!!caption || !!onAppreciate) && (
        <View style={s.captionBand}>
          {!!caption && (
            <Text variant="footnote" color="textSecondary" style={s.caption}>
              {caption}
            </Text>
          )}
          {!!onAppreciate && (
            <Button
              title="Mention this photo"
              variant="text"
              size="sm"
              icon="chatbubble-ellipses-outline"
              haptic={false}
              onPress={onAppreciate}
              testID="photo-mention"
            />
          )}
        </View>
      )}
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrap: { paddingHorizontal: spacing.gutter, marginTop: spacing.xl },
  photoHolder: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: c.surface2,
  },
  failed: { alignItems: 'center', justifyContent: 'center' },
  captionBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  caption: { flexShrink: 1 },
});

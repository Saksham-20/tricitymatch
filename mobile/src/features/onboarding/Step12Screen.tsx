import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View, StyleSheet, Alert, ActivityIndicator, AccessibilityInfo, useWindowDimensions,
} from 'react-native';
import Text from '../../components/ui/Text';
import { Badge } from '../../components/ui';
import SmartImage from '../../components/common/SmartImage';
import { PressableScale, useReduceTransparency } from '../../components/motion';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { haptics } from '../../utils/haptics';
import { tapSize } from '../../utils/elderTheme';
import { showToast } from '../../utils/toast';
import { refreshProfileCaches } from '../../utils/profileCache';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';
import { uploadPhoto, deletePhoto, getMyProfile, mainFirst } from '../../api/profile';

const MAX_PHOTOS = 6;
// Three tiles per row at any phone width; the cap keeps them sane on a tablet.
// Elder mode goes to two: its 60pt controls stack two to a tile (remove on top,
// make-main along the bottom) and a 3-across tile is too short to hold both.
const GRID_COLUMNS = 3;
const GRID_COLUMNS_ELDER = 2;
const SLOT_MAX = 140;
const SLOT_MAX_ELDER = 180;

// A drifting finger must not cancel a press (doctrine §10.8).
const RETAIN = { top: 10, bottom: 10, left: 10, right: 10 } as const;
// The remove disc and the make-main pill are small so they do not bury the photo.
// The PRESSABLE around each is a real tap-sized box run flush to the tile edge and
// the mark sits inside it, so the whole target lies within the tile. (hitSlop would
// not do here: a touch outside the parent's bounds is never delivered, and these
// marks are inset from the tile edge.)
const MARK_SIZE = 24;
const MARK_SIZE_ELDER = 32;
const MARK_INSET = 4;
// Reduce Transparency: the tint over a photo becomes solid (doctrine §10.5),
// same value the profile-detail scrims fall back to.
const SOLID_SCRIM = '#1a1a1a';
const TINT_SCRIM = 'rgba(0,0,0,0.55)';

// Guidelines: two do's and one don't. The icon, not just the colour, says which.
const GUIDES = [
  { key: 'guide1', fallback: 'Clear, well-lit face photo', ok: true },
  { key: 'guide2', fallback: 'No group photos or sunglasses', ok: false },
  { key: 'guide3Plain', fallback: 'Recent, taken within the last year', ok: true },
] as const;

type ApiFailure = { response?: { status?: number; data?: { error?: { message?: string; code?: string } } } };

interface PendingUpload {
  uri: string;
  mimeType: string;
  status: 'uploading' | 'failed';
}

const announce = (message: string) => AccessibilityInfo.announceForAccessibility(message);

export default function Step12Screen() {
  const { c, elder } = useTheme();
  const { width } = useWindowDimensions();
  const reduceTransparency = useReduceTransparency();
  const mark = elder ? MARK_SIZE_ELDER : MARK_SIZE;
  const columns = elder ? GRID_COLUMNS_ELDER : GRID_COLUMNS;
  // Content width is the screen minus the layout's gutters; the tiles + their gaps fill it.
  const slot = Math.min(
    elder ? SLOT_MAX_ELDER : SLOT_MAX,
    Math.floor((width - 2 * spacing.gutter - (columns - 1) * spacing.sm) / columns),
  );
  // Remove sits top-right and make-main runs along the bottom, so the two boxes
  // share the tile's height: each gets the full target where it fits and half the
  // tile where it does not, never overlapping.
  const hit = Math.min(tapSize(elder), Math.floor(slot / 2));
  const styles = React.useMemo(
    () => makeStyles(c, mark, slot, hit, reduceTransparency),
    [c, mark, slot, hit, reduceTransparency],
  );
  const { t } = useTranslation();
  const { data, update, saveAndNext } = useOnboarding();

  // Hydrated from the journey context so returning to this step shows the photos
  // already on the profile (it used to start empty and demand another upload).
  const [photos, setPhotos] = useState<string[]>(data.photos);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);

  // The async paths below read the gallery through a ref so they always see the
  // current list, never the one captured when they started.
  const photosRef = useRef(photos);
  // True only once the member has chosen a different main photo here (make-main,
  // or removing the one shown as main). Until then the server's own choice stands.
  const mainTouched = useRef(false);

  const busy = pending?.status === 'uploading' || removingUrl !== null;
  const isValid = photos.length > 0;

  // Every change goes to this screen AND the journey context in one step, from
  // the async continuation itself. Back and Skip stay live during an upload, so
  // a write that waited for an effect on this screen would be lost once it
  // unmounted, and re-entry would show a stale grid.
  const commitPhotos = useCallback((next: string[]) => {
    photosRef.current = next;
    setPhotos(next);
    update({ photos: next });
    // Photos persist the moment they upload or are removed (no patch rides on
    // Continue), and they are worth 13 completion points on Home's ring.
    refreshProfileCaches();
  }, [update]);

  // The photos as the server has them now, keeping a main-photo choice made on
  // this screen that Continue has not saved yet. Null when it cannot be read.
  const loadServerPhotos = useCallback(async (): Promise<string[] | null> => {
    try {
      const live = mainFirst(await getMyProfile());
      const chosen = mainTouched.current ? photosRef.current[0] : undefined;
      return chosen && live.includes(chosen) ? [chosen, ...live.filter((u) => u !== chosen)] : live;
    } catch {
      return null;
    }
  }, []);

  // The count changes when an upload lands or a removal finishes, neither of
  // which is a tap on the count itself, so announce it.
  const prevCount = useRef(photos.length);
  useEffect(() => {
    if (prevCount.current === photos.length) return;
    prevCount.current = photos.length;
    announce(t('onboarding.step12.count', { count: photos.length, max: MAX_PHOTOS }));
  }, [photos.length, t]);

  const upload = async (asset: { uri: string; mimeType: string }) => {
    setPending({ ...asset, status: 'uploading' });
    // The uploading tile appears with no focus move of its own, so say so.
    announce(t('onboarding.step12.uploading', 'Uploading photo'));
    try {
      const formData = new FormData();
      formData.append('photos', {
        uri: asset.uri,
        type: asset.mimeType,
        name: `photo_${photosRef.current.length}.jpg`,
      } as unknown as Blob);
      const { url } = await uploadPhoto(formData, 'photos');
      // A url already in the grid is a failed upload, not a copy (an older
      // server dropped the NEW file at its 6-photo cap and answered success).
      if (!url || photosRef.current.includes(url)) throw new Error('photo was not stored');
      haptics.light();
      commitPhotos([...photosRef.current, url]);
      setPending(null);
    } catch (e) {
      const failure = (e as ApiFailure)?.response?.data?.error;
      if (failure?.code === 'GALLERY_FULL') {
        // The server already holds six (some added elsewhere): a retry would
        // fail the same way. Say so in its words and show what it has.
        setPending(null);
        const live = await loadServerPhotos();
        if (live) commitPhotos(live);
        const message = failure.message || t('onboarding.step12.uploadError');
        showToast.error(message);
        announce(message);
        return;
      }
      // Keep the picked photo so Retry does not send the user back to the library.
      setPending({ ...asset, status: 'failed' });
      const message = t('onboarding.step12.uploadError');
      showToast.error(message);
      announce(message);
    }
  };

  const pickImage = async () => {
    if (busy) return;
    try {
      // No permission pre-request. The library picker is a system surface that
      // needs none, and gating on requestMediaLibraryPermissionsAsync dead-ended
      // Android 7-12 (it also asks for WRITE_EXTERNAL_STORAGE, which the manifest
      // strips, so it can never report "granted"). EditProfile picks the same way.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [4, 5],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await upload({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
    } catch {
      const message = t('onboarding.step12.pickError', 'Could not open your photos. Please try again.');
      showToast.error(message);
      announce(message);
    }
  };

  const retryUpload = () => {
    if (pending?.status === 'failed') upload(pending);
  };

  // Removing must delete the photo on the server. Dropping it from local state
  // alone left it on the live profile while the confirm said it was removed.
  const removePhoto = async (url: string) => {
    setRemovingUrl(url);
    let next: string[] | null = null;
    try {
      await deletePhoto(url);
      next = photosRef.current.filter((p) => p !== url);
    } catch (e) {
      // A 404 is not taken as "already gone": an older server answered 404 for
      // a main photo it was still showing, and the tile vanished here while the
      // photo stayed live. Ask the server what it really has.
      if ((e as ApiFailure)?.response?.status === 404) {
        const live = await loadServerPhotos();
        if (live && !live.includes(url)) next = live;
      }
    }
    if (!next) {
      const message = t('onboarding.step12.removeError', 'Could not remove that photo. Please try again.');
      showToast.error(message);
      announce(message);
      setRemovingUrl(null);
      return;
    }
    haptics.light();
    // Removing the photo shown as main promotes the next one, so that choice is ours to write.
    if (photosRef.current[0] === url) mainTouched.current = true;
    commitPhotos(next);
    setRemovingUrl(null);
  };

  // Destructive and irreversible: the one place a native confirm belongs.
  const confirmRemove = (index: number) => {
    const url = photos[index];
    if (!url) return;
    Alert.alert(
      t('onboarding.step12.removeTitle'),
      t('onboarding.step12.removeMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => { removePhoto(url); },
        },
      ],
    );
  };

  // The server keeps the gallery in upload order and honours exactly one thing
  // about order: which photo is the main one. So that is the only reordering
  // offered (a swap of tiles 2 to 6 would look saved and vanish next session).
  const makeMain = (index: number) => {
    const current = photosRef.current;
    if (index <= 0 || index >= current.length || busy) return;
    haptics.light();
    mainTouched.current = true;
    commitPhotos([current[index], ...current.filter((_, i) => i !== index)]);
    announce(t('onboarding.step12.nowMain', 'This photo is now your main photo'));
  };

  // Photos are saved as they are added, so the only thing left to write here is
  // a main-photo choice made on this screen. Sending photos[0] every time would
  // overwrite a main the member set elsewhere whenever the grid is in upload order.
  const handleContinue = async () => {
    const first = photosRef.current[0];
    await saveAndNext(
      { photos: photosRef.current },
      mainTouched.current && first ? { profilePhoto: first } : {},
    );
  };

  const handleSkip = async () => {
    await saveAndNext({}, {});
  };

  const photoLabel = (i: number) =>
    t(i === 0 ? 'onboarding.step12.photoOfMain' : 'onboarding.step12.photoOf', {
      index: i + 1,
      count: photos.length,
      defaultValue: i === 0 ? 'Photo {{index}} of {{count}}, main photo' : 'Photo {{index}} of {{count}}',
    });

  const showAddSlot = !pending && photos.length < MAX_PHOTOS;

  return (
    <OnboardingLayout
      step={12}
      title={t('onboarding.step12.title')}
      subtitle={t('onboarding.step12.subtitleClear', 'Your first photo is the one members see first.')}
      onContinue={handleContinue}
      continueDisabled={!isValid || busy}
      skippable
      onSkip={handleSkip}
    >
      {/* Guidelines */}
      <View style={styles.guidelines}>
        {GUIDES.map((g) => (
          <View key={g.key} style={styles.guideRow}>
            <Ionicons
              name={g.ok ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={g.ok ? c.successAccent : c.error}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <Text variant="footnote" color="textSecondary" style={styles.guideText}>
              {t(`onboarding.step12.${g.key}`, g.fallback)}
            </Text>
          </View>
        ))}
      </View>

      {/* Photo grid */}
      <View>
        <View style={styles.grid}>
          {photos.map((photo, i) => {
            const isRemoving = removingUrl === photo;
            return (
              <View key={`photo-${photo}`} style={styles.photoSlot} testID={`photo-${i}`}>
                <View
                  style={styles.photoClip}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={photoLabel(i)}
                >
                  <SmartImage uri={photo} name={data.firstName} style={styles.photoImg} initialSize={32} />
                </View>

                {/* Main badge. The tile's label already says "main photo", so the
                    badge is hidden from a screen reader rather than read twice. */}
                {i === 0 && (
                  <View
                    style={styles.primaryBadge}
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <Badge label={t('onboarding.step12.primary')} tone="primary" />
                  </View>
                )}

                {/* Remove: a real tap-sized box in the tile's corner, the disc inside it */}
                <PressableScale
                  style={styles.removeHit}
                  onPress={() => confirmRemove(i)}
                  disabled={busy}
                  testID={`btn-remove-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.step12.removePhotoN', {
                    index: i + 1,
                    defaultValue: 'Remove photo {{index}}',
                  })}
                  accessibilityState={{ disabled: busy }}
                  pressRetentionOffset={RETAIN}
                >
                  <View style={styles.removeDisc}>
                    <Ionicons name="close" size={mark - 10} color={c.onPrimary} />
                  </View>
                </PressableScale>

                {/* Make main: the first photo is the one members see first */}
                {i > 0 && (
                  <PressableScale
                    style={styles.makeMainHit}
                    onPress={() => makeMain(i)}
                    disabled={busy}
                    testID={`btn-make-main-${i}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('onboarding.step12.makeMainN', {
                      index: i + 1,
                      defaultValue: 'Make photo {{index}} your main photo',
                    })}
                    accessibilityState={{ disabled: busy }}
                    pressRetentionOffset={RETAIN}
                  >
                    <View style={styles.makeMainPill}>
                      <Text variant="caption" color="onPrimary" numberOfLines={1} maxScale={1.15}>
                        {t('onboarding.step12.makeMain', 'Make main')}
                      </Text>
                    </View>
                  </PressableScale>
                )}

                {isRemoving ? (
                  <View style={styles.removingVeil} pointerEvents="none">
                    <ActivityIndicator color={c.onPrimary} />
                  </View>
                ) : null}
              </View>
            );
          })}

          {/* Upload in flight, or failed with a way to retry */}
          {pending?.status === 'uploading' ? (
            <View
              style={styles.addSlot}
              testID="photo-uploading"
              accessible
              accessibilityLabel={t('onboarding.step12.uploading', 'Uploading photo')}
              accessibilityState={{ busy: true }}
            >
              <ActivityIndicator color={c.accent} />
            </View>
          ) : null}

          {pending?.status === 'failed' ? (
            <View style={styles.photoSlot} testID="photo-failed">
              <PressableScale
                style={styles.failedSlot}
                onPress={retryUpload}
                testID="btn-retryPhoto"
                accessibilityRole="button"
                accessibilityLabel={`${t('onboarding.step12.uploadFailed', 'Upload failed')}. ${t('onboarding.step12.tapToRetry', 'Tap to retry')}`}
                pressRetentionOffset={RETAIN}
              >
                <Ionicons
                  name="refresh"
                  size={24}
                  color={c.error}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
                <Text variant="caption" color="error" style={styles.slotText} numberOfLines={2} maxScale={1.15}>
                  {t('onboarding.step12.uploadFailed', 'Upload failed')}
                </Text>
                <Text variant="caption" color="textSecondary" style={styles.slotText} numberOfLines={2} maxScale={1.15}>
                  {t('onboarding.step12.tapToRetry', 'Tap to retry')}
                </Text>
              </PressableScale>
              <PressableScale
                style={styles.removeHit}
                onPress={() => setPending(null)}
                testID="btn-dismissFailed"
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.step12.dismissFailed', 'Discard failed upload')}
                pressRetentionOffset={RETAIN}
              >
                <View style={styles.removeDisc}>
                  <Ionicons name="close" size={mark - 10} color={c.onPrimary} />
                </View>
              </PressableScale>
            </View>
          ) : null}

          {/* Add */}
          {showAddSlot ? (
            <PressableScale
              style={styles.addSlot}
              onPress={pickImage}
              disabled={busy}
              testID="btn-addPhoto"
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.step12.addPhoto')}
              accessibilityState={{ disabled: busy }}
              pressRetentionOffset={RETAIN}
            >
              <Ionicons
                name="add"
                size={32}
                color={c.primary}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <Text variant="caption" color="primary" style={styles.slotText} numberOfLines={2} maxScale={1.15}>
                {photos.length === 0 ? t('onboarding.step12.addFirst') : t('onboarding.step12.addMore')}
              </Text>
            </PressableScale>
          ) : null}
        </View>

        <Text variant="footnote" color="textSecondary" style={styles.countHint}>
          {t('onboarding.step12.count', { count: photos.length, max: MAX_PHOTOS })}
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const makeStyles = (
  c: ThemeColours, mark: number, slot: number, hit: number, reduceTransparency: boolean,
) => StyleSheet.create({
  guidelines: { gap: spacing.xs },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  guideText: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  photoSlot: {
    width: slot,
    height: slot,
  },
  photoClip: {
    width: slot,
    height: slot,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  photoImg: {
    width: slot,
    height: slot,
    borderRadius: borderRadius.md,
  },
  addSlot: {
    width: slot,
    height: slot,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: c.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    backgroundColor: c.primaryLight,
  },
  failedSlot: {
    width: slot,
    height: slot,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: c.error,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    backgroundColor: c.errorBg,
  },
  slotText: { textAlign: 'center' },
  primaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
  },
  // The tap target: a `hit`-sized box flush to the tile's top-right corner. It has
  // no fill; the disc inside it is the only thing drawn.
  removeHit: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: hit,
    height: hit,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: MARK_INSET,
  },
  removeDisc: {
    backgroundColor: c.error,
    borderRadius: borderRadius.full,
    width: mark,
    height: mark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The tap target: a `hit`-tall box flush to the tile's bottom edge, full width.
  makeMainHit: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: hit,
    justifyContent: 'flex-end',
    padding: MARK_INSET,
  },
  // Scrim over a photo: the dark tint is theme-independent on purpose, the
  // photo underneath does not change with the theme. Solid under Reduce Transparency.
  makeMainPill: {
    height: mark,
    backgroundColor: reduceTransparency ? SOLID_SCRIM : TINT_SCRIM,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removingVeil: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.md,
    backgroundColor: reduceTransparency ? SOLID_SCRIM : c.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countHint: {
    textAlign: 'center',
  },
});

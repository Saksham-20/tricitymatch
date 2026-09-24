/**
 * Voice messages (D2, premium) — recorder button + playback bubble.
 * DS4 states: idle → recording (timer, hard stop at 60s) → review
 * (play / delete / send) → uploading / failed. expo-av is lazy-required
 * (absent in Expo Go, same pattern as VoiceIntroRecorder); when it is
 * missing, or the microphone is off, the strip says so inline (with an Open
 * Settings action for the permission case) rather than raising an alert.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, ActivityIndicator, AccessibilityInfo, Linking, StyleSheet } from 'react-native';
import Text from '../../components/ui/Text';
import { PressableScale } from '../../components/motion';
import { Ionicons } from '@expo/vector-icons';
import { spacing, type ThemeColours } from '@shared/constants/theme';
import { tapSize } from '../../utils/elderTheme';
import { showToast } from '../../utils/toast';

const MAX_SEC = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAV = (): any => {
  try {
    return require('expo-av');
  } catch {
    return null;
  }
};

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/**
 * Route playback to the loudspeaker and keep it audible with the iOS silent
 * switch on. The recorder leaves the session in record mode (`allowsRecordingIOS`),
 * which on iOS sends everything played afterwards through the quiet earpiece.
 */
const setPlaybackMode = () => {
  try {
    getAV()?.Audio?.setAudioModeAsync?.({ allowsRecordingIOS: false, playsInSilentModeIOS: true })?.catch?.(() => null);
  } catch {
    /* best effort */
  }
};

// One voice note plays at a time: starting a second pauses the first. The
// recorder's own preview takes part too, so a preview never talks over a message.
let stopActivePlayback: (() => void) | null = null;

/** Release a Sound without ever throwing (unload of an already-gone sound rejects). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unloadSound = (sound: any) => {
  try {
    sound?.unloadAsync?.()?.catch?.(() => null);
  } catch {
    /* best effort */
  }
};

type Phase = 'recording' | 'review' | 'uploading' | 'failed' | 'blocked';
type BlockedReason = 'unavailable' | 'permission' | 'error';

const BLOCKED_COPY: Record<BlockedReason, string> = {
  unavailable: 'Voice messages are not available in this build.',
  permission: 'Microphone access is off. Turn it on in Settings to send voice messages.',
  error: "Couldn't record. Try again.",
};

const PHASE_ANNOUNCE: Partial<Record<Phase, string>> = {
  review: 'Recording stopped. Ready to send.',
  uploading: 'Sending voice message',
  failed: 'Voice message failed to send',
};

// ─── Recorder strip (replaces the input bar while active) ────────────────────
interface RecorderProps {
  onSend: (uri: string, durationMs: number) => Promise<void>;
  onClose: () => void;
}

export function VoiceRecorderStrip({ onSend, onClose }: RecorderProps) {
  const { c, elder } = useTheme();
  const vs = getVs(c);
  const tap = tapSize(elder);
  const [phase, setPhase] = useState<Phase>('recording');
  const [blocked, setBlocked] = useState<BlockedReason | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordingRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const soundRef = useRef<any>(null);
  const uriRef = useRef<string | null>(null);
  const durationRef = useRef(0);
  const elapsedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // A preview load or an upload in flight. A second tap on the same control must
  // not start a second player / a second upload while the first is unresolved.
  const previewBusyRef = useRef(false);
  const sendingRef = useRef(false);
  // False once unmounted, so a load that resolves late releases its player
  // instead of parking it in a ref nobody will ever clean up.
  const aliveRef = useRef(true);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const block = useCallback((reason: BlockedReason) => {
    setBlocked(reason);
    setPhase('blocked');
  }, []);

  const stopRecording = useCallback(async () => {
    clearTimer();
    const rec = recordingRef.current;
    if (!rec) return;
    // Take the recording out of the ref BEFORE awaiting. A second Stop tap (or the
    // 60s auto-stop landing on the same frame) used to find it still there, unload
    // it twice, and drop a perfectly good take into the "couldn't record" state.
    recordingRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      uriRef.current = rec.getURI();
      setPlaybackMode();
      setPhase('review');
    } catch {
      // Was a silent close: the recording was simply gone.
      block('error');
    }
  }, [block]);

  // The recorder's preview player, as the single-playback lock sees it.
  const stopPreview = useCallback(() => {
    soundRef.current?.pauseAsync?.()?.catch?.(() => null);
    setPlaying(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    aliveRef.current = true;
    (async () => {
      const av = getAV();
      if (!av) { if (!cancelled) block('unavailable'); return; }
      const { Audio } = av;
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { if (!cancelled) block('permission'); return; }
      // A message still playing would bleed into the take.
      stopActivePlayback?.();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      if (cancelled) { recording.stopAndUnloadAsync().catch(() => null); return; }
      recordingRef.current = recording;
      elapsedRef.current = 0;
      AccessibilityInfo.announceForAccessibility('Recording started');
      // Plain interval: no side effects inside a state updater (they run twice
      // in StrictMode and the auto-stop used to live in one).
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        durationRef.current = elapsedRef.current * 1000;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= MAX_SEC) stopRecording();
      }, 1000);
    })().catch(() => { if (!cancelled) block('error'); });
    return () => {
      cancelled = true;
      aliveRef.current = false;
      clearTimer();
      if (stopActivePlayback === stopPreview) stopActivePlayback = null;
      unloadSound(soundRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A screen reader hears the phase change even though the control it was on
  // has just been replaced.
  useEffect(() => {
    const msg = phase === 'blocked' && blocked ? BLOCKED_COPY[blocked] : PHASE_ANNOUNCE[phase];
    if (msg) AccessibilityInfo.announceForAccessibility(msg);
  }, [phase, blocked]);

  const warn = elapsed >= MAX_SEC - 5;
  useEffect(() => {
    if (warn && phase === 'recording') AccessibilityInfo.announceForAccessibility('5 seconds left');
  }, [warn, phase]);

  const togglePlay = async () => {
    const av = getAV();
    if (!av || !uriRef.current || previewBusyRef.current) return;
    previewBusyRef.current = true;
    try {
      if (playing) {
        await soundRef.current?.pauseAsync().catch(() => null);
        if (stopActivePlayback === stopPreview) stopActivePlayback = null;
        setPlaying(false);
        return;
      }
      if (!soundRef.current) {
        setPlaybackMode();
        const { sound } = await av.Audio.Sound.createAsync({ uri: uriRef.current });
        if (!aliveRef.current) { unloadSound(sound); return; }
        soundRef.current = sound;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sound.setOnPlaybackStatusUpdate((st: any) => {
          if (st.didJustFinish) {
            if (stopActivePlayback === stopPreview) stopActivePlayback = null;
            setPlaying(false);
          }
        });
      }
      if (stopActivePlayback && stopActivePlayback !== stopPreview) stopActivePlayback();
      stopActivePlayback = stopPreview;
      await soundRef.current.replayAsync();
      setPlaying(true);
    } catch {
      showToast.error("Couldn't play the preview", 'You can still send or discard it.');
    } finally {
      previewBusyRef.current = false;
    }
  };

  const send = async () => {
    if (!uriRef.current || sendingRef.current) return;
    sendingRef.current = true;
    setPhase('uploading');
    try {
      await onSend(uriRef.current, durationRef.current);
      onClose();
    } catch {
      setPhase('failed');
    } finally {
      // Released on failure too, so "Retry send" works.
      sendingRef.current = false;
    }
  };

  const iconBox = { width: tap, height: tap };

  return (
    <View style={vs.strip} testID="VoiceRecorderStrip">
      {phase === 'recording' && (
        <>
          <View style={vs.redDot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          <Text
            variant="subhead"
            color={warn ? 'error' : 'textPrimary'}
            // flex:1 takes the space the two buttons leave, so at a large OS text
            // size the label wraps inside its own column instead of pushing Cancel
            // and Stop off the row.
            style={vs.grow}
            accessibilityRole="timer"
            accessibilityLabel={`Recording, ${fmt(elapsed)}${warn ? ', stopping soon' : ''}`}
          >
            {fmt(elapsed)}{warn ? ' · stopping soon' : ''}
          </Text>
          <PressableScale
            onPress={onClose}
            style={[vs.iconBtn, iconBox]}
            accessibilityRole="button"
            accessibilityLabel="Cancel recording"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={22} color={c.textMuted} />
          </PressableScale>
          <PressableScale
            onPress={stopRecording}
            style={[vs.stopBtn, { width: tap, height: tap, borderRadius: tap / 2 }]}
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="stop" size={20} color={c.onPrimary} />
          </PressableScale>
        </>
      )}
      {phase === 'review' && (
        <>
          <PressableScale
            onPress={togglePlay}
            style={[vs.playBtn, { width: tap, height: tap, borderRadius: tap / 2 }]}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause preview' : 'Play preview'}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={playing ? 'pause' : 'play'} size={18} color={c.primary} />
          </PressableScale>
          <Text variant="subhead" color="textPrimary" style={vs.grow}>{fmt(Math.round(durationRef.current / 1000))}</Text>
          <PressableScale
            onPress={onClose}
            style={[vs.iconBtn, iconBox]}
            accessibilityRole="button"
            accessibilityLabel="Discard voice message"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={22} color={c.textMuted} />
          </PressableScale>
          <PressableScale
            onPress={send}
            style={[vs.sendBtn, { width: tap, height: tap, borderRadius: tap / 2 }]}
            accessibilityRole="button"
            accessibilityLabel="Send voice message"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="send" size={18} color={c.onPrimary} />
          </PressableScale>
        </>
      )}
      {phase === 'uploading' && (
        <>
          <ActivityIndicator size="small" color={c.primary} />
          <Text variant="subhead" color="textPrimary" style={[vs.timer, { marginLeft: spacing.sm }]}>Sending…</Text>
        </>
      )}
      {phase === 'failed' && (
        <>
          <Text variant="subhead" color="error" style={vs.grow}>Upload failed</Text>
          <PressableScale
            onPress={send}
            style={[vs.iconBtn, iconBox]}
            accessibilityRole="button"
            accessibilityLabel="Retry send"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="refresh" size={22} color={c.primary} />
          </PressableScale>
          <PressableScale
            onPress={onClose}
            style={[vs.iconBtn, iconBox]}
            accessibilityRole="button"
            accessibilityLabel="Discard"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color={c.textMuted} />
          </PressableScale>
        </>
      )}
      {phase === 'blocked' && blocked && (
        // A column, not one long row: the message, the Settings action and the
        // dismiss button cannot share ~230pt at a large OS text size, so the
        // action sits under the message instead of squeezing it to a few words.
        <View style={vs.blockedCol}>
          <View style={vs.blockedRow}>
            <Ionicons
              name={blocked === 'permission' ? 'mic-off-outline' : 'alert-circle-outline'}
              size={20}
              color={c.textMuted}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <Text variant="subhead" color="textPrimary" style={vs.blockedText} testID="VoiceRecorderBlocked">
              {BLOCKED_COPY[blocked]}
            </Text>
            <PressableScale
              onPress={onClose}
              style={[vs.iconBtn, iconBox]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={c.textMuted} />
            </PressableScale>
          </View>
          {blocked === 'permission' && (
            <PressableScale
              onPress={() => { Linking.openSettings().catch(() => null); }}
              style={[vs.textAction, { minHeight: tap }]}
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="VoiceOpenSettings"
            >
              <Text variant="subhead" color="primary">Open Settings</Text>
            </PressableScale>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Playback bubble ─────────────────────────────────────────────────────────
interface BubbleProps {
  uri: string | null;
  durationMs: number | null;
  own: boolean;
  /** Who sent it, for the spoken label ("from Priya"). */
  from?: string;
  /** Exposes the parent bubble's actions menu as a screen-reader action. */
  onMoreActions?: () => void;
}

export function VoiceMessageBubble({ uri, durationMs, own, from, onMoreActions }: BubbleProps) {
  const { c, elder } = useTheme();
  const vs = getVs(c);
  const tap = tapSize(elder);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const soundRef = useRef<any>(null);
  // A load/pause in flight. Read from a ref, not from `state`: two taps inside one
  // render both see 'idle' in their closure, and the second used to start a second
  // player that overwrote soundRef, leaving the first playing with no way to stop it.
  const busyRef = useRef(false);
  // False once unmounted, so a load that resolves late releases its player.
  const aliveRef = useRef(true);

  const stopSelf = useCallback(() => {
    soundRef.current?.pauseAsync?.().catch?.(() => null);
    setState('idle');
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (stopActivePlayback === stopSelf) stopActivePlayback = null;
      unloadSound(soundRef.current);
    };
  }, [stopSelf]);

  const toggle = async () => {
    if (busyRef.current) return;
    const av = getAV();
    if (!av || !uri) { setState('failed'); return; }
    busyRef.current = true;
    try {
      if (state === 'playing') {
        await soundRef.current?.pauseAsync();
        if (stopActivePlayback === stopSelf) stopActivePlayback = null;
        if (aliveRef.current) setState('idle');
        return;
      }
      setState('loading');
      if (!soundRef.current) {
        setPlaybackMode();
        const { sound } = await av.Audio.Sound.createAsync({ uri });
        if (!aliveRef.current) { unloadSound(sound); return; }
        soundRef.current = sound;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sound.setOnPlaybackStatusUpdate((st: any) => {
          if (st.isLoaded && st.durationMillis) setProgress(st.positionMillis / st.durationMillis);
          if (st.didJustFinish) {
            if (stopActivePlayback === stopSelf) stopActivePlayback = null;
            setState('idle');
            setProgress(0);
          }
        });
      }
      if (stopActivePlayback && stopActivePlayback !== stopSelf) stopActivePlayback();
      stopActivePlayback = stopSelf;
      await soundRef.current.playAsync();
      if (aliveRef.current) setState('playing');
    } catch {
      if (aliveRef.current) setState('failed');
    } finally {
      busyRef.current = false;
    }
  };

  const fg = own ? c.onPrimary : c.textPrimary;
  if (state === 'failed') {
    return (
      <PressableScale
        onPress={() => {
          // Release the failed Sound before the retry builds a new one; nulling the
          // ref alone leaked the native player on every failed attempt.
          unloadSound(soundRef.current);
          soundRef.current = null;
          setState('idle');
          toggle();
        }}
        style={[vs.bubbleRowInner, { minHeight: tap }]}
        accessibilityRole="button"
        accessibilityLabel="Couldn't play this voice message. Retry."
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="alert-circle-outline" size={16} color={fg} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <Text variant="subhead" style={[vs.bubbleFail, { color: fg }]}>Couldn&apos;t play. Tap to retry.</Text>
      </PressableScale>
    );
  }

  // The play control is a 36pt disc (44 in elder mode); hitSlop tops it up to the
  // tap target without growing the mark. RN does not deliver a touch that lands
  // past its parent's bounds on iOS, so the row is made exactly `tap` tall: the
  // slop then lies wholly inside the row it belongs to, however much or little
  // padding the surrounding bubble has (it was 6pt against an elder slop of 8).
  const size = elder ? 44 : 36;
  const slop = Math.ceil((tap - size) / 2);
  const total = fmt(Math.round((durationMs || 0) / 1000));
  const pct = Math.round(progress * 100);
  const playLabel = `${state === 'playing' ? 'Pause' : 'Play'} voice message${from ? ` from ${from}` : ''}, ${total}`;

  return (
    <View style={[vs.bubbleRowInner, { minHeight: tap }]}>
      <PressableScale
        onPress={toggle}
        style={[
          vs.playBtnSmall,
          { width: size, height: size, borderRadius: size / 2 },
          own && vs.playBtnOwn,
        ]}
        // Ignored while the player is still loading (the ref guard is the real
        // protection; this makes it visible to the touch system and the reader).
        disabled={state === 'loading'}
        accessibilityRole="button"
        accessibilityLabel={playLabel}
        accessibilityState={{ busy: state === 'loading' }}
        accessibilityValue={pct > 0 ? { min: 0, max: 100, now: pct } : undefined}
        accessibilityActions={onMoreActions ? [{ name: 'messageActions', label: 'Message actions' }] : undefined}
        onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'messageActions') onMoreActions?.(); }}
        hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        testID="voice-play-tap44-hitslop"
      >
        {state === 'loading' ? (
          <ActivityIndicator size="small" color={own ? c.onPrimary : c.primary} />
        ) : (
          <Ionicons name={state === 'playing' ? 'pause' : 'play'} size={16} color={own ? c.onPrimary : c.primary} />
        )}
      </PressableScale>
      {/* Progress and duration are already in the button's label and value. */}
      <View
        style={[vs.track, own && vs.trackOwn]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[vs.fill, { backgroundColor: own ? c.onPrimary : c.primary }, { width: `${pct}%` }]} />
      </View>
      <Text
        variant="caption"
        style={[vs.duration, { color: own ? c.onPrimary : c.textMuted }, own && { opacity: 0.8 }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {total}
      </Text>
    </View>
  );
}

/**
 * Built once per palette, not once per bubble: a thread mounts a VoiceMessageBubble
 * for every voice note the window renders, and rows remount as they scroll. `c` is
 * always the `colours` / `darkColours` singleton from useTheme().
 */
const sheetsByPalette = new WeakMap<ThemeColours, ReturnType<typeof makeVs>>();
function getVs(c: ThemeColours): ReturnType<typeof makeVs> {
  let sheet = sheetsByPalette.get(c);
  if (!sheet) {
    sheet = makeVs(c);
    sheetsByPalette.set(c, sheet);
  }
  return sheet;
}

const makeVs = (c: ThemeColours) => StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.error, marginRight: spacing.sm },
  timer: { fontVariant: ['tabular-nums'] },
  // Fills the row between the leading mark and the trailing buttons; wraps rather
  // than pushing them off (replaces a flex:1 spacer beside a non-shrinking label).
  grow: { flex: 1, fontVariant: ['tabular-nums'] },
  blockedCol: { flex: 1 },
  blockedRow: { flexDirection: 'row', alignItems: 'center' },
  blockedText: { flex: 1, marginHorizontal: spacing.sm },
  // Sits under the message: marginLeft is the 20pt icon, and its own 8pt padding
  // is the icon-to-text gap, so the words line up with the message above.
  textAction: { alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: spacing.sm, marginLeft: 20 },
  // Target size (48 / 60 elder) and radius come inline from tapSize().
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  stopBtn: {
    backgroundColor: c.error,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.xs,
  },
  sendBtn: {
    backgroundColor: c.p500,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.xs,
  },
  playBtn: {
    backgroundColor: c.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  playBtnSmall: {
    backgroundColor: c.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  // Own bubbles are the fixed p500 fill in both themes, so these are the
  // c.onPrimary token at low alpha (8-digit hex: 0x40 = 25%, 0x4D = 30%), not a
  // literal and not a theme surface.
  playBtnOwn: { backgroundColor: c.onPrimary + '40' },
  trackOwn: { backgroundColor: c.onPrimary + '4D' },
  bubbleRowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 170 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.n200, overflow: 'hidden' },
  // Absolutely positioned and childless: its width follows playback progress
  // without re-running layout for its siblings.
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  duration: { fontVariant: ['tabular-nums'] },
  bubbleFail: { textDecorationLine: 'underline' },
});

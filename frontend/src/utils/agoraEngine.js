/**
 * Thin wrapper around agora-rtc-sdk-ng for in-browser voice/video calls.
 * The SDK is dynamically imported so it's only pulled in when a call actually
 * starts (keeps it out of the initial bundle) and a missing/blocked mic/cam
 * degrades gracefully.
 */

let AgoraRTC = null;
let client = null;
let localAudioTrack = null;
let localVideoTrack = null;

const loadSdk = async () => {
  if (!AgoraRTC) {
    const mod = await import('agora-rtc-sdk-ng');
    AgoraRTC = mod.default || mod;
  }
  return AgoraRTC;
};

/**
 * Join a channel and publish local tracks.
 * @returns {{ localVideoTrack: object|null }}
 */
export const joinChannel = async ({ appId, channel, token, uid = null, video = false, onRemoteTrack, onRemoteLeft }) => {
  const RTC = await loadSdk();
  client = RTC.createClient({ mode: 'rtc', codec: 'vp8' });

  client.on('user-published', async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    if (mediaType === 'audio') {
      user.audioTrack?.play();
    }
    onRemoteTrack?.(user, mediaType);
  });
  client.on('user-unpublished', (user, mediaType) => {
    if (mediaType === 'video') onRemoteLeft?.(user);
  });
  client.on('user-left', (user) => onRemoteLeft?.(user));

  await client.join(appId, channel, token || null, uid);

  localAudioTrack = await RTC.createMicrophoneAudioTrack();
  const toPublish = [localAudioTrack];
  if (video) {
    localVideoTrack = await RTC.createCameraVideoTrack();
    toPublish.push(localVideoTrack);
  }
  await client.publish(toPublish);

  return { localVideoTrack };
};

export const setMicEnabled = async (enabled) => {
  try { await localAudioTrack?.setEnabled(enabled); } catch { /* ignore */ }
};

export const setCamEnabled = async (enabled) => {
  try { await localVideoTrack?.setEnabled(enabled); } catch { /* ignore */ }
};

export const getLocalVideoTrack = () => localVideoTrack;

export const leaveChannel = async () => {
  try {
    localAudioTrack?.close();
    localVideoTrack?.close();
    await client?.leave();
  } catch { /* ignore */ }
  localAudioTrack = null;
  localVideoTrack = null;
  client = null;
};

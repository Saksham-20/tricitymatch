import { useState } from 'react';
import { Platform, Share } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { showToast } from '../utils/toast';
import { CONFIG } from '../constants/config';

/**
 * D5 biodata flagship: download the PDF with the auth header, then hand the
 * FILE to the share sheet (WhatsApp-first). expo-file-system ships with the
 * expo package; lazy-required so Expo Go without it degrades to a toast.
 *
 * Extracted from OwnProfileScreen so the journey finale can offer the same
 * share the moment a profile is complete — completion energy feeds the
 * "Made with TricityMatch" acquisition loop.
 */
export function useBiodataShare(template: 'classic' | 'modern' = 'classic') {
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let FileSystem: any = null;
      try { FileSystem = require('expo-file-system/legacy'); } catch { /* fall through */ }
      if (!FileSystem?.downloadAsync) {
        try { FileSystem = require('expo-file-system'); } catch { FileSystem = null; }
      }
      if (!FileSystem?.downloadAsync) {
        showToast.error('Not available', 'Biodata download needs a native build.');
        return;
      }
      const token = useAuthStore.getState().accessToken;
      const dest = `${FileSystem.cacheDirectory}biodata-tricitymatch.pdf`;
      const res = await FileSystem.downloadAsync(
        `${CONFIG.API_URL}/profile/me/biodata?template=${template}`,
        dest,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

      // KNOWN LIMITATION (Android): React Native's Share.share() accepts `url`
      // on iOS ONLY. On Android it silently drops it and shares just `message`,
      // so the sheet opens titled "Sharing text" and the recipient gets a
      // one-line caption — the biodata PDF itself never leaves the device.
      // Confirmed on an emulator 2026-08-20.
      //
      // The fix is expo-sharing's shareAsync(), which hands the file over as a
      // content:// intent. Attempted and reverted here: npm hoists the package
      // to the workspace root, so the rebuilt APK picked up its FileProvider
      // resources but not the JS module registration — require('expo-sharing')
      // resolved to undefined at runtime and this silently fell back anyway.
      // Sorting that out is a monorepo autolinking change, not a launch-day
      // patch. iOS is unaffected: the `url` branch below works there.
      await Share.share(
        Platform.OS === 'ios'
          ? { url: res.uri, title: 'Marriage Biodata' }
          : { message: 'My marriage biodata (PDF) — made with TricityMatch, tricitymatch.com', url: res.uri, title: 'Marriage Biodata' }
      );
    } catch {
      showToast.error('Error', 'Could not prepare your biodata. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return { share, busy };
}

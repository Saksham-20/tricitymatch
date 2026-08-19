import { useEffect, useRef } from 'react';
import { NativeModules, Platform } from 'react-native';
import { registerFcmToken, removeFcmToken } from '../api/notifications';
import { cache } from '../utils/cache';

/**
 * Wires up Firebase Cloud Messaging for the authenticated session.
 * Safe without native Firebase build: dynamic require falls back gracefully.
 *
 * 1. Requests permission + registers FCM token with backend
 * 2. Handles foreground message events
 * 3. Handles background-tap initial notification
 * 4. Refreshes token when FCM rotates it
 */
export const useNotificationHandler = (userId: string | undefined, enabled = true) => {
  const tokenRegisteredRef = useRef(false);

  useEffect(() => {
    if (!userId || !enabled) return;

    let messaging: any = null;
    let unsubscribeOnMessage: (() => void) | null = null;
    let unsubscribeTokenRefresh: (() => void) | null = null;

    const init = async () => {
      // Probe the NATIVE module first (haptics doctrine, R3-1): a require() of a
      // package Metro couldn't resolve throws "Requiring unknown module" through
      // a dev LogBox overlay even inside try/catch, blocking the UI. When the
      // native side is absent there is nothing to register anyway, so skip the
      // require entirely; real FCM lights up once @react-native-firebase/messaging
      // is installed and the client rebuilt.
      if (!NativeModules.RNFBMessagingModule) {
        __DEV__ && console.debug('[FCM] native messaging module not present — skipping registration');
        return;
      }
      try {
        messaging = require('@react-native-firebase/messaging').default;
      } catch {
        __DEV__ && console.debug('[FCM] @react-native-firebase/messaging not available');
        return;
      }

      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) return;

      const token = await messaging().getToken();
      if (token && !tokenRegisteredRef.current) {
        try {
          await registerFcmToken(token, Platform.OS as 'ios' | 'android');
          cache.setString('fcm_token', token);
          tokenRegisteredRef.current = true;
        } catch (err: any) {
          console.error('[FCM] token registration failed:', err?.message);
        }
      }

      unsubscribeOnMessage = messaging().onMessage(async (_remoteMessage: any) => {
        // Foreground: toast integration point — add a toast provider here when ready
      });

      unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken: string) => {
        const oldToken = cache.getString('fcm_token');
        try {
          if (oldToken) await removeFcmToken(oldToken);
          await registerFcmToken(newToken, Platform.OS as 'ios' | 'android');
          cache.setString('fcm_token', newToken);
        } catch (err: any) {
          console.error('[FCM] token refresh failed:', err?.message);
        }
      });

      // Background-tap deep-link: navigate based on notification data
      const initial = await messaging().getInitialNotification();
      if (initial?.data?.type) {
        __DEV__ && console.debug('[FCM] opened from notification:', initial.data.type);
        // Navigation will be handled by the screen that mounts this hook
      }
    };

    init();

    return () => {
      unsubscribeOnMessage?.();
      unsubscribeTokenRefresh?.();
    };
  }, [userId, enabled]);

  const deregisterToken = async () => {
    const token = cache.getString('fcm_token');
    if (!token) return;
    try {
      await removeFcmToken(token);
      cache.delete('fcm_token');
    } catch {
      // best-effort on logout
    }
  };

  return { deregisterToken };
};

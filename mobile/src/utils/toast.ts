// Outcome feedback = toast; confirmations stay Alert.alert (native confirm is
// the right UX for destructive/blocking choices). One-liner call sites that
// pair the matching haptic automatically.
import Toast from 'react-native-toast-message';
import { haptics } from './haptics';

function show(tone: 'success' | 'error' | 'info', title: string, body?: string) {
  Toast.show({ type: tone, text1: title, text2: body, visibilityTime: tone === 'error' ? 4000 : 2600 });
}

export const showToast = {
  success: (title: string, body?: string) => {
    haptics.success();
    show('success', title, body);
  },
  error: (title: string, body?: string) => {
    haptics.warning();
    show('error', title, body);
  },
  info: (title: string, body?: string) => {
    show('info', title, body);
  },
};

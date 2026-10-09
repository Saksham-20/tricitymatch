import useHtmlClassPref from './useHtmlClassPref';

const prefersDark = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

// Toggles .dark class on <html> element and persists to localStorage.
// Mounted once at the app root (so funnel pages without a Navbar still get the
// saved theme) and again wherever a toggle is shown; all instances stay in step.
export default function useDarkMode() {
  const [isDark, setDark] = useHtmlClassPref('tm_dark_mode', 'dark', prefersDark);
  return { isDark, toggle: () => setDark(!isDark) };
}

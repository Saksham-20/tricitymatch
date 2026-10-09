import useHtmlClassPref from './useHtmlClassPref';

// Toggles .elder class on <html> (larger type + higher-contrast muted text,
// AA+ for older users). Layout/hierarchy unchanged — only scale & contrast.
// Parallels useDarkMode; persisted to localStorage, shared across instances.
export default function useElderMode() {
  const [isElder, setElder] = useHtmlClassPref('tm_elder_mode', 'elder');
  return { isElder, toggle: () => setElder(!isElder) };
}

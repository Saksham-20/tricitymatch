import { useState, useEffect } from 'react';

// Toggles .elder class on <html> (larger type + higher-contrast muted text,
// AA+ for older users). Layout/hierarchy unchanged — only scale & contrast.
// Parallels useDarkMode; persisted to localStorage.
export default function useElderMode() {
  const [isElder, setIsElder] = useState(() => {
    try {
      return localStorage.getItem('tm_elder_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isElder) {
      root.classList.add('elder');
    } else {
      root.classList.remove('elder');
    }
    try {
      localStorage.setItem('tm_elder_mode', String(isElder));
    } catch {}
  }, [isElder]);

  const toggle = () => setIsElder((e) => !e);

  return { isElder, toggle };
}

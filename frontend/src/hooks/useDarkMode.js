import { useState, useEffect } from 'react';

// Toggles .dark class on <html> element and persists to localStorage
export default function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem('tm_dark_mode');
      if (stored !== null) return stored === 'true';
      // Respect OS preference if no stored preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('tm_dark_mode', String(isDark));
    } catch {}
  }, [isDark]);

  const toggle = () => setIsDark((d) => !d);

  return { isDark, toggle };
}

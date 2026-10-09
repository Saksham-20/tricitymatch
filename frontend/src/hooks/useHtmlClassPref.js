import { useState, useEffect, useCallback } from 'react';

// One persisted on/off preference mirrored as a class on <html>.
// Every caller (app root, Navbar, Settings, staff layouts) shares the value:
// a change made in one instance is broadcast so the others follow, instead of
// each keeping its own copy (which left the Navbar toggle stale after a change
// in Settings, needing two clicks).
const EVENT = 'tm:html-pref';

function read(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored === 'true';
  } catch {
    // storage blocked: fall through to the default
  }
  return fallback();
}

export default function useHtmlClassPref(key, className, fallback = () => false) {
  const [on, setOn] = useState(() => read(key, fallback));

  useEffect(() => {
    document.documentElement.classList.toggle(className, on);
    try {
      localStorage.setItem(key, String(on));
    } catch {
      // Private mode / storage disabled: applies for this session only.
    }
  }, [key, className, on]);

  useEffect(() => {
    const sync = (e) => { if (e.detail?.key === key) setOn(e.detail.value); };
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [key]);

  const set = useCallback((value) => {
    setOn(value);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { key, value } }));
  }, [key]);

  return [on, set];
}

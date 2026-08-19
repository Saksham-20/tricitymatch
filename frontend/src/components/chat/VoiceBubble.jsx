/**
 * VoiceBubble — receiving/sent voice-message player (DS4 client states:
 * loading / playing with progress / failed with tap-retry).
 */

import { useEffect, useRef, useState } from 'react';
import { FiPlay, FiPause, FiAlertCircle } from 'react-icons/fi';

const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const VoiceBubble = ({ mediaUrl, durationMs, light = false }) => {
  const [state, setState] = useState('idle'); // idle | loading | playing | paused | failed
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const ensureAudio = () => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio(mediaUrl);
    a.onwaiting = () => setState('loading');
    a.onplaying = () => setState('playing');
    a.onpause = () => setState((s) => (s === 'failed' ? s : 'paused'));
    a.onended = () => { setState('paused'); setProgress(0); };
    a.onerror = () => setState('failed');
    a.ontimeupdate = () => {
      if (a.duration) setProgress(a.currentTime / a.duration);
    };
    audioRef.current = a;
    return a;
  };

  const toggle = () => {
    const a = ensureAudio();
    if (state === 'playing') {
      a.pause();
    } else {
      setState('loading');
      a.play().catch(() => setState('failed'));
    }
  };

  const fg = light ? 'text-white' : 'text-neutral-700 dark:text-neutral-200';
  const track = light ? 'bg-white/30' : 'bg-neutral-300 dark:bg-neutral-600';
  const fill = light ? 'bg-white' : 'bg-primary-500';

  if (state === 'failed') {
    return (
      <button onClick={() => { audioRef.current = null; setState('idle'); toggle(); }} className={`flex items-center gap-2 ${fg}`}>
        <FiAlertCircle className="w-4 h-4" />
        <span className="text-sm underline">Couldn&apos;t play — tap to retry</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 min-w-[180px]" aria-label="Voice message">
      <button
        onClick={toggle}
        aria-label={state === 'playing' ? 'Pause voice message' : 'Play voice message'}
        className={`p-2 rounded-full flex-shrink-0 ${light ? 'bg-white/20 hover:bg-white/30' : 'bg-primary-100 hover:bg-primary-200'} transition-colors`}
      >
        {state === 'loading' ? (
          <span className={`block w-4 h-4 rounded-full border-2 border-t-transparent animate-spin ${light ? 'border-white' : 'border-primary-600'}`} />
        ) : state === 'playing' ? (
          <FiPause className={`w-4 h-4 ${light ? 'text-white' : 'text-primary-700'}`} />
        ) : (
          <FiPlay className={`w-4 h-4 ${light ? 'text-white' : 'text-primary-700'}`} />
        )}
      </button>
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${track}`}>
        <div className={`h-full ${fill} transition-[width] duration-200`} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <span className={`text-[11px] tabular-nums ${fg}`}>{fmt(durationMs || 0)}</span>
    </div>
  );
};

export default VoiceBubble;

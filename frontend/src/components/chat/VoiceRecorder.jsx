/**
 * VoiceRecorder — D2 voice notes (premium-only; the parent gates rendering).
 *
 * DS4 states: idle → recording (timer + cancel, hard stop at 60s with a 5s
 * warning) → review (play / delete / send) → uploading → failed (retry).
 * Permission-denied renders inline guidance + falls back to text.
 *
 * MediaRecorder records audio/webm;codecs=opus — webm is in the backend's
 * audio allowlist (voiceMessageStorage clones voiceIntroStorage).
 */

import { useEffect, useRef, useState } from 'react';
import { FiMic, FiX, FiTrash2, FiSend, FiPlay, FiPause, FiRefreshCw } from 'react-icons/fi';

const MAX_MS = 60 * 1000;
const WARN_MS = 55 * 1000;

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const VoiceRecorder = ({ onSend, onClose }) => {
  // idle | denied | recording | review | uploading | failed
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const blobRef = useRef(null);
  const durationRef = useRef(0);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const audioRef = useRef(null);
  const discardRef = useRef(false);

  const stopTracks = () => {
    recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType });
      recorderRef.current = rec;
      chunksRef.current = [];
      discardRef.current = false;

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stopTracks();
        if (discardRef.current) return;
        blobRef.current = new Blob(chunksRef.current, { type: 'audio/webm' });
        durationRef.current = Date.now() - startedAtRef.current;
        setPhase('review');
      };

      rec.start();
      startedAtRef.current = Date.now();
      setElapsed(0);
      setPhase('recording');

      timerRef.current = setInterval(() => {
        const ms = Date.now() - startedAtRef.current;
        setElapsed(ms);
        if (ms >= MAX_MS) {
          clearInterval(timerRef.current);
          rec.state !== 'inactive' && rec.stop();
        }
      }, 200);
    } catch {
      setPhase('denied');
    }
  };

  useEffect(() => {
    startRecording();
    return () => {
      clearInterval(timerRef.current);
      discardRef.current = true;
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      stopTracks();
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAndReview = () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const cancel = () => {
    discardRef.current = true;
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    stopTracks();
    onClose();
  };

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(URL.createObjectURL(blobRef.current));
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const send = async () => {
    setPhase('uploading');
    try {
      await onSend(blobRef.current, Math.min(durationRef.current, MAX_MS));
      onClose();
    } catch {
      setPhase('failed');
    }
  };

  return (
    <div className="flex items-center gap-3 w-full" role="group" aria-label="Voice message recorder">
      {phase === 'denied' && (
        <>
          <p className="flex-1 text-sm text-neutral-600 dark:text-neutral-300">
            Microphone is blocked — enable it in your browser settings, or just type your message instead.
          </p>
          <button onClick={onClose} aria-label="Close recorder" className="p-2 rounded-full hover:bg-neutral-100 text-neutral-500">
            <FiX className="w-5 h-5" />
          </button>
        </>
      )}

      {phase === 'recording' && (
        <>
          <span className="relative flex h-3 w-3 flex-shrink-0" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <span className={`text-sm font-medium tabular-nums ${elapsed >= WARN_MS ? 'text-red-600' : 'text-neutral-700 dark:text-neutral-200'}`}>
            {fmt(elapsed)}{elapsed >= WARN_MS && ' · stopping soon'}
          </span>
          <div className="flex-1" />
          <button onClick={cancel} aria-label="Cancel recording" className="p-2.5 rounded-full hover:bg-neutral-100 text-neutral-500">
            <FiTrash2 className="w-5 h-5" />
          </button>
          <button
            onClick={stopAndReview}
            aria-label="Stop recording"
            className="p-3 rounded-full bg-gradient-hero text-white shadow-burgundy"
          >
            <FiMic className="w-5 h-5" />
          </button>
        </>
      )}

      {phase === 'review' && (
        <>
          <button onClick={togglePlay} aria-label={playing ? 'Pause preview' : 'Play preview'} className="p-2.5 rounded-full bg-primary-100 text-primary-700">
            {playing ? <FiPause className="w-5 h-5" /> : <FiPlay className="w-5 h-5" />}
          </button>
          <span className="text-sm text-neutral-600 dark:text-neutral-300 tabular-nums">{fmt(durationRef.current)}</span>
          <div className="flex-1" />
          <button onClick={cancel} aria-label="Discard voice message" className="p-2.5 rounded-full hover:bg-neutral-100 text-neutral-500">
            <FiTrash2 className="w-5 h-5" />
          </button>
          <button onClick={send} aria-label="Send voice message" className="p-3 rounded-full bg-gradient-hero text-white shadow-burgundy hover:scale-105 transition-transform">
            <FiSend className="w-5 h-5" />
          </button>
        </>
      )}

      {phase === 'uploading' && (
        <p className="flex-1 text-sm text-neutral-500 animate-pulse">Sending voice message…</p>
      )}

      {phase === 'failed' && (
        <>
          <p className="flex-1 text-sm text-red-600">Upload failed.</p>
          <button onClick={send} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800">
            <FiRefreshCw className="w-4 h-4" /> Retry
          </button>
          <button onClick={cancel} aria-label="Discard" className="p-2 rounded-full hover:bg-neutral-100 text-neutral-500">
            <FiX className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
};

export default VoiceRecorder;

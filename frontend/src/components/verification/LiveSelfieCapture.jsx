import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiCamera, FiRefreshCw, FiVideo, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { fade } from '../../utils/animations';
import api from '../../api/axios';

/**
 * LiveSelfieCapture — captures a selfie strictly from the live camera.
 *
 * There is deliberately NO file-upload fallback: an uploaded image can be
 * doctored, so verification only trusts a frame grabbed straight from the
 * device camera (getUserMedia → canvas → JPEG File). If no camera is available
 * or permission is denied, the member is told to use a device with a camera /
 * the mobile app — we never let them attach a file.
 *
 * Contract mirrors the old SelfieField: props { file, onChange } where onChange
 * receives a File (or null on retake), so the parent's multipart submit is
 * unchanged (`form.append('selfiePhoto', file)`).
 *
 * The server refuses a selfie that did not come out of a capture session it
 * started, so opening the camera asks for one and the captured File carries it
 * as `file.captureToken`; the parent sends it as the X-Capture-Token header
 * (see captureHeaders below).
 */

/** Headers the parent must send with the selfie upload. */
export const captureHeaders = (file) => (file?.captureToken ? { 'X-Capture-Token': file.captureToken } : {});

export default function LiveSelfieCapture({ file, onChange }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const sessionRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | starting | live | captured | error
  // An error is held as a key under `selfie.errors` and translated at render,
  // so it follows a language switch.
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  // The <video> mounts only after the idle panel's exit animation, and
  // getUserMedia often resolves before that (instantly once permission was
  // granted before). Attaching only right after getUserMedia then found no
  // element: black preview, and Capture did nothing. Attach on mount too.
  const attachVideo = useCallback((el) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    setPhase('starting');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('unsupported');
      setPhase('error');
      return;
    }
    try {
      // getUserMedia stays pending for as long as the permission prompt is
      // unanswered — dismiss it, or open the page on a machine with no camera
      // driver, and the promise never settles. Without this race the member is
      // left staring at "Starting camera…" forever with nothing to act on.
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        }),
        new Promise((_, reject) =>
          setTimeout(() => {
            const e = new Error('camera-timeout');
            e.name = 'TimeoutError';
            reject(e);
          }, 15000)
        ),
      ]);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS Safari needs an explicit play() after setting srcObject.
        await videoRef.current.play().catch(() => {});
      }
      // Server-side capture session (best effort here: if it fails the upload is
      // refused with a clear "open the camera again" message).
      sessionRef.current = null;
      api.post('/verification/capture-session')
        .then((res) => { sessionRef.current = res.data?.captureToken || null; })
        .catch(() => {});
      setPhase('live');
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      const none = err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError';
      const timedOut = err?.name === 'TimeoutError';
      setError(
        denied
          ? 'denied'
          : none
          ? 'noCamera'
          : timedOut
          ? 'timedOut'
          : 'startFailed'
      );
      setPhase('error');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopStream(), [stopStream]);

  // Manage preview object URL for the captured file
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError('stillStarting');
      return;
    }
    setError('');
    // Center-crop to a square so the framing matches the round preview.
    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const f = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
        f.captureToken = sessionRef.current;
        onChange(f);
        setPhase('captured');
        stopStream();
      },
      'image/jpeg',
      0.92
    );
  }, [onChange, stopStream]);

  const retake = useCallback(() => {
    onChange(null);
    startCamera();
  }, [onChange, startCamera]);

  // Phase swaps (idle → starting → live → captured/error) get a plain fade so
  // the camera hand-off never reads as a jarring hard cut (doctrine §4.1:
  // purpose = preventing a jarring change).
  let content;

  // ── Captured still ──────────────────────────────────────────────────────
  if (file && phase === 'captured') {
    content = (
      <motion.div key="captured" initial="initial" animate="animate" exit="exit" variants={fade} className="flex flex-col items-center gap-3">
        <div className="relative">
          <img
            src={previewUrl}
            alt={t('selfie.capturedAlt')}
            className="w-40 h-40 rounded-2xl object-cover border-2 border-success-100"
          />
          <span className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-success text-white flex items-center justify-center shadow">
            <FiCheckCircle className="w-4 h-4" />
          </span>
        </div>
        <button
          type="button"
          onClick={retake}
          className="flex items-center gap-1.5 min-h-11 px-2 text-sm font-semibold text-primary-600 dark:text-primary-300 hover:text-primary-700"
        >
          <FiRefreshCw className="w-4 h-4" /> {t('selfie.retake')}
        </button>
      </motion.div>
    );

  // ── Error ───────────────────────────────────────────────────────────────
  } else if (phase === 'error') {
    content = (
      <motion.div key="error" initial="initial" animate="animate" exit="exit" variants={fade} className="flex flex-col items-center gap-3 px-4 py-8 rounded-2xl border-2 border-dashed border-destructive/30 bg-destructive-light dark:bg-destructive/10 text-center">
        <FiAlertCircle className="w-8 h-8 text-destructive" />
        <p role="alert" className="text-sm font-medium text-neutral-700 dark:text-neutral-200 max-w-xs">{t(`selfie.errors.${error}`)}</p>
        <button
          type="button"
          onClick={startCamera}
          className="mt-1 min-h-11 px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors duration-[160ms] active:scale-[0.98]"
        >
          {t('selfie.tryAgain')}
        </button>
      </motion.div>
    );

  // ── Live / starting ───────────────────────────────────────────────────────
  } else if (phase === 'live' || phase === 'starting') {
    content = (
      <motion.div key="live" initial="initial" animate="animate" exit="exit" variants={fade} className="flex flex-col items-center gap-4">
        <div className="relative w-56 h-56 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-200">
          <video
            ref={attachVideo}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} /* mirror preview only; capture is unmirrored */
          />
          {phase === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/60 text-white text-sm">
              {t('selfie.starting')}
            </div>
          )}
          {/* face guide */}
          <div className="pointer-events-none absolute inset-6 rounded-full border-2 border-white/40" />
        </div>
        <button
          type="button"
          onClick={capture}
          disabled={phase !== 'live'}
          className="flex items-center gap-2 px-6 py-2.5 min-h-11 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 disabled:opacity-60 shadow-sm transition-colors duration-[160ms] active:scale-[0.98]"
        >
          <FiCamera className="w-4 h-4" /> {t('selfie.capture')}
        </button>
        {error
          ? <p role="alert" className="text-xs font-medium text-destructive text-center max-w-xs">{t(`selfie.errors.${error}`)}</p>
          : <p className="text-xs text-neutral-600 dark:text-neutral-400">{t('selfie.hint')}</p>}
      </motion.div>
    );

  // ── Idle (start) ──────────────────────────────────────────────────────────
  } else {
    content = (
      <motion.button
        key="idle"
        type="button"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={fade}
        onClick={startCamera}
        className="w-full flex flex-col items-center gap-2 px-4 py-8 min-h-11 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-primary-400 text-neutral-500 dark:text-neutral-300 transition-colors duration-[160ms] active:scale-[0.99]"
      >
        <FiVideo className="w-8 h-8 text-primary-400" />
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{t('selfie.start')}</span>
        <span className="text-xs text-neutral-600 dark:text-neutral-400">{t('selfie.startHint')}</span>
      </motion.button>
    );
  }

  return <AnimatePresence mode="wait">{content}</AnimatePresence>;
}

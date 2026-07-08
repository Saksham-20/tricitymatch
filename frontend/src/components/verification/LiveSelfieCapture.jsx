import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiCamera, FiRefreshCw, FiVideo, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

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
 */
export default function LiveSelfieCapture({ file, onChange }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | starting | live | captured | error
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

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
      setError('Your browser does not support live camera capture. Open TricityShadi on a phone or use a device with a camera.');
      setPhase('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS Safari needs an explicit play() after setting srcObject.
        await videoRef.current.play().catch(() => {});
      }
      setPhase('live');
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      const none = err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError';
      setError(
        denied
          ? 'Camera access was blocked. Allow camera permission in your browser, then try again.'
          : none
          ? 'No camera found on this device. Open TricityShadi on a phone to verify.'
          : 'Could not start the camera. Make sure no other app is using it, then try again.'
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
    if (!video || !video.videoWidth) return;
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

  // ── Captured still ──────────────────────────────────────────────────────
  if (file && phase === 'captured') {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <img
            src={previewUrl}
            alt="Captured selfie"
            className="w-40 h-40 rounded-2xl object-cover border-2 border-success-100"
          />
          <span className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-success text-white flex items-center justify-center shadow">
            <FiCheckCircle className="w-4 h-4" />
          </span>
        </div>
        <button
          type="button"
          onClick={retake}
          className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          <FiRefreshCw className="w-4 h-4" /> Retake photo
        </button>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 rounded-2xl border-2 border-dashed border-destructive/30 bg-destructive-light text-center">
        <FiAlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm font-medium text-neutral-700 max-w-xs">{error}</p>
        <button
          type="button"
          onClick={startCamera}
          className="mt-1 px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Live / starting ───────────────────────────────────────────────────────
  if (phase === 'live' || phase === 'starting') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-56 h-56 rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-200">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} /* mirror preview only; capture is unmirrored */
          />
          {phase === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/60 text-white text-sm">
              Starting camera…
            </div>
          )}
          {/* face guide */}
          <div className="pointer-events-none absolute inset-6 rounded-full border-2 border-white/40" />
        </div>
        <button
          type="button"
          onClick={capture}
          disabled={phase !== 'live'}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 disabled:opacity-60 shadow-sm"
        >
          <FiCamera className="w-4 h-4" /> Capture selfie
        </button>
        <p className="text-xs text-neutral-400">Center your face in the circle, good light, look at the camera.</p>
      </div>
    );
  }

  // ── Idle (start) ──────────────────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={startCamera}
      className="w-full flex flex-col items-center gap-2 px-4 py-8 rounded-2xl border-2 border-dashed border-neutral-300 hover:border-primary-400 text-neutral-500 transition-colors"
    >
      <FiVideo className="w-8 h-8 text-primary-400" />
      <span className="text-sm font-semibold text-neutral-700">Start live camera</span>
      <span className="text-xs text-neutral-400">We capture your selfie live — no uploads, so nobody can fake it.</span>
    </button>
  );
}

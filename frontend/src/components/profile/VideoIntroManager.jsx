import React, { useRef, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FiVideo, FiUploadCloud, FiTrash2, FiLoader } from 'react-icons/fi';
import { getImageUrl } from '../../utils/cloudinary';
import { API_BASE_URL } from '../../utils/api';

const MAX_BYTES = 25 * 1024 * 1024; // keep in sync with backend MAX_VIDEO_SIZE
const ACCEPT = 'video/mp4,video/quicktime,video/webm';

/**
 * Self-contained video-intro control for the owner's profile.
 * Shows the current intro (with Remove) or an upload affordance.
 * Calls POST/DELETE /profile/video-intro and reports the new URL via onChange.
 */
export default function VideoIntroManager({ videoUrl, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const src = videoUrl ? getImageUrl(videoUrl, API_BASE_URL, 'full') : null;

  const handleSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting same file
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error('Video must be 25MB or less (keep it under ~30s)');
      return;
    }
    try {
      setBusy(true);
      const fd = new FormData();
      fd.append('videoIntro', file);
      const res = await api.post('/profile/video-intro', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange?.(res.data?.videoIntroUrl || null);
      toast.success('Video intro uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    try {
      setBusy(true);
      await api.delete('/profile/video-intro');
      onChange?.(null);
      toast.success('Video intro removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove video');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <FiVideo className="w-4 h-4 text-rose-400" />
        <h3 className="text-sm font-bold text-slate-900">Video intro</h3>
        <span className="text-[11px] text-slate-400">~30s · MP4/MOV/WebM · max 25MB</span>
      </div>

      {src ? (
        <div className="space-y-3">
          <video
            src={src}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-72 rounded-xl bg-black"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FiUploadCloud className="w-4 h-4" /> Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-rose-100 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              <FiTrash2 className="w-4 h-4" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-500 transition-colors disabled:opacity-50"
        >
          {busy ? <FiLoader className="w-6 h-6 animate-spin" /> : <FiUploadCloud className="w-6 h-6" />}
          <span className="text-sm font-medium">{busy ? 'Uploading…' : 'Add a short video intro'}</span>
          <span className="text-[11px] text-slate-400">Stand out — profiles with video get more interest</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleSelect}
        className="hidden"
      />
    </div>
  );
}

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCamera, FiCheck, FiPlus, FiStar, FiTrash2 } from 'react-icons/fi';
import api from '../../api/axios';
import RetryImage from '../ui/RetryImage';
import { API_BASE_URL } from '../../utils/api';
import { getImageUrl } from '../../utils/cloudinary';

export const MAX_PHOTOS = 6; // keep in sync with backend MAX_GALLERY_PHOTOS
const MAX_BYTES = 5 * 1024 * 1024;
const errOf = (err, fallback) => err?.response?.data?.error?.message || err?.response?.data?.message || fallback;

/** Main photo first, then the rest of the gallery, no duplicates. */
export const orderedPhotos = (profile) => {
  const main = profile?.profilePhoto;
  const rest = (profile?.photos || []).filter((p) => p && p !== main);
  return main ? [main, ...rest] : rest;
};

/**
 * The owner's photo gallery: add (up to six), make one the main photo, delete.
 * The web had no gallery UI at all: the endpoints existed and nothing called
 * them, and "Change photo" stacked the new photo on top of the old one with no
 * way to remove it.
 *
 * `onChange(profile)` receives the refreshed profile after every successful
 * change so the page can re-render from server truth.
 */
export default function PhotoManager({ profile, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const photos = orderedPhotos(profile);
  const main = profile?.profilePhoto;
  const room = MAX_PHOTOS - photos.length;

  const refresh = async () => {
    const res = await api.get('/profile/me');
    onChange?.(res.data.profile || res.data);
  };

  const run = async (work, okMessage) => {
    setBusy(true);
    try {
      const res = await work();
      await refresh();
      if (res?.data?.photosUnderReview > 0) {
        toast('Some photos are being checked by our team before they appear.', { icon: null });
      } else if (okMessage) {
        toast.success(okMessage);
      }
    } catch (err) {
      toast.error(errOf(err, 'Could not update your photos. Please try again.'));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const add = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;
    const images = picked.filter((f) => f.type.startsWith('image/'));
    if (images.length !== picked.length) toast.error('Only image files can be added.');
    const tooBig = images.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) toast.error('Each photo must be 5MB or smaller.');
    const ok = images.filter((f) => f.size <= MAX_BYTES).slice(0, room);
    if (images.length - tooBig.length > room) toast.error(`You can have up to ${MAX_PHOTOS} photos. Delete one to add another.`);
    if (!ok.length) return;
    const fd = new FormData();
    ok.forEach((f) => fd.append('photos', f));
    run(() => api.put('/profile/me', fd), ok.length === 1 ? 'Photo added' : 'Photos added');
  };

  const makeMain = (url) => {
    const fd = new FormData();
    fd.append('profilePhoto', url);
    run(() => api.put('/profile/me', fd), 'Main photo updated');
  };

  const remove = (url) => run(() => api.delete('/profile/me/photo', { data: { photoUrl: url } }), 'Photo deleted');

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="font-display text-lg font-semibold text-neutral-900 dark:text-neutral-100">Your photos</h3>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{photos.length} of {MAX_PHOTOS}</span>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-label="Your photos">
        {photos.map((url, i) => {
          const isMain = url === main;
          const asking = confirming === url;
          return (
            <li key={url} className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              {/* The camera glyph sits behind the image and shows when the photo cannot load. */}
              <div className="absolute inset-0 flex items-center justify-center text-neutral-400" aria-hidden="true">
                <FiCamera className="w-6 h-6" />
              </div>
              <RetryImage
                src={getImageUrl(url, API_BASE_URL, 'full')}
                alt={isMain ? 'Main photo' : `Photo ${i + 1}`}
                className="relative w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
              />
              {isMain && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-neutral-900/80 px-2 py-1 text-[11px] font-semibold text-white">
                  <FiCheck className="w-3 h-3" /> Main photo
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                {!isMain && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => makeMain(url)}
                    className="min-h-[2.75rem] flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-white/90 px-2 text-xs font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
                  >
                    <FiStar className="w-3.5 h-3.5" /> Make main
                  </button>
                )}
                {asking ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(url)}
                    className="min-h-[2.75rem] flex-1 rounded-lg bg-destructive px-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Confirm delete
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || photos.length <= 1}
                    onClick={() => setConfirming(url)}
                    aria-label={`Delete photo ${i + 1}`}
                    title={photos.length <= 1 ? 'Add another photo before deleting this one' : 'Delete photo'}
                    className="min-h-[2.75rem] min-w-[2.75rem] inline-flex items-center justify-center rounded-lg bg-white/90 text-neutral-900 hover:bg-white disabled:opacity-50"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          );
        })}

        {room > 0 && (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-60"
            >
              <FiPlus className="w-6 h-6" />
              <span className="text-sm font-medium">{busy ? 'Working…' : 'Add photo'}</span>
            </button>
          </li>
        )}
      </ul>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={add} className="hidden" />

      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {photos.length === 0
          ? 'Add a clear, recent photo of your face. Profiles with photos get far more interest.'
          : 'Up to six photos, 5MB each. New photos are checked by our team if our system is unsure, and appear once approved.'}
      </p>
      {/* The disabled delete only says why in a hover title, which a phone never shows. */}
      {photos.length === 1 && (
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
          To change this photo, add the new one first, then delete this one.
        </p>
      )}
      {confirming && (
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300" role="status">
          Tap &ldquo;Confirm delete&rdquo; to remove this photo for good, or{' '}
          <button type="button" className="underline" onClick={() => setConfirming(null)}>keep it</button>.
          {confirming === main && ' Your next photo becomes your main photo.'}
        </p>
      )}
    </div>
  );
}

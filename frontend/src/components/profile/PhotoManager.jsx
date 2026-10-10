import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Trans, useTranslation } from 'react-i18next';
import { FiCamera, FiCheck, FiPlus, FiStar, FiTrash2 } from 'react-icons/fi';
import api from '../../api/axios';
import RetryImage from '../ui/RetryImage';
import { useConfirm } from '../ui/ConfirmDialog';
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
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [confirm, confirmDialog] = useConfirm();
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
        toast(t('photos.underReview'), { icon: null });
      } else if (okMessage) {
        toast.success(okMessage);
      }
    } catch (err) {
      toast.error(errOf(err, t('photos.updateFailed')));
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
    if (images.length !== picked.length) toast.error(t('photos.onlyImages'));
    const tooBig = images.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) toast.error(t('photos.tooBig'));
    const ok = images.filter((f) => f.size <= MAX_BYTES).slice(0, room);
    if (images.length - tooBig.length > room) toast.error(t('photos.limit', { max: MAX_PHOTOS }));
    if (!ok.length) return;
    const fd = new FormData();
    ok.forEach((f) => fd.append('photos', f));
    run(() => api.put('/profile/me', fd), t('photos.added', { count: ok.length }));
  };

  const makeMain = (url) => {
    const fd = new FormData();
    fd.append('profilePhoto', url);
    run(() => api.put('/profile/me', fd), t('photos.mainUpdated'));
  };

  const remove = (url) => run(() => api.delete('/profile/me/photo', { data: { photoUrl: url } }), t('photos.deleted'));

  // The last photo can go too, but only after the member has read what it
  // costs: a profile without a photo ranks lower and cannot hold the badge.
  const removeLast = async (url) => {
    const ok = await confirm({
      title: t('photos.lastDeleteTitle'),
      body: t('photos.lastDeleteBody'),
      confirmLabel: t('photos.lastDeleteConfirm'),
      cancelLabel: t('photos.lastDeleteCancel'),
    });
    if (ok) remove(url);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="font-display text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t('photos.yourPhotos')}</h3>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{t('photos.countOf', { count: photos.length, max: MAX_PHOTOS })}</span>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-label={t('photos.yourPhotos')}>
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
                alt={isMain ? t('photos.mainPhoto') : t('photos.photoN', { n: i + 1 })}
                className="relative w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
              />
              {isMain && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-neutral-900/80 px-2 py-1 text-[11px] font-semibold text-white">
                  <FiCheck className="w-3 h-3" /> {t('photos.mainPhoto')}
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
                    <FiStar className="w-3.5 h-3.5" /> {t('photos.makeMain')}
                  </button>
                )}
                {asking ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(url)}
                    className="min-h-[2.75rem] flex-1 rounded-lg bg-destructive px-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {t('photos.confirmDelete')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => (photos.length === 1 ? removeLast(url) : setConfirming(url))}
                    aria-label={t('photos.deletePhotoN', { n: i + 1 })}
                    title={t('photos.deletePhoto')}
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
              <span className="text-sm font-medium">{busy ? t('photos.working') : t('photos.addPhoto')}</span>
            </button>
          </li>
        )}
      </ul>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={add} className="hidden" />

      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {photos.length === 0
          ? t('photos.emptyHint')
          : t('photos.galleryHint')}
      </p>
      {/* Changing the only photo: add first, so the profile is never without one. */}
      {photos.length === 1 && (
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
          {t('photos.changeOnlyPhoto')}
        </p>
      )}
      {confirming && (
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300" role="status">
          <Trans
            i18nKey="photos.confirmPrompt"
            components={{ btn: <button type="button" className="underline" onClick={() => setConfirming(null)} /> }}
          />
          {confirming === main && ` ${t('photos.nextBecomesMain')}`}
        </p>
      )}
      {confirmDialog}
    </div>
  );
}

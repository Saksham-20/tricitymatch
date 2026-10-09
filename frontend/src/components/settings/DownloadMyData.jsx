import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation, Trans } from 'react-i18next';
import { FiDownload } from 'react-icons/fi';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { legal } from '../../config';

// Right of access / portability: one JSON file with everything we hold about the
// member. Re-asks for the password, because a session left open on a shared
// machine must not be able to walk off with the whole file.
const messageOf = async (err, fallback) => {
  // With responseType 'blob' an error body arrives as a Blob; read it.
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed?.error?.message || parsed?.message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.error?.message || data?.message || fallback;
};

const DownloadMyData = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Google-only members have no password to confirm with here.
  const googleOnly = user?.hasPassword === false;

  const download = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/auth/me/export', { password }, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tricitymatch-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPassword('');
      toast.success(t('settings.downloadData.downloaded'));
    } catch (err) {
      toast.error(await messageOf(err, t('settings.downloadData.failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{t('settings.downloadData.title')}</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
          {t('settings.downloadData.desc')}
        </p>
      </div>
      {googleOnly ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-xl">
          <Trans i18nKey="settings.downloadData.google" values={{ email: legal.privacyEmail }} components={{ anchor: <a className="underline" href={`mailto:${legal.privacyEmail}`} /> }} />
        </p>
      ) : (
        <form onSubmit={download} className="max-w-xl space-y-3">
          <div>
            <label htmlFor="export-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('settings.downloadData.confirmPassword')}</label>
            <input id="export-password" type="password" autoComplete="current-password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={busy || !password} className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60">
            <FiDownload className="w-4 h-4" /> {busy ? t('settings.downloadData.preparing') : t('settings.downloadData.download')}
          </button>
        </form>
      )}
    </div>
  );
};

export default DownloadMyData;

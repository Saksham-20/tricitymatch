import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { FiAlertTriangle, FiEyeOff } from 'react-icons/fi';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatDate';

// A member whose account is scheduled for deletion, or whose profile is paused,
// is hidden from everyone. Both used to be visible only inside Settings → Pause
// or delete, so a member who signed back in landed on a normal-looking
// dashboard with no hint that nobody could see them and no way to undo it here.
export default function AccountStateBanner() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const scheduledFor = user?.deletionScheduledFor;
  const paused = Boolean(user?.Profile?.pausedAt);
  if (!scheduledFor && !paused) return null;

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (err) {
      toast.error(err.response?.data?.error?.message || t('chrome.accountState.failed'));
    } finally { setBusy(false); }
  };

  const cancelDeletion = () => run(async () => {
    await api.post('/auth/account/cancel-deletion');
    updateUser({ deletionScheduledFor: null, Profile: { ...(user?.Profile || {}), isActive: !paused } });
    toast.success(t('chrome.accountState.cancelled'));
  });

  const resume = () => run(async () => {
    await api.post('/profile/me/resume');
    updateUser({ Profile: { ...(user?.Profile || {}), pausedAt: null, isActive: true } });
    toast.success(t('chrome.accountState.resumed'));
  });

  const Icon = scheduledFor ? FiAlertTriangle : FiEyeOff;
  return (
    <div role="status" className="mb-6 flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-light dark:bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {scheduledFor
              ? t('chrome.accountState.deletionTitle', { date: formatDate(scheduledFor) })
              : t('chrome.accountState.pausedTitle')}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {scheduledFor
              ? t('chrome.accountState.deletionBody')
              : t('chrome.accountState.pausedBody')}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={scheduledFor ? cancelDeletion : resume}
        disabled={busy}
        className="btn-primary min-h-[44px] whitespace-nowrap px-4 text-sm disabled:opacity-60"
      >
        {scheduledFor ? t('chrome.accountState.cancelDeletion') : t('chrome.accountState.resume')}
      </button>
    </div>
  );
}

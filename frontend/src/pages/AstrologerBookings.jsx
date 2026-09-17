import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { FiArrowLeft, FiSmartphone, FiCalendar } from 'react-icons/fi';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

const STATUS_CLS = {
  confirmed: 'bg-success-50 dark:bg-success/15 text-success',
  pending_payment: 'bg-warning-light dark:bg-warning/15 text-warning',
  completed: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
  cancelled: 'bg-destructive-light dark:bg-destructive/15 text-destructive',
};

export default function AstrologerBookings() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get('/astrologers/my-bookings');
      setBookings(res.data.bookings || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/astrologers" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 mb-6">
        <FiArrowLeft className="w-4 h-4" /> {t('common.back')}
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100 mb-6">{t('astrologers.myBookings')}</h1>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <ErrorState
          title="Couldn't load your bookings"
          description="The connection dropped before this finished loading. Try again."
          onRetry={load}
        />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={FiCalendar}
          title={t('common.empty')}
          actionLabel={t('astrologers.title', 'Talk to an Astrologer')}
          onAction={() => { window.location.href = '/astrologers'; }}
        />
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li key={b.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-neutral-800 dark:text-neutral-100">{b.Astrologer?.name || 'Astrologer'}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[b.status] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'}`}>{b.status}</span>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : '—'} · {b.durationMin} min
              </p>
              {b.status === 'confirmed' && (
                <p className="text-sm text-primary-600 dark:text-primary-400 inline-flex items-center gap-1.5 mt-2">
                  <FiSmartphone className="w-4 h-4" /> {t('astrologers.callInApp')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

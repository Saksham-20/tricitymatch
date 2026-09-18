import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { FiStar, FiClock, FiCalendar } from 'react-icons/fi';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

// Pointer-gated hover (doctrine §4.7/ruling 16): a plain `hover:` utility
// fires on tap and leaves a touch device's card stuck in its raised state
// after the finger lifts.
const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover';

export default function Astrologers() {
  const { t } = useTranslation();
  const [astrologers, setAstrologers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get('/astrologers');
      setAstrologers(res.data.astrologers || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('astrologers.title')}</h1>
        <Link to="/astrologers/bookings" className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
          <FiCalendar className="w-4 h-4" /> {t('astrologers.myBookings')}
        </Link>
      </div>
      <p className="text-neutral-500 dark:text-neutral-400 mb-6">{t('astrologers.subtitle')}</p>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-4 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-card rounded-2xl p-4">
              <Skeleton variant="circle" className="w-16 h-16 flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <ErrorState
          title="Couldn't load astrologers"
          description="The connection dropped before this finished loading. Try again."
          onRetry={load}
        />
      ) : astrologers.length === 0 ? (
        <EmptyState
          icon={FiStar}
          title="No astrologers available yet"
          description="Our verified astrologers are joining soon. Check back shortly to book a consultation."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {astrologers.map((a) => (
            <Link
              key={a.id}
              to={`/astrologers/${a.id}`}
              className={`flex gap-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-card rounded-2xl p-4 ${HOVER}:border-primary-300 dark:${HOVER}:border-primary-700 ${HOVER}:-translate-y-0.5 transition-[border-color,transform] duration-[160ms]`}
            >
              <img
                src={a.avatarUrl || '/images/avatar-placeholder.svg'}
                alt={a.name}
                className="w-16 h-16 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-800 dark:text-neutral-100 truncate">{a.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.isOnline ? 'bg-success-50 dark:bg-success/15 text-success' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
                    {a.isOnline ? t('astrologers.online') : t('astrologers.offline')}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">{(a.speciality || []).join(', ')}</p>
                <div className="flex items-center gap-3 mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                  {/* Rating star is a state indicator (doctrine §3.1), not a
                      premium mark — warning is the closest semantic tone,
                      not gold. */}
                  <span className="inline-flex items-center gap-1"><FiStar className="w-4 h-4 text-warning fill-warning" /> {a.rating}</span>
                  <span className="inline-flex items-center gap-1"><FiClock className="w-4 h-4" /> {t('astrologers.experience', { years: a.experience })}</span>
                  <span className="font-medium text-primary-600 dark:text-primary-400">{t('astrologers.perMin', { price: a.pricePerMin })}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

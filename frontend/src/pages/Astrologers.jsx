import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { FiStar, FiClock, FiCalendar } from 'react-icons/fi';

export default function Astrologers() {
  const { t } = useTranslation();
  const [astrologers, setAstrologers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/astrologers');
        setAstrologers(res.data.astrologers || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('astrologers.title')}</h1>
        <Link to="/astrologers/bookings" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700">
          <FiCalendar className="w-4 h-4" /> {t('astrologers.myBookings')}
        </Link>
      </div>
      <p className="text-neutral-500 mb-6">{t('astrologers.subtitle')}</p>

      {loading ? (
        <p className="text-neutral-400">{t('common.loading')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {astrologers.map((a) => (
            <Link
              key={a.id}
              to={`/astrologers/${a.id}`}
              className="flex gap-4 bg-white dark:bg-[#1a1f2e] border border-neutral-200 dark:border-neutral-800 shadow-card rounded-2xl p-4 hover:border-primary-300 hover:-translate-y-0.5 transition-all"
            >
              <img
                src={a.avatarUrl || '/images/avatar-placeholder.svg'}
                alt={a.name}
                className="w-16 h-16 rounded-full object-cover bg-neutral-100"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-800 truncate">{a.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.isOnline ? 'bg-success-50 text-success' : 'bg-neutral-100 text-neutral-400'}`}>
                    {a.isOnline ? t('astrologers.online') : t('astrologers.offline')}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 truncate">{(a.speciality || []).join(', ')}</p>
                <div className="flex items-center gap-3 mt-2 text-sm text-neutral-600">
                  <span className="inline-flex items-center gap-1"><FiStar className="w-4 h-4 text-gold-500 fill-gold-500" /> {a.rating}</span>
                  <span className="inline-flex items-center gap-1"><FiClock className="w-4 h-4" /> {t('astrologers.experience', { years: a.experience })}</span>
                  <span className="font-medium text-primary-600">{t('astrologers.perMin', { price: a.pricePerMin })}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

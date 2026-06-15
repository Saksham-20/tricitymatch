import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { FiArrowLeft, FiSmartphone, FiCalendar } from 'react-icons/fi';

const STATUS_CLS = {
  confirmed: 'bg-green-50 text-green-600',
  pending_payment: 'bg-amber-50 text-amber-600',
  completed: 'bg-neutral-100 text-neutral-500',
  cancelled: 'bg-red-50 text-red-600',
};

export default function AstrologerBookings() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/astrologers/my-bookings');
        setBookings(res.data.bookings || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/astrologers" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 mb-6">
        <FiArrowLeft className="w-4 h-4" /> {t('common.back')}
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-800 mb-6">{t('astrologers.myBookings')}</h1>

      {loading ? (
        <p className="text-neutral-400">{t('common.loading')}</p>
      ) : bookings.length === 0 ? (
        <p className="text-neutral-400 inline-flex items-center gap-2"><FiCalendar className="w-4 h-4" /> {t('common.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li key={b.id} className="bg-white border border-neutral-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-neutral-800">{b.Astrologer?.name || 'Astrologer'}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[b.status] || 'bg-neutral-100 text-neutral-500'}`}>{b.status}</span>
              </div>
              <p className="text-sm text-neutral-500 mt-1">
                {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : '—'} · {b.durationMin} min
              </p>
              {b.status === 'confirmed' && (
                <p className="text-sm text-primary-600 inline-flex items-center gap-1.5 mt-2">
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

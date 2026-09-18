import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiStar, FiClock, FiArrowLeft, FiSmartphone, FiCheckCircle } from 'react-icons/fi';
import { razorpay } from '../config';
import { loadRazorpayScript, ensurePaymentsAvailable, PAYMENTS_UNAVAILABLE_MSG } from '../utils/razorpayCheckout';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

const DURATIONS = [10, 15, 30, 45];

export default function AstrologerDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [ast, setAst] = useState(null);
  const [loading, setLoading] = useState(true);
  // Distinct from "not found": a dropped connection is retryable, a genuinely
  // missing astrologer is not — the fetch below tells them apart.
  const [loadError, setLoadError] = useState(false);
  const [duration, setDuration] = useState(15);
  const [when, setWhen] = useState('');
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get(`/astrologers/${id}`);
      setAst(res.data.astrologer);
    } catch (err) {
      if (err.response?.status === 404) {
        setAst(null);
      } else {
        setLoadError(true);
        toast.error('Could not load this astrologer');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const book = async () => {
    if (!when) { toast.error('Pick a date & time'); return; }
    setBooking(true);
    try {
      const res = await api.post('/astrologers/book', {
        astrologerId: id,
        scheduledAt: new Date(when).toISOString(),
        durationMin: duration,
      });
      const b = res.data.booking;
      if (b.razorpayOrderId) {
        // Payment required — ensure the SDK + key are available before opening,
        // so we never mark a booking "confirmed" without actually charging.
        if (!b.keyId && !ensurePaymentsAvailable()) return;
        try {
          await loadRazorpayScript();
        } catch {
          toast.error(PAYMENTS_UNAVAILABLE_MSG);
          return;
        }
        const rzp = new window.Razorpay({
          key: b.keyId || razorpay.keyId,
          order_id: b.razorpayOrderId,
          amount: b.amountPaise,
          name: 'TricityMatch',
          description: `Consultation with ${b.astrologerName}`,
          handler: async (resp) => {
            try {
              await api.post(`/astrologers/book/${b.id}/verify-payment`, {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              });
              setConfirmed(true);
              toast.success(t('astrologers.bookingConfirmed'));
            } catch {
              toast.error('Payment verification failed');
            }
          },
        });
        rzp.open();
      } else {
        // Razorpay not configured → booking auto-confirmed by backend
        setConfirmed(true);
        toast.success(t('astrologers.bookingConfirmed'));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Skeleton className="h-4 w-20 mb-6" />
        <div className="flex gap-5 items-start mb-6">
          <Skeleton variant="circle" className="w-20 h-20 flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ErrorState
          title="Couldn't load this astrologer"
          description="The connection dropped before this finished loading. Try again."
          onRetry={load}
        />
      </div>
    );
  }

  if (!ast) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <EmptyState
          icon={FiStar}
          title="Astrologer not found"
          description="This listing may have been removed."
          actionLabel="Back to astrologers"
          onAction={() => window.history.back()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/astrologers" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 mb-6">
        <FiArrowLeft className="w-4 h-4" /> {t('common.back')}
      </Link>

      <div className="flex gap-5 items-start mb-6">
        <img
          src={ast.avatarUrl || '/images/avatar-placeholder.svg'}
          alt={ast.name}
          className="w-20 h-20 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        />
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100">{ast.name}</h1>
          <p className="text-neutral-500 dark:text-neutral-400">{(ast.speciality || []).join(', ')}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            <span className="inline-flex items-center gap-1"><FiStar className="w-4 h-4 text-warning fill-warning" /> {ast.rating} ({ast.reviewCount})</span>
            <span className="inline-flex items-center gap-1"><FiClock className="w-4 h-4" /> {t('astrologers.experience', { years: ast.experience })}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{(ast.languages || []).join(' · ')}</p>
        </div>
      </div>

      {ast.bio && <p className="text-neutral-600 dark:text-neutral-300 mb-6">{ast.bio}</p>}

      {confirmed ? (
        <div className="bg-success-50 dark:bg-success/15 border border-success-100 dark:border-success/30 rounded-2xl p-6 text-center">
          <FiCheckCircle className="w-10 h-10 text-success mx-auto mb-3" />
          <p className="font-medium text-neutral-800 dark:text-neutral-100 mb-2">{t('astrologers.bookingConfirmed')}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 inline-flex items-center gap-2">
            <FiSmartphone className="w-4 h-4" /> {t('astrologers.callInApp')}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
          <h2 className="font-semibold text-neutral-800 dark:text-neutral-100 mb-4">{t('astrologers.book')} · {t('astrologers.perMin', { price: ast.pricePerMin })}</h2>

          <label className="block text-sm text-neutral-600 dark:text-neutral-300 mb-1">Duration</label>
          <div className="flex gap-2 mb-4">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                aria-pressed={duration === d}
                className={`inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-[160ms] ${duration === d ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
              >
                {d} min
              </button>
            ))}
          </div>

          <label htmlFor="ast-when" className="block text-sm text-neutral-600 dark:text-neutral-300 mb-1">Date & time</label>
          <input
            id="ast-when"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full mb-4 px-3 py-3 text-base rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-[border-color,box-shadow] duration-[160ms]"
          />

          <div className="flex items-center justify-between mb-4">
            <span className="text-neutral-500 dark:text-neutral-400 text-sm">Total</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-100">₹{ast.pricePerMin * duration}</span>
          </div>

          <button
            onClick={book}
            disabled={booking}
            className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium transition-colors duration-[160ms]"
          >
            {booking ? t('common.loading') : t('astrologers.book')}
          </button>
        </div>
      )}
    </div>
  );
}

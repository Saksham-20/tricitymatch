import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiStar, FiClock, FiArrowLeft, FiSmartphone, FiCheckCircle } from 'react-icons/fi';

const DURATIONS = [10, 15, 30, 45];

export default function AstrologerDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [ast, setAst] = useState(null);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState(15);
  const [when, setWhen] = useState('');
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/astrologers/${id}`);
        setAst(res.data.astrologer);
      } catch {
        toast.error('Astrologer not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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
      if (b.razorpayOrderId && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: b.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
          order_id: b.razorpayOrderId,
          amount: b.amountPaise,
          name: 'TricityShadi',
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

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-neutral-400">{t('common.loading')}</div>;
  if (!ast) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/astrologers" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 mb-6">
        <FiArrowLeft className="w-4 h-4" /> {t('common.back')}
      </Link>

      <div className="flex gap-5 items-start mb-6">
        <img
          src={ast.avatarUrl || '/images/avatar-placeholder.svg'}
          alt={ast.name}
          className="w-20 h-20 rounded-full object-cover bg-neutral-100"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        />
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800">{ast.name}</h1>
          <p className="text-neutral-500">{(ast.speciality || []).join(', ')}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-neutral-600">
            <span className="inline-flex items-center gap-1"><FiStar className="w-4 h-4 text-gold-500 fill-gold-500" /> {ast.rating} ({ast.reviewCount})</span>
            <span className="inline-flex items-center gap-1"><FiClock className="w-4 h-4" /> {t('astrologers.experience', { years: ast.experience })}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">{(ast.languages || []).join(' · ')}</p>
        </div>
      </div>

      {ast.bio && <p className="text-neutral-600 mb-6">{ast.bio}</p>}

      {confirmed ? (
        <div className="bg-success-50 border border-success-100 rounded-2xl p-6 text-center">
          <FiCheckCircle className="w-10 h-10 text-success mx-auto mb-3" />
          <p className="font-medium text-neutral-800 mb-2">{t('astrologers.bookingConfirmed')}</p>
          <p className="text-sm text-neutral-600 inline-flex items-center gap-2">
            <FiSmartphone className="w-4 h-4" /> {t('astrologers.callInApp')}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
          <h2 className="font-semibold text-neutral-800 mb-4">{t('astrologers.book')} · {t('astrologers.perMin', { price: ast.pricePerMin })}</h2>

          <label className="block text-sm text-neutral-600 mb-1">Duration</label>
          <div className="flex gap-2 mb-4">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${duration === d ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600'}`}
              >
                {d} min
              </button>
            ))}
          </div>

          <label className="block text-sm text-neutral-600 mb-1">Date & time</label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-lg border border-neutral-200"
          />

          <div className="flex items-center justify-between mb-4">
            <span className="text-neutral-500 text-sm">Total</span>
            <span className="font-semibold text-neutral-800">₹{ast.pricePerMin * duration}</span>
          </div>

          <button
            onClick={book}
            disabled={booking}
            className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium"
          >
            {booking ? t('common.loading') : t('astrologers.book')}
          </button>
        </div>
      )}
    </div>
  );
}

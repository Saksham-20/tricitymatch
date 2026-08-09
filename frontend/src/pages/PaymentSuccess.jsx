import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiArrowRight } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import Logo from '../components/common/Logo';
import api from '../api/axios';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  // This page used to congratulate anyone who opened the URL — a bookmark or a
  // shared link told a free member their subscription was active. Confirm with
  // the server before claiming anything happened.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/subscription/my-subscription');
        const plan = data?.subscription?.planType;
        if (!cancelled && (!plan || plan === 'free')) {
          navigate('/subscription', { replace: true });
          return;
        }
      } catch {
        // Network hiccup on the confirmation read shouldn't strand the member
        // who genuinely just paid; fall through and show the page.
      }
      if (!cancelled) setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    if (checking) return undefined;
    const timer = setTimeout(() => navigate('/dashboard'), 10000);
    return () => clearTimeout(timer);
  }, [navigate, checking]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF8F2] dark:bg-[#0f1117] px-4">
        <div className="w-10 h-10 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDF8F2] dark:bg-[#0f1117] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" linkTo="/" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="card text-center"
        >
          {/* Animated check */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-18 h-18 rounded-full bg-gold-50 flex items-center justify-center mx-auto mb-5"
            style={{ width: 72, height: 72 }}
          >
            <FiCheckCircle className="w-9 h-9 text-gold" />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <FaCrown className="w-4 h-4 text-gold" />
              <h1 className="font-display text-2xl font-bold text-neutral-900">Payment Successful!</h1>
            </div>
            <p className="text-neutral-500 text-sm mb-6">
              Your subscription is now active. You have full access to all premium features.
            </p>

            <div className="bg-gold-50 rounded-2xl p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-gold-700 uppercase tracking-wide mb-2">What's unlocked</p>
              {[
                'Unlimited profile views',
                'Send unlimited interests',
                'Priority in search results',
                'Direct messaging',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 py-1">
                  <FiCheckCircle className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                  <span className="text-sm text-neutral-700">{f}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <Link to="/dashboard" className="btn-primary w-full flex items-center justify-center gap-2">
                Go to Dashboard <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/payment/history" className="btn-secondary w-full flex items-center justify-center">
                View Payment History
              </Link>
            </div>

            <p className="text-xs text-neutral-400 mt-5">Redirecting to dashboard in 10 seconds…</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

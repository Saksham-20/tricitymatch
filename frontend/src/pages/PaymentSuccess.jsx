import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiArrowRight, FiAward } from 'react-icons/fi';
import Logo from '../components/common/Logo';
import api from '../api/axios';
import { planFeatures } from '../utils/planFeatures';
import { useAuth } from '../context/AuthContext';
import { DUR, EASE_OUT } from '../utils/animations';

// Display names for the plan enum. Kept beside the page that shows them; the
// enum keys themselves are persisted in Postgres and never change.
const PLAN_LABEL = {
  basic_premium: 'Basic',
  premium_plus: 'Premium',
  elite: 'Elite',
  vip: 'VIP',
  nri: 'NRI Connect',
  founding_premium: 'Founding Member',
};

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // This page used to congratulate anyone who opened the URL — a bookmark or a
  // shared link told a free member their subscription was active. Confirm with
  // the server before claiming anything happened.
  const [checking, setChecking] = useState(true);
  const [plan, setPlan] = useState(null);
  const [features, setFeatures] = useState(null);
  const [unlockDailyCap, setUnlockDailyCap] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Both requests: the subscription confirms what was bought, and the
        // live plans response is what `planFeatures` needs to print the real
        // unlock count. Without it this receipt read the static fallback
        // copy ("15 contact unlocks") even when the plan actually purchased
        // — e.g. under a launch offer — sells unlimited unlocks: a receipt
        // is the worst possible place for a number that contradicts what the
        // member was just charged for.
        const [subRes, plansRes] = await Promise.all([
          api.get('/subscription/my-subscription'),
          api.get('/subscription/plans'),
        ]);
        const planType = subRes.data?.subscription?.planType;
        if (!cancelled && (!planType || planType === 'free')) {
          navigate('/subscription', { replace: true });
          return;
        }
        if (!cancelled) {
          setPlan(planType);
          const livePlan = plansRes.data?.plans?.[planType] || null;
          setUnlockDailyCap(livePlan?.unlockDailyCap ?? null);
          // What this member actually bought. The list used to be four
          // hardcoded lines shown to every buyer, including "Priority in search
          // results" — an Elite feature a Basic buyer does not get. A receipt
          // is the worst possible place to over-promise.
          // Drop the "Everything in X" chain lines — a comparison-grid device
          // that says nothing on a receipt — and honour the live chat flag so
          // this never takes credit for something that is currently free.
          setFeatures(
            planFeatures(planType, Boolean(user?.features?.freeChatForMutuals), livePlan)
              .filter((f) => !/^Everything in /.test(f))
              .slice(0, 4)
          );
        }
      } catch {
        // Network hiccup on the confirmation read shouldn't strand the member
        // who genuinely just paid; fall through and show the page.
      }
      if (!cancelled) setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [navigate, user]);

  useEffect(() => {
    if (checking) return undefined;
    const timer = setTimeout(() => navigate('/dashboard'), 10000);
    return () => clearTimeout(timer);
  }, [navigate, checking]);

  if (checking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background dark:bg-surface-dark-1 px-4">
        <div className="w-10 h-10 rounded-full border-2 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background dark:bg-surface-dark-1 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" linkTo="/" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: DUR.content, ease: EASE_OUT }}
          className="card text-center"
        >
          {/* Animated check — a first-time, rare-tier celebration (doctrine
              §4.1's delight budget), but ruling 8 still applies: springs are
              reserved for surfaces a finger is actively driving, not a
              route-loaded receipt. Duration + EASE_OUT, entrance starts from
              the sanctioned 0.95-0.97 scale range (§4.5), never scale(0). */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: DUR.content, ease: EASE_OUT }}
            className="w-18 h-18 rounded-full bg-gold-50 dark:bg-gold-900/20 flex items-center justify-center mx-auto mb-5"
          >
            <FiCheckCircle className="w-9 h-9 text-gold" />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <FiAward className="w-4 h-4 text-gold" />
              <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100">Payment successful</h1>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">
              {PLAN_LABEL[plan]
                ? `Your ${PLAN_LABEL[plan]} membership is now active.`
                : 'Your membership is now active.'}
            </p>

            {features?.length > 0 && (
            <div className="bg-gold-50 dark:bg-gold-900/10 rounded-2xl p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-gold-700 dark:text-gold-400 uppercase tracking-wide mb-2">What's unlocked</p>
              {(features || []).map((f) => (
                <div key={f} className="flex items-center gap-2 py-1">
                  <FiCheckCircle className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">{f}</span>
                </div>
              ))}
              {unlockDailyCap != null && (
                // Fact, not a restriction — disclosed on the receipt the same
                // way it is on the pricing page, not just in a FAQ.
                <div className="flex items-center gap-2 py-1">
                  <FiCheckCircle className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">Unlimited unlocks, up to {unlockDailyCap}/day</span>
                </div>
              )}
            </div>
            )}

            <div className="flex flex-col gap-3">
              <Link to="/dashboard" className="btn-primary w-full flex items-center justify-center gap-2">
                Go to Dashboard <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/payment/history" className="btn-secondary w-full flex items-center justify-center">
                View payment history
              </Link>
            </div>

            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-5">Redirecting to dashboard in 10 seconds…</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

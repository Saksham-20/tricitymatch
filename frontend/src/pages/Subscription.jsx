import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiCheck, FiArrowRight, FiZap, FiShield } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

// ─── Plan feature lists ───────────────────────
const PLAN_FEATURES = {
  free: [
    'Create profile',
    'Browse matches',
    'Send interest',
    'Basic search filters',
  ],
  basic_premium: [
    'View contact details',
    'Unlimited messages',
    'See who viewed profile',
    'Advanced search filters',
    '5 contact unlocks',
  ],
  premium_plus: [
    'Everything in Basic Premium',
    '10 contact unlocks',
    'Profile boost',
    'Spotlight listing',
    'Priority customer support',
  ],
  vip: [
    'Everything in Premium Plus',
    'Unlimited contact unlocks',
    'Priority ranking in search',
    'Verified badge',
    'Dedicated relationship advisor',
    'Exclusive member events',
  ],
};

// ─── Plan card config ─────────────────────────
const PLAN_CONFIG = {
  free:           { label: 'Free',          accent: 'neutral',  icon: null,     cta: 'Free Forever' },
  basic_premium:  { label: 'Basic Premium', accent: 'primary',  icon: FiZap,    cta: 'Get Basic',   duration: '15 days',  price: 1500  },
  premium_plus:   { label: 'Premium Plus',  accent: 'primary',  icon: FaCrown,  cta: 'Get Premium+', duration: '1 month',  price: 3000  },
  vip:            { label: 'VIP',           accent: 'gold',     icon: FiShield, cta: 'Get VIP',      duration: '3 months', price: 7499  },
};

// ─── Single plan card ─────────────────────────
const PlanCard = ({ planKey, plan, isPopular, isCurrent, onSubscribe }) => {
  const cfg = PLAN_CONFIG[planKey] || PLAN_CONFIG.free;
  const Icon = cfg.icon;
  const features = PLAN_FEATURES[planKey] || plan.features || [];
  const free = planKey === 'free';
  const displayPrice = plan.price || cfg.price || 0;

  // Compute per-month price for display (only show for multi-month plans)
  let perMonth = null;
  if (planKey === 'vip') perMonth = Math.round(displayPrice / 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!free && !isCurrent ? { y: -6 } : {}}
      transition={{ duration: 0.35 }}
      className={`relative flex flex-col bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
        isPopular
          ? 'border-primary-300 shadow-burgundy-lg ring-1 ring-primary-200 scale-[1.03]'
          : planKey === 'vip'
          ? 'border-gold-300 shadow-md'
          : 'border-neutral-200 shadow-card'
      }`}
    >
      {/* Popular / Best Value badge */}
      {isPopular && (
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary-500 to-primary-700 rounded-t-2xl" />
      )}
      {isPopular && (
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-500 text-white text-xs font-semibold rounded-b-xl shadow-burgundy">
            <FiZap className="w-3 h-3" />
            Most Popular
          </span>
        </div>
      )}
      {planKey === 'vip' && !isPopular && (
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-gold-400 to-gold-600 rounded-t-2xl" />
      )}
      {planKey === 'vip' && !isPopular && (
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gold text-neutral-900 text-xs font-semibold rounded-b-xl shadow-gold">
            <FaCrown className="w-3 h-3" />
            Best Value
          </span>
        </div>
      )}

      {/* Header */}
      <div className={`px-6 pt-8 pb-6 ${isPopular || planKey === 'vip' ? 'pt-10' : ''}`}>
        <div className="flex items-center gap-2.5 mb-4">
          {Icon && (
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              planKey === 'vip' ? 'bg-gold-50 text-gold'
              : planKey === 'premium_plus' ? 'bg-primary-100 text-primary-600'
              : 'bg-primary-50 text-primary-500'
            }`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <h3 className="text-lg font-bold text-neutral-900">{plan.name || cfg.label}</h3>
          {isCurrent && (
            <span className="ml-auto px-2 py-0.5 bg-success-50 border border-success-100 text-success text-[10px] font-bold rounded-full uppercase tracking-wide">
              Active
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1 mb-1">
          <span className={`text-4xl font-bold ${
            planKey === 'vip' ? 'text-gold-600'
            : planKey === 'premium_plus' || planKey === 'basic_premium' ? 'text-primary-500'
            : 'text-neutral-700'
          }`}>
            {displayPrice > 0 ? `₹${displayPrice.toLocaleString('en-IN')}` : 'Free'}
          </span>
          {displayPrice > 0 && (
            <span className="text-sm text-neutral-500">/{plan.duration || cfg.duration}</span>
          )}
        </div>
        {perMonth && (
          <p className="text-xs text-neutral-400">
            Just ₹{perMonth}/month · Billed once
          </p>
        )}
        {displayPrice > 0 && plan.contactUnlocks != null && (
          <p className="text-xs text-primary-500 font-medium mt-1">
            {plan.contactUnlocks === -1 ? '∞ Unlimited' : plan.contactUnlocks} contact unlocks
          </p>
        )}
      </div>

      {/* Feature list */}
      <div className="flex-1 px-6 pb-6">
        <ul className="space-y-2.5">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                planKey === 'vip' ? 'bg-gold-100 text-gold-700' :
                planKey === 'premium_plus' ? 'bg-primary-100 text-primary-600' :
                planKey === 'basic_premium' ? 'bg-primary-50 text-primary-500' :
                'bg-neutral-100 text-neutral-500'
              }`}>
                <FiCheck className="w-2.5 h-2.5" />
              </div>
              <span className="text-sm text-neutral-700 leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <button
          onClick={() => !free && !isCurrent && onSubscribe(planKey)}
          disabled={isCurrent || free}
          className={`w-full py-3 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
            isCurrent
              ? 'bg-neutral-100 text-neutral-500 cursor-default'
              : free
              ? 'bg-neutral-100 text-neutral-500 cursor-default'
              : planKey === 'vip'
              ? 'bg-gold text-neutral-900 hover:bg-gold-400 shadow-gold hover:-translate-y-0.5'
              : 'bg-primary-500 text-white hover:bg-primary-600 shadow-burgundy hover:-translate-y-0.5'
          }`}
        >
          {isCurrent
            ? <><FiCheck className="w-4 h-4" /> Current Plan</>
            : free
            ? 'Free Forever'
            : <>{cfg.cta} <FiArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────
const Subscription = () => {
  const [plans, setPlans] = useState({});
  const [currentSub, setCurrentSub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [plansRes, subRes] = await Promise.all([
        api.get('/subscription/plans'),
        api.get('/subscription/my-subscription'),
      ]);
      setPlans(plansRes.data.plans || {});
      setCurrentSub(subRes.data.subscription);
    } catch {
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planType) => {
    try {
      const res = await api.post('/subscription/create-order', { planType });
      const { order } = res.data;

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const rzp = new window.Razorpay({
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxxxxxx',
          amount: order.amount,
          currency: order.currency,
          name: 'TricityShadi',
          description: `${planType} Subscription`,
          order_id: order.id,
          handler: async (response) => {
            try {
              await api.post('/subscription/verify-payment', {
                razorpayOrderId:   response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              toast.success('Subscription activated!');
              loadData();
            } catch {
              toast.error('Payment verification failed');
            }
          },
          prefill: { email: 'user@example.com', contact: '9876543210' },
          theme: { color: '#8B2346' },
        });
        rzp.open();
      };
      document.body.appendChild(script);
    } catch {
      toast.error('Failed to create order');
    }
  };

  // Friendly plan name display
  const planDisplayName = (type) => {
    const names = { basic_premium: 'Basic Premium', premium_plus: 'Premium Plus', vip: 'VIP' };
    return names[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin" />
        <p className="text-sm text-neutral-500">Loading plans…</p>
      </div>
    );
  }

  const planEntries = Object.entries(plans);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-50 border border-gold-200 rounded-full mb-5">
            <FaCrown className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs font-semibold text-gold-700 uppercase tracking-wide">Membership Plans</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-neutral-900 mb-3">
            Choose Your Plan
          </h1>
          <p className="text-neutral-500 text-lg max-w-lg mx-auto">
            Unlock premium features and find your perfect match faster.
          </p>
        </motion.div>

        {/* Active subscription banner */}
        {currentSub?.status === 'active' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center gap-3 px-5 py-3.5 bg-success-50 border border-success-100 rounded-2xl"
          >
            <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center flex-shrink-0">
              <FiCheck className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm text-success font-medium">
              You have an active <strong>{planDisplayName(currentSub.planType)}</strong> subscription
              {currentSub.endDate && (
                <span className="font-normal text-success/80">
                  {' '}· valid until {new Date(currentSub.endDate).toLocaleDateString()}
                </span>
              )}
              {currentSub.contactUnlocksAllowed != null && (
                <span className="font-normal text-success/80">
                  {' '}· {currentSub.contactUnlocksAllowed === null
                    ? '∞'
                    : `${Math.max(0, (currentSub.contactUnlocksAllowed || 0) - (currentSub.contactUnlocksUsed || 0))} of ${currentSub.contactUnlocksAllowed}`} unlocks remaining
                </span>
              )}
            </p>
          </motion.div>
        )}

        {/* Plan grid — 4 columns on desktop */}
        {planEntries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {planEntries.map(([key, plan], idx) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <PlanCard
                  planKey={key}
                  plan={plan}
                  isPopular={key === 'premium_plus' || plan.popular}
                  isCurrent={currentSub?.planType === key && currentSub?.status === 'active'}
                  onSubscribe={handleSubscribe}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          /* Fallback when no plans loaded from API */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {['free', 'basic_premium', 'premium_plus', 'vip'].map((key, idx) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <PlanCard
                  planKey={key}
                  plan={{
                    name: PLAN_CONFIG[key].label,
                    price: PLAN_CONFIG[key].price || 0,
                    duration: PLAN_CONFIG[key].duration || null,
                  }}
                  isPopular={key === 'premium_plus'}
                  isCurrent={currentSub?.planType === key && currentSub?.status === 'active'}
                  onSubscribe={handleSubscribe}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-neutral-400 mt-10"
        >
          All plans include SSL-secured payments via Razorpay · 100% privacy guaranteed · Cancel anytime
        </motion.p>
      </div>
    </div>
  );
};

export default Subscription;

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiCheck, FiArrowRight, FiZap } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

// ─── Plan feature lists ───────────────────────
const PLAN_FEATURES = {
  free: [
    'Basic profile search',
    'Limited daily interests',
    'View compatibility scores',
    'Browse verified profiles',
  ],
  premium: [
    'Unlimited interests & likes',
    'View contact details',
    'Chat with all your matches',
    'See who liked your profile',
    'Advanced search filters',
    'Priority customer support',
  ],
  elite: [
    'Everything in Premium',
    'Verified profile badge',
    'Profile boost — appear at top',
    'Priority in search results',
    'Exclusive member events',
    'Dedicated relationship advisor',
  ],
};

// ─── Plan card config ─────────────────────────
const PLAN_CONFIG = {
  free:    { label: 'Free',    accent: 'neutral',  icon: null,      cta: 'Free Forever' },
  premium: { label: 'Premium', accent: 'primary',  icon: FiZap,     cta: 'Get Premium'  },
  elite:   { label: 'Elite',   accent: 'gold',     icon: FaCrown,   cta: 'Get Elite'    },
};

// ─── Single plan card ─────────────────────────
const PlanCard = ({ planKey, plan, isPopular, isCurrent, onSubscribe }) => {
  const cfg = PLAN_CONFIG[planKey] || PLAN_CONFIG.free;
  const Icon = cfg.icon;
  const features = PLAN_FEATURES[planKey] || [];
  const free = planKey === 'free';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!free && !isCurrent ? { y: -6 } : {}}
      transition={{ duration: 0.35 }}
      className={`relative flex flex-col bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
        isPopular
          ? 'border-primary-300 shadow-burgundy-lg ring-1 ring-primary-200 scale-[1.03]'
          : 'border-neutral-200 shadow-card'
      }`}
    >
      {/* Popular badge */}
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

      {/* Header */}
      <div className={`px-6 pt-8 pb-6 ${isPopular ? 'pt-10' : ''}`}>
        <div className="flex items-center gap-2.5 mb-4">
          {Icon && (
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              planKey === 'elite' ? 'bg-gold-50 text-gold' : 'bg-primary-50 text-primary-500'
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
            planKey === 'elite' ? 'text-gold-600' : planKey === 'premium' ? 'text-primary-500' : 'text-neutral-700'
          }`}>
            {plan.price > 0 ? `₹${plan.price}` : 'Free'}
          </span>
          {plan.price > 0 && plan.duration && (
            <span className="text-sm text-neutral-500">/{plan.duration}</span>
          )}
        </div>
        {plan.price > 0 && (
          <p className="text-xs text-neutral-400">Billed once · Cancel anytime</p>
        )}
      </div>

      {/* Feature list */}
      <div className="flex-1 px-6 pb-6">
        <ul className="space-y-2.5">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                planKey === 'elite' ? 'bg-gold-100 text-gold-700' :
                planKey === 'premium' ? 'bg-primary-100 text-primary-600' :
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
              : planKey === 'elite'
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

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
              You have an active <strong>{currentSub.planType}</strong> subscription
              {currentSub.endDate && (
                <span className="font-normal text-success/80">
                  {' '}· valid until {new Date(currentSub.endDate).toLocaleDateString()}
                </span>
              )}
            </p>
          </motion.div>
        )}

        {/* Plan grid */}
        {planEntries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
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
                  isPopular={key === 'premium'}
                  isCurrent={currentSub?.planType === key && currentSub?.status === 'active'}
                  onSubscribe={handleSubscribe}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          /* Fallback when no plans loaded from API */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {['free', 'premium', 'elite'].map((key, idx) => (
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
                    price: key === 'free' ? 0 : key === 'premium' ? 999 : 2499,
                    duration: key === 'free' ? null : 'month',
                  }}
                  isPopular={key === 'premium'}
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
          All plans include SSL-secured payments via Razorpay · 100% privacy guaranteed
        </motion.p>
      </div>
    </div>
  );
};

export default Subscription;

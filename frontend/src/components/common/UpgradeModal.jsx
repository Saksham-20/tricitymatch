import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FiX, FiLock, FiArrowRight, FiCheck } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

const plans = [
  {
    key: 'basic_premium',
    name: 'Basic Premium',
    price: '₹1,999',
    duration: '3 months',
    contactUnlocks: '30 unlocks',
    accent: 'primary',
  },
  {
    key: 'premium_plus',
    name: 'Premium Plus',
    price: '₹3,999',
    duration: '6 months',
    contactUnlocks: 'Unlimited',
    accent: 'primary',
    popular: true,
  },
  {
    key: 'vip',
    name: 'VIP',
    price: '₹9,999',
    duration: '12 months',
    contactUnlocks: 'Unlimited',
    accent: 'gold',
  },
];

/**
 * Reusable upgrade prompt modal
 * @param {boolean} isOpen - controls visibility
 * @param {function} onClose - close handler
 * @param {string} feature - name of the locked feature (e.g. "View Phone Number")
 * @param {string} description - optional longer description
 */
const UpgradeModal = ({ isOpen, onClose, feature = 'this feature', description }) => {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Gradient header */}
            <div
              className="relative px-6 pt-8 pb-6 text-center"
              style={{
                background: 'linear-gradient(135deg, #8B2346 0%, #6B1D3A 60%, #401123 100%)',
              }}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              >
                <FiX className="w-4 h-4 text-white" />
              </button>

              <div className="w-14 h-14 mx-auto mb-4 bg-white/15 rounded-2xl flex items-center justify-center">
                <FiLock className="w-7 h-7 text-white" />
              </div>

              <h2 className="font-display text-xl font-bold text-white mb-1.5">
                Upgrade to Premium
              </h2>
              <p className="text-white/75 text-sm">
                {description || `Unlock "${feature}" and get access to premium features`}
              </p>
            </div>

            {/* Plan mini-cards */}
            <div className="px-5 py-5 space-y-3">
              {plans.map((plan) => (
                <button
                  key={plan.key}
                  onClick={() => { onClose(); navigate('/subscription'); }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all hover:-translate-y-0.5 ${
                    plan.popular
                      ? 'border-primary-300 bg-primary-50/50 shadow-sm'
                      : 'border-neutral-200 bg-white hover:border-primary-200'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    plan.accent === 'gold' ? 'bg-gold-100' : 'bg-primary-100'
                  }`}>
                    <FaCrown className={`w-4 h-4 ${
                      plan.accent === 'gold' ? 'text-gold-600' : 'text-primary-500'
                    }`} />
                  </div>

                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-900">{plan.name}</span>
                      {plan.popular && (
                        <span className="px-1.5 py-0.5 bg-primary-500 text-white text-[9px] font-bold rounded-full uppercase">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">
                      {plan.price}/{plan.duration} · {plan.contactUnlocks}
                    </p>
                  </div>

                  <FiArrowRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5">
              <button
                onClick={() => { onClose(); navigate('/subscription'); }}
                className="w-full py-3 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors shadow-burgundy flex items-center justify-center gap-2"
              >
                View All Plans <FiArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default UpgradeModal;

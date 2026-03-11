import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiArrowRight } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

export default function PaymentSuccess() {
  const navigate = useNavigate();

  // Auto-redirect after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => navigate('/dashboard'), 10000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl max-w-md w-full text-center"
      >
        {/* Animated check */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6"
        >
          <FiCheckCircle className="w-10 h-10 text-green-600" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <FaCrown className="w-5 h-5 text-amber-500" />
            <h1 className="text-2xl font-bold text-gray-900">Payment Successful!</h1>
          </div>
          <p className="text-gray-500 text-sm mb-6">
            Your subscription has been activated. You now have access to all premium features.
          </p>

          <div className="bg-green-50 rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">What's included</p>
            {['Unlimited profile views', 'Send unlimited interests', 'Priority in search results', 'Direct messaging'].map((f) => (
              <div key={f} className="flex items-center gap-2 py-1">
                <FiCheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <span className="text-sm text-gray-700">{f}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to="/dashboard"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity bg-rose-700"
            >
              Go to Dashboard <FiArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/payment/history"
              className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors"
            >
              View Payment History
            </Link>
          </div>

          <p className="text-xs text-gray-400 mt-4">Redirecting to dashboard in 10 seconds…</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

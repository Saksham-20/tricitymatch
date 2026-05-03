import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiXCircle, FiRefreshCw, FiMail } from 'react-icons/fi';
import Logo from '../components/common/Logo';

export default function PaymentFailed() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-primary-50/20 to-gold-50/30 px-4">
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
          {/* Error icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-5"
            style={{ width: 72, height: 72 }}
          >
            <FiXCircle className="w-9 h-9 text-destructive" />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h1 className="font-display text-2xl font-bold text-neutral-900 mb-2">Payment Failed</h1>
            <p className="text-neutral-500 text-sm mb-6">
              We couldn't process your payment. Please check your card details and try again.
            </p>

            <div className="bg-neutral-50 rounded-2xl p-4 mb-6 text-left border border-neutral-100">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Common causes</p>
              {[
                'Insufficient account balance',
                'Card details incorrect or expired',
                'Transaction declined by bank',
                'Network connection issue',
              ].map((r) => (
                <div key={r} className="flex items-start gap-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 mt-1.5 flex-shrink-0" />
                  <span className="text-sm text-neutral-700">{r}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <Link to="/subscription" className="btn-primary w-full flex items-center justify-center gap-2">
                <FiRefreshCw className="w-4 h-4" /> Try Again
              </Link>
              <a
                href="mailto:support@tricitymatch.com"
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <FiMail className="w-4 h-4" /> Contact Support
              </a>
              <Link
                to="/dashboard"
                className="w-full py-2.5 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

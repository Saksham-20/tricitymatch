import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiXCircle, FiRefreshCw, FiMail } from 'react-icons/fi';

export default function PaymentFailed() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-rose-50 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl max-w-md w-full text-center"
      >
        {/* Error icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6"
        >
          <FiXCircle className="w-10 h-10 text-red-600" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
          <p className="text-gray-500 text-sm mb-6">
            We couldn't process your payment. This could be due to insufficient funds, card declined, or a network issue.
          </p>

          <div className="bg-red-50 rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Common causes</p>
            {[
              'Insufficient account balance',
              'Card details incorrect or expired',
              'Transaction declined by bank',
              'Network connection issue',
            ].map((r) => (
              <div key={r} className="flex items-start gap-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{r}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to="/subscription"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold text-sm transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" /> Try Again
            </Link>
            <a
              href="mailto:support@tricitymatch.com"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors"
            >
              <FiMail className="w-4 h-4" /> Contact Support
            </a>
            <Link
              to="/dashboard"
              className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

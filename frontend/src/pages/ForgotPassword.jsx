import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiMail, FiArrowLeft, FiCheck, FiShield, FiHeart } from 'react-icons/fi';
import { fadeInUp, staggerContainer } from '../utils/animations';
import Logo from '../components/common/Logo';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-neutral-50 via-primary-50/20 to-gold-50/30">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-neutral-900">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 via-neutral-900 to-neutral-900" />
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[38rem] h-[38rem] rounded-full border border-white/5 pointer-events-none" />
          <motion.div animate={{ rotate: -360 }} transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] rounded-full border border-white/8 pointer-events-none" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />
          <div className="relative z-10 flex flex-col justify-between w-full p-14 text-white">
            <div>
              <Logo variant="white" size="lg" linkTo="/" />
              <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">Chandigarh · Mohali · Panchkula</p>
            </div>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="max-w-sm">
              <p className="text-xs font-semibold text-primary-400 uppercase tracking-widest mb-5">Account Recovery</p>
              <h2 className="font-display text-5xl font-bold leading-tight mb-5">Back in<br />minutes.</h2>
              <p className="text-white/60 text-base leading-relaxed">Check your inbox — we've sent a secure link to reset your password.</p>
            </motion.div>
            <div className="flex items-center gap-5 text-xs text-white/40">
              <div className="flex items-center gap-1.5"><FiShield className="w-3.5 h-3.5" /><span>SSL Secured</span></div>
              <span className="w-px h-3 bg-white/20" />
              <div className="flex items-center gap-1.5"><FiHeart className="w-3.5 h-3.5" /><span>100% Privacy</span></div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
            <div className="lg:hidden flex justify-center mb-8"><Logo size="lg" linkTo="/" /></div>
            <div className="card text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center mx-auto mb-5">
                <FiCheck className="w-8 h-8 text-success" />
              </motion.div>
              <h2 className="font-display text-2xl font-bold text-neutral-800 mb-3">Check Your Email</h2>
              <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
                If an account with <strong className="text-neutral-700">{email}</strong> exists, we've sent a reset link. Check your inbox and spam folder.
              </p>
              <Link to="/login" className="btn-primary inline-flex items-center gap-2">
                <FiArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-neutral-50 via-primary-50/20 to-gold-50/30">
      {/* Left editorial panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 via-neutral-900 to-neutral-900" />
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[38rem] h-[38rem] rounded-full border border-white/5 pointer-events-none" />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] rounded-full border border-white/8 pointer-events-none" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />

        <div className="relative z-10 flex flex-col justify-between w-full p-14 text-white">
          <div>
            <Logo variant="white" size="lg" linkTo="/" />
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">Chandigarh · Mohali · Panchkula</p>
          </div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="max-w-sm">
            <p className="text-xs font-semibold text-primary-400 uppercase tracking-widest mb-5">Account Recovery</p>
            <h2 className="font-display text-5xl font-bold leading-tight mb-5">Reset your<br />access.</h2>
            <p className="text-white/60 text-base leading-relaxed">
              Enter your email and we'll send a secure link. You'll be back in under two minutes.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              {[
                { n: '2 min', l: 'To Reset' },
                { n: '100%', l: 'Secure' },
                { n: '24hr', l: 'Link Valid' },
              ].map(({ n, l }) => (
                <div key={l} className="flex flex-col px-4 py-2.5 rounded-xl bg-white/6 border border-white/10">
                  <span className="text-lg font-bold text-white leading-none">{n}</span>
                  <span className="text-[11px] text-white/50 mt-0.5">{l}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="flex items-center gap-5 text-xs text-white/40">
            <div className="flex items-center gap-1.5"><FiShield className="w-3.5 h-3.5" /><span>SSL Secured</span></div>
            <span className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1.5"><FiHeart className="w-3.5 h-3.5" /><span>100% Privacy</span></div>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <motion.div initial="initial" animate="animate" variants={staggerContainer} className="w-full max-w-md">
          <motion.div variants={fadeInUp} className="lg:hidden flex justify-center mb-8">
            <Logo size="lg" linkTo="/" />
          </motion.div>

          <motion.div variants={fadeInUp} className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-neutral-800 mb-2">Forgot password?</h1>
            <p className="text-neutral-500">We'll email you a secure reset link</p>
          </motion.div>

          <motion.form variants={fadeInUp} onSubmit={handleSubmit} className="card space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiMail className="w-5 h-5 text-neutral-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input-field pl-12"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
              ) : 'Send Reset Link'}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-primary-500 hover:text-primary-600 font-medium inline-flex items-center gap-1 transition-colors">
                <FiArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </div>
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;

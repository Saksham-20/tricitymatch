import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { FiMail, FiArrowLeft, FiCheck, FiShield, FiHeart } from 'react-icons/fi';
import { fadeInUp, staggerContainer, fade, popIn } from '../utils/animations';
import { validateEmail } from '../utils/validators';
import Logo from '../components/common/Logo';
import Seo from '../components/common/Seo';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    if (!email.trim()) return 'Enter your email to get a reset link';
    if (!validateEmail(email.trim())) return 'Enter a valid email address';
    return '';
  };

  const handleBlur = () => setError(validate());

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldError = validate();
    if (fieldError) { setError(fieldError); return; }
    setError('');
    setApiError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (error) {
      setApiError(error.response?.data?.error?.message || error.response?.data?.message || 'Could not send the reset email. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[100dvh] flex bg-[#FDF8F2]">
        <Seo
          title="Forgot Password"
          description="Reset your TricityMatch password — we'll email you a secure recovery link."
          path="/forgot-password"
        />
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-neutral-900">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 via-neutral-900 to-neutral-900" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[38rem] h-[38rem] rounded-full border border-white/5 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] rounded-full border border-white/8 pointer-events-none" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />
          <div className="relative z-10 flex flex-col justify-between w-full p-14 text-white">
            <div>
              <Logo variant="white" size="lg" linkTo="/" />
              <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">Chandigarh · Mohali · Panchkula</p>
            </div>
            <motion.div initial="initial" animate="animate" variants={fadeInUp} className="max-w-sm">
              <p className="text-xs font-semibold text-primary-400 uppercase tracking-widest mb-5">Account Recovery</p>
              <h2 className="font-display text-5xl font-bold leading-tight mb-5 text-white">Back in<br />minutes.</h2>
              <p className="text-white/60 text-base leading-relaxed">Check your inbox. We've sent a secure link to reset your password.</p>
            </motion.div>
            <div className="flex items-center gap-5 text-xs text-white/40">
              <div className="flex items-center gap-1.5"><FiShield className="w-3.5 h-3.5" /><span>SSL Secured</span></div>
              <span className="w-px h-3 bg-white/20" />
              <div className="flex items-center gap-1.5"><FiHeart className="w-3.5 h-3.5" /><span>100% Privacy</span></div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
          <motion.div initial="initial" animate="animate" variants={fade} className="w-full max-w-md">
            <div className="lg:hidden flex justify-center mb-8"><Logo size="lg" linkTo="/" /></div>
            <div className="card text-center">
              <motion.div initial="initial" animate="animate" variants={popIn}
                className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center mx-auto mb-5">
                <FiCheck className="w-8 h-8 text-success" />
              </motion.div>
              <h2 className="font-display text-2xl font-bold text-neutral-800 mb-3">Check your email</h2>
              <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
                If an account with <strong className="text-neutral-700">{email}</strong> exists, we've sent a reset link. Check your inbox and spam folder.
              </p>
              <Link to="/login" className="btn-primary inline-flex items-center gap-2">
                <FiArrowLeft className="w-4 h-4" /> Back to login
              </Link>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="block mx-auto mt-4 text-sm text-neutral-500 hover:text-primary-600 font-medium transition-colors"
              >
                Wrong email? Use a different one
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex bg-[#FDF8F2]">
      <Seo
        title="Forgot Password"
        description="Reset your TricityMatch password — we'll email you a secure recovery link."
        path="/forgot-password"
      />
      {/* Left editorial panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 via-neutral-900 to-neutral-900" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[38rem] h-[38rem] rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] rounded-full border border-white/8 pointer-events-none" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />

        <div className="relative z-10 flex flex-col justify-between w-full p-14 text-white">
          <div>
            <Logo variant="white" size="lg" linkTo="/" />
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">Chandigarh · Mohali · Panchkula</p>
          </div>

          <motion.div initial="initial" animate="animate" variants={fadeInUp} className="max-w-sm">
            <p className="text-xs font-semibold text-primary-400 uppercase tracking-widest mb-5">Account Recovery</p>
            <h2 className="font-display text-5xl font-bold leading-tight mb-5 text-white">Reset your<br />access.</h2>
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

          <motion.form variants={fadeInUp} onSubmit={handleSubmit} noValidate className="card space-y-5">
            {apiError && (
              <p role="alert" className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {apiError}
              </p>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiMail className={`w-5 h-5 ${error ? 'text-destructive' : 'text-neutral-400'}`} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'email-error' : undefined}
                  className={`input-field pl-12 ${error ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(''); if (apiError) setApiError(''); }}
                  onBlur={handleBlur}
                />
              </div>
              {/* Reserved row so an on-blur/on-submit error never shifts the button below it. */}
              <div className="min-h-[20px] mt-1.5">
                {error && <p id="email-error" role="alert" className="text-sm text-destructive">{error}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
              ) : 'Send reset link'}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-primary-500 hover:text-primary-600 font-medium inline-flex items-center gap-1 transition-colors">
                <FiArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </div>
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;

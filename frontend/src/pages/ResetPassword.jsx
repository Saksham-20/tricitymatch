import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiLock, FiEye, FiEyeOff, FiCheck, FiArrowLeft, FiShield, FiHeart } from 'react-icons/fi';
import { fadeInUp, staggerContainer } from '../utils/animations';
import { validatePassword } from '../utils/validators';
import Logo from '../components/common/Logo';

// ─── Shared left editorial panel ─────────────────────────────────────────────
const EditorialPanel = ({ headline, sub }) => (
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
        <h2 className="font-display text-5xl font-bold leading-tight mb-5">{headline}</h2>
        <p className="text-white/60 text-base leading-relaxed">{sub}</p>
      </motion.div>

      <div className="flex items-center gap-5 text-xs text-white/40">
        <div className="flex items-center gap-1.5"><FiShield className="w-3.5 h-3.5" /><span>SSL Secured</span></div>
        <span className="w-px h-3 bg-white/20" />
        <div className="flex items-center gap-1.5"><FiHeart className="w-3.5 h-3.5" /><span>100% Privacy</span></div>
      </div>
    </div>
  </div>
);

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-neutral-50 via-primary-50/20 to-gold-50/30">
        <EditorialPanel
          headline={"Invalid link."}
          sub="This password reset link is invalid or has expired. Please request a new one."
        />
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex justify-center mb-8"><Logo size="lg" linkTo="/" /></div>
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="card text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-5">
                <FiLock className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="font-display text-2xl font-bold text-neutral-800 mb-3">Invalid Reset Link</h2>
              <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
                This link is invalid or has expired. Reset links are valid for 24 hours.
              </p>
              <Link to="/forgot-password" className="btn-primary inline-flex">Request New Link</Link>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validatePassword(formData.password)) {
      toast.error('Password must be 8+ characters with uppercase, lowercase, number, and special character');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: formData.password });
      setSuccess(true);
      toast.success('Password reset successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex bg-gradient-to-br from-neutral-50 via-primary-50/20 to-gold-50/30">
        <EditorialPanel
          headline={"You're all set."}
          sub="Your password has been updated. Sign in with your new credentials."
        />
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex justify-center mb-8"><Logo size="lg" linkTo="/" /></div>
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="card text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center mx-auto mb-5">
                <FiCheck className="w-8 h-8 text-success" />
              </motion.div>
              <h2 className="font-display text-2xl font-bold text-neutral-800 mb-3">Password Reset</h2>
              <p className="text-neutral-500 text-sm mb-6">Your password has been reset. You can now sign in.</p>
              <button onClick={() => navigate('/login')} className="btn-primary inline-flex items-center gap-2">
                Go to Login
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-neutral-50 via-primary-50/20 to-gold-50/30">
      <EditorialPanel
        headline={"Create your new password."}
        sub="Choose a strong password to protect your TricityShadi account."
      />

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <motion.div initial="initial" animate="animate" variants={staggerContainer} className="w-full max-w-md">
          <motion.div variants={fadeInUp} className="lg:hidden flex justify-center mb-8">
            <Logo size="lg" linkTo="/" />
          </motion.div>

          <motion.div variants={fadeInUp} className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-neutral-800 mb-2">Reset password</h1>
            <p className="text-neutral-500">Enter and confirm your new password</p>
          </motion.div>

          <motion.form variants={fadeInUp} onSubmit={handleSubmit} className="card space-y-5">
            {[
              { id: 'password',        label: 'New Password',      placeholder: 'At least 8 characters' },
              { id: 'confirmPassword', label: 'Confirm Password',  placeholder: 'Repeat new password' },
            ].map(({ id, label, placeholder }) => (
              <div key={id}>
                <label htmlFor={id} className="block text-sm font-medium text-neutral-700 mb-1.5">{label}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FiLock className="w-5 h-5 text-neutral-400" />
                  </div>
                  <input
                    id={id}
                    name={id}
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="input-field pl-12 pr-12"
                    placeholder={placeholder}
                    value={formData[id]}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Resetting…</>
              ) : 'Reset Password'}
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

export default ResetPassword;

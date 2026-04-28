import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword } from '../utils/validators';
import Logo from '../components/common/Logo';
import { FiMail, FiLock, FiEye, FiEyeOff, FiHeart, FiShield, FiArrowRight } from 'react-icons/fi';
import { fadeInUp, staggerContainer, shakeAnimation } from '../utils/animations';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear errors when user starts typing
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
    if (apiError) setApiError('');
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';
    }
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setShakeTrigger(true);
      setTimeout(() => setShakeTrigger(false), 500);
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;
    
    setLoading(true);
    try {
      const result = await login(formData.email, formData.password);
      setLoading(false);
      
      if (result.success) {
        setTimeout(() => {
          navigate(result.role === 'admin' ? '/admin/dashboard' : '/dashboard');
        }, 100);
      } else {
        setApiError(result.message || 'Incorrect email or password. Please try again.');
        setShakeTrigger(true);
        setTimeout(() => setShakeTrigger(false), 500);
      }
    } catch (error) {
      setLoading(false);
      setApiError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-neutral-50 via-primary-50/20 to-gold-50/30">
      {/* Left Side — Editorial panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-neutral-900">
        {/* Warm gradient wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 via-neutral-900 to-neutral-900" />

        {/* Rotating orbit rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[38rem] h-[38rem] rounded-full border border-white/5 pointer-events-none"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] rounded-full border border-white/8 pointer-events-none"
        />

        {/* Top line accent */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-14 text-white">
          {/* Logo */}
          <div>
            <Logo variant="white" size="lg" linkTo="/" />
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">
              Chandigarh · Mohali · Panchkula
            </p>
          </div>

          {/* Main copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="max-w-sm"
          >
            <p className="text-xs font-semibold text-primary-400 uppercase tracking-widest mb-5">
              Welcome back
            </p>
            <h2 className="font-display text-5xl font-bold leading-tight mb-5">
              Your journey<br />continues here.
            </h2>
            <p className="text-white/60 text-base leading-relaxed">
              Thousands of families found their forever through TricityShadi.
              Every sign-in brings you closer.
            </p>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-3 mt-8">
              {[
                { n: '1,190+', l: 'Matches Made' },
                { n: '98%',    l: 'Satisfaction' },
                { n: '50K+',   l: 'Profiles' },
              ].map(({ n, l }) => (
                <div key={l} className="flex flex-col px-4 py-2.5 rounded-xl bg-white/6 border border-white/10">
                  <span className="text-lg font-bold text-white leading-none">{n}</span>
                  <span className="text-[11px] text-white/50 mt-0.5">{l}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Bottom trust strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center gap-5 text-xs text-white/40"
          >
            <div className="flex items-center gap-1.5">
              <FiShield className="w-3.5 h-3.5" />
              <span>SSL Secured</span>
            </div>
            <span className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <FiHeart className="w-3.5 h-3.5" />
              <span>100% Privacy</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerContainer}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <motion.div variants={fadeInUp} className="lg:hidden flex justify-center mb-8">
            <Logo size="lg" linkTo="/" />
          </motion.div>

          <motion.div variants={fadeInUp} className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-neutral-800 mb-2">
              Sign In
            </h1>
            <p className="text-neutral-600">
              Enter your details to access your profile.
            </p>
          </motion.div>

          <motion.form 
            variants={fadeInUp}
            onSubmit={handleSubmit}
            className={`card space-y-6 ${shakeTrigger ? 'animate-shake' : ''}`}
          >
            {/* API Error Alert */}
            <AnimatePresence>
              {apiError && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                >
                  {apiError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiMail className={`w-5 h-5 ${errors.email ? 'text-destructive' : 'text-neutral-400'}`} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`input-field pl-12 ${errors.email ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 text-sm text-destructive flex items-center gap-1"
                  >
                    {errors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiLock className={`w-5 h-5 ${errors.password ? 'text-destructive' : 'text-neutral-400'}`} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={`input-field pl-12 pr-12 ${errors.password ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
              <AnimatePresence>
                {errors.password && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 text-sm text-destructive"
                  >
                    {errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Remember me"
                  className="w-4 h-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-neutral-700">Remember me</span>
              </label>
              <Link 
                to="/forgot-password" 
                className="text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.99 }}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <FiArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-neutral-500">New to TricityShadi?</span>
              </div>
            </div>

            {/* Create Account Link */}
            <Link
              to="/signup"
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              Create Your Profile
            </Link>
          </motion.form>

          {/* Trust Badges */}
          <motion.div 
            variants={fadeInUp}
            className="mt-8 flex items-center justify-center gap-6 text-xs text-neutral-500"
          >
            <div className="flex items-center gap-1">
              <FiShield className="w-4 h-4 text-success" />
              <span>SSL Secured</span>
            </div>
            <div className="flex items-center gap-1">
              <FiHeart className="w-4 h-4 text-primary-500" />
              <span>100% Privacy</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;

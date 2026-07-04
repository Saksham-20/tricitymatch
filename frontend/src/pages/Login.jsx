import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import Seo from '../components/common/Seo';
import { validateEmail } from '../utils/validators';
import Logo from '../components/common/Logo';
import SmartContactField, { detectContactType, phoneDigits } from '../components/onboarding/SmartContactField';
import { FiMail, FiPhone, FiLock, FiEye, FiEyeOff, FiHeart, FiShield, FiArrowRight, FiClock, FiEdit2 } from 'react-icons/fi';
import { fadeInUp, staggerContainer } from '../utils/animations';
import { google as googleConfig } from '../config';
import api from '../api/axios';

const Login = () => {
  // Progressive fintech-style flow: identifier first, password revealed after.
  const [phase, setPhase] = useState('identifier'); // 'identifier' | 'password'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0); // epoch ms; 0 = not locked
  const passwordRef = useRef(null);
  const { login, setUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  // Only honor a returnTo that's a same-origin in-app path (block open redirects).
  const returnTo = searchParams.get('returnTo');
  const safeReturnTo = returnTo && /^\/(?!\/)/.test(returnTo) ? returnTo : null;

  const LOCK_MS = 10 * 60 * 1000; // 10-minute client lock; no timer shown to the user
  const isLocked = lockedUntil > Date.now();

  const idType = detectContactType(identifier);
  const idIsValid = idType === 'email'
    ? validateEmail(identifier.trim())
    : idType === 'phone' ? /^[6-9]\d{9}$/.test(phoneDigits(identifier)) : false;

  // Re-enable the form once the lock elapses (no countdown displayed).
  useEffect(() => {
    if (!lockedUntil) return;
    const ms = lockedUntil - Date.now();
    if (ms <= 0) { setLockedUntil(0); return; }
    const id = setTimeout(() => setLockedUntil(0), ms);
    return () => clearTimeout(id);
  }, [lockedUntil]);

  // Focus the password box the moment it's revealed.
  useEffect(() => {
    if (phase === 'password') {
      const id = setTimeout(() => passwordRef.current?.focus(), 250);
      return () => clearTimeout(id);
    }
  }, [phase]);

  const goAfterLogin = useCallback((role) => {
    if (safeReturnTo && role !== 'admin' && role !== 'super_admin'
        && role !== 'marketing' && role !== 'marketing_manager') {
      navigate(safeReturnTo);
      return;
    }
    navigate(role === 'admin' || role === 'super_admin' ? '/admin/dashboard'
      : role === 'marketing' || role === 'marketing_manager' ? '/marketing/dashboard'
      : '/dashboard');
  }, [navigate, safeReturnTo]);

  const handleGoogleCredential = useCallback(async (response) => {
    setGoogleLoading(true);
    setApiError('');
    try {
      const result = await api.post('/auth/google', { credential: response.credential });
      if (result.data.success) {
        // Fetch full user profile and let AuthContext handle state
        const meResult = await api.get('/auth/me');
        if (meResult.data?.user) {
          setUser(meResult.data.user);
          localStorage.setItem('tricitymatch-auth-hint', '1');
        }
        goAfterLogin(result.data.user?.role);
      }
    } catch (err) {
      setApiError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [goAfterLogin, setUser]);

  useEffect(() => {
    if (!googleConfig.isConfigured) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: googleConfig.clientId,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google?.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        { theme: 'outline', size: 'large', width: '100%', text: 'signin_with' }
      );
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [handleGoogleCredential]);

  const shake = () => {
    setShakeTrigger(true);
    setTimeout(() => setShakeTrigger(false), 500);
  };

  const backToIdentifier = () => {
    setPhase('identifier');
    setPassword('');
    setErrors({});
    setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (phase === 'identifier') {
      if (!identifier.trim()) {
        setErrors({ identifier: 'Email or phone is required' });
        shake();
        return;
      }
      if (!idIsValid) {
        setErrors({ identifier: 'Enter a valid email or 10-digit phone' });
        shake();
        return;
      }
      setErrors({});
      setPhase('password');
      return;
    }

    if (!password) {
      setErrors({ password: 'Password is required' });
      shake();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const submitId = idType === 'phone' ? phoneDigits(identifier) : identifier.trim();
      const result = await login(submitId, password);
      setLoading(false);

      if (result.success) {
        setTimeout(() => goAfterLogin(result.role), 100);
      } else {
        const msg = result.error || result.message || 'Incorrect email or password. Please try again.';
        setApiError(msg);
        if (result.locked) {
          setLockedUntil(Date.now() + LOCK_MS);
        }
        shake();
      }
    } catch (error) {
      setLoading(false);
      setApiError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FDF8F2]">
      <Seo
        title="Login"
        description="Log in to your TricityShadi account to continue your match journey."
        path="/login"
      />
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
            <h2 className="font-display text-5xl font-bold leading-tight mb-5 text-white">
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
          <motion.div variants={fadeInUp} className="lg:hidden flex justify-center mb-6">
            <Logo size="lg" linkTo="/" />
          </motion.div>

          {/* Mobile tab switcher — Sign In / Create Profile */}
          <motion.div variants={fadeInUp} className="lg:hidden flex rounded-2xl bg-neutral-100 p-1 mb-6">
            <span className="flex-1 py-3 text-center text-sm font-semibold rounded-xl bg-white shadow-sm text-neutral-900">
              {t('navbar.signIn')}
            </span>
            <Link
              to="/signup"
              className="flex-1 py-3 text-center text-sm font-semibold rounded-xl text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              {t('navbar.createProfile')}
            </Link>
          </motion.div>

          <motion.div variants={fadeInUp} className="text-center mb-8 hidden lg:block">
            <h1 className="text-3xl font-display font-bold text-neutral-800 mb-2">
              {t('auth.welcomeBack')}
            </h1>
            <p className="text-neutral-600">
              {t('auth.loginSubtitle')}
            </p>
          </motion.div>

          <motion.form
            variants={fadeInUp}
            layout
            transition={{ layout: { duration: 0.25, ease: 'easeOut' } }}
            onSubmit={handleSubmit}
            className={`card space-y-5 ${shakeTrigger ? 'animate-shake' : ''}`}
          >
            {/* Lockout / API Error Alert */}
            <AnimatePresence>
              {isLocked ? (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-gold-50 border border-gold-200 text-gold-800 text-sm"
                >
                  <FiClock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Too many attempts. Please wait a few minutes, then try again.</span>
                </motion.div>
              ) : apiError ? (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                >
                  {apiError}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
              {phase === 'identifier' ? (
                <motion.div
                  key="identifier"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <SmartContactField
                    id="login-identifier"
                    label={t('auth.emailOrPhone', 'Email or mobile number')}
                    hint=""
                    value={identifier}
                    onChange={(v) => { setIdentifier(v); if (errors.identifier) setErrors({}); if (apiError) setApiError(''); }}
                    error={errors.identifier}
                    autoFocus
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="password"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* Identifier recap chip */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-200">
                    <span className="text-neutral-400 flex-shrink-0">
                      {idType === 'phone' ? <FiPhone className="w-4 h-4" /> : <FiMail className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-neutral-400 uppercase tracking-wide leading-none mb-0.5">{t('auth.signingInAs', 'Signing in as')}</p>
                      <p className="text-sm font-semibold text-neutral-800 truncate">
                        {idType === 'phone' ? `+91 ${phoneDigits(identifier)}` : identifier.trim()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={backToIdentifier}
                      className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 flex-shrink-0"
                    >
                      <FiEdit2 className="w-3.5 h-3.5" /> {t('auth.change', 'Change')}
                    </button>
                  </div>

                  {/* Hidden username input keeps password managers working */}
                  <input
                    type="text"
                    autoComplete="username"
                    value={idType === 'phone' ? phoneDigits(identifier) : identifier.trim()}
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only"
                  />

                  {/* Password Field */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
                      {t('auth.password')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <FiLock className={`w-5 h-5 ${errors.password ? 'text-destructive' : 'text-neutral-400'}`} />
                      </div>
                      <input
                        id="password"
                        name="password"
                        ref={passwordRef}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className={`input-field pl-12 pr-12 ${errors.password ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                        placeholder={t('auth.passwordPlaceholder')}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({}); if (apiError) setApiError(''); }}
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

                  {/* Forgot Password */}
                  <div className="flex items-center justify-end -mt-2">
                    <Link
                      to="/forgot-password"
                      className="text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors"
                    >
                      {t('auth.forgotPassword')}
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading || isLocked}
              whileHover={{ scale: loading || isLocked ? 1 : 1.01 }}
              whileTap={{ scale: loading || isLocked ? 1 : 0.99 }}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('auth.signingIn')}
                </>
              ) : isLocked ? (
                <>
                  <FiClock className="w-5 h-5" />
                  Please try again later
                </>
              ) : phase === 'identifier' ? (
                <>
                  {t('auth.continue', 'Continue')}
                  <FiArrowRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  {t('auth.signIn')}
                  <FiArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>

            {/* Google Sign-In */}
            {googleConfig.isConfigured && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-neutral-600">{t('auth.orContinueWith')}</span>
                  </div>
                </div>
                <div className={`w-full overflow-hidden rounded-xl ${googleLoading ? 'opacity-60 pointer-events-none' : ''}`}>
                  <div id="google-signin-btn" className="w-full" />
                </div>
              </>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-neutral-600">New to TricityShadi?</span>
              </div>
            </div>

            {/* Create Account Link */}
            <Link
              to="/signup"
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              {t('navbar.createProfile')}
            </Link>
          </motion.form>

          {/* Trust Badges — mobile only; on desktop the left brand panel already
              shows the SSL/Privacy strip (avoid the duplicate). */}
          <motion.div
            variants={fadeInUp}
            className="mt-8 flex lg:hidden items-center justify-center gap-6 text-xs text-neutral-500"
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

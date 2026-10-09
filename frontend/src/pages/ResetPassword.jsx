import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import api from '../api/axios';
import { FiLock, FiEye, FiEyeOff, FiCheck, FiArrowLeft, FiShield, FiHeart } from 'react-icons/fi';
import { fadeInUp, staggerContainer, fade, popIn } from '../utils/animations';
import { validatePassword } from '../utils/validators';
import Logo from '../components/common/Logo';
import Seo from '../components/common/Seo';

// --- Shared left editorial panel --------------------------------------------
// Pinned to a literal hex, not the neutral-900 scale class — bg-neutral-900
// inverts to a near-white under html.dark (see Login.jsx's identical note),
// which would strand the white headline text with nothing behind it.
const EditorialPanel = ({ headline, sub }) => {
  const { t } = useTranslation();
  return (
  <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[var(--editorial-rail)] dark:bg-surface-dark-2">
    <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 via-neutral-900 to-neutral-900" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[38rem] h-[38rem] rounded-full border border-white/5 pointer-events-none" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] rounded-full border border-white/8 pointer-events-none" />
    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />

    <div className="relative z-10 flex flex-col justify-between w-full p-14 text-white">
      <div>
        <Logo variant="white" size="lg" linkTo="/" />
        <p className="text-xs text-white/60 mt-1 uppercase tracking-widest">{t('navbar.region')}</p>
      </div>

      <motion.div initial="initial" animate="animate" variants={fadeInUp} className="max-w-sm">
        <p className="font-display text-5xl font-bold leading-tight mb-5 text-white">{headline}</p>
        <p className="text-white/60 text-base leading-relaxed">{sub}</p>
      </motion.div>

      <div className="flex items-center gap-5 text-xs text-white/60">
        <div className="flex items-center gap-1.5"><FiShield className="w-3.5 h-3.5" /><span>{t('auth.sslSecured')}</span></div>
        <span className="w-px h-3 bg-white/20" />
        <div className="flex items-center gap-1.5"><FiHeart className="w-3.5 h-3.5" /><span>{t('auth.privacy100')}</span></div>
      </div>
    </div>
  </div>
  );
};

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { t } = useTranslation();

  if (!token) {
    return (
      <div className="min-h-[100dvh] flex bg-[#FDF8F2] dark:bg-surface-dark-1">
        <Seo title="Reset Password" description="Set a new password for your TricityMatch account." path="/reset-password" />
        <EditorialPanel
          headline={t('passwordReset.invalidLinkHeadline')}
          sub={t('passwordReset.invalidLinkSub')}
        />
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex justify-center mb-8"><Logo size="lg" linkTo="/" /></div>
            <motion.div initial="initial" animate="animate" variants={fade} className="card dark:bg-surface-dark-3 dark:border-neutral-800 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-5">
                <FiLock className="w-8 h-8 text-destructive dark:text-red-400" />
              </div>
              <h2 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-3">{t('passwordReset.invalidResetLink')}</h2>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6 leading-relaxed">
                {t('passwordReset.invalidResetBody')}
              </p>
              <Link to="/forgot-password" className="btn-primary inline-flex">{t('passwordReset.requestNewLink')}</Link>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    if (apiError) setApiError('');
  };

  const validate = (data = formData) => {
    const newErrors = {};
    if (!data.password) newErrors.password = t('passwordReset.enterNewPassword');
    else if (!validatePassword(data.password)) newErrors.password = t('validation.passwordRule');
    if (!data.confirmPassword) newErrors.confirmPassword = t('passwordReset.confirmNewPassword');
    else if (data.password !== data.confirmPassword) newErrors.confirmPassword = t('validation.passwordsNoMatch');
    return newErrors;
  };

  const handleBlur = (field) => () => {
    setErrors((prev) => ({ ...prev, [field]: validate()[field] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.values(newErrors).some(Boolean)) { setErrors(newErrors); return; }
    setErrors({});
    setApiError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: formData.password });
      setSuccess(true);
    } catch (error) {
      setApiError(error.response?.data?.error?.message || error.response?.data?.message || t('passwordReset.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex bg-[#FDF8F2] dark:bg-surface-dark-1">
        <Seo title="Reset Password" description="Set a new password for your TricityMatch account." path="/reset-password" />
        <EditorialPanel
          headline={t('passwordReset.allSetHeadline')}
          sub={t('passwordReset.allSetSub')}
        />
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex justify-center mb-8"><Logo size="lg" linkTo="/" /></div>
            <motion.div initial="initial" animate="animate" variants={fade} className="card dark:bg-surface-dark-3 dark:border-neutral-800 text-center">
              <motion.div initial="initial" animate="animate" variants={popIn}
                className="w-16 h-16 rounded-full bg-success-light dark:bg-success/15 flex items-center justify-center mx-auto mb-5">
                <FiCheck className="w-8 h-8 text-success dark:text-green-400" />
              </motion.div>
              <h2 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-3">{t('passwordReset.passwordResetDone')}</h2>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">{t('passwordReset.passwordResetBody')}</p>
              <button onClick={() => navigate('/login')} className="btn-primary inline-flex items-center gap-2">
                {t('passwordReset.goToLogin')}
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex bg-[#FDF8F2] dark:bg-surface-dark-1">
      <Seo title="Reset Password" description="Set a new password for your TricityMatch account." path="/reset-password" />
      <EditorialPanel
        headline={t('passwordReset.createNewHeadline')}
        sub={t('passwordReset.createNewSub')}
      />

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <motion.div initial="initial" animate="animate" variants={staggerContainer} className="w-full max-w-md">
          <motion.div variants={fadeInUp} className="lg:hidden flex justify-center mb-8">
            <Logo size="lg" linkTo="/" />
          </motion.div>

          <motion.div variants={fadeInUp} className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-neutral-800 dark:text-neutral-100 mb-2">{t('passwordReset.resetPassword')}</h1>
            <p className="text-neutral-500 dark:text-neutral-400">{t('passwordReset.resetSubtitle')}</p>
          </motion.div>

          <motion.form variants={fadeInUp} onSubmit={handleSubmit} noValidate className="card dark:bg-surface-dark-3 dark:border-neutral-800 space-y-5">
            {apiError && (
              <p role="alert" className="px-4 py-3 rounded-xl bg-destructive/10 dark:bg-red-950/30 border border-destructive/20 dark:border-red-900/50 text-destructive dark:text-red-300 text-sm">
                {apiError}
              </p>
            )}

            {[
              { id: 'password',        label: t('auth.newPassword'),     placeholder: t('passwordReset.atLeast8Placeholder'), hint: t('validation.passwordHint') },
              { id: 'confirmPassword', label: t('auth.confirmPassword'), placeholder: t('passwordReset.repeatNewPassword'), hint: '' },
            ].map(({ id, label, placeholder, hint }) => (
              <div key={id}>
                <label htmlFor={id} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{label}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FiLock className={`w-5 h-5 ${errors[id] ? 'text-destructive dark:text-red-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
                  </div>
                  <input
                    id={id}
                    name={id}
                    type={showPassword ? 'text' : 'password'}
                    autoFocus={id === 'password'}
                    required
                    aria-invalid={errors[id] ? true : undefined}
                    aria-describedby={(errors[id] || hint) ? `${id}-note` : undefined}
                    className={`input-field dark:bg-surface-dark-2 dark:border-neutral-700 dark:placeholder:text-neutral-500 dark:focus:border-primary-400 dark:focus:ring-primary-400/20 pl-12 pr-12 ${errors[id] ? 'border-destructive focus:border-destructive focus:ring-destructive/20 dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500/20' : ''}`}
                    placeholder={placeholder}
                    value={formData[id]}
                    onChange={handleChange}
                    onBlur={handleBlur(id)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
                {/* Reserved row: error replaces the hint in place, nothing below shifts. */}
                <div className="min-h-[18px] mt-1.5">
                  {errors[id] ? (
                    <p id={`${id}-note`} role="alert" className="text-sm text-destructive dark:text-red-300">{errors[id]}</p>
                  ) : hint ? (
                    <p id={`${id}-note`} className="text-xs text-neutral-400 dark:text-neutral-500">{hint}</p>
                  ) : null}
                </div>
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('passwordReset.resetting')}</>
              ) : t('passwordReset.resetPassword')}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-primary-500 dark:text-primary-300 hover:text-primary-600 dark:hover:text-primary-200 font-medium inline-flex items-center gap-1 transition-colors">
                <FiArrowLeft className="w-4 h-4" /> {t('auth.backToLogin')}
              </Link>
            </div>
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPassword;

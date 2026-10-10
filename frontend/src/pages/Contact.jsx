import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { FiCheck, FiMail, FiClock, FiShield, FiAlertCircle } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import FormField from '../components/ui/FormField';
import CheckBox from '../components/ui/CheckBox';
import api from '../api/axios';
import { legal } from '../config';
import { useAuth } from '../context/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Per-field rules, shared by blur validation and full-form submit validation
// so a field is checked the same way whichever path triggers it. They return a
// translation key (contact.errors.*), translated at render so a language
// switch also re-words an error already on screen.
const FIELD_RULES = {
  name: (v) => (!v.trim() || v.trim().length < 2) ? 'contact.errors.name' : null,
  email: (v) => (!EMAIL_RE.test(v)) ? 'contact.errors.email' : null,
  message: (v) => (!v.trim() || v.trim().length < 10) ? 'contact.errors.message' : null,
};

export default function Contact() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  // A signed-in member accepted the Terms and Privacy Policy when they joined,
  // so they are not asked again, and their details are filled in for them.
  const member = Boolean(isAuthenticated && user && (!user.role || user.role === 'user'));
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [agreed, setAgreed] = useState(false);

  // Fill in what the account knows once it is loaded (once only, so a field
  // the member clears stays clear); never overwrite what they typed.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!member || prefilled.current) return;
    prefilled.current = true;
    const profile = user.Profile || user.profile || {};
    const known = {
      name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
      email: user.email || '',
      phone: user.contactPhone || user.phone || '',
    };
    setForm((f) => ({
      ...f,
      name: f.name || known.name,
      email: f.email || known.email,
      phone: f.phone || known.phone,
    }));
  }, [member, user]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const set = (field) => (value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  // Validates a single field on blur, so a malformed email or a too-short
  // message is caught as the user moves on, not only at submit.
  const handleBlur = (field) => () => {
    const rule = FIELD_RULES[field];
    if (!rule) return;
    const message = rule(form[field]);
    setErrors((e) => ({ ...e, [field]: message || undefined }));
  };

  const validate = () => {
    const e = {};
    const nameMsg = FIELD_RULES.name(form.name); if (nameMsg) e.name = nameMsg;
    const emailMsg = FIELD_RULES.email(form.email); if (emailMsg) e.email = emailMsg;
    const messageMsg = FIELD_RULES.message(form.message); if (messageMsg) e.message = messageMsg;
    if (!agreed && !member) e.agreed = 'contact.errors.agreed';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/contact', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        subject: form.subject.trim() || undefined,
        message: form.message.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.response?.data?.message || t('contact.errors.send'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pt-20 pb-16 px-4">
      <Seo
        title="Contact Us"
        description="Get in touch with the TricityMatch team for support, partnerships or feedback."
        path="/contact"
      />
      <div className="max-w-5xl mx-auto">
        <Link to="/" className="text-sm text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 inline-block py-2 px-2 -mx-2 -mt-2 mb-4">{t('contact.backHome')}</Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-3 bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-8 md:p-10">
            <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{t('contact.title')}</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">{t('contact.intro')}</p>

            {submitted ? (
              <div className="text-center py-10" role="status" aria-live="polite">
                <div className="w-16 h-16 rounded-full bg-success-light dark:bg-success/15 flex items-center justify-center mx-auto mb-5">
                  <FiCheck className="w-8 h-8 text-success dark:text-green-400" />
                </div>
                <h2 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-3">{t('contact.sentTitle')}</h2>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6 max-w-sm mx-auto">
                  {t('contact.sentBody')}
                </p>
                <Link to="/" className="btn-primary inline-flex">{t('contact.backHomeButton')}</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <FormField
                  label={t('contact.fields.name')} name="name" autoComplete="name"
                  placeholder={t('contact.fields.namePlaceholder')}
                  value={form.name} onChange={set('name')} onBlur={handleBlur('name')} error={errors.name && t(errors.name)} required
                />
                <FormField
                  label={t('contact.fields.email')} type="email" name="email" autoComplete="email" inputMode="email"
                  placeholder="you@example.com"
                  value={form.email} onChange={set('email')} onBlur={handleBlur('email')} error={errors.email && t(errors.email)} required
                />
                <FormField
                  label={t('contact.fields.phone')} type="tel" name="phone" autoComplete="tel" inputMode="numeric"
                  placeholder={t('contact.fields.phonePlaceholder')}
                  value={form.phone} onChange={set('phone')}
                />
                <FormField
                  label={t('contact.fields.subject')} name="subject"
                  placeholder={t('contact.fields.subjectPlaceholder')}
                  value={form.subject} onChange={set('subject')}
                />
                <div className="space-y-2">
                  <label htmlFor="contact-message" className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {t('contact.fields.message')}<span className="text-red-500 dark:text-red-400 ml-1">*</span>
                  </label>
                  <textarea
                    id="contact-message" name="message" rows={5}
                    placeholder={t('contact.fields.messagePlaceholder')}
                    value={form.message}
                    onChange={(e) => set('message')(e.target.value)}
                    onBlur={handleBlur('message')}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={errors.message ? 'contact-message-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-surface-dark-2 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-transparent transition-[border-color,box-shadow] duration-150 resize-y ${
                      errors.message
                        ? 'border-red-500 dark:border-red-500 focus:ring-red-500/20 focus:ring-red-500'
                        : 'border-neutral-300 dark:border-neutral-700 focus:ring-primary-500/20 focus:ring-primary-500 dark:focus:ring-primary-400/20 dark:focus:ring-primary-400'
                    }`}
                  />
                  {errors.message && <p id="contact-message-error" className="text-sm text-red-600 dark:text-red-400 font-medium">{t(errors.message)}</p>}
                </div>
                {!member && (
                <div>
                  <CheckBox
                    checked={agreed}
                    onChange={(v) => { setAgreed(v); if (errors.agreed) setErrors((e) => ({ ...e, agreed: undefined })); }}
                    size="md"
                    label={(
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        <Trans
                          i18nKey="contact.agree"
                          components={{
                            terms: <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-300 underline hover:text-primary-700 dark:hover:text-primary-200" />,
                            privacy: <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-300 underline hover:text-primary-700 dark:hover:text-primary-200" />,
                          }}
                        />
                      </span>
                    )}
                  />
                  {errors.agreed && <p className="text-sm text-red-600 dark:text-red-400 font-medium mt-1.5">{t(errors.agreed)}</p>}
                </div>
                )}
                {submitError && (
                  <div role="alert" className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-destructive/10 dark:bg-red-950/30 border border-destructive/20 dark:border-red-900/50 text-destructive dark:text-red-300 text-sm">
                    <FiAlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                  {loading ? t('contact.sending') : t('contact.send')}
                </button>
              </form>
            )}
          </div>

          {/* Info sidebar */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-6">
              <div className="flex items-start gap-3">
                <FiMail className="w-5 h-5 text-primary-600 dark:text-primary-300 mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">{t('contact.emailSupport')}</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {/* py/-my pair: 24px+ hit box, zero layout shift (WCAG 2.5.8) */}
                    <a href="mailto:support@tricitymatch.com" className="inline-block py-2 -my-2 text-primary-600 dark:text-primary-300 hover:underline">support@tricitymatch.com</a>
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-6">
              <div className="flex items-start gap-3">
                <FiClock className="w-5 h-5 text-primary-600 dark:text-primary-300 mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">{t('contact.responseTime')}</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('contact.responseTimeBody')}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-6">
              <div className="flex items-start gap-3">
                <FiShield className="w-5 h-5 text-primary-600 dark:text-primary-300 mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">{t('contact.reportAbuse')}</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {t('contact.reportAbuseBody')}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-6">
              <div className="flex items-start gap-3">
                <FiAlertCircle className="w-5 h-5 text-primary-600 dark:text-primary-300 mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">{t('contact.grievance')}</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {legal.grievanceOfficer && <span className="block">{legal.grievanceOfficer}</span>}
                    <a href={`mailto:${legal.grievanceEmail}`} className="inline-block py-2 -my-2 text-primary-600 dark:text-primary-300 hover:underline">{legal.grievanceEmail}</a>
                    {legal.address && <span className="block mt-1">{legal.entity}, {legal.address}</span>}
                    <span className="block mt-1">
                      <Trans
                        i18nKey="contact.grievanceBody"
                        components={{ terms: <Link to="/terms" className="text-primary-600 dark:text-primary-300 underline hover:text-primary-700 dark:hover:text-primary-200" /> }}
                      />
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

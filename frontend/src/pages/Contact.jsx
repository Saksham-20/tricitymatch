import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiMail, FiClock, FiShield, FiAlertCircle } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import FormField from '../components/ui/FormField';
import CheckBox from '../components/ui/CheckBox';
import api from '../api/axios';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Per-field rules, shared by blur validation and full-form submit validation
// so a field is checked the same way whichever path triggers it.
const FIELD_RULES = {
  name: (v) => (!v.trim() || v.trim().length < 2) ? 'Please enter your name' : null,
  email: (v) => (!EMAIL_RE.test(v)) ? 'Please enter a valid email' : null,
  message: (v) => (!v.trim() || v.trim().length < 10) ? 'Message must be at least 10 characters' : null,
};

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [agreed, setAgreed] = useState(false);
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
    if (!agreed) e.agreed = 'Please agree to the Privacy Policy so we can respond to you';
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
      setSubmitError(err.response?.data?.message || 'Could not send your message. Please try again.');
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
        <Link to="/" className="text-sm text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 inline-block py-2 px-2 -mx-2 -mt-2 mb-4">← Back to home</Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-3 bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-8 md:p-10">
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Contact us</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">Have a question, concern, or feedback? Send us a message and we'll get back to you.</p>

            {submitted ? (
              <div className="text-center py-10" role="status" aria-live="polite">
                <div className="w-16 h-16 rounded-full bg-success-light dark:bg-success/15 flex items-center justify-center mx-auto mb-5">
                  <FiCheck className="w-8 h-8 text-success dark:text-green-400" />
                </div>
                <h2 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-3">Message sent</h2>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6 max-w-sm mx-auto">
                  Thanks for reaching out — we've received your message and will reply within 24–48 hours.
                </p>
                <Link to="/" className="btn-primary inline-flex">Back to home</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <FormField
                  label="Your Name" name="name" autoComplete="name"
                  placeholder="Enter your name"
                  value={form.name} onChange={set('name')} onBlur={handleBlur('name')} error={errors.name} required
                />
                <FormField
                  label="Email" type="email" name="email" autoComplete="email" inputMode="email"
                  placeholder="you@example.com"
                  value={form.email} onChange={set('email')} onBlur={handleBlur('email')} error={errors.email} required
                />
                <FormField
                  label="Phone (optional)" type="tel" name="phone" autoComplete="tel" inputMode="numeric"
                  placeholder="10-digit phone number"
                  value={form.phone} onChange={set('phone')}
                />
                <FormField
                  label="Subject (optional)" name="subject"
                  placeholder="What is this about?"
                  value={form.subject} onChange={set('subject')}
                />
                <div className="space-y-2">
                  <label htmlFor="contact-message" className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    Message<span className="text-red-500 dark:text-red-400 ml-1">*</span>
                  </label>
                  <textarea
                    id="contact-message" name="message" rows={5}
                    placeholder="How can we help?"
                    value={form.message}
                    onChange={(e) => set('message')(e.target.value)}
                    onBlur={handleBlur('message')}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={errors.message ? 'contact-message-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-surface-dark-2 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:border-transparent transition-[border-color,box-shadow] duration-150 resize-y ${
                      errors.message
                        ? 'border-red-500 dark:border-red-500 focus:ring-red-500/20 focus:ring-red-500'
                        : 'border-neutral-300 dark:border-neutral-700 focus:ring-primary-500/20 focus:ring-primary-500 dark:focus:ring-primary-400/20 dark:focus:ring-primary-400'
                    }`}
                  />
                  {errors.message && <p id="contact-message-error" className="text-sm text-red-600 dark:text-red-400 font-medium">{errors.message}</p>}
                </div>
                <div>
                  <CheckBox
                    checked={agreed}
                    onChange={(v) => { setAgreed(v); if (errors.agreed) setErrors((e) => ({ ...e, agreed: undefined })); }}
                    size="md"
                    label={(
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        I agree to the{' '}
                        <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-300 underline hover:text-primary-700 dark:hover:text-primary-200">Terms &amp; Conditions</Link>{' '}
                        and{' '}
                        <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-300 underline hover:text-primary-700 dark:hover:text-primary-200">Privacy Policy</Link>, and to TricityMatch contacting me about this enquiry.
                      </span>
                    )}
                  />
                  {errors.agreed && <p className="text-sm text-red-600 dark:text-red-400 font-medium mt-1.5">{errors.agreed}</p>}
                </div>
                {submitError && (
                  <div role="alert" className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-destructive/10 dark:bg-red-950/30 border border-destructive/20 dark:border-red-900/50 text-destructive dark:text-red-300 text-sm">
                    <FiAlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                  {loading ? 'Sending…' : 'Send message'}
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
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">Email support</h2>
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
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">Response time</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Within 24–48 hours on business days (Mon–Sat, 10am–6pm IST).</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-6">
              <div className="flex items-start gap-3">
                <FiShield className="w-5 h-5 text-primary-600 dark:text-primary-300 mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">Report abuse</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    To report a suspicious profile, use the "Report" button on the profile, or email us with the profile ID.
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

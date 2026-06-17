import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheck, FiMail, FiClock, FiShield } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import FormField from '../components/ui/FormField';
import api from '../api/axios';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (field) => (value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Please enter your name';
    if (!EMAIL_RE.test(form.email)) e.email = 'Please enter a valid email';
    if (!form.message.trim() || form.message.trim().length < 10) e.message = 'Message must be at least 10 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
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
      toast.error(err.response?.data?.message || 'Could not send your message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-16 px-4">
      <Seo
        title="Contact Us"
        description="Get in touch with the TricityShadi team for support, partnerships or feedback."
        path="/contact"
      />
      <div className="max-w-5xl mx-auto">
        <Link to="/" className="text-sm text-primary-600 hover:text-primary-700 mb-6 inline-block">← Back to Home</Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 md:p-10">
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">Contact Us</h1>
            <p className="text-sm text-neutral-600 mb-8">Have a question, concern, or feedback? Send us a message and we'll get back to you.</p>

            {submitted ? (
              <div className="text-center py-10" role="status" aria-live="polite">
                <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center mx-auto mb-5">
                  <FiCheck className="w-8 h-8 text-success" />
                </div>
                <h2 className="font-display text-2xl font-bold text-neutral-800 mb-3">Message sent</h2>
                <p className="text-neutral-500 text-sm mb-6 max-w-sm mx-auto">
                  Thanks for reaching out — we've received your message and will reply within 24–48 hours.
                </p>
                <Link to="/" className="btn-primary inline-flex">Back to Home</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <FormField
                  label="Your Name" name="name" autoComplete="name"
                  placeholder="Enter your name"
                  value={form.name} onChange={set('name')} error={errors.name} required
                />
                <FormField
                  label="Email" type="email" name="email" autoComplete="email" inputMode="email"
                  placeholder="you@example.com"
                  value={form.email} onChange={set('email')} error={errors.email} required
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
                  <label htmlFor="contact-message" className="block text-sm font-medium text-neutral-900">
                    Message<span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    id="contact-message" name="message" rows={5}
                    placeholder="How can we help?"
                    value={form.message}
                    onChange={(e) => set('message')(e.target.value)}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={errors.message ? 'contact-message-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all resize-y ${
                      errors.message
                        ? 'border-red-500 focus:ring-red-500/20 focus:ring-red-500'
                        : 'border-neutral-300 focus:ring-primary-500/20 focus:ring-primary-500'
                    }`}
                  />
                  {errors.message && <p id="contact-message-error" className="text-sm text-red-600 font-medium">{errors.message}</p>}
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                  {loading ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>

          {/* Info sidebar */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
              <div className="flex items-start gap-3">
                <FiMail className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 mb-1">Email Support</h2>
                  <p className="text-sm text-neutral-600">
                    <a href="mailto:support@tricityshadi.com" className="text-primary-600 hover:underline">support@tricityshadi.com</a>
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
              <div className="flex items-start gap-3">
                <FiClock className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 mb-1">Response Time</h2>
                  <p className="text-sm text-neutral-600">Within 24–48 hours on business days (Mon–Sat, 10am–6pm IST).</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
              <div className="flex items-start gap-3">
                <FiShield className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 mb-1">Report Abuse</h2>
                  <p className="text-sm text-neutral-600">
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

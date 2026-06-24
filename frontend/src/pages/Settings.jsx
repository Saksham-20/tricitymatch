import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  FiUser, FiLock, FiBell, FiAlertTriangle, FiEye, FiEyeOff,
  FiMoon, FiShield, FiCheck, FiUpload, FiClock, FiX, FiCamera,
  FiFileText, FiUsers, FiStar, FiChevronRight,
} from 'react-icons/fi';
import useDarkMode from '../hooks/useDarkMode';
import useElderMode from '../hooks/useElderMode';
import LanguageSwitcher from '../components/common/LanguageSwitcher';

const TABS = [
  { id: 'account',       label: 'Account',      icon: FiUser,          desc: 'Password & appearance' },
  { id: 'privacy',       label: 'Privacy',       icon: FiShield,        desc: 'Visibility controls' },
  { id: 'notifications', label: 'Notifications', icon: FiBell,          desc: 'Alert preferences' },
  { id: 'verification',  label: 'Verification',  icon: FiFileText,      desc: 'Identity & trust badge' },
  { id: 'danger',        label: 'Danger Zone',   icon: FiAlertTriangle, desc: 'Irreversible actions' },
];

// ─── Shared Toggle ────────────────────────────────────────────────────────────
const Toggle = ({ value, onChange, label, desc, disabled }) => (
  <div className="flex items-center justify-between py-3.5 border-b border-neutral-100 last:border-0">
    <div className="min-w-0 pr-4">
      <p className="text-sm font-medium text-neutral-800">{label}</p>
      {desc && <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>}
    </div>
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      aria-checked={value}
      aria-label={label}
      role="switch"
      className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex-shrink-0 ${
        value ? 'bg-primary-500' : 'bg-neutral-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

// ─── Section heading ──────────────────────────────────────────────────────────
const SectionHeader = ({ title, desc }) => (
  <div className="mb-5">
    <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
    {desc && <p className="text-sm text-neutral-500 mt-0.5">{desc}</p>}
  </div>
);

// ─── File upload dropzone ─────────────────────────────────────────────────────
const FileUploadBox = ({ label, sublabel, required, file, onFile, accept = 'image/*' }) => {
  const ref = useRef();
  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };
  return (
    <div>
      <p className="text-sm font-medium text-neutral-700 mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </p>
      {file ? (
        <div className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-100 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
            {file.type.startsWith('image/') ? (
              <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 object-cover rounded-lg" />
            ) : (
              <FiFileText className="w-5 h-5 text-primary-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-neutral-800 truncate">{file.name}</p>
            <p className="text-xs text-neutral-500">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => onFile(null)}
            aria-label="Remove file"
            className="text-neutral-400 hover:text-destructive transition-colors cursor-pointer"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="w-full border-2 border-dashed border-neutral-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-primary-300 hover:bg-primary-50/40 transition-all cursor-pointer text-center"
        >
          <FiUpload className="w-5 h-5 text-neutral-400" />
          <div>
            <p className="text-sm font-medium text-neutral-600">Click or drag to upload</p>
            {sublabel && <p className="text-xs text-neutral-400 mt-0.5">{sublabel}</p>}
          </div>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files[0] || null)}
      />
    </div>
  );
};

// ─── Account tab ──────────────────────────────────────────────────────────────
const EmailSection = () => {
  const { user, setUser } = useAuth();
  const currentEmail = user?.email || null;
  const [step, setStep] = useState('idle'); // 'idle' | 'otp'
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  // Start readonly so the browser can't autofill the signed-in email into the
  // "new email" field (Chromium ignores autoComplete="off" for type=email).
  const [emailEditable, setEmailEditable] = useState(false);

  const errMsg = (err, fallback) =>
    err.response?.data?.error?.message || err.response?.data?.message || fallback;

  const requestCode = async (e) => {
    e.preventDefault();
    if (!newEmail) return;
    setLoading(true);
    try {
      await api.post('/auth/change-email/request', { newEmail: newEmail.trim(), password });
      toast.success('Verification code sent to your new email');
      setStep('otp');
    } catch (err) {
      toast.error(errMsg(err, 'Could not send verification code'));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/change-email/verify', { newEmail: newEmail.trim(), code: code.trim() });
      if (res.data?.user && setUser) setUser(res.data.user);
      toast.success('Email updated successfully');
      setStep('idle'); setNewEmail(''); setPassword(''); setCode('');
    } catch (err) {
      toast.error(errMsg(err, 'Invalid or expired code'));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  return (
    <div>
      <SectionHeader title="Email Address" desc="Change the email you use to sign in. We'll send a code to confirm the new address." />
      <div className="max-w-sm space-y-3">
        <div className="text-sm text-neutral-600 dark:text-neutral-300">
          Current: <span className="font-medium text-neutral-900 dark:text-neutral-100">{currentEmail || 'No email set (phone-only account)'}</span>
        </div>

        {step === 'idle' ? (
          <form onSubmit={requestCode} className="space-y-3">
            <input
              type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              readOnly={!emailEditable} onFocus={() => setEmailEditable(true)}
              placeholder="New email address" name="new-email-address" autoComplete="off" className={inputCls} required
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Current password (leave blank for Google accounts)" autoComplete="current-password" className={inputCls}
            />
            <button type="submit" disabled={loading || !newEmail}
              className="w-full py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
              {loading ? 'Sending…' : 'Send verification code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <p className="text-xs text-neutral-500">Enter the 6-digit code sent to <span className="font-medium">{newEmail}</span>.</p>
            <input
              type="text" inputMode="numeric" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit code" className={`${inputCls} tracking-[0.4em] text-center`} required
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep('idle')}
                className="flex-1 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800">
                Back
              </button>
              <button type="submit" disabled={loading || code.length !== 6}
                className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
                {loading ? 'Verifying…' : 'Verify & update'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const AccountTab = () => {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState({ current: false, newPw: false, confirm: false });
  const [success, setSuccess] = useState(false);
  const { isDark, toggle: toggleDark } = useDarkMode();
  const { isElder, toggle: toggleElder } = useElderMode();

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      // Backend route: POST /auth/change-password
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const pwFields = [
    { key: 'current', label: 'Current Password',    field: 'currentPassword' },
    { key: 'newPw',   label: 'New Password',         field: 'newPassword' },
    { key: 'confirm', label: 'Confirm New Password', field: 'confirmPassword' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader title="Appearance" desc="Customize how TricityShadi looks for you" />
        <div className="rounded-2xl border border-neutral-100 divide-y divide-neutral-100 overflow-hidden max-w-sm">
          <Toggle
            value={isDark}
            onChange={toggleDark}
            label="Dark Mode"
            desc="Switch between light and dark theme"
          />
          <Toggle
            value={isElder}
            onChange={toggleElder}
            label="Elder Mode"
            desc="Larger text and higher contrast for easier reading"
          />
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-neutral-900">Language</p>
              <p className="text-xs text-neutral-500">English · हिन्दी · ਪੰਜਾਬੀ</p>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="More" desc="Verification, family & astrology services" />
        <div className="rounded-2xl border border-neutral-100 divide-y divide-neutral-100 overflow-hidden max-w-sm">
          {[
            { to: '/verification', icon: FiShield, label: 'Verification' },
            { to: '/guardian',     icon: FiUsers,  label: 'Guardian & Family' },
            { to: '/astrologers',  icon: FiStar,   label: 'Talk to an Astrologer' },
          ].map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors">
              <span className="flex items-center gap-3 text-sm font-medium text-neutral-800">
                <Icon className="w-4 h-4 text-primary-500" /> {label}
              </span>
              <FiChevronRight className="w-4 h-4 text-neutral-400" />
            </Link>
          ))}
        </div>
      </div>

      <EmailSection />

      <div>
        <SectionHeader title="Change Password" desc="Must be 8+ characters with uppercase, lowercase, number, and special character." />
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
          {pwFields.map(({ key, label, field }) => (
            <div key={key}>
              <label htmlFor={`settings-pw-${key}`} className="block text-sm font-medium text-neutral-700 mb-1.5">{label}</label>
              <div className="relative">
                <input
                  id={`settings-pw-${key}`}
                  name={field}
                  type={show[key] ? 'text' : 'password'}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  required
                  className="input-field pr-10"
                  placeholder="••••••••"
                  autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                  aria-label={show[key] ? 'Hide password' : 'Show password'}
                >
                  {show[key] ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
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
              <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Updating…</>
            ) : success ? (
              <><FiCheck className="w-4 h-4" /> Password Updated</>
            ) : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Privacy tab ──────────────────────────────────────────────────────────────
const PrivacyTab = () => {
  // Backend validates: ['everyone', 'matches_only']
  const [settings, setSettings] = useState({
    profileVisibility: 'everyone',
    showOnlineStatus: true,
    showLastSeen: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/profile/me').then((r) => {
      const p = r.data.profile || r.data;
      if (p) {
        setSettings({
          profileVisibility: p.profileVisibility || 'everyone',
          showOnlineStatus: p.showOnlineStatus ?? true,
          showLastSeen: p.showLastSeen ?? true,
        });
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/profile/privacy', settings);
      toast.success('Privacy settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader title="Profile Visibility" desc="Control who can discover and view your profile" />
        <div className="max-w-sm">
          <label htmlFor="setting-profile-visibility" className="block text-sm font-medium text-neutral-700 mb-1.5">Who can see your profile</label>
          <select
            id="setting-profile-visibility"
            name="profileVisibility"
            value={settings.profileVisibility}
            onChange={(e) => setSettings((s) => ({ ...s, profileVisibility: e.target.value }))}
            className="input-field"
          >
            <option value="everyone">Everyone</option>
            <option value="matches_only">Matches Only</option>
          </select>
        </div>
      </div>

      <div>
        <SectionHeader title="Activity Status" desc="Choose what others can see about your online activity" />
        <div className="rounded-2xl border border-neutral-100 divide-y divide-neutral-100 overflow-hidden max-w-sm">
          <Toggle
            value={settings.showOnlineStatus}
            onChange={(v) => setSettings((s) => ({ ...s, showOnlineStatus: v }))}
            label="Show Online Status"
            desc="Let others see when you're online"
          />
          <Toggle
            value={settings.showLastSeen}
            onChange={(v) => setSettings((s) => ({ ...s, showLastSeen: v }))}
            label="Show Last Seen"
            desc="Let others see when you were last active"
          />
        </div>
      </div>

      <div className="max-w-sm">
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving…</>
          ) : 'Save Privacy Settings'}
        </button>
      </div>
    </div>
  );
};

// ─── Notifications tab ────────────────────────────────────────────────────────
const NotificationsTab = () => {
  const PREFS_KEY = 'tm_notif_prefs';
  const defaultPrefs = { matches: true, messages: true, profileViews: true, interests: true, promotions: false };

  const [prefs, setPrefs] = useState(() => {
    try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; }
    catch { return defaultPrefs; }
  });

  const togglePref = (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    toast.success('Preference saved');
  };

  const items = [
    { key: 'matches',      label: 'New Matches',   desc: 'When someone matches with you' },
    { key: 'messages',     label: 'Messages',       desc: 'When you receive a new message' },
    { key: 'profileViews', label: 'Profile Views',  desc: 'When someone views your profile' },
    { key: 'interests',    label: 'Interests',      desc: 'When someone sends you an interest' },
    { key: 'promotions',   label: 'Promotions',     desc: 'Offers and promotional emails' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Notification Preferences" desc="Choose which alerts you want to receive" />
      <div className="rounded-2xl border border-neutral-100 divide-y divide-neutral-100 overflow-hidden max-w-sm">
        {items.map(({ key, label, desc }) => (
          <Toggle key={key} value={prefs[key]} onChange={() => togglePref(key)} label={label} desc={desc} />
        ))}
      </div>
    </div>
  );
};

// ─── Verification tab ─────────────────────────────────────────────────────────
const VerificationTab = () => {
  const [status, setStatus] = useState(null); // null = loading
  const [form, setForm] = useState({
    documentType: 'aadhaar',
    documentFront: null,
    documentBack: null,
    selfiePhoto: null,
  });
  const [submitting, setSubmitting] = useState(false);

  const DOC_TYPES = [
    { value: 'aadhaar',         label: 'Aadhaar Card' },
    { value: 'pan',             label: 'PAN Card' },
    { value: 'passport',        label: 'Passport' },
    { value: 'driving_license', label: 'Driving Licence' },
  ];

  useEffect(() => {
    api.get('/verification/status')
      .then((r) => setStatus(r.data.verification))
      .catch(() => setStatus({ status: 'not_submitted' }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.documentFront) { toast.error('Document front image is required'); return; }
    if (!form.selfiePhoto)   { toast.error('Selfie photo is required'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('documentType', form.documentType);
      fd.append('documentFront', form.documentFront);
      if (form.documentBack) fd.append('documentBack', form.documentBack);
      fd.append('selfiePhoto', form.selfiePhoto);

      const res = await api.post('/verification/submit', fd);
      toast.success('Documents submitted! We will review within 24 hours.');
      setStatus(res.data.verification);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit documents');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === null) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin" />
      </div>
    );
  }

  // ── Approved state ────────────────────────────────────────────────────────
  if (status.status === 'approved') {
    return (
      <div className="space-y-6">
        <SectionHeader title="Identity Verification" desc="Your profile is verified and trusted by other members" />
        <div className="flex items-start gap-4 p-5 bg-success-light border border-success-100 rounded-2xl max-w-sm">
          <div className="w-11 h-11 rounded-full bg-success flex items-center justify-center flex-shrink-0">
            <FiCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-success text-sm">Identity Verified</p>
            <p className="text-xs text-success/80 mt-0.5">
              Verified {status.verifiedAt ? `on ${new Date(status.verifiedAt).toLocaleDateString('en-IN')}` : ''} · {DOC_TYPES.find(d => d.value === status.documentType)?.label || status.documentType}
            </p>
            <p className="text-xs text-neutral-500 mt-2">You have a verified badge on your profile. Verified profiles receive 3× more responses.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Pending state ─────────────────────────────────────────────────────────
  if (status.status === 'pending') {
    return (
      <div className="space-y-6">
        <SectionHeader title="Identity Verification" desc="Your documents are under review" />
        <div className="flex items-start gap-4 p-5 bg-warning-light border border-warning/20 rounded-2xl max-w-sm">
          <div className="w-11 h-11 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
            <FiClock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="font-semibold text-warning text-sm">Under Review</p>
            <p className="text-xs text-warning/80 mt-0.5">
              Submitted {status.submittedAt ? new Date(status.submittedAt).toLocaleDateString('en-IN') : ''} · {DOC_TYPES.find(d => d.value === status.documentType)?.label || status.documentType}
            </p>
            <p className="text-xs text-neutral-500 mt-2">We typically review documents within 24 hours. You'll receive an email when it's done.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Rejected state — show reason + allow resubmission ─────────────────────
  // ── Not submitted / rejected — show form ─────────────────────────────────
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Identity Verification"
        desc="Get a verified badge. Verified profiles appear higher in search and receive significantly more responses."
      />

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg">
        {[
          { step: '1', title: 'Upload ID', desc: 'Government-issued photo ID' },
          { step: '2', title: 'Admin Review', desc: 'We verify within 24 hours' },
          { step: '3', title: 'Get Verified', desc: 'Badge added to your profile' },
        ].map(({ step, title, desc }) => (
          <div key={step} className="flex flex-col items-center text-center p-3 bg-neutral-50 rounded-xl border border-neutral-100">
            <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center mb-2">{step}</div>
            <p className="text-xs font-semibold text-neutral-800">{title}</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Rejection notice */}
      {status.status === 'rejected' && status.adminNotes && (
        <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/15 rounded-xl max-w-lg">
          <FiX className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Previous submission rejected</p>
            <p className="text-xs text-neutral-600 mt-0.5">{status.adminNotes}</p>
            <p className="text-xs text-neutral-500 mt-1">Please resubmit with a clearer image.</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
        <div>
          <label htmlFor="setting-document-type" className="block text-sm font-medium text-neutral-700 mb-1.5">
            Document Type <span className="text-destructive">*</span>
          </label>
          <select
            id="setting-document-type"
            name="documentType"
            value={form.documentType}
            onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}
            className="input-field max-w-sm"
            required
          >
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUploadBox
            label="Document Front"
            sublabel="Clear photo, all text visible"
            required
            file={form.documentFront}
            onFile={(f) => setForm((s) => ({ ...s, documentFront: f }))}
          />
          <FileUploadBox
            label="Document Back"
            sublabel="Optional for PAN/Passport"
            file={form.documentBack}
            onFile={(f) => setForm((s) => ({ ...s, documentBack: f }))}
          />
        </div>

        <FileUploadBox
          label="Selfie Photo"
          sublabel="Hold document next to your face"
          required
          file={form.selfiePhoto}
          onFile={(f) => setForm((s) => ({ ...s, selfiePhoto: f }))}
        />

        <div className="flex items-start gap-2 p-3.5 bg-neutral-50 border border-neutral-100 rounded-xl text-xs text-neutral-500 max-w-sm">
          <FiShield className="w-3.5 h-3.5 text-primary-400 flex-shrink-0 mt-0.5" />
          <span>Your documents are securely encrypted and only used to verify your identity. They are never shared with other users.</span>
        </div>

        <button
          type="submit"
          disabled={submitting || !form.documentFront || !form.selfiePhoto}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Uploading…</>
          ) : (
            <><FiUpload className="w-4 h-4" /> Submit for Verification</>
          )}
        </button>
      </form>
    </div>
  );
};

// ─── Danger Zone tab ──────────────────────────────────────────────────────────
const DangerTab = () => {
  const { logout } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [showPw, setShowPw]       = useState(false);

  const handleDelete = async () => {
    if (!password) { toast.error('Please enter your password'); return; }
    setLoading(true);
    try {
      await api.delete('/auth/account', { data: { password } });
      toast.success('Account deleted');
      await logout();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Deletion failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Danger Zone" desc="These actions are permanent and cannot be undone" />

      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 max-w-sm">
        <h4 className="text-sm font-semibold text-neutral-900 mb-1">Delete Account</h4>
        <p className="text-sm text-neutral-600 mb-4 leading-relaxed">
          Permanently removes your profile, matches, messages, and all data. This cannot be undone.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          Delete My Account
        </button>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowModal(false); setPassword(''); } }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
          >
            <h3 id="delete-account-title" className="text-lg font-bold text-neutral-900 mb-1">Confirm Account Deletion</h3>
            <p className="text-sm text-neutral-500 mb-5">Enter your password to confirm. This action is permanent.</p>
            <div className="relative mb-5">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your current password"
                aria-label="Current password"
                autoComplete="current-password"
                autoFocus
                className="input-field pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                {showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setPassword(''); }}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-white text-sm font-semibold disabled:opacity-60 transition-colors cursor-pointer"
              >
                {loading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Settings page ───────────────────────────────────────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState('account');

  const TabContent = () => {
    switch (activeTab) {
      case 'account':       return <AccountTab />;
      case 'privacy':       return <PrivacyTab />;
      case 'notifications': return <NotificationsTab />;
      case 'verification':  return <VerificationTab />;
      case 'danger':        return <DangerTab />;
      default:              return null;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1117] pt-20 pb-24 md:pb-10 px-4">
      <div className="max-w-4xl mx-auto">

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-neutral-100">Settings</h1>
          <p className="text-neutral-500 text-sm mt-1">Manage your account preferences and privacy</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">

          {/* Sidebar nav */}
          <div className="md:w-56 flex-shrink-0 w-full">
            <nav className="bg-white dark:bg-[#1a1f2e] rounded-2xl shadow-card border border-neutral-100 dark:border-neutral-800 overflow-hidden">
              {TABS.map(({ id, label, icon: Icon, desc }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-colors border-b border-neutral-100 last:border-0 group cursor-pointer ${
                    activeTab === id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    activeTab === id ? 'bg-primary-100' : 'bg-neutral-100 group-hover:bg-neutral-200'
                  }`}>
                    <Icon className={`w-4 h-4 ${
                      activeTab === id
                        ? 'text-primary-600'
                        : id === 'danger'
                          ? 'text-destructive/60'
                          : 'text-neutral-500'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold leading-none ${
                      activeTab === id ? 'text-primary-700' : id === 'danger' ? 'text-destructive/80' : 'text-neutral-700'
                    }`}>
                      {label}
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{desc}</p>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Content panel */}
          <div className="flex-1 min-w-0 bg-white dark:bg-[#1a1f2e] rounded-2xl shadow-card border border-neutral-100 dark:border-neutral-800 p-6 md:p-8">
            <TabContent />
          </div>
        </div>
      </div>
    </div>
  );
}

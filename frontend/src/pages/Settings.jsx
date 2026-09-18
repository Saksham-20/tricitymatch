import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  FiUser, FiLock, FiBell, FiAlertTriangle, FiEye, FiEyeOff,
  FiMoon, FiShield, FiCheck, FiUpload, FiClock, FiX, FiCamera,
  FiFileText, FiUsers, FiStar, FiChevronRight, FiMonitor, FiSmartphone,
  FiRefreshCw, FiAlertCircle, FiHelpCircle,
} from 'react-icons/fi';
import useDarkMode from '../hooks/useDarkMode';
import useElderMode from '../hooks/useElderMode';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import LiveSelfieCapture from '../components/verification/LiveSelfieCapture';
import InviteLink from '../components/common/InviteLink';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { modal, backdrop } from '../utils/animations';

const TABS = [
  { id: 'account',       label: 'Account',      icon: FiUser,          desc: 'Password & appearance' },
  { id: 'privacy',       label: 'Privacy',       icon: FiShield,        desc: 'Visibility controls' },
  { id: 'notifications', label: 'Notifications', icon: FiBell,          desc: 'Alert preferences' },
  { id: 'verification',  label: 'Verification',  icon: FiFileText,      desc: 'Identity & trust badge' },
  { id: 'danger',        label: 'Danger Zone',   icon: FiAlertTriangle, desc: 'Irreversible actions' },
];

// ─── Shared Toggle ────────────────────────────────────────────────────────────
// Doctrine §3.5: the visual mark (a 44×24px track) is smaller than the
// 44×44 hit-target floor (48px in elder mode, which this already clears —
// `h-11` is rem-based and elder's 16→18.5px root scales it to ~51px) — pad
// the TARGET, don't grow the mark. The track lives in its own inner span so
// the extra height stays invisible instead of stretching the colored pill.
// The knob also drops plain `bg-white`: this codebase force-inverts every
// `.bg-white` element in dark mode (`html.dark .bg-white` → dark navy), which
// is right for cards but wrong for a switch knob — it left the knob nearly
// the same color as its off-state track. `bg-[#fff]` isn't matched by that
// selector, so the knob stays a legible white circle in both themes.
const Toggle = ({ value, onChange, label, desc, disabled }) => (
  <div className="flex items-center justify-between py-3.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
    <div className="min-w-0 pr-4">
      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{label}</p>
      {desc && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{desc}</p>}
    </div>
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      aria-checked={value}
      aria-label={label}
      role="switch"
      className={`relative inline-flex items-center justify-center w-11 h-11 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 flex-shrink-0 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-[160ms] ${
          value ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#fff] shadow-sm transition-transform duration-[160ms] ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  </div>
);

// ─── In-panel group heading ───────────────────────────────────────────────────
// Deliberately its own (smaller, plain) component, not `components/common/
// SectionHeader` — that one is the page-level Playfair tick-bar header used
// once per page section (Matches, Dashboard); this repeats ~15 times inside
// a single Settings tab as a quiet subsection label, a different job at a
// different scale. It used to share the exact name `SectionHeader`, which
// shadowed the common one for anyone searching the codebase; renamed so
// "SectionHeader" resolves to exactly one component.
const GroupHeader = ({ title, desc }) => (
  <div className="mb-5">
    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
    {desc && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{desc}</p>}
  </div>
);

// ─── File upload dropzone ─────────────────────────────────────────────────────
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
      <GroupHeader title="Email Address" desc="Change the email you use to sign in. We'll send a code to confirm the new address." />
      {/* Doctrine §3.4 finding: max-w-sm (384px) left ~200px dead gutter in a
          ~584px-wide desktop panel — widened to max-w-xl (576px) here and at
          every other capped block in this file. */}
      <div className="max-w-xl space-y-3">
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
              className="w-full py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 active:scale-[0.97] transition-transform duration-[120ms] disabled:opacity-60 disabled:active:scale-100">
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
                className="flex-1 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 active:scale-[0.97] transition-transform duration-[120ms]">
                Back
              </button>
              <button type="submit" disabled={loading || code.length !== 6}
                className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 active:scale-[0.97] transition-transform duration-[120ms] disabled:opacity-60 disabled:active:scale-100">
                {loading ? 'Verifying…' : 'Verify & update'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Active sessions ──────────────────────────────────────────────────────────
// GET /auth/sessions, DELETE /auth/sessions/:id and POST /auth/logout-all have
// existed on the server since launch with no way to reach them from the web
// app. On a shared family device that is the difference between "someone is
// still signed in on the tablet" and having no way to find out.
const parseUserAgent = (ua = '') => {
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox'
    : 'Browser';
  const mobile = /Mobile|Android|iPhone|iPad/.test(ua);
  const os = /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown device';
  return { label: `${browser} on ${os}`, mobile };
};

const formatWhen = (value) => {
  if (!value) return 'not used yet';
  const then = new Date(value);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const SessionsSection = () => {
  const { logoutAll } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);
  // Replaces window.confirm (doctrine §8 banned pattern) with an inline
  // Yes/No, the same pattern the per-device "Sign out" already implies but
  // never needed — this is the one destructive action on the page that does.
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.get('/auth/sessions');
      setSessions(data.sessions || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id) => {
    setBusyId(id);
    try {
      await api.delete(`/auth/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('Signed out on that device');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not sign that device out');
    } finally {
      setBusyId(null);
    }
  };

  const signOutEverywhere = async () => {
    setSigningOutAll(true);
    try {
      await logoutAll();
    } catch {
      toast.error('Could not sign out everywhere');
      setSigningOutAll(false);
      setConfirmingAll(false);
    }
  };

  return (
    <div>
      <GroupHeader
        title="Where you're signed in"
        desc="Sign out any device you don't recognise. Doing that immediately ends its access."
      />
      {/* Doctrine §3.4: this was a bordered box nested inside the content
          panel's own border+shadow. The list rows already separate with
          `divide-y`, so the outer border is dropped rather than declaring
          elevation twice; ErrorState/EmptyState are self-contained and don't
          need a box either. Widened max-w-lg → max-w-xl (finding #4). */}
      <div className="max-w-xl">
        {loading ? (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border-y border-neutral-100 dark:border-neutral-800">
            {[0, 1].map((i) => (
              <div key={i} className="p-4 flex items-center gap-3">
                <Skeleton variant="circle" className="w-9 h-9 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Couldn't load your sessions"
            description="The connection dropped before this finished loading. Try again."
            onRetry={load}
          />
        ) : sessions.length === 0 ? (
          <EmptyState icon={FiMonitor} title="No other active sessions" />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border-y border-neutral-100 dark:border-neutral-800">
            {sessions.map((s) => {
              const { label, mobile } = parseUserAgent(s.userAgent);
              const Icon = mobile ? FiSmartphone : FiMonitor;
              return (
                <div key={s.id} className="p-4 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {label}
                      {s.isCurrent && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-[10px] font-semibold uppercase tracking-wide">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {s.ipAddress || 'unknown IP'} · active {formatWhen(s.lastUsedAt || s.createdAt)}
                    </p>
                  </div>
                  {!s.isCurrent && (
                    <button
                      onClick={() => revoke(s.id)}
                      disabled={busyId === s.id}
                      className="text-xs font-semibold text-destructive hover:opacity-80 active:scale-[0.97] transition-transform duration-[120ms] disabled:opacity-50 disabled:active:scale-100 flex-shrink-0 py-3.5 px-2 -my-3.5 -mr-2"
                    >
                      {busyId === s.id ? 'Signing out…' : 'Sign out'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {!loading && !error && sessions.length > 0 && (
        confirmingAll ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-sm text-neutral-600 dark:text-neutral-300">Sign out of every device, including this one?</span>
            <button
              onClick={signOutEverywhere}
              disabled={signingOutAll}
              className="text-sm font-semibold text-white bg-destructive hover:bg-destructive/90 active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100 rounded-lg px-3 py-3 transition-[background-color,transform] duration-[160ms]"
            >
              {signingOutAll ? 'Signing out…' : 'Yes, sign out everywhere'}
            </button>
            <button
              onClick={() => setConfirmingAll(false)}
              disabled={signingOutAll}
              className="text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-neutral-100 active:scale-[0.97] transition-transform duration-[120ms] disabled:active:scale-100 py-3.5 px-2 -my-3.5 -mx-2"
            >
              Cancel
            </button>
          </div>
        ) : (
        <button
          onClick={() => setConfirmingAll(true)}
          className="mt-1 py-3 px-2 -mx-2 -mb-3 text-sm font-semibold text-destructive hover:opacity-80 active:scale-[0.97] transition-transform duration-[120ms]"
        >
          Sign out everywhere
        </button>
        )
      )}
    </div>
  );
};

const AccountTab = () => {
  const { user } = useAuth();
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
      toast.error(err.response?.data?.message || 'Could not change your password. Try again.');
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
      {/* Doctrine §3.4 finding: Invite/Appearance/More were each their own
          bordered box nested inside the content panel's own border+shadow —
          a card inside a card, repeated. All three are plain settings groups
          that already separate rows with `divide-y`, so the outer border is
          dropped in favour of that hairline instead of declaring elevation
          twice. Appearance/More also widen max-w-sm → max-w-xl (finding #4). */}
      <div>
        <GroupHeader title="Invite" desc="Bring someone you'd vouch for into the community" />
        <div className="px-4 max-w-xl">
          <InviteLink variant="row" />
        </div>
      </div>

      <div>
        <GroupHeader title="Appearance" desc="Customize how TricityMatch looks for you" />
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800 max-w-xl">
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
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Language</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">English · हिन्दी · ਪੰਜਾਬੀ</p>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div>
        <GroupHeader title="More" desc="Verification, family, support & astrology services" />
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800 max-w-xl">
          {[
            { to: '/verification', icon: FiShield, label: 'Verification' },
            { to: '/guardian',     icon: FiUsers,  label: 'Guardian & Family' },
            // D7: astrologer entry only when the server flag is on
            ...(user?.features?.astrologerMarketplace
              ? [{ to: '/astrologers', icon: FiStar, label: 'Talk to an Astrologer' }]
              : []),
            // Members had no in-product route to support at all — the contact
            // form was reachable only from the marketing footer.
            { to: '/help', icon: FiHelpCircle, label: 'Help & Support' },
            // A promoted personal account keeps its member profile, so the panel
            // needs a door from inside the app — otherwise the only way in is
            // typing /admin, which nobody tells them.
            ...(['sub_admin', 'admin', 'super_admin'].includes(user?.role)
              ? [{ to: '/admin', icon: FiShield, label: 'Admin panel' }]
              : []),
          ].map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-[160ms]">
              <span className="flex items-center gap-3 text-sm font-medium text-neutral-800 dark:text-neutral-100">
                <Icon className="w-4 h-4 text-primary-500" /> {label}
              </span>
              <FiChevronRight className="w-4 h-4 text-neutral-400" />
            </Link>
          ))}
        </div>
      </div>

      <EmailSection />

      <div>
        <GroupHeader title="Change Password" desc="Must be 8+ characters with uppercase, lowercase, number, and special character." />
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
          {pwFields.map(({ key, label, field }) => (
            <div key={key}>
              <label htmlFor={`settings-pw-${key}`} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{label}</label>
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
                  // Doctrine §3.5: was p-2.5 around a 16px icon (~36px hit
                  // target). w-11 h-11 (44px) flush to the input's edge pads
                  // the target without growing the visible glyph.
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
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

      <SessionsSection />
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
  // CRITICAL fix: this used to render the hardcoded defaults above
  // immediately and swallow a failed GET (`.catch(() => {})`), with no
  // loading or error state at all. A member whose fetch failed (network
  // blip, auth-refresh race) could click Save without changing anything and
  // silently overwrite a real 'Matches Only' back to 'Everyone' — a privacy
  // regression with no visible failure anywhere. The form (and the Save
  // button) now render only once the real server state is confirmed loaded;
  // a failed load shows ErrorState + retry instead, mirroring the pattern
  // SessionsSection already uses above.
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    api.get('/profile/me').then((r) => {
      const p = r.data.profile || r.data;
      if (p) {
        setSettings({
          profileVisibility: p.profileVisibility || 'everyone',
          showOnlineStatus: p.showOnlineStatus ?? true,
          showLastSeen: p.showLastSeen ?? true,
        });
      }
    }).catch(() => {
      setLoadError(true);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/profile/privacy', settings);
      toast.success('Privacy settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your privacy settings. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-4 w-36 mb-2" />
          <Skeleton className="h-3 w-56 mb-5" />
          <Skeleton className="h-11 w-full max-w-xl rounded-lg" />
        </div>
        <div className="max-w-xl divide-y divide-neutral-100 dark:divide-neutral-800 border-y border-neutral-100 dark:border-neutral-800">
          {[0, 1].map((i) => (
            <div key={i} className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton variant="circle" className="w-11 h-6 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <GroupHeader title="Profile Visibility" desc="Control who can discover and view your profile" />
        <ErrorState
          title="Couldn't load your privacy settings"
          description="We couldn't confirm your current settings, so nothing is shown rather than risk saving the wrong ones over them. Try again."
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <GroupHeader title="Profile Visibility" desc="Control who can discover and view your profile" />
        <div className="max-w-xl">
          <label htmlFor="setting-profile-visibility" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Who can see your profile</label>
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
        <GroupHeader title="Activity Status" desc="Choose what others can see about your online activity" />
        <div className="rounded-2xl border border-neutral-100 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden max-w-xl">
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

      <div className="max-w-xl">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? (
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
      <GroupHeader title="Notification Preferences" desc="Choose which alerts you want to receive" />
      <div className="rounded-2xl border border-neutral-100 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden max-w-xl">
        {items.map(({ key, label, desc }) => (
          <Toggle key={key} value={prefs[key]} onChange={() => togglePref(key)} label={label} desc={desc} />
        ))}
      </div>
    </div>
  );
};

// ─── Verification tab — photo (selfie) verification, no ID documents ─────────
const VerificationTab = () => {
  const [status, setStatus] = useState(null); // null = loading
  // Major fix: a genuine fetch failure used to `setStatus({ status:
  // 'not_submitted' })`, rendering byte-identical to "you haven't submitted
  // yet" — the full get-verified form, with no sign anything went wrong. A
  // member who had already submitted (or whose request just failed) could
  // see no trace of that submission and resubmit needlessly. It's now its
  // own state with a real retry.
  const [loadError, setLoadError] = useState(false);
  const [selfiePhoto, setSelfiePhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setStatus(null);
    setLoadError(false);
    api.get('/verification/status')
      .then((r) => setStatus(r.data.verification))
      .catch(() => setLoadError(true));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selfiePhoto) { toast.error('Selfie photo is required'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('selfiePhoto', selfiePhoto);

      const res = await api.post('/verification/submit', fd);
      toast.success('Selfie submitted. We will review within 24 hours.');
      setStatus(res.data.verification);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Could not submit your selfie. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === null && !loadError) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
        {/* Doctrine §3.4 finding: dropped the outer border — a plain neutral
            loading placeholder doesn't need its own box nested inside the
            content panel's; widened max-w-sm → max-w-xl (finding #4). */}
        <div className="flex items-start gap-4 p-5 max-w-xl">
          <Skeleton variant="circle" className="w-11 h-11 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <GroupHeader title="Photo Verification" desc="Get a verified badge by matching a selfie to your profile photos" />
        <ErrorState
          title="Couldn't load your verification status"
          description="The connection dropped before this finished loading. Try again."
          onRetry={load}
        />
      </div>
    );
  }

  // ── Approved state ────────────────────────────────────────────────────────
  if (status.status === 'approved') {
    return (
      <div className="space-y-6">
        <GroupHeader title="Photo Verification" desc="Your profile is verified and trusted by other members" />
        {/* Doctrine §3.4 finding: dropped the border — the tint alone already
            carries the state (the same bg-success-light/15 idiom Badge.jsx
            uses without a border elsewhere), so it no longer reads as a
            second box nested in the panel's own border. Widened max-w-sm →
            max-w-xl (finding #4). */}
        <div className="flex items-start gap-4 p-5 bg-success-light dark:bg-success/15 rounded-2xl max-w-xl">
          <div className="w-11 h-11 rounded-full bg-success flex items-center justify-center flex-shrink-0">
            <FiCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-success text-sm">Photo Verified</p>
            <p className="text-xs text-success/80 mt-0.5">
              Verified {status.verifiedAt ? `on ${new Date(status.verifiedAt).toLocaleDateString('en-IN')}` : ''}
            </p>
            {/* "3× more responses" was invented precision with no source
                (doctrine §7 finding) — reworded to a plain, unquantified
                statement instead of dropping the incentive entirely. */}
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">You have a verified badge on your profile, a signal other members trust.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Pending state ─────────────────────────────────────────────────────────
  if (status.status === 'pending') {
    return (
      <div className="space-y-6">
        <GroupHeader title="Photo Verification" desc="Your selfie is under review" />
        {/* Same ghost/nested-card fix as the approved state above: tint
            carries the state, border dropped; max-w-sm → max-w-xl. */}
        <div className="flex items-start gap-4 p-5 bg-warning-light dark:bg-warning/15 rounded-2xl max-w-xl">
          <div className="w-11 h-11 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
            <FiClock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="font-semibold text-warning text-sm">Under Review</p>
            <p className="text-xs text-warning/80 mt-0.5">
              Submitted {status.submittedAt ? new Date(status.submittedAt).toLocaleDateString('en-IN') : ''}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">We typically review selfies within 24 hours. You'll receive an email when it's done.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Not submitted / rejected — show form ─────────────────────────────────
  return (
    <div className="space-y-6">
      <GroupHeader
        title="Photo Verification"
        desc="Get a verified badge by matching a selfie to your profile photos. No documents needed."
      />

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
        {[
          { step: '1', title: 'Take a Selfie', desc: 'Good light, face clearly visible' },
          { step: '2', title: 'Team Review', desc: 'Matched to your profile photos' },
          { step: '3', title: 'Get Verified', desc: 'Badge added to your profile' },
        ].map(({ step, title, desc }) => (
          <div key={step} className="flex flex-col items-center text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700">
            <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 text-xs font-bold flex items-center justify-center mb-2">{step}</div>
            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">{title}</p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Rejection notice */}
      {status.status === 'rejected' && status.adminNotes && (
        <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/15 rounded-xl max-w-xl">
          <FiX className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Previous submission rejected</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">{status.adminNotes}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Please resubmit a clearer selfie.</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
        <LiveSelfieCapture file={selfiePhoto} onChange={setSelfiePhoto} />

        <div className="flex items-start gap-2 p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-xl text-xs text-neutral-500 dark:text-neutral-400">
          <FiShield className="w-3.5 h-3.5 text-primary-400 flex-shrink-0 mt-0.5" />
          <span>Your selfie is captured live from your camera (no uploads) and only used by our team to verify your profile photos. It is never shown to other members.</span>
        </div>

        <button
          type="submit"
          disabled={submitting || !selfiePhoto}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Submitting…</>
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
  const dialogRef = useRef(null);
  const passwordInputRef = useRef(null);
  const triggerRef = useRef(null);

  const closeModal = () => { setShowModal(false); setPassword(''); };

  // Major fix: the modal had role="dialog"/aria-modal and closed on Escape,
  // but implemented no real focus trap (Tab could leave it into the page
  // behind) and never restored focus to the trigger on close. Mirrors the
  // pattern already shipped on ImageLightbox.jsx elsewhere in this rework.
  useEffect(() => {
    if (!showModal) return;

    triggerRef.current = document.activeElement;
    passwordInputRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (typeof triggerRef.current?.focus === 'function') {
        triggerRef.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  const handleDelete = async () => {
    if (!password) { toast.error('Please enter your password'); return; }
    setLoading(true);
    try {
      await api.delete('/auth/account', { data: { password } });
      toast.success('Account deleted');
      await logout();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete your account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <GroupHeader title="Danger Zone" desc="These actions are permanent and cannot be undone" />

      {/* Doctrine §3.4 finding: dropped the border — the destructive tint
          alone still marks this as a distinct, dangerous action, so it no
          longer reads as a card nested in the panel's own border. Widened
          max-w-sm → max-w-xl (finding #4). */}
      <div className="rounded-2xl bg-destructive/5 p-5 max-w-xl">
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Delete Account</h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4 leading-relaxed">
          Permanently removes your profile, matches, messages, and all data. This cannot be undone.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 active:scale-[0.97] text-white text-sm font-semibold transition-[background-color,transform] duration-[160ms] cursor-pointer"
        >
          Delete My Account
        </button>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            {...backdrop}
            className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              ref={dialogRef}
              {...modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              className="bg-white dark:bg-neutral-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 id="delete-account-title" className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">Confirm Account Deletion</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">Enter your password to confirm. This action is permanent.</p>
              <div className="relative mb-5">
                <input
                  ref={passwordInputRef}
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your current password"
                  aria-label="Current password"
                  autoComplete="current-password"
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  // Doctrine §3.5: was p-2.5 around a 16px icon (~36px hit
                  // target); w-11 h-11 flush to the field's edge pads the
                  // target without growing the visible glyph.
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer"
                >
                  {showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 active:scale-[0.97] transition-[background-color,transform] duration-[160ms] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 active:scale-[0.97] text-white text-sm font-semibold disabled:opacity-60 disabled:active:scale-100 transition-[background-color,transform] duration-[160ms] cursor-pointer"
                >
                  {loading ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pt-20 pb-24 md:pb-10 px-4">
      <div className="max-w-4xl mx-auto">

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-neutral-100">Settings</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Manage your account preferences and privacy</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">

          {/* Sidebar nav */}
          {/* Doctrine §3.4: was `shadow-card border` together on one element
              — a literal ghost card. Follows the same resolution already
              established for this exact combination on Dashboard.jsx's `CARD`
              shell: light mode reads elevation from the shadow, dark mode
              (where a shadow barely registers) reads it from the border
              instead, never both at once. */}
          <div className="md:w-56 flex-shrink-0 w-full">
            <nav className="bg-white dark:bg-surface-dark-3 rounded-2xl shadow-card dark:shadow-none dark:border dark:border-neutral-800 overflow-hidden">
              {TABS.map(({ id, label, icon: Icon, desc }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-[color,background-color,transform] active:scale-[0.97] duration-[160ms] border-b border-neutral-100 dark:border-neutral-800 last:border-0 group cursor-pointer ${
                    activeTab === id
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    activeTab === id ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-neutral-100 dark:bg-neutral-800 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700'
                  }`}>
                    <Icon className={`w-4 h-4 ${
                      activeTab === id
                        ? 'text-primary-600 dark:text-primary-400'
                        : id === 'danger'
                          ? 'text-destructive/60'
                          : 'text-neutral-500 dark:text-neutral-400'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold leading-none ${
                      activeTab === id ? 'text-primary-700 dark:text-primary-300' : id === 'danger' ? 'text-destructive/80' : 'text-neutral-700 dark:text-neutral-200'
                    }`}>
                      {label}
                    </p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">{desc}</p>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Content panel */}
          {/* w-full: the parent row is `items-start`, so on the sub-md column
              layout a flex-col's cross axis (width) is NOT governed by
              flex-1/flex-basis — a child sizes to its own content unless given
              an explicit width. Without w-full, wide inner content (e.g. the
              invite-code row) pushed this panel past the viewport instead of
              wrapping inside it, causing the page-level horizontal scroll. */}
          {/* Same ghost-card fix as the sidebar nav above: `shadow-card
              border` together on one element was a literal doctrine
              violation; light mode keeps the shadow, dark mode reads the
              border instead. */}
          <div className="flex-1 min-w-0 w-full bg-white dark:bg-surface-dark-3 rounded-2xl shadow-card dark:shadow-none dark:border dark:border-neutral-800 p-6 md:p-8">
            <TabContent />
          </div>
        </div>
      </div>
    </div>
  );
}

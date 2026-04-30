import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiUser, FiLock, FiBell, FiAlertTriangle, FiEye, FiEyeOff, FiMoon } from 'react-icons/fi';
import useDarkMode from '../hooks/useDarkMode';

const TABS = [
  { id: 'account',       label: 'Account',       icon: FiUser },
  { id: 'privacy',       label: 'Privacy',        icon: FiLock },
  { id: 'notifications', label: 'Notifications',  icon: FiBell },
  { id: 'danger',        label: 'Danger Zone',    icon: FiAlertTriangle },
];

// ─── Account tab ─────────────────────────────
const AccountTab = () => {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState({ current: false, newPw: false, confirm: false });
  const { isDark, toggle: toggleDark } = useDarkMode();

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dark mode toggle */}
      <div className="flex items-center justify-between max-w-md p-4 rounded-2xl border border-neutral-100">
        <div className="flex items-center gap-3">
          <FiMoon className="w-5 h-5 text-neutral-500" />
          <div>
            <p className="text-sm font-medium text-neutral-800">Dark Mode</p>
            <p className="text-xs text-neutral-500">Switch between light and dark theme</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleDark}
          className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${isDark ? 'bg-primary-500' : 'bg-neutral-200'}`}
          style={isDark ? { backgroundColor: '#8B2346' } : {}}
          aria-label="Toggle dark mode"
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isDark ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <div>
        <h3 className="text-base font-semibold text-neutral-800 mb-1">Change Password</h3>
        <p className="text-sm text-neutral-500">Update your account password</p>
      </div>
      <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
        {[
          { key: 'current', label: 'Current Password',  field: 'currentPassword' },
          { key: 'newPw',   label: 'New Password',       field: 'newPassword' },
          { key: 'confirm', label: 'Confirm New Password',field: 'confirmPassword' },
        ].map(({ key, label, field }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">{label}</label>
            <div className="relative">
              <input
                type={show[key] ? 'text' : 'password'}
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                required
                minLength={key !== 'current' ? 8 : undefined}
                className="w-full pr-10 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                style={{ '--tw-ring-color': '#8B2346' }}
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {show[key] ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-colors"
          style={{ backgroundColor: '#8B2346' }}
        >
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

// ─── Privacy tab ─────────────────────────────
const PrivacyTab = () => {
  const [settings, setSettings] = useState({
    profileVisibility: 'all',
    showOnlineStatus: true,
    showLastSeen: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/profile/me').then((r) => {
      const p = r.data.profile || r.data;
      if (p) {
        setSettings({
          profileVisibility: p.profileVisibility || 'all',
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
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const Toggle = ({ label, desc, value, onChange }) => (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        {desc && <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${value ? 'bg-rose-700' : 'bg-neutral-200'}`}
        style={value ? { backgroundColor: '#8B2346' } : {}}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-base font-semibold text-neutral-800 mb-1">Privacy Settings</h3>
        <p className="text-sm text-neutral-500">Control who can see your profile and activity</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Profile Visibility</label>
        <select
          value={settings.profileVisibility}
          onChange={(e) => setSettings((s) => ({ ...s, profileVisibility: e.target.value }))}
          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="all">Everyone</option>
          <option value="premium">Premium Users Only</option>
          <option value="connections">My Connections Only</option>
        </select>
      </div>

      <div className="rounded-2xl border border-neutral-100 px-4">
        <Toggle
          label="Show Online Status"
          desc="Let others see when you're online"
          value={settings.showOnlineStatus}
          onChange={(v) => setSettings((s) => ({ ...s, showOnlineStatus: v }))}
        />
        <Toggle
          label="Show Last Seen"
          desc="Let others see when you were last active"
          value={settings.showLastSeen}
          onChange={(v) => setSettings((s) => ({ ...s, showLastSeen: v }))}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-colors"
        style={{ backgroundColor: '#8B2346' }}
      >
        {loading ? 'Saving…' : 'Save Privacy Settings'}
      </button>
    </div>
  );
};

// ─── Notifications tab ────────────────────────
const NotificationsTab = () => {
  const PREFS_KEY = 'tm_notif_prefs';
  const defaultPrefs = {
    matches: true,
    messages: true,
    profileViews: true,
    interests: true,
    promotions: false,
  };

  const [prefs, setPrefs] = useState(() => {
    try {
      return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
    } catch {
      return defaultPrefs;
    }
  });

  const togglePref = (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    toast.success('Notification preference saved');
  };

  const items = [
    { key: 'matches',      label: 'New Matches',      desc: 'When someone matches with you' },
    { key: 'messages',     label: 'Messages',          desc: 'When you receive a new message' },
    { key: 'profileViews', label: 'Profile Views',     desc: 'When someone views your profile' },
    { key: 'interests',    label: 'Interests',         desc: 'When someone sends you an interest' },
    { key: 'promotions',   label: 'Promotions',        desc: 'Offers and promotional emails' },
  ];

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <h3 className="text-base font-semibold text-neutral-800 mb-1">Notification Preferences</h3>
        <p className="text-sm text-neutral-500">Choose which notifications you want to receive</p>
      </div>
      <div className="rounded-2xl border border-neutral-100 px-4">
        {items.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0">
            <div>
              <p className="text-sm font-medium text-neutral-800">{label}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
            </div>
            <button
              onClick={() => togglePref(key)}
              className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${prefs[key] ? 'bg-rose-700' : 'bg-neutral-200'}`}
              style={prefs[key] ? { backgroundColor: '#8B2346' } : {}}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${prefs[key] ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Danger Zone tab ─────────────────────────
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
    <div className="space-y-4 max-w-md">
      <div>
        <h3 className="text-base font-semibold text-neutral-800 mb-1">Danger Zone</h3>
        <p className="text-sm text-neutral-500">Irreversible actions for your account</p>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <h4 className="text-sm font-semibold text-red-800 mb-1">Delete Account</h4>
        <p className="text-sm text-red-700 mb-4">
          Once deleted, your account and all associated data will be permanently removed. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
        >
          Delete My Account
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Account Deletion</h3>
            <p className="text-sm text-gray-500 mb-4">Enter your password to confirm this irreversible action.</p>
            <div className="relative mb-4">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your current password"
                className="w-full pr-10 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowModal(false); setPassword(''); }} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">Cancel</button>
              <button onClick={handleDelete} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60">
                {loading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Settings page ───────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState('account');

  const TabContent = () => {
    switch (activeTab) {
      case 'account':       return <AccountTab />;
      case 'privacy':       return <PrivacyTab />;
      case 'notifications': return <NotificationsTab />;
      case 'danger':        return <DangerTab />;
      default:              return null;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-24 md:pb-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-neutral-900 mb-6">Settings</h1>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="md:w-52 flex-shrink-0">
            <nav className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors border-b border-neutral-100 last:border-0 ${
                    activeTab === id
                      ? 'text-rose-700 bg-rose-50'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
            <TabContent />
          </div>
        </div>
      </div>
    </div>
  );
}

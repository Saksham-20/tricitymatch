import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiEye, FiPower, FiAlertCircle, FiUsers, FiRefreshCw, FiCopy, FiCheck, FiX } from 'react-icons/fi';
import apiClient from '../../api/apiClient';
import CommissionSettingsCard from '../../components/admin/CommissionSettingsCard';
import { useAdminScopes } from '../../components/admin/AdminLayout';
import copyText from '../../utils/copyText';
import generatePassword from '../../utils/generatePassword';

// What an admin needs to chase, in the words they would use. Keyed by the
// server's onboarding step names.
const MISSING_LABEL = {
  agreement: 'Guide not accepted',
  payout: 'No payout details',
  code: 'No code yet',
  outreach: 'No members yet',
};

export default function AdminMarketingUsers() {
  // null = full-access role. Commission is a money lever with its own scope.
  const scopes = useAdminScopes();
  const canPayouts = !scopes || scopes.includes('payouts');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'marketing'
  });
  const [error, setError] = useState('');
  // Errors from the create form belong INSIDE the dialog: the page-level banner
  // rendered behind the scrim, so a duplicate email looked like nothing happened.
  const [createError, setCreateError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // The just-created partner's sign-in details, kept only until the admin closes
  // the panel. There is no other way to read the password back.
  const [created, setCreated] = useState(null);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const navigate = useNavigate();
  const firstFieldRef = useRef(null);

  useEffect(() => {
    fetchUsers();
  }, [page]);

  // Dialog a11y: focus the first field when the create modal opens, let Escape
  // close it, and lock background scroll while it is open.
  useEffect(() => {
    if (!showCreateModal) return undefined;
    firstFieldRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setShowCreateModal(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showCreateModal]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/marketing-users?page=${page}&limit=20`);
      setUsers(res.data.users);
      setTotalPages(res.data.pagination.pages);
      setLoadError('');
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to fetch marketing users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/admin/marketing-users', formData);
      setError('');
      setCreateError('');
      setSuccess('');
      setCreated({
        email: res.data.user?.email || formData.email,
        password: formData.password,
        firstName: formData.firstName,
        welcomeEmailSent: Boolean(res.data.welcomeEmailSent),
      });
      setCopiedDetails(false);
      setShowCreateModal(false);
      setShowPassword(false);
      setFormData({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'marketing' });
      setPage(1);
      fetchUsers();
    } catch (err) {
      const e2 = err.response?.data?.error;
      setCreateError(e2?.details?.[0]?.message || e2?.message || err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleToggleStatus = async (userId, currentStatus, email, openLeads = 0) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    // Deactivating also switches off every referral code the partner owns, and
    // reactivating does NOT switch them back on, so say so before doing it.
    if (newStatus === 'inactive' && !window.confirm(
      `Deactivate ${email}?\n\nThey will no longer be able to sign in, and all of their referral codes stop working. Reactivating them later does not turn the codes back on.`
      + (openLeads > 0 ? `\n\nThey have ${openLeads} open ${openLeads === 1 ? 'lead' : 'leads'} nobody will follow up. You can give ${openLeads === 1 ? 'it' : 'them'} to another partner from their page afterwards.` : '')
    )) return;
    try {
      await apiClient.put(`/admin/marketing-users/${userId}/status`, { status: newStatus });
      setError('');
      setSuccess(newStatus === 'inactive'
        ? `${email} deactivated. Their referral codes were switched off.${openLeads > 0 ? ` They still have ${openLeads} open ${openLeads === 1 ? 'lead' : 'leads'}: open their page to give ${openLeads === 1 ? 'it' : 'them'} to another partner.` : ''}`
        : `${email} reactivated. Their referral codes stay off until you re-enable them.`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update user status');
    }
  };

  const signInMessage = (c) => [
    `Hi ${c.firstName}, your TricityMatch partner account is ready.`,
    '',
    `Sign in: ${window.location.origin}/login`,
    `Email: ${c.email}`,
    `Temporary password: ${c.password}`,
    '',
    'Please change your password after you sign in (Account & security in the portal), then read and accept the Partner Guide.',
  ].join('\n');

  const copySignIn = async () => {
    if (await copyText(signInMessage(created))) {
      setCopiedDetails(true);
      setTimeout(() => setCopiedDetails(false), 2000);
    }
  };

  const handleViewStats = async (userId) => {
    navigate(`/admin/marketing-users/${userId}`);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Marketing Users</h1>
        <button
          onClick={() => { setCreateError(''); setShowCreateModal(true); }}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          <FiPlus size={20} /> Create User
        </button>
      </div>

      {canPayouts && <CommissionSettingsCard />}

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-4">{success}</div>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <FiAlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">{loadError}</p>
          <button onClick={fetchUsers} className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
            Try again
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12">
          <FiUsers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No marketing users yet</p>
          <button onClick={() => { setCreateError(''); setShowCreateModal(true); }} className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
            <FiPlus size={18} /> Create User
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">Email</th>
                  <th className="border p-3 text-left">Name</th>
                  <th className="border p-3 text-left">Role</th>
                  <th className="border p-3 text-left">Status</th>
                  <th className="border p-3 text-left">Setup</th>
                  <th className="border p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="border p-3">{user.email}</td>
                    <td className="border p-3">{user.Profile?.firstName} {user.Profile?.lastName}</td>
                    <td className="border p-3">{user.role}</td>
                    <td className="border p-3">
                      <span className={`px-3 py-1 rounded-full text-sm ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="border p-3">
                      {user.onboarding ? (
                        <div>
                          <span className={`text-sm font-medium ${user.onboarding.complete ? 'text-green-700' : 'text-gray-800'}`}>
                            {user.onboarding.completed} of {user.onboarding.total}
                          </span>
                          {!user.onboarding.complete && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              {Object.keys(MISSING_LABEL).filter((k) => !user.onboarding.steps[k]).map((k) => MISSING_LABEL[k]).join(' · ')}
                            </p>
                          )}
                        </div>
                      ) : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="border p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewStats(user.id)}
                          aria-label="View rep report"
                          title="View rep report"
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                        >
                          <FiEye size={18} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user.id, user.status, user.email, user.openLeads)}
                          aria-label={user.status === 'active' ? 'Deactivate rep' : 'Activate rep'}
                          title={user.status === 'active' ? 'Deactivate rep' : 'Activate rep'}
                          className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:opacity-75 ${user.status === 'active' ? 'text-yellow-600' : 'text-green-600'}`}
                        >
                          <FiPower size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 rounded ${page === p ? 'bg-primary-500 text-white' : 'border'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </>
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-mu-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-mu-title" className="text-2xl font-bold mb-4">Create Marketing User</h2>
            {createError && (
              <div role="alert" className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{createError}</div>
            )}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label htmlFor="mu-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="mu-email"
                  ref={firstFieldRef}
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div>
                <label htmlFor="mu-password" className="block text-sm font-medium text-gray-700 mb-1">Temporary password</label>
                <div className="flex gap-2">
                  <input
                    id="mu-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="12+ characters, upper, lower, number, symbol"
                    minLength={12}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full border px-3 py-2 rounded"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => { setFormData((f) => ({ ...f, password: generatePassword() })); setShowPassword(true); }}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap border px-3 rounded text-sm font-medium text-gray-800 hover:bg-gray-50 min-h-[44px]"
                  >
                    <FiRefreshCw size={14} aria-hidden="true" /> Generate
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  You will be shown the sign-in details once after creating the account. The partner is asked to change this password.
                </p>
              </div>
              <div>
                <label htmlFor="mu-firstName" className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  id="mu-firstName"
                  type="text"
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div>
                <label htmlFor="mu-lastName" className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  id="mu-lastName"
                  type="text"
                  placeholder="Last name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div>
                <label htmlFor="mu-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  id="mu-phone"
                  type="tel"
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div>
                <label htmlFor="mu-role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  id="mu-role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                >
                  <option value="marketing">Marketing</option>
                  <option value="marketing_manager">Marketing Manager (also sees the whole team's numbers)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-primary-600 text-white py-2 rounded hover:bg-primary-700">
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border py-2 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {created && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div
            className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="created-mu-title"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 id="created-mu-title" className="text-xl font-bold">Partner account created</h2>
              <button
                type="button"
                onClick={() => setCreated(null)}
                aria-label="Close"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mt-2 -mr-2 rounded text-gray-500 hover:bg-gray-100"
              >
                <FiX size={18} />
              </button>
            </div>
            <p className={`text-sm mb-3 ${created.welcomeEmailSent ? 'text-green-700' : 'text-amber-800'}`}>
              {created.welcomeEmailSent
                ? `A welcome email with the first steps was sent to ${created.email}. It does not contain the password.`
                : `The welcome email could not be sent to ${created.email}. The account exists; send the details below yourself.`}
            </p>
            <p className="text-sm text-gray-700 mb-2">Send these sign-in details to the partner now. The password cannot be shown again.</p>
            <pre className="whitespace-pre-wrap break-all rounded bg-gray-50 border p-3 text-sm text-gray-900">{signInMessage(created)}</pre>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={copySignIn}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-600 text-white py-2 rounded hover:bg-primary-700 min-h-[44px]"
              >
                {copiedDetails ? <FiCheck size={16} aria-hidden="true" /> : <FiCopy size={16} aria-hidden="true" />}
                {copiedDetails ? 'Copied' : 'Copy sign-in details'}
              </button>
              <button type="button" onClick={() => setCreated(null)} className="flex-1 border py-2 rounded hover:bg-gray-50 min-h-[44px]">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

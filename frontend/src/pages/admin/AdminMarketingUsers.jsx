import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiEye, FiPower, FiAlertCircle, FiUsers } from 'react-icons/fi';
import apiClient from '../../api/apiClient';
import CommissionSettingsCard from '../../components/admin/CommissionSettingsCard';
import { useAdminScopes } from '../../components/admin/AdminLayout';

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
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');
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
      await apiClient.post('/admin/marketing-users', formData);
      setSuccess('Marketing user created successfully');
      setShowCreateModal(false);
      setFormData({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'marketing' });
      setPage(1);
      fetchUsers();
    } catch (err) {
      const e2 = err.response?.data?.error;
      setError(e2?.details?.[0]?.message || e2?.message || err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await apiClient.put(`/admin/marketing-users/${userId}/status`, { status: newStatus });
      setSuccess(`User ${newStatus} successfully`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user status');
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
          onClick={() => setShowCreateModal(true)}
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
          <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
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
                          onClick={() => handleToggleStatus(user.id, user.status)}
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
                <label htmlFor="mu-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  id="mu-password"
                  type="password"
                  placeholder="12+ characters, upper, lower, number, symbol"
                  minLength={12}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
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
                  <option value="marketing_manager">Marketing Manager</option>
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
    </div>
  );
}

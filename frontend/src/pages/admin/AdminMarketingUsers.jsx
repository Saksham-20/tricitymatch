import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, Edit2, Power } from 'lucide-react';
import apiClient from '../../api/apiClient';

export default function AdminMarketingUsers() {
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
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/marketing-users?page=${page}&limit=20`);
      setUsers(res.data.users);
      setTotalPages(res.data.pagination.pages);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch marketing users');
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
      setError(err.response?.data?.message || 'Failed to create user');
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
        <h1 className="text-3xl font-bold">Marketing Users</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} /> Create User
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-4">{success}</div>}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No marketing users found</div>
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
                    <td className="border p-3 flex gap-2">
                      <button
                        onClick={() => handleViewStats(user.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(user.id, user.status)}
                        className={`${user.status === 'active' ? 'text-yellow-600' : 'text-green-600'} hover:opacity-75`}
                      >
                        <Power size={18} />
                      </button>
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
                className={`px-3 py-1 rounded ${page === p ? 'bg-blue-600 text-white' : 'border'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create Marketing User</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border px-3 py-2 rounded"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full border px-3 py-2 rounded"
                required
              />
              <input
                type="text"
                placeholder="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full border px-3 py-2 rounded"
                required
              />
              <input
                type="text"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full border px-3 py-2 rounded"
                required
              />
              <input
                type="tel"
                placeholder="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border px-3 py-2 rounded"
              />
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="marketing">Marketing</option>
                <option value="marketing_manager">Marketing Manager</option>
              </select>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
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

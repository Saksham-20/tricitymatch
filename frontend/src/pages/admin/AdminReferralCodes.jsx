import { useState, useEffect } from 'react';
import { Plus, Copy, ToggleRight } from 'lucide-react';
import apiClient from '../../api/apiClient';

export default function AdminReferralCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [marketingUsers, setMarketingUsers] = useState([]);
  const [formData, setFormData] = useState({
    code: '',
    marketingUserId: '',
    campaign: '',
    source: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    fetchCodes();
    fetchMarketingUsers();
  }, [page]);

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/referral-codes?page=${page}&limit=20`);
      setCodes(res.data.codes);
      setTotalPages(res.data.pagination.pages);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch referral codes');
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketingUsers = async () => {
    try {
      const res = await apiClient.get('/admin/marketing-users?limit=100');
      setMarketingUsers(res.data.users);
    } catch (err) {
      console.error('Failed to fetch marketing users');
    }
  };

  const handleCreateCode = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/referral-codes', formData);
      setSuccess('Referral code created successfully');
      setShowCreateModal(false);
      setFormData({ code: '', marketingUserId: '', campaign: '', source: '' });
      setPage(1);
      fetchCodes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create referral code');
    }
  };

  const handleToggle = async (codeId) => {
    try {
      await apiClient.put(`/admin/referral-codes/${codeId}/toggle`);
      setSuccess('Referral code updated successfully');
      fetchCodes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update referral code');
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Referral Codes</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} /> Create Code
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-4">{success}</div>}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No referral codes found</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">Code</th>
                  <th className="border p-3 text-left">Marketing User</th>
                  <th className="border p-3 text-left">Campaign</th>
                  <th className="border p-3 text-left">Usage</th>
                  <th className="border p-3 text-left">Status</th>
                  <th className="border p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(code => (
                  <tr key={code.id} className="hover:bg-gray-50">
                    <td className="border p-3 font-mono text-sm">{code.code}</td>
                    <td className="border p-3">{code.MarketingUser?.email}</td>
                    <td className="border p-3">{code.campaign || '-'}</td>
                    <td className="border p-3">{code.usageCount}</td>
                    <td className="border p-3">
                      <span className={`px-3 py-1 rounded-full text-sm ${code.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {code.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="border p-3 flex gap-2">
                      <button
                        onClick={() => handleCopyCode(code.code)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Copy code"
                      >
                        <Copy size={18} />
                      </button>
                      <button
                        onClick={() => handleToggle(code.id)}
                        className={`${code.isActive ? 'text-red-600' : 'text-green-600'} hover:opacity-75`}
                      >
                        <ToggleRight size={18} />
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
            <h2 className="text-2xl font-bold mb-4">Create Referral Code</h2>
            <form onSubmit={handleCreateCode} className="space-y-4">
              <input
                type="text"
                placeholder="Code (e.g., REFER50)"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full border px-3 py-2 rounded"
                required
              />
              <select
                value={formData.marketingUserId}
                onChange={(e) => setFormData({ ...formData, marketingUserId: e.target.value })}
                className="w-full border px-3 py-2 rounded"
                required
              >
                <option value="">Select Marketing User</option>
                {marketingUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Campaign (optional)"
                value={formData.campaign}
                onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                className="w-full border px-3 py-2 rounded"
              />
              <input
                type="text"
                placeholder="Source (optional)"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full border px-3 py-2 rounded"
              />
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

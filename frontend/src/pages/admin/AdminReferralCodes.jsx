import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiCopy, FiToggleRight, FiAlertCircle, FiInbox } from 'react-icons/fi';
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
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    fetchCodes();
    fetchMarketingUsers();
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

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/referral-codes?page=${page}&limit=20`);
      setCodes(res.data.codes);
      setTotalPages(res.data.pagination.pages);
      setLoadError('');
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to fetch referral codes');
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
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to create referral code');
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

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy the code. Select and copy it manually.');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Referral Codes</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          <FiPlus size={20} /> Create Code
        </button>
      </div>

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
          <button onClick={fetchCodes} className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
            Try again
          </button>
        </div>
      ) : codes.length === 0 ? (
        <div className="text-center py-12">
          <FiInbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No referral codes yet</p>
          <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
            <FiPlus size={18} /> Create Code
          </button>
        </div>
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
                    <td className="border p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopyCode(code.code)}
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                          title="Copy code"
                          aria-label="Copy code"
                        >
                          <FiCopy size={18} />
                        </button>
                        <button
                          onClick={() => handleToggle(code.id)}
                          aria-label={code.isActive ? 'Disable code' : 'Enable code'}
                          title={code.isActive ? 'Disable code' : 'Enable code'}
                          className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:opacity-75 ${code.isActive ? 'text-red-600' : 'text-green-600'}`}
                        >
                          <FiToggleRight size={18} />
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
            aria-labelledby="create-code-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-code-title" className="text-2xl font-bold mb-4">Create Referral Code</h2>
            <form onSubmit={handleCreateCode} className="space-y-4">
              <div>
                <label htmlFor="rc-code" className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  id="rc-code"
                  ref={firstFieldRef}
                  type="text"
                  placeholder="e.g. REFER50"
                  value={formData.code}
                  pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,31}"
                  title="3-32 characters: letters, numbers and hyphens, starting with a letter or number"
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div>
                <label htmlFor="rc-mu" className="block text-sm font-medium text-gray-700 mb-1">Marketing user</label>
                <select
                  id="rc-mu"
                  value={formData.marketingUserId}
                  onChange={(e) => setFormData({ ...formData, marketingUserId: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                  required
                >
                  <option value="">Select marketing user</option>
                  {marketingUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rc-campaign" className="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
                <input
                  id="rc-campaign"
                  type="text"
                  placeholder="Optional"
                  value={formData.campaign}
                  onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div>
                <label htmlFor="rc-source" className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <input
                  id="rc-source"
                  type="text"
                  placeholder="Optional"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                />
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

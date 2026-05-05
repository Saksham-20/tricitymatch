import { useState, useEffect } from 'react';
import { Copy, Check, Plus, X } from 'lucide-react';
import apiClient from '../../api/apiClient';
import toast from 'react-hot-toast';

export default function MarketingReferralCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCodeForm, setNewCodeForm] = useState({ campaign: '', source: '' });

  useEffect(() => {
    fetchCodes();
  }, [page]);

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/marketing/referral-codes?page=${page}&limit=20`);
      setCodes(res.data.codes);
      setTotalPages(res.data.pagination.pages);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch referral codes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCode = async () => {
    try {
      setCreating(true);
      const res = await apiClient.post('/marketing/referral-codes', newCodeForm);
      toast.success(`Code ${res.data.referralCode.code} created!`);
      setShowCreateModal(false);
      setNewCodeForm({ campaign: '', source: '' });
      setPage(1);
      fetchCodes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create code');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateShareLink = (code) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/onboarding?ref=${code}`;
  };

  const handleCopyLink = (code) => {
    navigator.clipboard.writeText(generateShareLink(code));
    setCopied(`link-${code}`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Referral Codes</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} /> Generate New Code
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}

      {/* Create code modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Generate Referral Code</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">A unique code will be auto-generated from your username.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign <span className="text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  value={newCodeForm.campaign}
                  onChange={(e) => setNewCodeForm(f => ({ ...f, campaign: e.target.value }))}
                  placeholder="e.g. Instagram Q2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source <span className="text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  value={newCodeForm.source}
                  onChange={(e) => setNewCodeForm(f => ({ ...f, source: e.target.value }))}
                  placeholder="e.g. instagram, whatsapp"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCode}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Generating...' : 'Generate Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No referral codes yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mx-auto"
          >
            <Plus size={18} /> Generate Your First Code
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 mb-6">
            {codes.map(code => (
              <div key={code.id} className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold font-mono">{code.code}</h3>
                    {code.campaign && <p className="text-sm text-gray-600">Campaign: {code.campaign}</p>}
                    {code.source && <p className="text-sm text-gray-600">Source: {code.source}</p>}
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${code.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {code.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{code.usageCount}</p>
                    <p className="text-sm text-gray-600">Signups</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="bg-gray-100 p-3 rounded flex items-center justify-between">
                    <code className="text-sm">{code.code}</code>
                    <button
                      onClick={() => handleCopyCode(code.code)}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      {copied === code.code ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>

                  <div className="bg-gray-100 p-3 rounded flex items-center justify-between">
                    <code className="text-sm truncate">{generateShareLink(code.code)}</code>
                    <button
                      onClick={() => handleCopyLink(code.code)}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 ml-2"
                    >
                      {copied === `link-${code.code}` ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
    </div>
  );
}

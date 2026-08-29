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
        <h1 className="text-3xl font-serif font-bold text-neutral-900 dark:text-neutral-100">Referral Codes</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} /> Generate New Code
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 p-4 rounded-lg mb-4">{error}</div>}

      {/* Create code modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-transparent dark:border-neutral-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Generate Referral Code</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">A unique code will be auto-generated from your username.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">Campaign <span className="text-neutral-400 dark:text-neutral-500">(optional)</span></label>
                <input
                  type="text"
                  value={newCodeForm.campaign}
                  onChange={(e) => setNewCodeForm(f => ({ ...f, campaign: e.target.value }))}
                  placeholder="e.g. Instagram Q2"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">Source <span className="text-neutral-400 dark:text-neutral-500">(optional)</span></label>
                <input
                  type="text"
                  value={newCodeForm.source}
                  onChange={(e) => setNewCodeForm(f => ({ ...f, source: e.target.value }))}
                  placeholder="e.g. instagram, whatsapp"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCode}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {creating ? 'Generating...' : 'Generate Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">Loading...</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-500 dark:text-neutral-400 mb-4">No referral codes yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 mx-auto"
          >
            <Plus size={18} /> Generate Your First Code
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 mb-6">
            {codes.map(code => (
              <div key={code.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 rounded-xl">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-50">{code.code}</h3>
                    {code.campaign && <p className="text-sm text-neutral-600 dark:text-neutral-400">Campaign: {code.campaign}</p>}
                    {code.source && <p className="text-sm text-neutral-600 dark:text-neutral-400">Source: {code.source}</p>}
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${code.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
                      {code.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600 dark:text-primary-300">{code.usageCount}</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Signups</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-lg flex items-center justify-between">
                    <code className="text-sm text-neutral-800 dark:text-neutral-100">{code.code}</code>
                    <button
                      onClick={() => handleCopyCode(code.code)}
                      className="flex items-center gap-2 text-primary-600 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-100"
                    >
                      {copied === code.code ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>

                  <div className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-lg flex items-center justify-between">
                    <code className="text-sm truncate text-neutral-800 dark:text-neutral-100">{generateShareLink(code.code)}</code>
                    <button
                      onClick={() => handleCopyLink(code.code)}
                      className="flex items-center gap-2 text-primary-600 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-100 ml-2"
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
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${page === p ? 'bg-primary-600 text-white' : 'border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
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

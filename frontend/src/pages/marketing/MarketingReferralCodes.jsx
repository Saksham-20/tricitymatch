import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import apiClient from '../../api/apiClient';

export default function MarketingReferralCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState('');

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

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateShareLink = (code) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/signup?ref=${code}`;
  };

  const handleCopyLink = (code) => {
    navigator.clipboard.writeText(generateShareLink(code));
    setCopied(`link-${code}`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Referral Codes</h1>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No referral codes assigned yet</div>
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
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{code.usageCount}</p>
                    <p className="text-sm text-gray-600">Uses</p>
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

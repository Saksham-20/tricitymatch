import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, TrendingUp, DollarSign } from 'lucide-react';
import apiClient from '../../api/apiClient';

export default function AdminMarketingUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAll();
  }, [userId]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [statsRes, leadsRes, codesRes] = await Promise.all([
        apiClient.get(`/admin/marketing-users/${userId}/stats`),
        apiClient.get(`/admin/leads?marketingUserId=${userId}&limit=50`),
        apiClient.get(`/admin/referral-codes?marketingUserId=${userId}&limit=50`),
      ]);
      setUser(statsRes.data.user);
      setStats(statsRes.data.stats);
      setLeads(leadsRes.data.leads);
      setCodes(codesRes.data.codes);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (error) return <div className="p-6"><div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div></div>;

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/admin/marketing-users')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={18} /> Back to Marketing Users
      </button>

      <h1 className="text-3xl font-bold mb-2">Marketing User Detail</h1>
      {user && (
        <p className="text-gray-600 mb-6">
          {user.Profile?.firstName} {user.Profile?.lastName} — {user.email} ({user.role})
        </p>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow flex items-center gap-4">
            <Users className="text-blue-600" size={28} />
            <div>
              <p className="text-gray-600 text-sm">Total Leads</p>
              <p className="text-2xl font-bold">{stats.totalLeads}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow flex items-center gap-4">
            <TrendingUp className="text-green-600" size={28} />
            <div>
              <p className="text-gray-600 text-sm">Converted</p>
              <p className="text-2xl font-bold">{stats.convertedLeads}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow flex items-center gap-4">
            <DollarSign className="text-purple-600" size={28} />
            <div>
              <p className="text-gray-600 text-sm">Revenue</p>
              <p className="text-2xl font-bold">₹{stats.totalRevenue?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-bold mb-4">Referral Codes ({codes.length})</h2>
          {codes.length === 0 ? (
            <div className="bg-white p-4 rounded-lg text-gray-500">No codes assigned</div>
          ) : (
            <div className="space-y-2">
              {codes.map(code => (
                <div key={code.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                  <div>
                    <p className="font-mono font-bold">{code.code}</p>
                    {code.campaign && <p className="text-sm text-gray-600">{code.campaign}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">{code.usageCount} uses</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${code.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {code.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Leads ({leads.length})</h2>
          {leads.length === 0 ? (
            <div className="bg-white p-4 rounded-lg text-gray-500">No leads assigned</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">Name</th>
                    <th className="border p-2 text-left">Status</th>
                    <th className="border p-2 text-left">Payment</th>
                    <th className="border p-2 text-left">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="border p-2">{lead.name}</td>
                      <td className="border p-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          lead.status === 'converted' ? 'bg-green-100 text-green-700' :
                          lead.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{lead.status}</span>
                      </td>
                      <td className="border p-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${lead.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {lead.paymentStatus}
                        </span>
                      </td>
                      <td className="border p-2">{lead.amountPaid ? `₹${lead.amountPaid}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

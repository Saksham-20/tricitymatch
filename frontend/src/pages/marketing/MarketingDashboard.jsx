import { useState, useEffect } from 'react';
import { Users, TrendingUp, DollarSign, Code2, PhoneCall } from 'lucide-react';
import apiClient from '../../api/apiClient';

export default function MarketingDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/marketing/dashboard');
      setStats(res.data.stats);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">Marketing Dashboard</h1>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-4">
              <Users className="text-blue-600" size={28} />
              <div>
                <p className="text-gray-600 text-sm">Total Leads</p>
                <p className="text-3xl font-bold">{stats.totalLeads}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-4">
              <PhoneCall className="text-blue-400" size={28} />
              <div>
                <p className="text-gray-600 text-sm">Contacted</p>
                <p className="text-3xl font-bold">{stats.contactedLeads}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-4">
              <TrendingUp className="text-green-600" size={28} />
              <div>
                <p className="text-gray-600 text-sm">Converted</p>
                <p className="text-3xl font-bold">{stats.convertedLeads}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-4">
              <DollarSign className="text-purple-600" size={28} />
              <div>
                <p className="text-gray-600 text-sm">Revenue</p>
                <p className="text-3xl font-bold">₹{stats.totalRevenue?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-4">
              <Code2 className="text-orange-600" size={28} />
              <div>
                <p className="text-gray-600 text-sm">Active Codes</p>
                <p className="text-3xl font-bold">{stats.activeReferralCodes}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="space-y-2 text-gray-700">
          <p>View your leads in the "My Leads" section to manage and track conversions.</p>
          <p>Create and manage referral codes in the "Referral Codes" section.</p>
          <p>Track conversion rates and revenue generated from your referrals.</p>
        </div>
      </div>
    </div>
  );
}

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
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
        <h2 className="text-xl font-bold mb-4">How It Works</h2>
        <ol className="space-y-3 text-gray-700 list-none">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">1</span>
            <span>Go to <strong>Referral Codes</strong> and generate a code for your campaign.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">2</span>
            <span>Copy the share link — it opens the signup page with your code pre-filled.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">3</span>
            <span>Every signup via your link appears in <strong>My Leads</strong> and increments your code's signup count.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">4</span>
            <span>Track conversions and revenue in the stats above.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}

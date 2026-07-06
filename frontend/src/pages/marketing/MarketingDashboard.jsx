import { useState, useEffect } from 'react';
import { Users, TrendingUp, DollarSign, Code2, PhoneCall } from 'lucide-react';
import apiClient from '../../api/apiClient';

// Tiled KPI card — mirrors the admin dashboard KpiCard so both portals read the same.
const KpiCard = ({ icon: Icon, label, value, accent = 'primary' }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
      accent === 'gold' ? 'bg-gold-50 text-gold' : 'bg-primary-100 text-primary-600'
    }`}>
      <Icon size={22} />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      <p className="text-sm font-medium text-gray-600">{label}</p>
    </div>
  </div>
);

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
          <KpiCard icon={Users}      label="Total Leads"  value={stats.totalLeads} />
          <KpiCard icon={PhoneCall}  label="Contacted"    value={stats.contactedLeads} />
          <KpiCard icon={TrendingUp} label="Converted"    value={stats.convertedLeads} />
          <KpiCard icon={DollarSign} label="Revenue"      value={`₹${stats.totalRevenue?.toLocaleString() || 0}`} accent="gold" />
          <KpiCard icon={Code2}      label="Active Codes" value={stats.activeReferralCodes} />
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">How It Works</h2>
        <ol className="space-y-3 text-gray-700 list-none">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">1</span>
            <span>Go to <strong>Referral Codes</strong> and generate a code for your campaign.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">2</span>
            <span>Copy the share link — it opens the signup page with your code pre-filled.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">3</span>
            <span>Every signup via your link appears in <strong>My Leads</strong> and increments your code's signup count.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">4</span>
            <span>Track conversions and revenue in the stats above.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}

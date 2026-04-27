import { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import apiClient from '../../api/apiClient';

export default function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    marketingUserId: ''
  });
  const [marketingUsers, setMarketingUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeads();
    fetchMarketingUsers();
  }, [page, filters]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.status) params.append('status', filters.status);
      if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
      if (filters.marketingUserId) params.append('marketingUserId', filters.marketingUserId);

      const res = await apiClient.get(`/admin/leads?${params}`);
      setLeads(res.data.leads);
      setTotalPages(res.data.pagination.pages);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch leads');
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

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Marketing Leads</h1>

      <div className="bg-white p-4 rounded-lg mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="border px-3 py-2 rounded"
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
          <select
            value={filters.paymentStatus}
            onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
            className="border px-3 py-2 rounded"
          >
            <option value="">All Payment Status</option>
            <option value="none">None</option>
            <option value="paid">Paid</option>
          </select>
          <select
            value={filters.marketingUserId}
            onChange={(e) => handleFilterChange('marketingUserId', e.target.value)}
            className="border px-3 py-2 rounded"
          >
            <option value="">All Marketing Users</option>
            {marketingUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No leads found</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">Name</th>
                  <th className="border p-3 text-left">Phone</th>
                  <th className="border p-3 text-left">Email</th>
                  <th className="border p-3 text-left">City</th>
                  <th className="border p-3 text-left">Status</th>
                  <th className="border p-3 text-left">Payment</th>
                  <th className="border p-3 text-left">Amount</th>
                  <th className="border p-3 text-left">Marketer</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="border p-3">{lead.name}</td>
                    <td className="border p-3">{lead.phone}</td>
                    <td className="border p-3">{lead.email || '-'}</td>
                    <td className="border p-3">{lead.city || '-'}</td>
                    <td className="border p-3">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        lead.status === 'converted' ? 'bg-green-100 text-green-700' :
                        lead.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="border p-3">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        lead.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {lead.paymentStatus}
                      </span>
                    </td>
                    <td className="border p-3">{lead.amountPaid ? `₹${lead.amountPaid}` : '-'}</td>
                    <td className="border p-3">{lead.AssignedMarketer?.email || '-'}</td>
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
    </div>
  );
}

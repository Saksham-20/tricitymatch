import { useState, useEffect, useCallback, Fragment } from 'react';
import { Filter, Mail, AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import apiClient from '../../api/apiClient';

const STATUS_STYLES = {
  new: 'bg-primary-100 text-primary-700',
  read: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
};

const formatDate = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export default function AdminContactMessages() {
  const [messages, setMessages] = useState([]);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 20 });
      if (status) params.append('status', status);
      if (search.trim()) params.append('search', search.trim());

      const res = await apiClient.get(`/admin/contact-messages?${params}`);
      setMessages(res.data.messages || []);
      setNewCount(res.data.newCount || 0);
      setTotalPages(res.data.pagination?.pages || 1);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load enquiries');
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const changeStatus = async (id, nextStatus) => {
    setSavingId(id);
    // Optimistic — revert on failure so the table never lies about what was saved.
    const previous = messages;
    setMessages((rows) => rows.map((m) => (m.id === id ? { ...m, status: nextStatus } : m)));
    try {
      await apiClient.put(`/admin/contact-messages/${id}`, { status: nextStatus });
      setNewCount((c) => {
        const was = previous.find((m) => m.id === id)?.status;
        if (was === 'new' && nextStatus !== 'new') return Math.max(0, c - 1);
        if (was !== 'new' && nextStatus === 'new') return c + 1;
        return c;
      });
    } catch (err) {
      setMessages(previous);
      setError(err.response?.data?.error?.message || 'Could not update status');
    } finally {
      setSavingId(null);
    }
  };

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchMessages();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Support Inbox</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Enquiries from the public contact form.
            {newCount > 0 && <span className="ml-2 font-medium text-primary-700">{newCount} unread</span>}
          </p>
        </div>
        <button
          onClick={fetchMessages}
          className="inline-flex items-center gap-2 border px-3 py-2 rounded text-sm hover:bg-neutral-50"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        <div className="flex gap-4 flex-wrap">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="border px-3 py-2 rounded"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="resolved">Resolved</option>
          </select>
          <form onSubmit={applySearch} className="flex gap-2 flex-1 min-w-[240px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or message"
              className="border px-3 py-2 rounded flex-1"
              aria-label="Search enquiries"
            />
            <button type="submit" className="px-4 py-2 rounded bg-primary-600 text-white">Search</button>
          </form>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{error}</p>
            <button onClick={fetchMessages} className="text-sm underline mt-1">Retry</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-neutral-100 rounded animate-pulse" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg">
          <Inbox size={40} className="mx-auto text-neutral-300 mb-3" />
          <p className="text-neutral-600 font-medium">No enquiries found</p>
          <p className="text-sm text-neutral-400 mt-1">
            {status || search ? 'Try clearing the filters.' : 'Messages from the contact form will appear here.'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">Received</th>
                  <th className="border p-3 text-left">From</th>
                  <th className="border p-3 text-left">Subject</th>
                  <th className="border p-3 text-left">Status</th>
                  <th className="border p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <Fragment key={m.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                    >
                      <td className="border p-3 whitespace-nowrap text-sm">{formatDate(m.createdAt)}</td>
                      <td className="border p-3">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-sm text-neutral-500">{m.email}</div>
                        {m.phone && <div className="text-sm text-neutral-500">{m.phone}</div>}
                      </td>
                      <td className="border p-3">{m.subject || <span className="text-neutral-400">(no subject)</span>}</td>
                      <td className="border p-3">
                        <span className={`px-3 py-1 rounded-full text-sm ${STATUS_STYLES[m.status] || 'bg-gray-100 text-gray-700'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="border p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <select
                            value={m.status}
                            disabled={savingId === m.id}
                            onChange={(e) => changeStatus(m.id, e.target.value)}
                            className="border px-2 py-1 rounded text-sm"
                            aria-label={`Status for enquiry from ${m.name}`}
                          >
                            <option value="new">New</option>
                            <option value="read">Read</option>
                            <option value="resolved">Resolved</option>
                          </select>
                          <a
                            href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || 'Your enquiry'}`)}`}
                            className="inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"
                          >
                            <Mail size={14} /> Reply
                          </a>
                        </div>
                      </td>
                    </tr>
                    {expanded === m.id && (
                      <tr key={`${m.id}-body`}>
                        <td colSpan={5} className="border p-4 bg-neutral-50">
                          <p className="whitespace-pre-wrap text-sm text-neutral-800">{m.message}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-600">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded border disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

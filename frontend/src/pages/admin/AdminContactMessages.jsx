import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiFilter, FiMail, FiAlertCircle, FiInbox, FiRefreshCw, FiSearch, FiCheck, FiUser } from 'react-icons/fi';
import apiClient from '../../api/apiClient';
import { useDebounce } from '../../hooks/useDebounce';
import QueueMemberLink from '../../components/admin/QueueMemberLink';

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

// "2 h ago" for scanning; the absolute datetime lives in the title tooltip.
const formatRelative = (iso) => {
  if (!iso) return '-';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_OPTIONS = ['new', 'read', 'resolved'];

// The inbox opens on what needs doing: unread enquiries, whoever has waited
// longest first. Every filter lives in the URL, so a link (the dashboard's
// "Unread Support" tile, a colleague's paste) opens the same view.
const DEFAULT_STATUS = 'new';
const DEFAULT_SORT = 'oldest';

const selectCls = 'w-full sm:w-auto min-h-[40px] border border-gray-200 bg-white text-gray-900 px-3 rounded-lg text-sm';

/**
 * The status chip IS the control: click (or Enter/Space) opens a small menu,
 * arrows move, Esc closes. Replaces the redundant chip-column + select-column
 * pair. Optimistic update + revert live in the parent's changeStatus.
 */
function StatusChipMenu({ value, disabled, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const openMenu = () => {
    setActive(Math.max(0, STATUS_OPTIONS.indexOf(value)));
    setOpen(true);
  };

  const pick = (opt) => {
    setOpen(false);
    if (opt !== value) onChange(opt);
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % STATUS_OPTIONS.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + STATUS_OPTIONS.length) % STATUS_OPTIONS.length); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(STATUS_OPTIONS[active]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="relative inline-block" onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onBlur={(e) => { if (!e.currentTarget.parentElement.contains(e.relatedTarget)) setOpen(false); }}
        className={`px-3 py-1.5 rounded-full text-sm inline-flex items-center gap-1.5 border border-transparent
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60
          ${STATUS_STYLES[value] || 'bg-gray-100 text-gray-700'}`}
      >
        {value}
        <span aria-hidden="true" className="text-[10px] opacity-60">▾</span>
      </button>
      {open && (
        <ul role="listbox" aria-label={label}
          className="absolute z-60 mt-1 left-0 bg-white border border-neutral-200 rounded-lg shadow-card py-1 min-w-[8rem]">
          {STATUS_OPTIONS.map((opt, i) => (
            <li key={opt} role="option" aria-selected={opt === value}>
              <button
                type="button"
                onClick={() => pick(opt)}
                onMouseEnter={() => setActive(i)}
                className={`w-full text-left px-3 py-2 text-sm capitalize
                  ${i === active ? 'bg-primary-50 text-primary-700' : 'text-neutral-700'}
                  ${opt === value ? 'font-semibold' : ''}`}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminContactMessages() {
  const [params, setParams] = useSearchParams();
  const status = ['all', ...STATUS_OPTIONS].includes(params.get('status'))
    ? params.get('status')
    : DEFAULT_STATUS; // 'all' = every status
  const sort = params.get('sort') === 'newest' ? 'newest' : DEFAULT_SORT;
  const replied = ['yes', 'no'].includes(params.get('replied')) ? params.get('replied') : '';
  const assigned = ['me', 'unassigned'].includes(params.get('assigned')) ? params.get('assigned') : '';
  const search = params.get('search') || '';
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);

  // Typing waits for a pause before it asks the server.
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 350);

  const [messages, setMessages] = useState([]);
  const [newCount, setNewCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');   // a failed action (assign, status)
  const [totalPages, setTotalPages] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [replyDraft, setReplyDraft] = useState({});   // id → text
  const [replyingId, setReplyingId] = useState(null);
  const [replyError, setReplyError] = useState({});   // id → message
  const [staff, setStaff] = useState([]);
  const requestSeq = useRef(0);

  const setFilter = useCallback((key, value) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    if (debouncedSearch.trim() !== search) setFilter('search', debouncedSearch.trim());
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiClient.get('/admin/support-staff').then((r) => setStaff(r.data.staff || [])).catch(() => {});
  }, []);

  const assign = async (id, assignedTo) => {
    try {
      const res = await apiClient.put(`/admin/contact-messages/${id}/assign`, { assignedTo: assignedTo || null });
      setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...res.data.message } : m)));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not assign this enquiry');
    }
  };

  const fetchMessages = useCallback(async () => {
    // Only the newest request may fill the table: a slow answer for an older
    // filter or search must not replace the one on screen.
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: '20', sort });
      if (status !== 'all') q.set('status', status);
      if (assigned) q.set('assigned', assigned);
      if (replied) q.set('replied', replied);
      if (search) q.set('search', search);

      const res = await apiClient.get(`/admin/contact-messages?${q}`);
      if (seq !== requestSeq.current) return;
      setMessages(res.data.messages || []);
      setNewCount(res.data.newCount || 0);
      setTotalPages(res.data.pagination?.pages || 1);
      setTotal(res.data.pagination?.total || 0);
      setLoadError('');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setLoadError(err.response?.data?.error?.message || 'Failed to load enquiries');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [page, status, sort, replied, assigned, search]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Send an in-product reply. NOT optimistic: the server only records the reply
  // once the email actually went out, so the row must reflect the server's
  // answer — an admin who believes they replied and did not is the failure this
  // whole path exists to prevent.
  const sendReply = async (id) => {
    const body = (replyDraft[id] || '').trim();
    if (body.length < 2) return;
    setReplyingId(id);
    setReplyError((e) => ({ ...e, [id]: '' }));
    try {
      const res = await apiClient.post(`/admin/contact-messages/${id}/reply`, { body });
      const updated = res.data.message;
      setMessages((rows) => rows.map((m) => (m.id === id ? { ...m, ...updated } : m)));
      setReplyDraft((d) => ({ ...d, [id]: '' }));
      setNewCount((c) => (messages.find((m) => m.id === id)?.status === 'new' ? Math.max(0, c - 1) : c));
    } catch (err) {
      setReplyError((e) => ({ ...e, [id]: err.response?.data?.error?.message || 'Reply failed to send' }));
    } finally {
      setReplyingId(null);
    }
  };

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

  // Opening an unread enquiry is reading it: it stops counting as unread.
  const toggleExpanded = (m) => {
    const opening = expanded !== m.id;
    setExpanded(opening ? m.id : null);
    if (opening && m.status === 'new') changeStatus(m.id, 'read');
  };

  const applySearch = (e) => {
    e.preventDefault();
    setFilter('search', searchInput.trim());
  };

  const goPage = (p) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (p > 1) next.set('page', String(p)); else next.delete('page');
    return next;
  });

  const showEverything = () => { setSearchInput(''); setParams({ status: 'all' }, { replace: true }); };
  const onlyUnread = status === 'new' && !replied && !assigned && !search;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Support Inbox</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Enquiries from the public contact form.
            {newCount > 0 && <span className="ml-2 font-medium text-primary-700">{newCount} unread</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchMessages}
          className="inline-flex items-center gap-2 min-h-[40px] border border-gray-200 px-3 rounded-lg text-sm text-gray-700 hover:bg-neutral-50"
        >
          <FiRefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>

      <section aria-label="Filters" className="bg-white border border-gray-100 p-4 rounded-2xl">
        <div className="flex items-center gap-2 mb-3">
          <FiFilter size={18} aria-hidden="true" />
          <h2 className="text-base font-semibold text-gray-900">Filters</h2>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <select
            value={status}
            onChange={(e) => setFilter('status', e.target.value)}
            className={selectCls}
            aria-label="Filter by status"
          >
            <option value="new">Unread</option>
            <option value="read">Read</option>
            <option value="resolved">Resolved</option>
            <option value="all">All statuses</option>
          </select>
          <select
            value={replied}
            onChange={(e) => setFilter('replied', e.target.value)}
            className={selectCls}
            aria-label="Filter by reply"
          >
            <option value="">Replied or not</option>
            <option value="no">Not replied yet</option>
            <option value="yes">Replied</option>
          </select>
          <select
            value={assigned}
            onChange={(e) => setFilter('assigned', e.target.value)}
            className={selectCls}
            aria-label="Filter by assignee"
          >
            <option value="">Everyone's enquiries</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setFilter('sort', e.target.value === DEFAULT_SORT ? '' : e.target.value)}
            className={selectCls}
            aria-label="Order"
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
          <form onSubmit={applySearch} role="search" className="relative w-full sm:flex-1 sm:min-w-[220px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email, phone or message"
              className="w-full min-w-0 min-h-[40px] border border-gray-200 bg-white text-gray-900 pl-9 pr-3 rounded-lg text-sm"
              aria-label="Search enquiries"
            />
          </form>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3" role="alert">
          <FiAlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">{error}</p>
            <button type="button" onClick={() => setError('')} className="text-sm underline mt-1">Dismiss</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-neutral-100 rounded animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        // A failed load is never shown as an empty inbox.
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100" role="alert">
          <FiAlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-gray-600 mb-4">{loadError}</p>
          <button type="button" onClick={fetchMessages} className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium">
            Try again
          </button>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <FiInbox size={40} className="mx-auto text-neutral-300 mb-3" aria-hidden="true" />
          <p className="text-neutral-600 font-medium">{onlyUnread ? 'No unread enquiries' : 'No enquiries found'}</p>
          <p className="text-sm text-neutral-400 mt-1">
            {onlyUnread ? 'Everything that came in has been read.' : 'Try another filter, or show every enquiry.'}
          </p>
          {status !== 'all' || replied || assigned || search ? (
            <button type="button" onClick={showEverything} className="mt-4 min-h-[40px] px-4 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              Show every enquiry
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500" aria-live="polite">
            {total} {total === 1 ? 'enquiry' : 'enquiries'} · {sort === 'oldest' ? 'oldest first' : 'newest first'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">Received</th>
                  <th className="border p-3 text-left">From</th>
                  <th className="border p-3 text-left">Subject</th>
                  <th className="border p-3 text-left">Status</th>
                  <th className="border p-3 text-left">Assigned to</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <Fragment key={m.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded === m.id}
                      aria-controls={`msg-body-${m.id}`}
                      onClick={() => toggleExpanded(m)}
                      onKeyDown={(e) => {
                        // Only the row itself toggles — Enter/Space on the inner
                        // chip, assign select or email link must not bubble here.
                        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                          e.preventDefault();
                          toggleExpanded(m);
                        }
                      }}
                    >
                      <td className="border p-3 whitespace-nowrap text-sm" title={formatDate(m.createdAt)}>{formatRelative(m.createdAt)}</td>
                      <td className="border p-3">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-sm text-neutral-500 break-all">{m.email}</div>
                        {m.phone && <div className="text-sm text-neutral-500">{m.phone}</div>}
                        {m.memberId && (
                          <div className="text-sm mt-0.5" onClick={(e) => e.stopPropagation()}>
                            <QueueMemberLink userId={m.memberId} className="inline-flex items-center gap-1">
                              <FiUser size={13} aria-hidden="true" />
                              Member account
                              <span className="sr-only"> (same {m.memberMatch === 'phone' ? 'mobile number' : 'email'})</span>
                            </QueueMemberLink>
                          </div>
                        )}
                      </td>
                      <td className="border p-3">
                        <div>{m.subject || <span className="text-neutral-400">(no subject)</span>}</div>
                        {m.repliedAt && (
                          <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium" title={formatDate(m.repliedAt)}>
                            <FiCheck size={12} aria-hidden="true" /> Replied {formatRelative(m.repliedAt)}
                          </span>
                        )}
                      </td>
                      <td className="border p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <StatusChipMenu
                            value={m.status}
                            disabled={savingId === m.id}
                            onChange={(next) => changeStatus(m.id, next)}
                            label={`Status for enquiry from ${m.name}`}
                          />
                          <a
                            href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || 'Your enquiry'}`)}`}
                            className="inline-flex items-center gap-1 text-sm text-primary-700 hover:underline py-2"
                          >
                            <FiMail size={14} /> Email
                          </a>
                        </div>
                      </td>
                      <td className="border p-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={m.assignedTo || ''}
                          onChange={(e) => assign(m.id, e.target.value)}
                          aria-label={`Assign enquiry from ${m.name}`}
                          className="text-sm border border-neutral-200 rounded-lg px-2 py-1.5"
                        >
                          <option value="">Unassigned</option>
                          {staff.map((s) => <option key={s.id} value={s.id}>{s.email}</option>)}
                        </select>
                      </td>
                    </tr>
                    {expanded === m.id && (
                      <tr key={`${m.id}-body`} id={`msg-body-${m.id}`}>
                        <td colSpan={5} className="border p-4 bg-neutral-50">
                          <p className="whitespace-pre-wrap text-sm text-neutral-800">{m.message}</p>

                          {m.replyBody ? (
                            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
                              <p className="text-xs font-semibold text-green-800 mb-1">
                                Replied {m.repliedAt ? formatDate(m.repliedAt) : ''}
                              </p>
                              <p className="whitespace-pre-wrap text-sm text-green-900">{m.replyBody}</p>
                            </div>
                          ) : (
                            <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                              <label htmlFor={`reply-${m.id}`} className="block text-xs font-semibold text-neutral-600 mb-1">
                                Reply to {m.name} &lt;{m.email}&gt;
                              </label>
                              <textarea
                                id={`reply-${m.id}`}
                                rows={4}
                                value={replyDraft[m.id] || ''}
                                onChange={(e) => setReplyDraft((d) => ({ ...d, [m.id]: e.target.value }))}
                                maxLength={5000}
                                placeholder="Write the answer the member will receive by email…"
                                className="w-full border border-neutral-200 rounded-lg p-3 text-sm"
                              />
                              {replyError[m.id] && (
                                <p className="text-sm text-red-700 mt-1">{replyError[m.id]}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-3 mt-2">
                                <button
                                  onClick={() => sendReply(m.id)}
                                  disabled={replyingId === m.id || (replyDraft[m.id] || '').trim().length < 2}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
                                >
                                  <FiMail size={14} /> {replyingId === m.id ? 'Sending…' : 'Send reply'}
                                </button>
                                <span className="text-xs text-neutral-400">
                                  Sends from support and marks the enquiry resolved.
                                </span>
                              </div>
                            </div>
                          )}
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
                type="button"
                onClick={() => goPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="min-h-[40px] px-3 rounded border disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-600">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => goPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="min-h-[40px] px-3 rounded border disabled:opacity-40"
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

import React, { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { getMediaReviews, decideMediaReview } from '../../api/adminApi';
import { formatDate } from '../../utils/formatDate';
import QueueMemberLink from '../../components/admin/QueueMemberLink';

const SOURCES = [
  { key: 'auto', label: 'Held by screening' },
  { key: 'report', label: 'Stolen-photo reports' },
  { key: 'admin', label: 'Flagged by staff' },
];

// Waiting photos, and the decisions already made (newest first), so a reviewer
// can check what happened to a photo before acting on a complaint about it.
const STATUSES = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

// Photos a person has to look at: uploads the automated screen held back (never
// shown to anyone until approved), photos named in stolen-photo reports and
// photos staff flagged from a member's page (both live until decided).
export default function AdminPhotoReview() {
  const [status, setStatus] = useState('pending');
  const [source, setSource] = useState('auto');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(false);
    try {
      const res = await getMediaReviews({ status, source });
      if (seq !== requestSeq.current) return;
      setReviews(res.data.reviews || []);
    } catch {
      if (seq !== requestSeq.current) return;
      setError(true);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [status, source]);

  useEffect(() => { load(); }, [load]);

  const decide = async (review, decision, reason) => {
    setBusyId(review.id);
    try {
      await decideMediaReview(review.id, { decision, note: reason });
      toast.success(decision === 'reject' ? 'Photo removed' : review.source === 'auto' ? 'Approved' : 'Kept on the profile');
      setRejecting(null);
      setNote('');
      setReviews((rows) => rows.filter((r) => r.id !== review.id));
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not save the decision');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Photo review</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Approving a held photo puts it on the member's profile. Removing a photo deletes it and tells the member.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit" role="group" aria-label="Decision">
          {STATUSES.map((s) => (
            <button key={s.key} onClick={() => { setStatus(s.key); setRejecting(null); }} aria-pressed={status === s.key}
              className={`px-3 py-2 rounded-lg text-xs font-medium ${status === s.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit" role="group" aria-label="Where the photo came from">
          {SOURCES.map((s) => (
            <button key={s.key} onClick={() => setSource(s.key)} aria-pressed={source === s.key}
              className={`px-3 py-2 rounded-lg text-xs font-medium ${source === s.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-700">Could not load photos. <button className="underline" onClick={load}>Retry</button></p>}

      {loading ? (
        <p className="p-8 text-center text-sm text-gray-400">Loading…</p>
      ) : reviews.length === 0 && !error ? (
        <p className="p-8 text-center text-sm text-gray-400">{status === 'pending' ? 'Nothing waiting' : `No ${status} photos here yet`}</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {r.status === 'rejected' ? (
                // A removed photo's file is deleted, so there is nothing to show.
                <div className="w-full h-56 bg-gray-100 flex items-center justify-center text-xs text-gray-500">Photo deleted after review</div>
              ) : (
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  <img src={r.url} alt="Photo under review" loading="lazy" className="w-full h-56 object-cover bg-gray-100" />
                </a>
              )}
              <div className="p-4 space-y-2">
                <p className="text-sm font-medium text-gray-800">
                  <QueueMemberLink userId={r.userId}>
                    {[r.member?.firstName, r.member?.lastName].filter(Boolean).join(' ') || 'Member'}
                  </QueueMemberLink>
                  {r.member?.city ? <span className="text-gray-400 font-normal"> · {r.member.city}</span> : null}
                </p>
                {r.status !== 'pending' ? (
                  <p className="text-xs text-gray-500">
                    {r.status === 'approved' ? (r.source === 'auto' ? 'Approved' : 'Kept') : 'Removed'}
                    {r.decidedAt ? ` on ${formatDate(r.decidedAt)}` : ''}
                    {r.decisionNote ? ` · ${r.decisionNote}` : ''}
                  </p>
                ) : r.source === 'admin' ? (
                  r.decisionNote && <p className="text-xs text-gray-500">Flagged: {r.decisionNote}</p>
                ) : r.labels?.length > 0 && (
                  <p className="text-xs text-gray-500">{r.labels.join(', ').replace(/_/g, ' ')}</p>
                )}
                {r.status !== 'pending' ? null : rejecting === r.id ? (
                  <div className="space-y-2">
                    <label htmlFor={`note-${r.id}`} className="sr-only">Reason shown to the member</label>
                    <textarea id={`note-${r.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Reason shown to the member"
                      aria-describedby={`note-hint-${r.id}`}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <p id={`note-hint-${r.id}`} className="text-xs text-gray-400">At least 5 characters.</p>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setRejecting(null); setNote(''); }} className="px-3 py-1.5 text-xs text-gray-600">Cancel</button>
                      <button disabled={busyId === r.id || note.trim().length < 5}
                        onClick={() => decide(r, 'reject', note.trim())}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs disabled:opacity-50">Remove photo</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 justify-end">
                    <button disabled={busyId === r.id} onClick={() => { setRejecting(r.id); setNote(''); }}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 disabled:opacity-50">Remove</button>
                    <button disabled={busyId === r.id} onClick={() => decide(r, 'approve')}
                      className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs disabled:opacity-50">
                      {source === 'auto' ? 'Approve' : 'Keep'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

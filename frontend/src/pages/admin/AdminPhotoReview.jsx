import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getMediaReviews, decideMediaReview } from '../../api/adminApi';

const SOURCES = [
  { key: 'auto', label: 'Held by screening' },
  { key: 'report', label: 'Stolen-photo reports' },
];

// Photos a person has to look at: uploads the automated screen held back (never
// shown to anyone until approved), and photos named in stolen-photo reports
// (live until decided).
export default function AdminPhotoReview() {
  const [source, setSource] = useState('auto');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getMediaReviews({ status: 'pending', source });
      setReviews(res.data.reviews || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => { load(); }, [load]);

  const decide = async (review, decision, reason) => {
    setBusyId(review.id);
    try {
      await decideMediaReview(review.id, { decision, note: reason });
      toast.success(decision === 'approve' ? 'Approved' : 'Photo removed');
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

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {SOURCES.map((s) => (
          <button key={s.key} onClick={() => setSource(s.key)}
            className={`px-3 py-2 rounded-lg text-xs font-medium ${source === s.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-700">Could not load photos. <button className="underline" onClick={load}>Retry</button></p>}

      {loading ? (
        <p className="p-8 text-center text-sm text-gray-400">Loading…</p>
      ) : reviews.length === 0 && !error ? (
        <p className="p-8 text-center text-sm text-gray-400">Nothing waiting</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                <img src={r.url} alt="Photo under review" loading="lazy" className="w-full h-56 object-cover bg-gray-100" />
              </a>
              <div className="p-4 space-y-2">
                <p className="text-sm font-medium text-gray-800">
                  {[r.member?.firstName, r.member?.lastName].filter(Boolean).join(' ') || 'Member'}
                  {r.member?.city ? <span className="text-gray-400 font-normal"> · {r.member.city}</span> : null}
                </p>
                {r.labels?.length > 0 && (
                  <p className="text-xs text-gray-500">{r.labels.join(', ').replace(/_/g, ' ')}</p>
                )}
                {rejecting === r.id ? (
                  <div className="space-y-2">
                    <label htmlFor={`note-${r.id}`} className="sr-only">Reason shown to the member</label>
                    <textarea id={`note-${r.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Reason shown to the member"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
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

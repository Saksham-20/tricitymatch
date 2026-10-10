import React, { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getAppeals, decideAppeal } from '../../api/adminApi';
import { formatDate } from '../../utils/formatDate';
import QueueMemberLink, { memberLabel } from '../../components/admin/QueueMemberLink';

const TABS = ['pending', 'overturned', 'upheld'];

// What the member was suspended for, as recorded when it happened.
export const suspensionText = (suspension) => {
  if (!suspension) return 'No suspension record was found for this account.';
  const what = suspension.status === 'inactive' ? 'Deactivated' : 'Banned';
  const when = suspension.at ? ` on ${formatDate(suspension.at)}` : '';
  const who = suspension.byEmail ? ` by ${suspension.byEmail}` : '';
  if (suspension.bulk) return `${what}${when}${who} in a bulk change. No reason was recorded.`;
  return `${what}${when}${who}. ${suspension.reason ? `Reason: ${suspension.reason}` : 'No reason was recorded.'}`;
};

// Appeals against a suspension. The member cannot sign in, so they arrive
// through the public /appeal form with their email or mobile number; a decision
// is emailed when there is an address, and an overturn reactivates the account.
export default function AdminAppeals() {
  const [tab, setTab] = useState('pending');
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);
  const noteRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getAppeals({ status: tab });
      setAppeals(res.data.appeals || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  // Focus management for the review dialog: move focus to the note on open,
  // trap Tab inside the card, close on Escape, and restore focus to the opener
  // (the Review button) on close.
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    noteRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(null); return; }
      if (e.key === 'Tab' && dialogRef.current) {
        const items = Array.from(dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [open]);

  const decide = async (decision) => {
    setBusy(true);
    try {
      const res = await decideAppeal(open.id, { decision, note });
      // Phone-only appellants are not emailed: the reviewer has to tell them.
      const told = res?.data?.emailed === false
        ? `call or message them on ${open.email}`
        : 'the member has been emailed';
      toast.success(decision === 'overturned' ? `Account restored — ${told}` : `Suspension kept — ${told}`);
      setOpen(null);
      setNote('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not save the decision');
    } finally {
      setBusy(false);
    }
  };

  // The member's name when the account has one; the appeal's own contact otherwise.
  const who = (a) => (a.User ? memberLabel(a.User) : a.email);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Appeals</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Suspended members asking for a second look. Your note is emailed to them; a member who joined by phone has to be called or messaged instead.
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-lg text-xs font-medium capitalize ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-700">Could not load appeals. <button className="underline" onClick={load}>Retry</button></p>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">Loading…</p>
        ) : appeals.length === 0 && !error ? (
          <p className="p-8 text-center text-sm text-gray-400">No {tab} appeals</p>
        ) : appeals.map((a) => (
          <div key={a.id} className="p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">
                <QueueMemberLink userId={a.userId}>{who(a)}</QueueMemberLink>
              </p>
              <p className="text-xs text-gray-500 break-words">
                {a.email} · Account {a.User?.status || 'unknown'} · sent {formatDate(a.createdAt)}
              </p>
              <p className="mt-1 text-xs text-gray-600 break-words">{suspensionText(a.suspension)}</p>
              <p className="mt-2 text-sm text-gray-600 whitespace-pre-line line-clamp-3">{a.statement}</p>
              {a.decisionNote && <p className="mt-2 text-xs text-gray-500">Decision: {a.decisionNote}</p>}
            </div>
            {a.status === 'pending' && (
              <button onClick={() => { setOpen(a); setNote(''); }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-primary-100 text-gray-600 hover:text-primary-700 text-xs font-medium">
                Review
              </button>
            )}
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(null)}>
          <div ref={dialogRef} onClick={(e) => e.stopPropagation()} tabIndex={-1}
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto focus:outline-none" role="dialog" aria-modal="true" aria-labelledby="appeal-title">
            <h3 id="appeal-title" className="text-lg font-bold text-gray-900 mb-1">Review appeal</h3>
            <p className="text-sm text-gray-500 mb-3">
              <QueueMemberLink userId={open.userId}>{who(open)}</QueueMemberLink>
              {open.User ? <span> · {open.email}</span> : null}
            </p>
            {!String(open.email || '').includes('@') && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This account has no email, so your note cannot be emailed. Tell them the decision on {open.email} by phone or WhatsApp.
              </p>
            )}
            <div className="mb-3 rounded-lg border border-gray-200 px-3 py-2">
              <p className="text-xs font-semibold text-gray-700">Why they were suspended</p>
              <p className="text-sm text-gray-700 break-words">{suspensionText(open.suspension)}</p>
            </div>
            <p className="text-xs font-semibold text-gray-700 mb-1">What they say</p>
            <p className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 whitespace-pre-line max-h-48 overflow-y-auto">{open.statement}</p>
            <label htmlFor="appeal-note" className="block text-sm font-medium text-gray-700 mt-4 mb-1.5">Note to the member (required)</label>
            <textarea id="appeal-note" ref={noteRef} rows={3} value={note} onChange={(e) => setNote(e.target.value)}
              aria-describedby="appeal-note-hint"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <p id="appeal-note-hint" className="text-xs text-gray-400 mt-1">Please write at least 10 characters.</p>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setOpen(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button disabled={busy || note.trim().length < 10} onClick={() => decide('upheld')}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 disabled:opacity-50">Keep suspension</button>
              <button disabled={busy || note.trim().length < 10} onClick={() => decide('overturned')}
                className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm disabled:opacity-50">Restore account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiAlertCircle } from 'react-icons/fi';
import { changeMemberIdentity } from '../../api/adminApi';

/**
 * Correct a member's date of birth or gender.
 *
 * Members cannot change either after sign-up (both decide the marriageable-age
 * rule and who they are shown to), and the message they get says to contact
 * support. This is that support path: only what changed is sent, a reason is
 * required for the audit trail, and the server still applies the age rule, so
 * its refusal is shown here word for word.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// The stored value is midnight UTC or midnight IST depending on where it was
// typed; read in India time both are the same calendar day.
const dayOf = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
};

const GENDERS = [['female', 'Female'], ['male', 'Male'], ['other', 'Other']];
const MIN_REASON = 10;

const errorOf = (err) =>
  err?.response?.data?.error?.details?.[0]?.message
  || err?.response?.data?.error?.message
  || err?.response?.data?.message
  || 'Could not save the change';

// Youngest date of birth the picker offers: 18 years ago (the lowest minimum;
// the server applies 21 for men and for "other").
const maxDob = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
};

export default function MemberIdentityDialog({ userId, profile, onSaved, onClose }) {
  const panelRef = useRef(null);
  const startDob = dayOf(profile?.dateOfBirth);
  const startGender = profile?.gender || '';
  const [dob, setDob] = useState(startDob);
  const [gender, setGender] = useState(startGender);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const dobChanged = Boolean(dob) && dob !== startDob;
  const genderChanged = Boolean(gender) && gender !== startGender;
  const problem = !dobChanged && !genderChanged ? 'Change the date of birth or the gender first'
    : reason.trim().length < MIN_REASON ? `Give a reason of at least ${MIN_REASON} characters (it is kept in the audit log)`
    : null;

  const submit = async (e) => {
    e.preventDefault();
    if (problem) { setError(problem); return; }
    const body = { reason: reason.trim() };
    if (dobChanged) body.dateOfBirth = dob;
    if (genderChanged) body.gender = gender;
    setBusy(true);
    setError('');
    try {
      await changeMemberIdentity(userId, body);
      toast.success('Date of birth and gender saved');
      onSaved();
    } catch (err) {
      setError(errorOf(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <form
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl outline-none"
      >
        <h3 id="identity-title" className="text-lg font-bold text-gray-900 mb-1">Correct date of birth or gender</h3>
        <p className="text-sm text-gray-500 mb-4">
          Members cannot change these themselves after sign-up. Check the correction with the member first: the
          minimum age still applies (men and &quot;other&quot; 21, women 18), and the change is recorded with your reason.
        </p>

        <label htmlFor="identity-dob" className="block text-sm font-medium text-gray-700 mb-1">Date of birth</label>
        <input
          id="identity-dob"
          type="date"
          value={dob}
          min="1926-01-01"
          max={maxDob()}
          onChange={(e) => { setDob(e.target.value); setError(''); }}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
        />

        <label htmlFor="identity-gender" className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
        <select
          id="identity-gender"
          value={gender}
          onChange={(e) => { setGender(e.target.value); setError(''); }}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
        >
          {!startGender && <option value="">Not set</option>}
          {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <label htmlFor="identity-reason" className="block text-sm font-medium text-gray-700 mb-1">Reason for the change</label>
        <textarea
          id="identity-reason"
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(''); }}
          rows={3}
          maxLength={500}
          placeholder="e.g. Member sent a copy of their birth certificate; typo at sign-up"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
        />

        {error ? (
          <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-2" role="alert">
            <FiAlertCircle className="mt-0.5 flex-shrink-0" aria-hidden="true" /> {error}
          </p>
        ) : problem ? (
          <p role="status" className="text-xs text-amber-800 mb-2">{problem}</p>
        ) : null}

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={busy || Boolean(problem)} className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-primary-700 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {busy ? 'Saving…' : 'Save change'}
          </button>
        </div>
      </form>
    </div>
  );
}

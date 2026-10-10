import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiEyeOff, FiSlash } from 'react-icons/fi';
import { updateUserStatus, updateUserVisibility } from '../../api/adminApi';

const errorText = (err, fallback) => err?.response?.data?.error?.message || err?.response?.data?.message || fallback;

const ACTIONS = {
  ban: {
    min: 5,
    label: 'Reason for the ban',
    hint: 'The member is shown this reason and can appeal. At least 5 characters.',
    placeholder: 'e.g. asked members for money',
    confirm: 'Confirm ban',
  },
  hide: {
    min: 3,
    label: 'Reason (only admins see this)',
    hint: 'They stay signed in and are not told; they drop out of search and daily matches.',
    placeholder: 'e.g. checking this report',
    confirm: 'Make invisible',
  },
};

/**
 * Act on the reported member from the report itself: ban them, or make them
 * invisible to other members while the case is looked at. Each needs a reason
 * and a second, deliberate click. The caller shows this only to admins who may
 * change members (the `users` scope) and only for ordinary member accounts.
 */
export default function ReportMemberActions({ member, onChanged }) {
  const [action, setAction] = useState(null); // 'ban' | 'hide'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const banned = member.status === 'banned';
  const hidden = Boolean(member.invisible);
  const spec = action ? ACTIONS[action] : null;
  const ready = Boolean(spec) && reason.trim().length >= spec.min;

  const start = (next) => { setAction(next); setReason(''); };

  const confirm = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      if (action === 'ban') {
        await updateUserStatus(member.id, { status: 'banned', reason: reason.trim() });
        toast.success('Member banned. They have been told why and can appeal.');
        onChanged?.({ status: 'banned' });
      } else {
        await updateUserVisibility(member.id, { hidden: true, reason: reason.trim() });
        toast.success('Member is now invisible to other members');
        onChanged?.({ invisible: true });
      }
      setAction(null);
      setReason('');
    } catch (err) {
      toast.error(errorText(err, 'That did not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="report-member-actions" className="rounded-xl border border-gray-200 p-3">
      <h4 id="report-member-actions" className="text-sm font-semibold text-gray-800">Act on the reported member</h4>
      {(banned || hidden) && (
        <p className="mt-1 text-xs text-gray-600">
          {banned ? 'This account is banned.' : ''}{banned && hidden ? ' ' : ''}{hidden ? 'They are invisible to other members.' : ''}
        </p>
      )}

      {!action ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => start('ban')}
            disabled={banned}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium disabled:opacity-50"
          >
            <FiSlash className="w-4 h-4" aria-hidden="true" /> Ban member
          </button>
          <button
            type="button"
            onClick={() => start('hide')}
            disabled={hidden || banned}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium disabled:opacity-50"
          >
            <FiEyeOff className="w-4 h-4" aria-hidden="true" /> Make invisible
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <label htmlFor="report-member-reason" className="block text-xs font-medium text-gray-700">{spec.label}</label>
          <textarea
            id="report-member-reason"
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={spec.placeholder}
            aria-describedby="report-member-reason-hint"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p id="report-member-reason-hint" className="text-xs text-gray-500">{spec.hint}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setAction(null); setReason(''); }}
              className="min-h-[40px] px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!ready || busy}
              className={`min-h-[40px] px-3 rounded-xl text-white text-sm font-medium disabled:opacity-50 ${
                action === 'ban' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {busy ? 'Saving…' : spec.confirm}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';

/**
 * What an admin plan override will actually do, and why it was done.
 *
 * Pressing Update used to cancel the member's paid row and start a fresh one
 * with a full new term and used-unlocks reset to 0, with no reason recorded and
 * no preview of what was being replaced. This shows the consequence before the
 * click and collects the reason for the audit log.
 */
export const MIN_REASON = 10;

export const overrideProblem = ({ currentPlan, nextPlan, reason }) => {
  if (!nextPlan) return 'Choose a plan';
  if (nextPlan === (currentPlan || 'free')) return 'The member is already on this plan';
  if (String(reason || '').trim().length < MIN_REASON) return `Add a reason (at least ${MIN_REASON} characters)`;
  return null;
};

const labelOf = (options, key) => options.find((o) => o.planType === key)?.label || key;

export default function PlanOverrideNotice({ options, currentPlan, nextPlan, reason, onReason }) {
  const current = currentPlan || 'free';
  const same = nextPlan === current;
  const problem = overrideProblem({ currentPlan, nextPlan, reason });

  let summary;
  if (same) {
    summary = 'The member is already on this plan. Pick a different one.';
  } else if (nextPlan === 'free') {
    summary = `Ends the ${labelOf(options, current)} plan now. The member keeps their profile and matches.`;
  } else if (current === 'free') {
    summary = `Starts ${labelOf(options, nextPlan)} with a fresh term and a full unlock allowance.`;
  } else {
    summary = `Cancels ${labelOf(options, current)} (remaining term and unlock count are discarded) and starts ${labelOf(options, nextPlan)} with a fresh term and a full unlock allowance.`;
  }

  return (
    <div className="space-y-3 mb-4">
      <p className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${same ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600'}`}>
        <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
        <span>{summary}</span>
      </p>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="override-reason">
          Reason (recorded in the audit log)
        </label>
        <textarea
          id="override-reason"
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="e.g. Comped after a failed payment (support ticket 123)"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {problem && !same && <p className="text-xs text-gray-400 mt-1">{problem}</p>}
      </div>
    </div>
  );
}

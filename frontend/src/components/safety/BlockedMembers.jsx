/**
 * BlockedMembers — the list behind "you can unblock later from Settings".
 * Four states: loading, error (retry), empty, list.
 */

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getBlockedMembers, unblockMember } from '../../api/safety';
import { Skeleton, ErrorState } from '../ui';

const nameOf = (block) => {
  const p = block.BlockedUser?.Profile;
  const full = [p?.firstName, p?.lastName].filter(Boolean).join(' ');
  return full || 'Member';
};

const BlockedMembers = () => {
  const [state, setState] = useState('loading'); // loading | error | ready
  const [blocks, setBlocks] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      setBlocks(await getBlockedMembers());
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const unblock = async (block) => {
    setBusyId(block.blockedUserId);
    try {
      await unblockMember(block.blockedUserId);
      setBlocks((prev) => prev.filter((b) => b.blockedUserId !== block.blockedUserId));
      toast.success(`${nameOf(block)} is unblocked`);
    } catch {
      toast.error("Couldn't unblock. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (state === 'loading') {
    return (
      <div className="max-w-xl space-y-3" aria-busy="true">
        {[0, 1].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <ErrorState
        className="max-w-xl"
        title="Couldn't load blocked members"
        description="Your blocks are still in place. Try again."
        onRetry={load}
      />
    );
  }

  if (blocks.length === 0) {
    return (
      <p className="max-w-xl text-sm text-neutral-500 dark:text-neutral-400">
        You haven&apos;t blocked anyone. Use the More menu on a profile or chat to block or report a member.
      </p>
    );
  }

  return (
    <ul className="max-w-xl divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
      {blocks.map((block) => (
        <li key={block.id || block.blockedUserId} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{nameOf(block)}</p>
            {block.BlockedUser?.Profile?.city && (
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{block.BlockedUser.Profile.city}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => unblock(block)}
            disabled={busyId === block.blockedUserId}
            className="min-h-[44px] flex-shrink-0 rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 transition-colors duration-[160ms] hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {busyId === block.blockedUserId ? 'Unblocking…' : 'Unblock'}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default BlockedMembers;

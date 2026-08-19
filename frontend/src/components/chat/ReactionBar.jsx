/**
 * Reactions — D2. Two pieces:
 *  - ReactionPicker: the 6-emoji allowlist row (shared constant mirror),
 *    shown from the bubble's hover/focus affordance. Premium-only; the parent
 *    renders a neutral lock (DS7 — never gold) for free members.
 *  - ReactionPills: existing reactions under a bubble; tap toggles own.
 */

// Mirror of shared/src/constants/chat.ts REACTION_EMOJIS (server enforces).
export const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🙏'];

export const ReactionPicker = ({ onPick, onClose }) => (
  <div
    role="menu"
    aria-label="React to message"
    className="flex items-center gap-0.5 bg-white dark:bg-[#1a1f2e] rounded-full shadow-lg border border-neutral-200 dark:border-neutral-700 px-1.5 py-1"
  >
    {REACTION_EMOJIS.map((e) => (
      <button
        key={e}
        role="menuitem"
        onClick={() => { onPick(e); onClose(); }}
        className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-lg leading-none transition-transform hover:scale-110"
        aria-label={`React ${e}`}
      >
        {e}
      </button>
    ))}
  </div>
);

export const ReactionPills = ({ reactions, myUserId, onToggle, canReact }) => {
  const entries = Object.entries(reactions || {}).filter(([, users]) => users?.length);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([emoji, users]) => {
        const mine = users.includes(myUserId);
        return (
          <button
            key={emoji}
            onClick={() => canReact && onToggle(emoji)}
            disabled={!canReact}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
              mine
                ? 'bg-primary-50 border-primary-300 dark:bg-primary-900/30'
                : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
            } ${canReact ? 'hover:border-primary-300' : 'cursor-default'}`}
            aria-label={`${emoji} ${users.length}${mine ? ' (you reacted)' : ''}`}
          >
            <span>{emoji}</span>
            {users.length > 1 && <span className="tabular-nums text-neutral-500">{users.length}</span>}
          </button>
        );
      })}
    </div>
  );
};

/**
 * MessageBubble — one message row, extracted from the 977-line Chat.jsx.
 * Renders: text or voice bubble, quote-reply block, hover actions
 * (react / reply / edit / delete), reaction pills, ticks, edit-in-place.
 *
 * DS7: for free members the react/reply affordances render NEUTRAL (muted icon
 * + small lock glyph), never gold — tapping opens the upgrade modal.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiEdit2, FiTrash2, FiX, FiSmile, FiCornerUpLeft, FiLock } from 'react-icons/fi';
import { BsCheck, BsCheckAll } from 'react-icons/bs';
import { sanitizeText } from '../../utils/sanitize';
import VoiceBubble from './VoiceBubble';
import { ReactionPicker, ReactionPills } from './ReactionBar';
import { listRow } from '../../utils/animations';

// Mouse-only hover (doctrine §4.7 / Ruling 16), same gate Chat.jsx/
// ReactionBar.jsx/VoiceRecorder.jsx already use. The toolbar reveal below
// was the one hover affordance in this feature that had drifted from it —
// on a touch device an ungated `group-hover` can latch the action toolbar
// visibly open over the next bubble after a tap, with no hover-out event to
// release it. Tap (`actionsOpen`) and keyboard (`group-focus-within`) reveal
// it unconditionally; only the mouse-hover path is gated.
const GROUP_HOVER = '[@media(hover:hover)_and_(pointer:fine)]:group-hover';

const MessageTicks = ({ message, isSent }) => {
  if (!isSent) return null;
  if (message.isRead) {
    // "Read" is a state indicator, not a premium mark — info (blue) is the
    // universal read-receipt convention and the doctrine-sanctioned semantic
    // tone for state (doctrine §3.1); gold is reserved for paid tiers.
    return <span className="inline-flex items-center ml-1" title="Read"><BsCheckAll className="w-4 h-4 text-info" /></span>;
  }
  if (message.deliveredAt) {
    return <span className="inline-flex items-center ml-1"><BsCheckAll className="w-4 h-4 text-white/60" /></span>;
  }
  return <span className="inline-flex items-center ml-1"><BsCheck className="w-4 h-4 text-white/60" /></span>;
};

const QuoteBlock = ({ replyTo, isSentByMe, myUserId }) => {
  if (!replyTo) return null;
  const label = replyTo.senderId === myUserId ? 'You' : '';
  return (
    <div className={`mb-1.5 px-3 py-1.5 rounded-lg border-l-2 text-xs ${
      isSentByMe ? 'bg-white/15 border-white/50 text-white/85' : 'bg-neutral-100 dark:bg-neutral-800 border-primary-300 text-neutral-500 dark:text-neutral-400'
    }`}>
      {label && <span className="font-semibold mr-1">{label}</span>}
      <span className="line-clamp-2">
        {replyTo.messageType === 'voice' ? 'Voice message' : sanitizeText(replyTo.content)}
      </span>
    </div>
  );
};

const MessageBubble = ({
  message,
  myUserId,
  canRich,          // premium: reactions + reply-quote enabled
  canEdit,
  isEditing,
  editContent,
  setEditContent,
  editInputRef,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  showDeleteConfirm,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  onReact,
  onReply,
  onLockedAffordance, // free member tapped a premium affordance
}) => {
  const isSentByMe = message.senderId === myUserId;
  const isVoice = message.messageType === 'voice';
  // Doctrine Ruling 16: no affordance may exist only in hover — half our
  // traffic is touch, which has no hover at all. Tapping the bubble itself
  // is the fallback reveal; hover and keyboard focus still work alongside it.
  const [actionsOpen, setActionsOpen] = useState(false);
  const toggleActions = () => {
    if (!isEditing && !showDeleteConfirm) setActionsOpen((open) => !open);
  };

  // Doctrine §6: overlays close on Escape. The reaction picker already does
  // this (ReactionBar.jsx); the delete confirmation floats in the same slot
  // and needs the same escape hatch for a keyboard user.
  useEffect(() => {
    if (!showDeleteConfirm) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCancelDelete(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDeleteConfirm, onCancelDelete]);

  return (
    // Messages are the highest-frequency motion event in the product
    // (doctrine §4.1/§4.5): `listRow` is transition-based, not a `@keyframes`
    // animation, so a message sent while a previous one is still entering
    // retargets smoothly instead of restarting from zero.
    <motion.div {...listRow} className={`mb-3 flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`group relative flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isSentByMe ? 'flex-row-reverse' : ''}`}>
        {/* Actions toolbar — reachable by mouse hover, keyboard focus, AND a
            tap on the bubble (doctrine Ruling 16: no affordance may exist
            only in hover; touch has no hover event at all). Floats above the
            bubble, out of the flex flow, so 44px targets never squeeze the
            message text into a narrower column. Hidden while the reaction
            picker is open so the two floating toolbars never overlap. */}
        {!isEditing && !showDeleteConfirm && !pickerOpen && (
          <div
            className={`absolute -top-14 ${isSentByMe ? 'right-0' : 'left-0'} z-20 flex items-center gap-1 transition-opacity duration-[160ms] ${
              actionsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            } ${GROUP_HOVER}:opacity-100 ${GROUP_HOVER}:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto`}
          >
            {/* React */}
            <button
              onClick={() => (canRich ? (pickerOpen ? onClosePicker() : onOpenPicker(message.id)) : onLockedAffordance('Reactions'))}
              className="relative flex items-center justify-center w-11 h-11 rounded-full bg-white/90 dark:bg-surface-dark-3/90 hover:bg-white dark:hover:bg-surface-dark-3 text-neutral-400 hover:text-primary-500 transition-colors shadow-md"
              aria-label={canRich ? 'React to message' : 'Reactions — premium feature'}
            >
              <FiSmile className="w-4 h-4" />
              {!canRich && <FiLock className="w-2.5 h-2.5 absolute top-1 right-1 text-neutral-400" aria-hidden="true" />}
            </button>
            {/* Reply-quote */}
            <button
              onClick={() => (canRich ? onReply(message) : onLockedAffordance('Quote replies'))}
              className="relative flex items-center justify-center w-11 h-11 rounded-full bg-white/90 dark:bg-surface-dark-3/90 hover:bg-white dark:hover:bg-surface-dark-3 text-neutral-400 hover:text-primary-500 transition-colors shadow-md"
              aria-label={canRich ? 'Reply to message' : 'Quote replies — premium feature'}
            >
              <FiCornerUpLeft className="w-4 h-4" />
              {!canRich && <FiLock className="w-2.5 h-2.5 absolute top-1 right-1 text-neutral-400" aria-hidden="true" />}
            </button>
            {isSentByMe && canEdit && !isVoice && (
              <button
                onClick={() => onStartEdit(message)}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-white/90 dark:bg-surface-dark-3/90 hover:bg-white dark:hover:bg-surface-dark-3 text-neutral-400 hover:text-primary-500 transition-colors shadow-md"
                aria-label="Edit message"
              >
                <FiEdit2 className="w-4 h-4" />
              </button>
            )}
            {isSentByMe && (
              <button
                onClick={() => onAskDelete(message.id)}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-white/90 dark:bg-surface-dark-3/90 hover:bg-white dark:hover:bg-surface-dark-3 text-neutral-400 hover:text-destructive transition-colors shadow-md"
                aria-label="Delete message"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Delete confirmation — floats in the same slot as the toolbar. */}
        {showDeleteConfirm && (
          <div className={`absolute -top-14 ${isSentByMe ? 'right-0' : 'left-0'} z-20 flex items-center gap-1.5 bg-white dark:bg-neutral-900 rounded-full pl-4 pr-1.5 py-1.5 shadow-md`}>
            <span className="text-xs text-destructive font-medium whitespace-nowrap">Delete?</span>
            {/* min-w/min-h in rem, not px (doctrine §3.5 elder mode >= 48px):
                a literal [44px] stays fixed at html.elder's 18.5px root,
                landing 4px short; 2.75rem scales with it like the w-11/h-11
                icon buttons above already do. */}
            <button onClick={() => onConfirmDelete(message.id)} className="min-w-[2.75rem] min-h-[2.75rem] px-3 rounded-full bg-destructive hover:bg-destructive/90 text-white text-xs font-medium transition-colors">Yes</button>
            <button onClick={onCancelDelete} className="min-w-[2.75rem] min-h-[2.75rem] px-3 rounded-full bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 text-xs font-medium transition-colors">No</button>
          </div>
        )}

        {/* Reaction picker (anchored above bubble) */}
        {pickerOpen && (
          <div className="absolute -top-14 z-30">
            <ReactionPicker onPick={(emoji) => onReact(message.id, emoji)} onClose={onClosePicker} />
          </div>
        )}

        {/* Bubble — tapping it is the touch fallback that reveals the
            toolbar above (see actionsOpen). */}
        <div>
          <div
            onClick={toggleActions}
            className={`relative px-4 py-2.5 rounded-2xl shadow-sm ${isSentByMe ? 'message-sent' : 'message-received'}`}
          >
            {isEditing ? (
              <div className="space-y-2 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={editInputRef}
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  aria-label="Edit message text"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveEdit(message.id); }
                    else if (e.key === 'Escape') onCancelEdit();
                  }}
                  className="w-full px-3 py-1.5 rounded-lg text-neutral-800 text-sm bg-white/90 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  autoFocus
                />
                <div className="flex justify-end gap-1">
                  <button type="button" onClick={onCancelEdit} className="flex items-center justify-center w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors" title="Cancel (Esc)" aria-label="Cancel edit">
                    <FiX className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onSaveEdit(message.id)} className="flex items-center justify-center w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors" title="Save (Enter)" aria-label="Save edit">
                    <FiCheck className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <QuoteBlock replyTo={message.ReplyTo} isSentByMe={isSentByMe} myUserId={myUserId} />
                {isVoice ? (
                  <VoiceBubble mediaUrl={message.mediaUrl} durationMs={message.mediaDurationMs} light={isSentByMe} />
                ) : (
                  <p className="break-words text-[15px] leading-relaxed">{sanitizeText(message.content)}</p>
                )}
                <div className={`flex items-center justify-end gap-1.5 mt-1 ${isSentByMe ? 'text-white/70' : 'text-neutral-400'}`}>
                  {message.isEdited && <span className="text-[10px] italic">edited</span>}
                  <span className="text-[10px]">
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <MessageTicks message={message} isSent={isSentByMe} />
                </div>
              </>
            )}
          </div>
          <ReactionPills
            reactions={message.reactions}
            myUserId={myUserId}
            canReact={canRich}
            onToggle={(emoji) => onReact(message.id, emoji)}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;

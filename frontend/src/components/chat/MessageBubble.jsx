/**
 * MessageBubble — one message row, extracted from the 977-line Chat.jsx.
 * Renders: text or voice bubble, quote-reply block, hover actions
 * (react / reply / edit / delete), reaction pills, ticks, edit-in-place.
 *
 * DS7: for free members the react/reply affordances render NEUTRAL (muted icon
 * + small lock glyph), never gold — tapping opens the upgrade modal.
 */

import { FiCheck, FiEdit2, FiTrash2, FiX, FiSmile, FiCornerUpLeft, FiLock } from 'react-icons/fi';
import { BsCheck, BsCheckAll } from 'react-icons/bs';
import { sanitizeText } from '../../utils/sanitize';
import VoiceBubble from './VoiceBubble';
import { ReactionPicker, ReactionPills } from './ReactionBar';

const MessageTicks = ({ message, isSent }) => {
  if (!isSent) return null;
  if (message.isRead) {
    return <span className="inline-flex items-center ml-1" title="Read"><BsCheckAll className="w-4 h-4 text-gold-400" /></span>;
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

  return (
    <div className={`mb-3 flex message-enter ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`group relative flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isSentByMe ? 'flex-row-reverse' : ''}`}>
        {/* Hover actions */}
        {!isEditing && !showDeleteConfirm && (
          <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-200 flex items-center gap-0.5 mb-1">
            {/* React */}
            <button
              onClick={() => (canRich ? (pickerOpen ? onClosePicker() : onOpenPicker(message.id)) : onLockedAffordance('Reactions'))}
              className="p-1.5 rounded-full bg-white/80 hover:bg-white text-neutral-400 hover:text-primary-500 transition-colors shadow-sm relative"
              aria-label={canRich ? 'React to message' : 'Reactions — premium feature'}
            >
              <FiSmile className="w-3 h-3" />
              {!canRich && <FiLock className="w-2 h-2 absolute -top-0.5 -right-0.5 text-neutral-400" aria-hidden="true" />}
            </button>
            {/* Reply-quote */}
            <button
              onClick={() => (canRich ? onReply(message) : onLockedAffordance('Quote replies'))}
              className="p-1.5 rounded-full bg-white/80 hover:bg-white text-neutral-400 hover:text-primary-500 transition-colors shadow-sm relative"
              aria-label={canRich ? 'Reply to message' : 'Quote replies — premium feature'}
            >
              <FiCornerUpLeft className="w-3 h-3" />
              {!canRich && <FiLock className="w-2 h-2 absolute -top-0.5 -right-0.5 text-neutral-400" aria-hidden="true" />}
            </button>
            {isSentByMe && canEdit && !isVoice && (
              <button
                onClick={() => onStartEdit(message)}
                className="p-1.5 rounded-full bg-white/80 hover:bg-white text-neutral-400 hover:text-primary-500 transition-colors shadow-sm"
                aria-label="Edit message"
              >
                <FiEdit2 className="w-3 h-3" />
              </button>
            )}
            {isSentByMe && (
              <button
                onClick={() => onAskDelete(message.id)}
                className="p-1.5 rounded-full bg-white/80 hover:bg-white text-neutral-400 hover:text-destructive transition-colors shadow-sm"
                aria-label="Delete message"
              >
                <FiTrash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="flex items-center gap-1 mb-1 bg-white rounded-full px-3 py-1.5 shadow-md border border-destructive-light">
            <span className="text-xs text-destructive font-medium">Delete?</span>
            <button onClick={() => onConfirmDelete(message.id)} className="px-2 py-0.5 rounded-full bg-destructive hover:bg-destructive/90 text-white text-xs font-medium transition-colors">Yes</button>
            <button onClick={onCancelDelete} className="px-2 py-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 text-neutral-600 text-xs font-medium transition-colors">No</button>
          </div>
        )}

        {/* Reaction picker (anchored above bubble) */}
        {pickerOpen && (
          <div className="absolute -top-10 z-30">
            <ReactionPicker onPick={(emoji) => onReact(message.id, emoji)} onClose={onClosePicker} />
          </div>
        )}

        {/* Bubble */}
        <div>
          <div className={`relative px-4 py-2.5 rounded-2xl shadow-sm ${isSentByMe ? 'message-sent' : 'message-received'}`}>
            {isEditing ? (
              <div className="space-y-2 min-w-[200px]">
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
                  <button type="button" onClick={onCancelEdit} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors" title="Cancel (Esc)" aria-label="Cancel edit">
                    <FiX className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onSaveEdit(message.id)} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors" title="Save (Enter)" aria-label="Save edit">
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
    </div>
  );
};

export default MessageBubble;

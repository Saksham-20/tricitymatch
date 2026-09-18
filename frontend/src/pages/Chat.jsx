import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiSend, FiMessageCircle, FiChevronLeft, FiMoreVertical, FiLock, FiMic, FiX, FiCornerUpLeft } from 'react-icons/fi';
import { API_BASE_URL } from '../utils/api';
import { getImageUrl } from '../utils/cloudinary';
import { sanitizeText } from '../utils/sanitize';
import UpgradeModal from '../components/common/UpgradeModal';
import MessageBubble from '../components/chat/MessageBubble';
import VoiceRecorder from '../components/chat/VoiceRecorder';
import ReplyMeter from '../components/chat/ReplyMeter';
import PaywalledComposer from '../components/chat/PaywalledComposer';
import FirstReplyUpsell, { upsellSeenKey } from '../components/chat/FirstReplyUpsell';
import RetryImage from '../components/ui/RetryImage';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { listRow } from '../utils/animations';

// Mouse-only hover lift (doctrine §4.7) — computed once so a touch tap never
// leaves a button visually "raised" with no un-hover event to release it.
const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover';

// Environment check for logging
const isDev = import.meta.env.DEV;

// Custom scrollbar styles (injected once). The typing-indicator keyframes
// used to be redeclared here too — that was a verbatim duplicate of
// `.typing-indicator span` + `@keyframes typingBounce` already defined
// globally in index.css (which is also where the reduced-motion override
// that turns the dots into the word "typing" lives). A second copy appended
// to <head> on mount would win the cascade over the original and could
// silently drift out of sync with it, so only the scrollbar rules — which
// have no global equivalent — are injected here.
const scrollbarStyles = `
  .chat-scrollbar::-webkit-scrollbar { width: 6px; }
  .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.5); border-radius: 3px; }
  .chat-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(156, 163, 175, 0.7); }
  .sidebar-scrollbar::-webkit-scrollbar { width: 4px; }
  .sidebar-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .sidebar-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.3); border-radius: 2px; }
`;

// Typing indicator component. Elevation declared once — shadow only, no
// border (doctrine §3.4: never both on the same element).
const TypingIndicator = () => (
  <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-2xl rounded-bl-sm shadow-sm w-fit">
    <div className="typing-indicator flex gap-1">
      <span className="w-2 h-2 bg-primary-300 rounded-full"></span>
      <span className="w-2 h-2 bg-primary-300 rounded-full"></span>
      <span className="w-2 h-2 bg-primary-300 rounded-full"></span>
    </div>
  </div>
);

// Skeleton mirrors an in-progress thread — a few alternating bubbles, not a
// spinner — so switching conversations never renders as a blank pane while
// loadMessages() is in flight (doctrine §9: loading states match the layout).
const MessagePaneSkeleton = () => (
  <div className="space-y-4" aria-hidden="true">
    {[0, 1, 2, 3, 4].map((i) => (
      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
        <Skeleton className={`h-10 rounded-2xl ${i % 2 === 0 ? 'w-2/5' : 'w-1/3'}`} />
      </div>
    ))}
  </div>
);

// Date separator component
const DateSeparator = ({ date }) => (
  <div className="flex items-center justify-center my-4" role="separator">
    <div className="px-3 py-1 bg-neutral-200/80 dark:bg-neutral-800/80 rounded-full">
      <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">{date}</span>
    </div>
  </div>
);

// Sidebar avatar with initials fallback
const ConversationAvatar = ({ name, photo, size = 'w-14 h-14', textSize = 'text-lg' }) => (
  photo ? (
    <>
      <RetryImage
        src={getImageUrl(photo, API_BASE_URL, 'thumbnail')}
        alt={name || 'Profile'}
        className={`${size} rounded-full object-cover ring-2 ring-white shadow-md`}
        loading="lazy"
        onError={(e) => {
          e.target.style.display = 'none';
          if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
        }}
      />
      <div className={`${size} rounded-full bg-gradient-hero flex items-center justify-center text-white font-bold ${textSize} ring-2 ring-white shadow-md hidden`} aria-hidden="true">
        {(name || '?')[0]}
      </div>
    </>
  ) : (
    <div className={`${size} rounded-full bg-gradient-hero flex items-center justify-center text-white font-bold ${textSize} ring-2 ring-white shadow-md`}>
      {(name || '?')[0]}
    </div>
  )
);

const Chat = () => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null); // {userId, name, firstName, profilePhoto, replyWindow, locked}
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  // Per-thread fetch state — switching conversations shows a skeleton, and a
  // dropped fetch that isn't a premium-access code renders an inline retry
  // instead of an indistinguishable empty conversation.
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  // A dropped connection is never rendered as "no conversations yet" — that
  // tells a member something false about their own matches.
  const [loadError, setLoadError] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('Chat & Messaging');
  // Access lost WHILE the thread is open — subscription expired, or the flag
  // turned off. Thread stays readable; only the composer closes.
  const [revoked, setRevoked] = useState(false);
  // D1: per-thread access from GET /chat/messages — {reason, replyWindow}.
  const [chatAccess, setChatAccess] = useState(null);
  // Live window state — updated on every send (post-increment) and on the 403
  // backstop; a local timer flips `active` at expiresAt (DS local-timer rule).
  const [replyWindow, setReplyWindow] = useState(null);
  // D2 rich composer state
  const [replyingTo, setReplyingTo] = useState(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [showFirstReplyUpsell, setShowFirstReplyUpsell] = useState(false);

  const chatEverWorked = useRef(false);
  const messagesEndRef = useRef(null);
  const editInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const composerInputRef = useRef(null);

  const isPaid = (user?.subscriptionPlan || 'free') !== 'free';
  // Reactions / voice notes / quote-replies are premium features (DS7:
  // free members see neutral locked affordances).
  const canRich = isPaid;

  // Inject custom scrollbar styles
  useEffect(() => {
    const styleId = 'chat-custom-styles';
    if (!document.getElementById(styleId)) {
      const styleTag = document.createElement('style');
      styleTag.id = styleId;
      styleTag.textContent = scrollbarStyles;
      document.head.appendChild(styleTag);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The mobile conversation-list drawer closes on backdrop click already;
  // Escape closes it the same way (doctrine §6: sheets close on Escape).
  useEffect(() => {
    if (!showMobileSidebar || !selected) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowMobileSidebar(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showMobileSidebar, selected]);

  // DS local-timer: flip the window inactive the moment expiresAt passes —
  // the 403 from the server is the backstop, not the primary UX.
  useEffect(() => {
    if (!replyWindow?.active || !replyWindow?.expiresAt) return undefined;
    const ms = new Date(replyWindow.expiresAt).getTime() - Date.now();
    if (ms <= 0) {
      setReplyWindow((w) => (w ? { ...w, active: false } : w));
      return undefined;
    }
    const t = setTimeout(() => setReplyWindow((w) => (w ? { ...w, active: false } : w)), ms);
    return () => clearTimeout(t);
  }, [replyWindow?.active, replyWindow?.expiresAt]);

  useEffect(() => {
    if (selected && !selected.locked && socket) {
      loadMessages();
      const roomId = [user.id, selected.userId].sort().join('_room_');
      socket.emit('join-room', roomId);

      const isForThread = (m) => m.senderId === selected.userId || m.receiverId === selected.userId;

      // ES1: the server now broadcasts authoritatively from REST — the client
      // listens to the namespaced events and NEVER re-emits messages itself.
      // Dedupe by id: the server emits to the pair room AND the personal room,
      // and our own sends are appended locally from the REST response.
      const addMessage = (message) => {
        if (!message || !isForThread(message)) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          if (message.senderId === user.id) return prev;
          return [...prev, message];
        });
      };

      const onNew = ({ message }) => addMessage(message);
      const onEdited = ({ message }) => {
        if (!message) return;
        setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
      };
      const onDeleted = ({ messageId }) => {
        if (!messageId) return;
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      };
      const onReaction = ({ messageId, reactions }) => {
        if (!messageId) return;
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
      };
      const onTyping = (data) => {
        if (data.userId === selected.userId) setIsTyping(data.isTyping);
      };

      socket.on('message:new', onNew);
      socket.on('message:edited', onEdited);
      socket.on('message:deleted', onDeleted);
      socket.on('message:reaction', onReaction);
      socket.on('user_typing', onTyping);

      return () => {
        socket.emit('leave-room', roomId);
        socket.off('message:new', onNew);
        socket.off('message:edited', onEdited);
        socket.off('message:deleted', onDeleted);
        socket.off('message:reaction', onReaction);
        socket.off('user_typing', onTyping);
        setIsTyping(false);
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, socket, user.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // B1: sidebar now reads /chat/conversations — real previews + unread counts
  // + per-row replyWindow. ES5: for a free member (no free-chat flag), rows
  // WITHOUT a grant render locked; the server keeps returning them.
  const toRow = useCallback((c) => {
    const name = c.user?.name || '';
    const locked =
      (user?.subscriptionPlan || 'free') === 'free' &&
      !user?.features?.freeChatForMutuals &&
      !c.replyWindow;
    return {
      userId: c.userId,
      name,
      firstName: name.split(' ')[0] || '',
      profilePhoto: c.user?.profilePhoto || null,
      lastMessage: c.lastMessage,
      unreadCount: c.unreadCount || 0,
      replyWindow: c.replyWindow || null,
      locked,
    };
  }, [user]);

  const loadConversations = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await api.get('/chat/conversations');
      const rows = (response.data.conversations || []).map(toRow);
      setConversations(rows);
      chatEverWorked.current = true;

      if (rows.length > 0) {
        // Deep-link: /chat?to=<userId> opens that thread; otherwise the first
        // openable one.
        const targetId = searchParams.get('to');
        const target = targetId && rows.find((r) => r.userId === targetId);
        setSelected(target || rows.find((r) => !r.locked) || rows[0]);
        if (targetId) {
          setShowMobileSidebar(false);
          setSearchParams({}, { replace: true });
        }
      }
    } catch (error) {
      if (isDev) console.error('Failed to load conversations:', error.response?.data || error.message);
      if (error.response?.status === 403) {
        const code = error.response?.data?.error?.code;
        if (code === 'PREMIUM_REQUIRED' || code === 'SUBSCRIPTION_EXPIRED') {
          setAccessDenied(true);
          setShowUpgradeModal(true);
        }
      } else {
        setLoadError(true);
        toast.error('Failed to load conversations');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selected) return;
    setMessagesLoading(true);
    setMessagesError(false);
    try {
      const response = await api.get(`/chat/messages/${selected.userId}`);
      setMessages(response.data.messages || []);
      // D1: the thread response carries {reason, replyWindow} — drives the
      // composer state machine (normal / meter / paywalled).
      const access = response.data.chatAccess || null;
      setChatAccess(access);
      setReplyWindow(access?.replyWindow || null);
      chatEverWorked.current = true;
      setRevoked(false);
    } catch (error) {
      if (isDev) console.error('Failed to load messages:', error.response?.data || error.message);
      if (error.response?.status === 403) {
        const code = error.response?.data?.error?.code;
        if (code === 'PREMIUM_REQUIRED' || code === 'SUBSCRIPTION_EXPIRED') {
          if (chatEverWorked.current) {
            setRevoked(true);
            toast.error(error.response?.data?.message || 'Premium subscription required');
          } else {
            setAccessDenied(true);
          }
        } else {
          // Not a premium-access code — a dropped fetch never renders as an
          // empty conversation; the pane shows an explicit retry instead.
          setMessagesError(true);
        }
      } else {
        setMessagesError(true);
      }
    } finally {
      setMessagesLoading(false);
    }
  };

  const appendOwn = (sentMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === sentMessage.id) ? prev : [...prev, sentMessage]));
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const messageContent = newMessage.trim();
    if (!messageContent || !selected || sending) return;

    setNewMessage('');
    setSending(true);

    try {
      const response = await api.post('/chat/messages', {
        receiverId: selected.userId,
        content: messageContent,
        ...(replyingTo ? { replyToId: replyingTo.id } : {}),
      });

      const sentMessage = response.data.message;
      chatEverWorked.current = true;
      appendOwn(sentMessage);
      setReplyingTo(null);

      // D1: post-increment window state → meter + first-reply upsell (DS3:
      // dismissible inline card, once per pair).
      if (response.data.replyWindow) {
        const w = response.data.replyWindow;
        setReplyWindow(w);
        if (w.messagesUsed === 1 && !localStorage.getItem(upsellSeenKey(selected.userId))) {
          setShowFirstReplyUpsell(true);
        }
      }
      // No socket emit: the server broadcasts authoritatively (ES1).
    } catch (error) {
      if (isDev) console.error('Failed to send message:', error.response?.data || error.message);
      setNewMessage(messageContent);
      if (error.response?.status === 403) {
        const errBody = error.response?.data?.error;
        const code = errBody?.code;
        if (code === 'REPLY_WINDOW_ENDED') {
          // 403 backstop: trust the server's state; the paywalled composer
          // takes over (DS1).
          setReplyWindow(errBody.replyWindow || { active: false, messagesRemaining: 0, messagesUsed: 5, firstReplyAt: null, expiresAt: null });
        } else if (code === 'PREMIUM_REQUIRED' || code === 'SUBSCRIPTION_EXPIRED') {
          setRevoked(true);
          toast.error(error.response?.data?.error?.message || 'Premium subscription required to send messages');
        } else {
          toast.error(errBody?.message || 'Failed to send message');
        }
      } else {
        toast.error('Failed to send message');
      }
    } finally {
      setSending(false);
    }
  };

  // D2: voice note — multipart to the dedicated route; server broadcasts.
  const sendVoice = async (blob, durationMs) => {
    const form = new FormData();
    form.append('audio', blob, 'voice-message.webm');
    form.append('receiverId', selected.userId);
    form.append('durationMs', String(Math.round(durationMs)));
    const response = await api.post('/chat/messages/voice', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    appendOwn(response.data.message);
  };

  // D2: reaction toggle — optimistic with revert on failure (DS8).
  const toggleReaction = async (messageId, emoji) => {
    setPickerFor(null);
    const prevMessages = messages;
    setMessages((prev) => prev.map((m) => {
      if (m.id !== messageId) return m;
      const reactions = { ...(m.reactions || {}) };
      const users = new Set(reactions[emoji] || []);
      users.has(user.id) ? users.delete(user.id) : users.add(user.id);
      if (users.size) reactions[emoji] = [...users]; else delete reactions[emoji];
      return { ...m, reactions };
    }));
    try {
      const response = await api.post(`/chat/messages/${messageId}/reactions`, { emoji });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: response.data.reactions } : m)));
    } catch (error) {
      setMessages(prevMessages);
      toast.error(error.response?.data?.error?.message || 'Could not react');
    }
  };

  const startEditing = (message) => {
    setEditingMessage(message.id);
    setEditContent(message.content);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setEditContent('');
  };

  const saveEdit = async (messageId) => {
    if (!editContent.trim()) {
      toast.error('Message cannot be empty');
      return;
    }
    try {
      const response = await api.put(`/chat/messages/${messageId}`, { content: editContent });
      const updatedMessage = response.data.message;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updatedMessage : m)));
      // Server broadcasts the edit (ES1) — no client emit.
      setEditingMessage(null);
      setEditContent('');
      toast.success('Message updated');
    } catch (error) {
      if (isDev) console.error('Failed to edit message:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to edit message');
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await api.delete(`/chat/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      // Server broadcasts the deletion (SOCK-3/ES1) — no client emit.
      setDeleteConfirm(null);
      toast.success('Message deleted');
    } catch (error) {
      if (isDev) console.error('Failed to delete message:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to delete message');
    }
  };

  const canEditMessage = (message) => {
    if (message.senderId !== user.id) return false;
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    return messageAge < 15 * 60 * 1000;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const typingTimeoutRef = useRef(null);
  const handleTyping = (value) => {
    setNewMessage(value);
    if (socket && selected) {
      socket.emit('typing', { receiverId: selected.userId, isTyping: true });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', { receiverId: selected.userId, isTyping: false });
      }, 1500);
    }
  };

  const formatMessageDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let currentDate = null;
    msgs.forEach((message, index) => {
      const messageDate = formatMessageDate(message.createdAt);
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ type: 'date', date: messageDate, key: `date-${index}` });
      }
      groups.push({ type: 'message', message, key: message.id || index });
    });
    return groups;
  };

  const handleSelect = (row) => {
    if (row.locked) {
      // ES5 locked row: readable context, tap explains instead of erroring.
      setUpgradeFeature('Chat & Messaging');
      setShowUpgradeModal(true);
      return;
    }
    setSelected(row);
    setMessages([]);
    setMessagesLoading(true);
    setMessagesError(false);
    setChatAccess(null);
    setReplyWindow(null);
    setShowFirstReplyUpsell(false);
    setReplyingTo(null);
    setShowRecorder(false);
    setShowMobileSidebar(false);
  };

  const openLockedAffordance = (featureLabel) => {
    setUpgradeFeature(featureLabel);
    setShowUpgradeModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#FDF8F2] dark:bg-surface-dark-2 flex">
        {/* Skeleton mirrors the real two-pane layout, not a spinner. */}
        <div className="hidden md:flex w-80 lg:w-96 h-full flex-col bg-white dark:bg-surface-dark-3 border-r border-neutral-200 dark:border-neutral-800 p-4 space-y-4">
          <Skeleton className="h-6 w-32" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton variant="circle" className="w-14 h-14 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 hidden md:flex items-center justify-center">
          <Skeleton variant="circle" className="w-16 h-16" />
        </div>
        <div className="md:hidden w-full p-4 space-y-4">
          <Skeleton className="h-6 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton variant="circle" className="w-14 h-14 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <>
        <div className="min-h-[100dvh] bg-[#FDF8F2] dark:bg-surface-dark-2 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 mx-auto mb-6 bg-gold-50 dark:bg-gold-900/20 border border-gold-100 dark:border-gold-800/40 rounded-full flex items-center justify-center">
              <FiLock className="w-12 h-12 text-gold-600 dark:text-gold-400" />
            </div>
            <h2 className="text-2xl font-bold font-display text-neutral-800 dark:text-neutral-100 mb-3">Chat is a premium feature</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
              Unlock messaging to connect with your matches. Upgrade to a premium plan today.
            </p>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-hero text-white rounded-xl font-semibold ${HOVER}:shadow-burgundy ${HOVER}:scale-105 transition-[transform,box-shadow] duration-[160ms]`}
            >
              Upgrade now
            </button>
          </div>
        </div>
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} feature="Chat & Messaging" />
      </>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[100dvh] bg-[#FDF8F2] dark:bg-surface-dark-2 flex items-center justify-center p-4">
        <ErrorState
          title="Couldn't load your conversations"
          description="The connection dropped before this finished loading. Your messages are safe. Try again."
          onRetry={loadConversations}
          className="max-w-md"
        />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="min-h-[100dvh] bg-[#FDF8F2] dark:bg-surface-dark-2 flex items-center justify-center p-4">
        <EmptyState
          icon={FiMessageCircle}
          title="Chat opens when you both match"
          description="When you and someone else both like each other, you'll be able to start a conversation here."
          actionLabel="Find your match"
          onAction={() => navigate('/search')}
          className="max-w-md"
        />
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(messages);
  // Composer state machine: grant thread → active (meter) or ended (paywall).
  const isGrantThread = chatAccess?.reason === 'free_reply_window';
  const windowEnded = isGrantThread && replyWindow && !replyWindow.active;
  const endReason = replyWindow?.messagesRemaining === 0 ? 'exhausted' : 'expired';

  return (
    <div className="h-[calc(100dvh-8rem)] md:h-[100dvh] -mb-24 md:mb-0 flex bg-neutral-100 dark:bg-surface-dark-2 overflow-hidden">
      {/* Conversations Sidebar */}
      <div className={`
        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        absolute md:relative z-20 w-full md:w-80 lg:w-96 h-full
        bg-white dark:bg-surface-dark-3 border-r border-neutral-200 dark:border-neutral-800 flex flex-col
        transition-transform duration-300 ease-[var(--ease-drawer)]
      `}>
        <div className="relative p-4 border-b border-neutral-100 dark:border-neutral-800 bg-primary-50 dark:bg-primary-900/20 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary-500 to-primary-700" />
          <h2 className="text-xl font-bold font-display text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <FiMessageCircle className="w-6 h-6 text-primary-500" />
            Messages
          </h2>
          <p className="text-neutral-500 text-sm mt-1">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex-1 overflow-y-auto sidebar-scrollbar">
          {conversations.map((row) => {
            const isSelected = selected?.userId === row.userId;
            const preview = row.lastMessage
              ? (row.lastMessage.messageType === 'voice' ? 'Voice message' : sanitizeText(row.lastMessage.content))
              : 'Say hello';
            return (
              // A real <button>, not a clickable <div> — conversation switching is
              // the primary navigation in this screen, and a <div onClick> is
              // invisible to Tab (doctrine §9 Access: full keyboard path). The
              // global :focus-visible rule (index.css) applies to any `button`
              // automatically once it's a real button.
              <button
                key={row.userId}
                type="button"
                onClick={() => handleSelect(row)}
                aria-current={isSelected ? 'true' : undefined}
                className={`
                  relative w-full text-left p-4 transition-[background-color,border-color] duration-[160ms]
                  hover:bg-primary-50 dark:hover:bg-primary-900/20 border-l-4
                  ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20 border-l-primary-500' : 'border-l-transparent hover:border-l-primary-300'}
                  ${row.locked ? 'opacity-70' : ''}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <ConversationAvatar name={row.firstName} photo={row.profilePhoto} />
                    {row.unreadCount > 0 && !row.locked && (
                      <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-primary-600 text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
                        {row.unreadCount > 9 ? '9+' : row.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold truncate flex items-center gap-1.5 ${isSelected ? 'text-primary-600' : 'text-neutral-800 dark:text-neutral-100'}`}>
                        {row.name}
                        {row.locked && <FiLock className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" aria-label="Premium required" />}
                      </h3>
                      <span className="text-xs text-neutral-400 flex-shrink-0">
                        {row.lastMessage?.createdAt
                          ? new Date(row.lastMessage.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : ''}
                      </span>
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${row.unreadCount > 0 && !row.locked ? 'text-neutral-800 dark:text-neutral-200 font-medium' : 'text-neutral-500'}`}>
                      {row.locked ? 'Upgrade to open this conversation' : preview}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected && !selected.locked ? (
          <>
            {/* Chat Header */}
            <div className="flex-shrink-0 px-4 py-3 bg-white dark:bg-surface-dark-3 border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    aria-label="Back to conversations"
                    className="md:hidden p-3 -ml-3 hover:bg-neutral-100 rounded-full transition-colors"
                  >
                    <FiChevronLeft className="w-5 h-5 text-neutral-600" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${selected.userId}`)}
                    className="flex items-center gap-3 -m-1 p-1 rounded-xl hover:bg-neutral-100 transition-colors text-left"
                    aria-label={`View ${selected.firstName || 'match'}'s profile`}
                  >
                    <div className="relative">
                      <ConversationAvatar name={selected.firstName} photo={selected.profilePhoto} size="w-11 h-11" textSize="text-base" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-800 dark:text-neutral-100">{selected.name}</h3>
                      <p className="text-xs text-neutral-400 font-medium">
                        {isTyping ? <span className="text-success">typing…</span> : 'View profile'}
                      </p>
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => navigate(`/profile/${selected.userId}`)}
                  aria-label="View profile"
                  title="View profile"
                  className="p-3 -mr-3 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <FiMoreVertical className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
            </div>

            {/* Messages Container */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto chat-scrollbar px-4 py-4 bg-[#FDF8F2] dark:bg-surface-dark-2"
              role="log"
              aria-label="Chat messages"
            >
              {messagesLoading ? (
                <MessagePaneSkeleton />
              ) : messagesError ? (
                <ErrorState
                  title="Couldn't load this conversation"
                  description="The connection dropped before this finished loading. Nothing here was lost. Try again."
                  onRetry={loadMessages}
                  className="max-w-md mx-auto mt-10"
                />
              ) : (
                <>
                  <div className="flex justify-center mb-6">
                    <div className="px-4 py-2 bg-white/90 backdrop-blur rounded-full shadow-sm border border-gold-200">
                      <p className="text-xs text-neutral-600">
                        You matched with {selected.firstName}. Make a meaningful connection...
                      </p>
                    </div>
                  </div>

                  {groupedMessages.map((item) => {
                    if (item.type === 'date') return <DateSeparator key={item.key} date={item.date} />;
                    const message = item.message;
                    return (
                      <MessageBubble
                        key={item.key}
                        message={message}
                        myUserId={user.id}
                        canRich={canRich}
                        canEdit={canEditMessage(message)}
                        isEditing={editingMessage === message.id}
                        editContent={editContent}
                        setEditContent={setEditContent}
                        editInputRef={editInputRef}
                        onStartEdit={startEditing}
                        onCancelEdit={cancelEditing}
                        onSaveEdit={saveEdit}
                        showDeleteConfirm={deleteConfirm === message.id}
                        onAskDelete={setDeleteConfirm}
                        onConfirmDelete={deleteMessage}
                        onCancelDelete={() => setDeleteConfirm(null)}
                        pickerOpen={pickerFor === message.id}
                        onOpenPicker={setPickerFor}
                        onClosePicker={() => setPickerFor(null)}
                        onReact={toggleReaction}
                        onReply={(m) => { setReplyingTo(m); composerInputRef.current?.focus(); }}
                        onLockedAffordance={openLockedAffordance}
                      />
                    );
                  })}

                  {showFirstReplyUpsell && replyWindow && (
                    <FirstReplyUpsell
                      name={selected.name}
                      remaining={replyWindow.messagesRemaining}
                      onDismiss={() => {
                        localStorage.setItem(upsellSeenKey(selected.userId), '1');
                        setShowFirstReplyUpsell(false);
                      }}
                    />
                  )}

                  {/* Transition-based (doctrine §4.5): the indicator can mount
                      and unmount repeatedly in one session, so it retargets
                      instead of restarting from a hand-rolled @keyframes. */}
                  <AnimatePresence>
                    {isTyping && (
                      <motion.div key="typing" {...listRow} className="mb-3 flex justify-start">
                        <TypingIndicator />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="flex-shrink-0 p-4 bg-white dark:bg-surface-dark-3 border-t border-neutral-200 dark:border-neutral-800">
              {revoked ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-neutral-100 dark:bg-surface-dark-2 px-4 py-3">
                  <FiLock className="w-4 h-4 flex-shrink-0 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
                  <p className="flex-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Your messaging access ended. You can still read this conversation.
                  </p>
                  <Link
                    to="/subscription"
                    className="inline-flex items-center justify-center min-h-[2.75rem] px-5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium transition-colors"
                  >
                    See plans
                  </Link>
                </div>
              ) : windowEnded ? (
                /* DS1: scripted paywalled composer — thread above stays readable. */
                <PaywalledComposer
                  name={selected.name}
                  avatarUrl={selected.profilePhoto ? getImageUrl(selected.profilePhoto, API_BASE_URL, 'avatar') : null}
                  reason={endReason}
                />
              ) : showRecorder ? (
                <div className="rounded-2xl bg-neutral-100 dark:bg-surface-dark-2 px-4 py-3">
                  <VoiceRecorder onSend={sendVoice} onClose={() => setShowRecorder(false)} />
                </div>
              ) : (
                <>
                  {replyingTo && (
                    <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-surface-dark-2 border-l-2 border-primary-400">
                      <FiCornerUpLeft className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" aria-hidden="true" />
                      <p className="flex-1 text-xs text-neutral-500 line-clamp-1">
                        {replyingTo.messageType === 'voice' ? 'Voice message' : sanitizeText(replyingTo.content)}
                      </p>
                      <button onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="flex-shrink-0 flex items-center justify-center min-w-[2.75rem] min-h-[2.75rem] -mr-2 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400">
                        <FiX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <form onSubmit={sendMessage} className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      {/* Visually hidden but real — a placeholder alone is
                          never the label (doctrine §6/§8). */}
                      <label htmlFor="chat-composer-input" className="sr-only">Message</label>
                      <input
                        ref={composerInputRef}
                        id="chat-composer-input"
                        type="text"
                        value={newMessage}
                        onChange={(e) => handleTyping(e.target.value)}
                        placeholder="Make a meaningful connection..."
                        className="w-full px-5 py-3 text-base bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-neutral-900 transition-[background-color,box-shadow] duration-[160ms]"
                        disabled={sending}
                      />
                    </div>

                    {/* Voice note — premium; free members see the neutral
                        locked affordance (DS7), grant threads are text-only. */}
                    {!newMessage.trim() && !isGrantThread && (
                      <button
                        type="button"
                        onClick={() => (canRich ? setShowRecorder(true) : openLockedAffordance('Voice notes'))}
                        aria-label={canRich ? 'Record a voice message' : 'Voice notes — premium feature'}
                        className="relative p-3 rounded-full bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-500 dark:text-neutral-300 transition-colors duration-[160ms]"
                      >
                        <FiMic className="w-5 h-5" />
                        {!canRich && <FiLock className="w-2.5 h-2.5 absolute top-1.5 right-1.5 text-neutral-400" aria-hidden="true" />}
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      aria-label="Send message"
                      className={`
                        p-3 rounded-full transition-[background-color,box-shadow,transform] duration-[160ms]
                        ${newMessage.trim()
                          ? `bg-gradient-hero text-white shadow-burgundy ${HOVER}:shadow-burgundy-lg ${HOVER}:scale-105`
                          : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                      `}
                    >
                      <FiSend className={`w-5 h-5 ${sending ? 'animate-pulse' : ''} ${newMessage.trim() ? '' : 'opacity-50'}`} />
                    </button>
                  </form>
                  {/* DS3: meter last in the hierarchy — muted, warns at ≤2. */}
                  {isGrantThread && <ReplyMeter replyWindow={replyWindow} />}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#FDF8F2] dark:bg-surface-dark-2">
            <div className="text-center p-8">
              <div className="w-32 h-32 mx-auto mb-6 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center">
                <FiMessageCircle className="w-16 h-16 text-primary-400" />
              </div>
              <h3 className="text-xl font-semibold font-display text-neutral-700 mb-2">Start a conversation</h3>
              <p className="text-neutral-500 max-w-sm">
                Select a match from the sidebar to begin your journey of meaningful connection.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile overlay */}
      {showMobileSidebar && selected && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-10" onClick={() => setShowMobileSidebar(false)} />
      )}

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} feature={upgradeFeature} />
    </div>
  );
};

export default Chat;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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

// Environment check for logging
const isDev = import.meta.env.DEV;

// Custom scrollbar styles (injected once)
const scrollbarStyles = `
  .chat-scrollbar::-webkit-scrollbar { width: 6px; }
  .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.5); border-radius: 3px; }
  .chat-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(156, 163, 175, 0.7); }
  .sidebar-scrollbar::-webkit-scrollbar { width: 4px; }
  .sidebar-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .sidebar-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.3); border-radius: 2px; }
  .message-enter { animation: messageSlideIn 0.3s ease-out; }
  @keyframes messageSlideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .typing-indicator span { animation: typingBounce 1.4s infinite ease-in-out; }
  .typing-indicator span:nth-child(1) { animation-delay: 0s; }
  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-4px); }
  }
`;

// Typing indicator component
const TypingIndicator = () => (
  <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-2xl rounded-bl-sm shadow-sm border border-neutral-100 w-fit">
    <div className="typing-indicator flex gap-1">
      <span className="w-2 h-2 bg-primary-300 rounded-full"></span>
      <span className="w-2 h-2 bg-primary-300 rounded-full"></span>
      <span className="w-2 h-2 bg-primary-300 rounded-full"></span>
    </div>
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
  const [sending, setSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
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
        toast.error('Failed to load conversations');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selected) return;
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
          toast.error(error.response?.data?.message || 'Premium subscription required');
        }
      } else {
        toast.error('Failed to load messages');
      }
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
      <div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-primary-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-neutral-500 animate-pulse">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <>
        <div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 mx-auto mb-6 bg-gold-50 border border-gold-100 rounded-full flex items-center justify-center">
              <FiLock className="w-12 h-12 text-gold-600" />
            </div>
            <h2 className="text-2xl font-bold font-display text-neutral-800 mb-3">Chat is a Premium Feature</h2>
            <p className="text-neutral-500 mb-6 leading-relaxed">
              Unlock messaging to connect with your matches. Upgrade to a premium plan today.
            </p>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-hero text-white rounded-full font-semibold hover:shadow-burgundy hover:scale-105 transition-all duration-200"
            >
              Upgrade Now
            </button>
          </div>
        </div>
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} feature="Chat & Messaging" />
      </>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 bg-primary-100 rounded-full flex items-center justify-center">
            <FiMessageCircle className="w-12 h-12 text-primary-400" />
          </div>
          <h2 className="text-2xl font-bold font-display text-neutral-800 mb-3">Chat opens when you both match</h2>
          <p className="text-neutral-500 mb-6 leading-relaxed">
            When you and someone else both like each other, you&apos;ll be able to start a conversation here.
          </p>
          <a
            href="/search"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-hero text-white rounded-full font-semibold hover:shadow-burgundy hover:scale-105 transition-all duration-200"
          >
            Find Your Match
          </a>
        </div>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(messages);
  // Composer state machine: grant thread → active (meter) or ended (paywall).
  const isGrantThread = chatAccess?.reason === 'free_reply_window';
  const windowEnded = isGrantThread && replyWindow && !replyWindow.active;
  const endReason = replyWindow?.messagesRemaining === 0 ? 'exhausted' : 'expired';

  return (
    <div className="h-[calc(100dvh-8rem)] md:h-screen -mb-24 md:mb-0 flex bg-neutral-100 dark:bg-[#14182a] overflow-hidden">
      {/* Conversations Sidebar */}
      <div className={`
        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        absolute md:relative z-20 w-full md:w-80 lg:w-96 h-full
        bg-white dark:bg-[#1a1f2e] border-r border-neutral-200 dark:border-neutral-800 flex flex-col
        transition-transform duration-300 ease-in-out
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
              <div
                key={row.userId}
                onClick={() => handleSelect(row)}
                className={`
                  relative p-4 cursor-pointer transition-all duration-200
                  hover:bg-primary-50 border-l-4
                  ${isSelected ? 'bg-primary-50 border-l-primary-500' : 'border-l-transparent hover:border-l-primary-300'}
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected && !selected.locked ? (
          <>
            {/* Chat Header */}
            <div className="flex-shrink-0 px-4 py-3 bg-white dark:bg-[#1a1f2e] border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    aria-label="Back to conversations"
                    className="md:hidden p-2 -ml-2 hover:bg-neutral-100 rounded-full transition-colors"
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
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <FiMoreVertical className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
            </div>

            {/* Messages Container */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto chat-scrollbar px-4 py-4 bg-[#FDF8F2] dark:bg-[#14182a]"
              role="log"
              aria-label="Chat messages"
            >
              <div className="flex justify-center mb-6">
                <div className="px-4 py-2 bg-white/90 backdrop-blur rounded-full shadow-sm border border-gold-200">
                  <p className="text-xs text-neutral-600">
                    You matched with {selected.firstName}! Make a meaningful connection...
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

              {isTyping && (
                <div className="mb-3 flex justify-start message-enter">
                  <TypingIndicator />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="flex-shrink-0 p-4 bg-white dark:bg-[#1a1f2e] border-t border-neutral-200 dark:border-neutral-800">
              {revoked ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-neutral-100 dark:bg-[#14182a] px-4 py-3">
                  <FiLock className="w-4 h-4 flex-shrink-0 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
                  <p className="flex-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Your messaging access ended. You can still read this conversation.
                  </p>
                  <Link
                    to="/subscription"
                    className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium transition-colors"
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
                <div className="rounded-2xl bg-neutral-100 dark:bg-[#14182a] px-4 py-3">
                  <VoiceRecorder onSend={sendVoice} onClose={() => setShowRecorder(false)} />
                </div>
              ) : (
                <>
                  {replyingTo && (
                    <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-[#14182a] border-l-2 border-primary-400">
                      <FiCornerUpLeft className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" aria-hidden="true" />
                      <p className="flex-1 text-xs text-neutral-500 line-clamp-1">
                        {replyingTo.messageType === 'voice' ? 'Voice message' : sanitizeText(replyingTo.content)}
                      </p>
                      <button onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="p-1 rounded-full hover:bg-neutral-200 text-neutral-400">
                        <FiX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <form onSubmit={sendMessage} className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <input
                        ref={composerInputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => handleTyping(e.target.value)}
                        placeholder="Make a meaningful connection..."
                        aria-label="Type your message"
                        className="w-full px-5 py-3 bg-neutral-100 rounded-full text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all duration-200"
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
                        className="relative p-3 rounded-full bg-neutral-200 hover:bg-neutral-300 text-neutral-500 transition-colors"
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
                        p-3 rounded-full transition-all duration-200
                        ${newMessage.trim()
                          ? 'bg-gradient-hero text-white shadow-burgundy hover:shadow-burgundy-lg hover:scale-105'
                          : 'bg-neutral-200 text-neutral-400'
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
          <div className="flex-1 flex items-center justify-center bg-[#FDF8F2]">
            <div className="text-center p-8">
              <div className="w-32 h-32 mx-auto mb-6 bg-primary-100 rounded-full flex items-center justify-center">
                <FiMessageCircle className="w-16 h-16 text-primary-400" />
              </div>
              <h3 className="text-xl font-semibold font-display text-neutral-700 mb-2">Start a Conversation</h3>
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

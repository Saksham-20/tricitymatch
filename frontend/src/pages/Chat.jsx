import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiSend, FiMessageCircle, FiCheck, FiEdit2, FiTrash2, FiX, FiChevronLeft, FiMoreVertical, FiSmile } from 'react-icons/fi';
import { BsCheck, BsCheckAll, BsEmojiSmile } from 'react-icons/bs';
import { HiOutlinePhotograph } from 'react-icons/hi';
import { API_BASE_URL } from '../utils/api';
import { getImageUrl } from '../utils/cloudinary';

// Custom scrollbar styles (injected once)
const scrollbarStyles = `
  .chat-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .chat-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .chat-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.5);
    border-radius: 3px;
  }
  .chat-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.7);
  }
  .sidebar-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .sidebar-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .sidebar-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.3);
    border-radius: 2px;
  }
  .message-enter {
    animation: messageSlideIn 0.3s ease-out;
  }
  @keyframes messageSlideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .typing-indicator span {
    animation: typingBounce 1.4s infinite ease-in-out;
  }
  .typing-indicator span:nth-child(1) { animation-delay: 0s; }
  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-4px); }
  }
`;

// Message status tick component - WhatsApp style
const MessageTicks = ({ message, isSent }) => {
  if (!isSent) return null;
  
  if (message.isRead) {
    return (
      <span className="inline-flex items-center ml-1">
        <BsCheckAll className="w-4 h-4 text-blue-400" />
      </span>
    );
  }
  
  if (message.deliveredAt) {
    return (
      <span className="inline-flex items-center ml-1">
        <BsCheckAll className="w-4 h-4 text-white/60" />
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center ml-1">
      <BsCheck className="w-4 h-4 text-white/60" />
    </span>
  );
};

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
    <div className="px-3 py-1 bg-neutral-200/80 rounded-full">
      <span className="text-xs text-neutral-600 font-medium">{date}</span>
    </div>
  </div>
);

const Chat = () => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const messagesEndRef = useRef(null);
  const editInputRef = useRef(null);
  const chatContainerRef = useRef(null);

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
    loadMutualMatches();
  }, []);

  useEffect(() => {
    if (selectedMatch && socket) {
      loadMessages();
      // Use _room_ as separator since UUIDs contain hyphens
      const roomId = [user.id, selectedMatch.userId].sort().join('_room_');
      socket.emit('join-room', roomId);

      socket.on('message', (message) => {
        // Only process messages for this conversation
        if (message.senderId === selectedMatch.userId || message.receiverId === selectedMatch.userId) {
          // Prevent duplicates: don't add if we sent it (already added locally)
          // and check if message already exists by ID
          setMessages(prev => {
            // Skip if message already exists
            if (prev.some(m => m.id === message.id)) {
              return prev;
            }
            // Skip if we sent this message (already added when sending)
            if (message.senderId === user.id) {
              return prev;
            }
            return [...prev, message];
          });
        }
      });

      // Handle edited messages from other user
      socket.on('message-edited', (data) => {
        if (data.message) {
          setMessages(prev => prev.map(m => 
            m.id === data.message.id ? data.message : m
          ));
        }
      });

      // Handle deleted messages from other user
      socket.on('message-deleted', (data) => {
        if (data.messageId) {
          setMessages(prev => prev.filter(m => m.id !== data.messageId));
        }
      });

      // Handle typing indicator
      socket.on('user_typing', (data) => {
        if (data.userId === selectedMatch.userId) {
          setIsTyping(data.isTyping);
        }
      });

      return () => {
        socket.emit('leave-room', roomId);
        socket.off('message');
        socket.off('message-edited');
        socket.off('message-deleted');
        socket.off('user_typing');
        setIsTyping(false);
      };
    }
  }, [selectedMatch, socket, user.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMutualMatches = async () => {
    try {
      const response = await api.get('/match/mutual');
      console.log('Mutual matches response:', response.data);
      
      const mutualMatches = response.data.mutualMatches || [];
      setMatches(mutualMatches);
      
      if (mutualMatches.length > 0) {
        setSelectedMatch(mutualMatches[0]);
      }
    } catch (error) {
      console.error('Failed to load mutual matches:', error.response?.data || error.message);
      // Don't show error toast for 403 (no subscription) - show empty state instead
      if (error.response?.status !== 403) {
        toast.error('Failed to load matches');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedMatch) return;
    try {
      const response = await api.get(`/chat/messages/${selectedMatch.userId}`);
      console.log('Messages response:', response.data);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error.response?.data || error.message);
      if (error.response?.status === 403) {
        toast.error(error.response?.data?.message || 'Premium subscription required');
      } else {
        toast.error('Failed to load messages');
      }
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const messageContent = newMessage.trim();
    if (!messageContent || !selectedMatch || sending) return;

    // Clear input immediately for better UX
    setNewMessage('');
    setSending(true);

    try {
      const response = await api.post('/chat/messages', {
        receiverId: selectedMatch.userId,
        content: messageContent
      });

      const sentMessage = response.data.message;
      
      // Add message to local state
      setMessages(prev => {
        // Check if already exists (prevent duplicates)
        if (prev.some(m => m.id === sentMessage.id)) {
          return prev;
        }
        return [...prev, sentMessage];
      });

      // Broadcast via socket for real-time delivery to receiver
      if (socket) {
        const roomId = [user.id, selectedMatch.userId].sort().join('_room_');
        socket.emit('send-message', {
          roomId,
          message: sentMessage
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error.response?.data || error.message);
      // Restore the message if failed
      setNewMessage(messageContent);
      if (error.response?.status === 403) {
        toast.error(error.response?.data?.message || 'Premium subscription required to send messages');
      } else {
        toast.error('Failed to send message');
      }
    } finally {
      setSending(false);
    }
  };

  // Start editing a message
  const startEditing = (message) => {
    setEditingMessage(message.id);
    setEditContent(message.content);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingMessage(null);
    setEditContent('');
  };

  // Save edited message
  const saveEdit = async (messageId) => {
    if (!editContent.trim()) {
      toast.error('Message cannot be empty');
      return;
    }

    try {
      const response = await api.put(`/chat/messages/${messageId}`, {
        content: editContent
      });

      const updatedMessage = response.data.message;
      
      // Update local state
      setMessages(prev => prev.map(m => 
        m.id === messageId ? updatedMessage : m
      ));

      // Broadcast via socket
      if (socket && selectedMatch) {
        const roomId = [user.id, selectedMatch.userId].sort().join('_room_');
        socket.emit('message-edited', {
          roomId,
          message: updatedMessage
        });
      }

      setEditingMessage(null);
      setEditContent('');
      toast.success('Message updated');
    } catch (error) {
      console.error('Failed to edit message:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to edit message');
    }
  };

  // Delete a message
  const deleteMessage = async (messageId) => {
    try {
      const response = await api.delete(`/chat/messages/${messageId}`);
      
      // Remove from local state
      setMessages(prev => prev.filter(m => m.id !== messageId));

      // Broadcast via socket
      if (socket && selectedMatch) {
        const roomId = [user.id, selectedMatch.userId].sort().join('_room_');
        socket.emit('message-deleted', {
          roomId,
          messageId,
          receiverId: response.data.receiverId
        });
      }

      setDeleteConfirm(null);
      toast.success('Message deleted');
    } catch (error) {
      console.error('Failed to delete message:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to delete message');
    }
  };

  // Check if message can be edited (within 15 minutes)
  const canEditMessage = (message) => {
    if (message.senderId !== user.id) return false;
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    const maxEditTime = 15 * 60 * 1000; // 15 minutes
    return messageAge < maxEditTime;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle typing indicator
  const typingTimeoutRef = useRef(null);
  const handleTyping = (value) => {
    setNewMessage(value);
    
    if (socket && selectedMatch) {
      // Emit typing start
      socket.emit('typing', { receiverId: selectedMatch.userId, isTyping: true });
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', { receiverId: selectedMatch.userId, isTyping: false });
      }, 1500);
    }
  };

  // Format message date for grouping
  const formatMessageDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = [];
    let currentDate = null;
    
    messages.forEach((message, index) => {
      const messageDate = formatMessageDate(message.createdAt);
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ type: 'date', date: messageDate, key: `date-${index}` });
      }
      groups.push({ type: 'message', message, key: message.id || index });
    });
    
    return groups;
  };

  // Select match and hide mobile sidebar
  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
    setShowMobileSidebar(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-gold-50/30 to-white flex items-center justify-center">
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

  if (matches.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-gold-50/30 to-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary-100 to-gold-100 rounded-full flex items-center justify-center">
            <FiMessageCircle className="w-12 h-12 text-primary-400" />
          </div>
          <h2 className="text-2xl font-bold font-display text-neutral-800 mb-3">No Matches Yet</h2>
          <p className="text-neutral-500 mb-6 leading-relaxed">
            When you and someone else both like each other, you'll be able to start a conversation here.
          </p>
          <a 
            href="/discovery" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-hero text-white rounded-full font-semibold hover:shadow-burgundy hover:scale-105 transition-all duration-200"
          >
            Find Your Match
          </a>
        </div>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="h-screen flex bg-neutral-100 overflow-hidden">
      {/* Matches Sidebar */}
      <div className={`
        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        absolute md:relative z-20 w-full md:w-80 lg:w-96 h-full
        bg-white border-r border-neutral-200 flex flex-col
        transition-transform duration-300 ease-in-out
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-primary-600 bg-gradient-hero">
          <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
            <FiMessageCircle className="w-6 h-6" />
            Messages
          </h2>
          <p className="text-white/80 text-sm mt-1">{matches.length} conversation{matches.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Matches List */}
        <div className="flex-1 overflow-y-auto sidebar-scrollbar">
          {matches.map((match) => {
            const isSelected = selectedMatch?.userId === match.userId;
            return (
              <div
                key={match.userId}
                onClick={() => handleSelectMatch(match)}
                className={`
                  relative p-4 cursor-pointer transition-all duration-200
                  hover:bg-primary-50 border-l-4 
                  ${isSelected 
                    ? 'bg-primary-50 border-l-primary-500' 
                    : 'border-l-transparent hover:border-l-primary-300'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {match.profilePhoto ? (
                      <img
                        src={getImageUrl(match.profilePhoto, API_BASE_URL, 'thumbnail')}
                        alt={match.firstName}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-md"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-hero flex items-center justify-center text-white font-bold text-lg ring-2 ring-white shadow-md">
                        {match.firstName[0]}
                      </div>
                    )}
                    {/* Online indicator */}
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold truncate ${isSelected ? 'text-primary-600' : 'text-neutral-800'}`}>
                        {match.firstName} {match.lastName}
                      </h3>
                      <span className="text-xs text-neutral-400">
                        {match.matchedAt ? new Date(match.matchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500 truncate mt-0.5">{match.city}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedMatch ? (
          <>
            {/* Chat Header */}
            <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Back button for mobile */}
                  <button 
                    onClick={() => setShowMobileSidebar(true)}
                    aria-label="Back to conversations"
                    className="md:hidden p-2 -ml-2 hover:bg-neutral-100 rounded-full transition-colors"
                  >
                    <FiChevronLeft className="w-5 h-5 text-neutral-600" />
                  </button>

                  {/* Avatar */}
                  <div className="relative">
                    {selectedMatch.profilePhoto ? (
                      <img
                        src={getImageUrl(selectedMatch.profilePhoto, API_BASE_URL, 'avatar')}
                        alt={`Profile photo of ${selectedMatch.firstName}`}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-primary-100"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-hero flex items-center justify-center text-white font-semibold ring-2 ring-primary-100">
                        {selectedMatch.firstName[0]}
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-white"></div>
                  </div>

                  {/* Info */}
                  <div>
                    <h3 className="font-semibold text-neutral-800">
                      {selectedMatch.firstName} {selectedMatch.lastName}
                    </h3>
                    <p className="text-xs text-success font-medium">
                      {isTyping ? 'typing...' : 'Online'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <button 
                  aria-label="More options"
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <FiMoreVertical className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
            </div>

            {/* Messages Container */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto chat-scrollbar px-4 py-4"
              role="log"
              aria-label="Chat messages"
              style={{ 
                background: 'linear-gradient(180deg, #FDF2F5 0%, #FDF6E3 50%, #FAFAFA 100%)'
              }}
            >
              {/* Chat start message */}
              <div className="flex justify-center mb-6">
                <div className="px-4 py-2 bg-white/90 backdrop-blur rounded-full shadow-sm border border-gold-200">
                  <p className="text-xs text-neutral-600">
                    You matched with {selectedMatch.firstName}! Make a meaningful connection...
                  </p>
                </div>
              </div>

              {groupedMessages.map((item) => {
                if (item.type === 'date') {
                  return <DateSeparator key={item.key} date={item.date} />;
                }

                const message = item.message;
                const isSentByMe = message.senderId === user.id;
                const isEditing = editingMessage === message.id;
                const showDeleteConfirm = deleteConfirm === message.id;
                
                return (
                  <div
                    key={item.key}
                    className={`mb-3 flex message-enter ${isSentByMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`group relative flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isSentByMe ? 'flex-row-reverse' : ''}`}>
                      {/* Edit/Delete buttons */}
                      {isSentByMe && !isEditing && !showDeleteConfirm && (
                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-0.5 mb-1">
                          {canEditMessage(message) && (
                            <button
                              onClick={() => startEditing(message)}
                              className="p-1.5 rounded-full bg-white/80 hover:bg-white text-neutral-400 hover:text-primary-500 transition-colors shadow-sm"
                              aria-label="Edit message"
                            >
                              <FiEdit2 className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteConfirm(message.id)}
                            className="p-1.5 rounded-full bg-white/80 hover:bg-white text-neutral-400 hover:text-destructive transition-colors shadow-sm"
                            aria-label="Delete message"
                          >
                            <FiTrash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Delete confirmation */}
                      {showDeleteConfirm && (
                        <div className="flex items-center gap-1 mb-1 bg-white rounded-full px-3 py-1.5 shadow-md border border-destructive-light">
                          <span className="text-xs text-destructive font-medium">Delete?</span>
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className="px-2 py-0.5 rounded-full bg-destructive hover:bg-red-700 text-white text-xs font-medium transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 text-neutral-600 text-xs font-medium transition-colors"
                          >
                            No
                          </button>
                        </div>
                      )}

                      {/* Message bubble */}
                      <div
                        className={`
                          relative px-4 py-2.5 rounded-2xl shadow-sm
                          ${isSentByMe
                            ? 'message-sent'
                            : 'message-received'
                          }
                        `}
                      >
                        {isEditing ? (
                          <div className="space-y-2 min-w-[200px]">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  saveEdit(message.id);
                                } else if (e.key === 'Escape') {
                                  cancelEditing();
                                }
                              }}
                              className="w-full px-3 py-1.5 rounded-lg text-neutral-800 text-sm bg-white/90 focus:outline-none focus:ring-2 focus:ring-primary-300"
                              autoFocus
                            />
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={cancelEditing}
                                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                                title="Cancel (Esc)"
                              >
                                <FiX className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => saveEdit(message.id)}
                                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                                title="Save (Enter)"
                              >
                                <FiCheck className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="break-words text-[15px] leading-relaxed">{message.content}</p>
                            <div className={`flex items-center justify-end gap-1.5 mt-1 ${
                              isSentByMe ? 'text-white/70' : 'text-neutral-400'
                            }`}>
                              {message.isEdited && (
                                <span className="text-[10px] italic">edited</span>
                              )}
                              <span className="text-[10px]">
                                {new Date(message.createdAt).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                              <MessageTicks message={message} isSent={isSentByMe} />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="mb-3 flex justify-start message-enter">
                  <TypingIndicator />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="flex-shrink-0 p-4 bg-white border-t border-neutral-200">
              <form onSubmit={sendMessage} className="flex items-end gap-3">
                {/* Emoji button */}
                <button 
                  type="button"
                  aria-label="Add emoji"
                  className="p-2.5 text-neutral-400 hover:text-primary-500 hover:bg-primary-50 rounded-full transition-colors"
                >
                  <BsEmojiSmile className="w-6 h-6" />
                </button>

                {/* Input container */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => handleTyping(e.target.value)}
                    placeholder="Make a meaningful connection..."
                    aria-label="Type your message"
                    className="w-full px-5 py-3 bg-neutral-100 rounded-full text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all duration-200"
                    disabled={sending}
                  />
                </div>

                {/* Attachment button */}
                <button 
                  type="button"
                  aria-label="Attach photo"
                  className="p-2.5 text-neutral-400 hover:text-primary-500 hover:bg-primary-50 rounded-full transition-colors"
                >
                  <HiOutlinePhotograph className="w-6 h-6" />
                </button>

                {/* Send button */}
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
            </div>
          </>
        ) : (
          /* No chat selected */
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary-50 via-gold-50/30 to-white">
            <div className="text-center p-8">
              <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-primary-100 to-gold-100 rounded-full flex items-center justify-center">
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
      {showMobileSidebar && selectedMatch && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-10"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}
    </div>
  );
};

export default Chat;


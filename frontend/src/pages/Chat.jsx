import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiSend, FiMessageCircle } from 'react-icons/fi';

const Chat = () => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadMutualMatches();
  }, []);

  useEffect(() => {
    if (selectedMatch && socket) {
      loadMessages();
      const roomId = [user.id, selectedMatch.userId].sort().join('-');
      socket.emit('join-room', roomId);

      socket.on('message', (message) => {
        if (message.senderId === selectedMatch.userId || message.receiverId === selectedMatch.userId) {
          setMessages(prev => [...prev, message]);
        }
      });

      return () => {
        socket.emit('leave-room', roomId);
        socket.off('message');
      };
    }
  }, [selectedMatch, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMutualMatches = async () => {
    try {
      const response = await api.get('/match/mutual');
      setMatches(response.data.mutualMatches);
      if (response.data.mutualMatches.length > 0) {
        setSelectedMatch(response.data.mutualMatches[0]);
      }
    } catch (error) {
      toast.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedMatch) return;
    try {
      const response = await api.get(`/chat/messages/${selectedMatch.userId}`);
      setMessages(response.data.messages);
    } catch (error) {
      toast.error('Failed to load messages');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedMatch) return;

    try {
      const response = await api.post('/chat/messages', {
        receiverId: selectedMatch.userId,
        content: newMessage
      });

      setMessages(prev => [...prev, response.data.message]);
      setNewMessage('');

      if (socket) {
        const roomId = [user.id, selectedMatch.userId].sort().join('-');
        socket.emit('send-message', {
          roomId,
          message: response.data.message
        });
      }
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FiMessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">No Matches Yet</h2>
          <p className="text-gray-600 mb-4">Start liking profiles to get mutual matches!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Matches Sidebar */}
      <div className="w-1/3 border-r bg-white">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold gradient-text">Messages</h2>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 80px)' }}>
          {matches.map((match) => (
            <div
              key={match.userId}
              onClick={() => setSelectedMatch(match)}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedMatch?.userId === match.userId ? 'bg-purple-50' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                {match.profilePhoto ? (
                  <img
                    src={`http://localhost:5000${match.profilePhoto}`}
                    alt={match.firstName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold">
                    {match.firstName[0]}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold">
                    {match.firstName} {match.lastName}
                  </h3>
                  <p className="text-sm text-gray-600">{match.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedMatch ? (
          <>
            <div className="p-4 border-b bg-white">
              <div className="flex items-center space-x-3">
                {selectedMatch.profilePhoto ? (
                  <img
                    src={`http://localhost:5000${selectedMatch.profilePhoto}`}
                    alt={selectedMatch.firstName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold">
                    {selectedMatch.firstName[0]}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">
                    {selectedMatch.firstName} {selectedMatch.lastName}
                  </h3>
                  <p className="text-sm text-gray-600">{selectedMatch.city}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`mb-4 flex ${
                    message.senderId === user.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.senderId === user.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-800'
                    }`}
                  >
                    <p>{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.senderId === user.id ? 'text-purple-100' : 'text-gray-500'
                    }`}>
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t bg-white">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 input-field"
                />
                <button type="submit" className="btn-primary">
                  <FiSend className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-600">Select a match to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;


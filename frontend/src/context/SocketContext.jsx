import React, { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../api/config'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

const SocketContext = createContext()

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { isAuthenticated, token, user } = useAuth()

  useEffect(() => {
    if (isAuthenticated && token && user) {
      // Initialize socket connection
      const newSocket = io(SOCKET_URL, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      })

      // Connection events
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id)
        setIsConnected(true)
      })

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected')
        setIsConnected(false)
      })

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
        setIsConnected(false)
      })

      // Message events
      newSocket.on('receive_message', (message) => {
        console.log('New message received:', message)
        
        // Show toast notification if not in chat with sender
        const currentPath = window.location.pathname
        if (!currentPath.includes(`/chat/${message.senderId}`)) {
          toast.success(`New message from ${message.sender?.name || 'Someone'}`, {
            duration: 5000,
            onClick: () => {
              window.location.href = `/chat/${message.senderId}`
            }
          })
        }
      })

      newSocket.on('message_sent', (data) => {
        console.log('Message sent confirmation:', data)
      })

      newSocket.on('user_typing', (data) => {
        console.log('User typing:', data)
        // Handle typing indicator
      })

      newSocket.on('message_read', (data) => {
        console.log('Message read:', data)
        // Handle read receipt
      })

      newSocket.on('error', (error) => {
        console.error('Socket error:', error)
        toast.error('Connection error occurred')
      })

      setSocket(newSocket)

      return () => {
        newSocket.close()
        setSocket(null)
        setIsConnected(false)
      }
    } else {
      // Clean up socket if not authenticated
      if (socket) {
        socket.close()
        setSocket(null)
        setIsConnected(false)
      }
    }
  }, [isAuthenticated, token, user])

  // Send message
  const sendMessage = (receiverId, message, messageType = 'text', attachmentUrl = null) => {
    if (socket && isConnected) {
      socket.emit('send_message', {
        receiverId,
        message,
        messageType,
        attachmentUrl
      })
    } else {
      toast.error('Connection not available')
    }
  }

  // Join chat room
  const joinChat = (chatPartnerId) => {
    if (socket && isConnected) {
      socket.emit('join_chat', { chatPartnerId })
    }
  }

  // Leave chat room
  const leaveChat = (chatPartnerId) => {
    if (socket && isConnected) {
      socket.emit('leave_chat', { chatPartnerId })
    }
  }

  // Send typing indicator
  const sendTyping = (receiverId, isTyping) => {
    if (socket && isConnected) {
      if (isTyping) {
        socket.emit('typing_start', { receiverId })
      } else {
        socket.emit('typing_stop', { receiverId })
      }
    }
  }

  // Mark message as read
  const markAsRead = (messageId) => {
    if (socket && isConnected) {
      socket.emit('mark_as_read', { messageId })
    }
  }

  const value = {
    socket,
    isConnected,
    unreadCount,
    setUnreadCount,
    sendMessage,
    joinChat,
    leaveChat,
    sendTyping,
    markAsRead
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

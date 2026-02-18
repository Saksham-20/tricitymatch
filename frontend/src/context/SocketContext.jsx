import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

// Environment check for logging
const isDev = import.meta.env.DEV;

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated, user } = useAuth();

  const connect = useCallback(() => {
    if (!isAuthenticated || !user) return null;

    const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    
    const newSocket = io(socketUrl, {
      // Use cookies for authentication (httpOnly cookies are sent automatically)
      withCredentials: true,
      // Reconnection settings
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // Timeout settings
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      if (isDev) {
        console.log('Socket connected:', newSocket.id);
      }
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      if (isDev) {
        console.log('Socket disconnected:', reason);
      }
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      if (isDev) {
        console.error('Socket connection error:', error.message);
      }
      setIsConnected(false);
    });

    newSocket.on('error', (error) => {
      if (isDev) {
        console.error('Socket error:', error);
      }
    });

    return newSocket;
  }, [isAuthenticated, user]);

  useEffect(() => {
    let currentSocket = null;

    if (isAuthenticated && user) {
      currentSocket = connect();
      if (currentSocket) {
        setSocket(currentSocket);
      }
    }

    return () => {
      if (currentSocket) {
        currentSocket.removeAllListeners();
        currentSocket.close();
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [isAuthenticated, user, connect]);

  // Reconnect function for manual reconnection
  const reconnect = useCallback(() => {
    if (socket) {
      socket.connect();
    }
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

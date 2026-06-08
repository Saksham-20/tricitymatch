import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useCallStore } from '../stores/callStore';
import { CONFIG } from '../constants/config';
import { queryKeys } from '../constants/queryKeys';
import type { Message, Conversation } from '../types';
import type { CallInvitation } from '../types';

export interface SocketEventHandlers {
  onNewMatch?: (data: { matchedUserId: string; compatibilityScore: number }) => void;
  onNewNotification?: () => void;
  onMessageReceived?: (msg: Message) => void;
  onTypingIndicator?: (data: { userId: string; isTyping: boolean }) => void;
  onMessageEdited?: (msg: Message) => void;
  onMessageDeleted?: (data: { messageId: string; deletedForBoth: boolean }) => void;
  onCallIncoming?: (invitation: CallInvitation) => void;
  onCallAccepted?: (data: { callId: string; channelName: string }) => void;
  onCallDeclined?: (data: { callId: string }) => void;
  onCallEnded?: (data: { callId: string }) => void;
}

let socketInstance: Socket | null = null;

export function useSocket(handlers?: SocketEventHandlers) {
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const { setIncomingCall } = useCallStore();
  const queryClient = useQueryClient();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken || !user) return;
    if (socketInstance?.connected) return;

    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }

    socketInstance = io(CONFIG.WS_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketInstance.on('connect', () => {
      socketInstance?.emit('join-room', { userId: user.id });
    });

    socketInstance.on('new-match', (data: { matchedUserId: string; compatibilityScore: number }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mutualMatches });
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyMatches });
      handlersRef.current?.onNewMatch?.(data);
    });

    socketInstance.on('new-notification', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      handlersRef.current?.onNewNotification?.();
    });

    socketInstance.on('message-received', (msg: Message) => {
      // Update thread cache for the sender's conversation
      queryClient.setQueryData<{ pages: { messages: Message[]; nextCursor: string | null }[] }>(
        queryKeys.thread(msg.senderId),
        (old) => {
          if (!old) return old;
          const pages = [...old.pages];
          if (pages.length > 0) {
            pages[0] = { ...pages[0], messages: [msg, ...pages[0].messages] };
          }
          return { ...old, pages };
        }
      );
      // Update conversation list unread count
      queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.userId === msg.senderId
            ? { ...c, lastMessage: msg, unreadCount: c.unreadCount + 1 }
            : c
        );
      });
      handlersRef.current?.onMessageReceived?.(msg);
    });

    socketInstance.on('typing-indicator', (data: { userId: string; isTyping: boolean }) => {
      handlersRef.current?.onTypingIndicator?.(data);
    });

    socketInstance.on('message-edited', (msg: Message) => {
      queryClient.setQueryData<{ pages: { messages: Message[]; nextCursor: string | null }[] }>(
        queryKeys.thread(msg.senderId === user.id ? msg.receiverId : msg.senderId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) => (m.id === msg.id ? msg : m)),
          }));
          return { ...old, pages };
        }
      );
      handlersRef.current?.onMessageEdited?.(msg);
    });

    socketInstance.on('message-deleted', (data: { messageId: string; senderId: string; deletedForBoth: boolean }) => {
      const otherUserId = data.senderId === user.id ? undefined : data.senderId;
      if (otherUserId) {
        queryClient.setQueryData<{ pages: { messages: Message[]; nextCursor: string | null }[] }>(
          queryKeys.thread(otherUserId),
          (old) => {
            if (!old) return old;
            const pages = old.pages.map((page) => ({
              ...page,
              messages: page.messages.filter((m) => m.id !== data.messageId),
            }));
            return { ...old, pages };
          }
        );
      }
      handlersRef.current?.onMessageDeleted?.(data);
    });

    socketInstance.on('call-incoming', (invitation: CallInvitation) => {
      setIncomingCall(invitation);
      handlersRef.current?.onCallIncoming?.(invitation);
    });

    socketInstance.on('call-accepted', (data: { callId: string; channelName: string }) => {
      handlersRef.current?.onCallAccepted?.(data);
    });

    socketInstance.on('call-declined', (data: { callId: string }) => {
      handlersRef.current?.onCallDeclined?.(data);
    });

    socketInstance.on('call-ended', (data: { callId: string }) => {
      handlersRef.current?.onCallEnded?.(data);
    });
  }, [isAuthenticated, accessToken, user, queryClient, setIncomingCall]);

  const disconnect = useCallback(() => {
    socketInstance?.disconnect();
  }, []);

  // Connect when authenticated; disconnect on logout
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }
    return () => {
      // Don't disconnect on component unmount — socket is module-level singleton
    };
  }, [isAuthenticated, connect, disconnect]);

  // Reconnect on app foreground
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && isAuthenticated) {
        if (!socketInstance?.connected) {
          connect();
        }
      } else if (nextState === 'background') {
        disconnect();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isAuthenticated, connect, disconnect]);

  const emitTyping = useCallback((receiverId: string, isTyping: boolean) => {
    socketInstance?.emit('typing', { receiverId, isTyping });
  }, []);

  const emitSeen = useCallback((messageId: string) => {
    socketInstance?.emit('message-seen', { messageId });
  }, []);

  return {
    isConnected: socketInstance?.connected ?? false,
    emitTyping,
    emitSeen,
    socket: socketInstance,
  };
}

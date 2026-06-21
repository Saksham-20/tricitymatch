import { apiClient } from './client';
import type { Notification } from '../types';

export const getNotifications = async (cursor?: string): Promise<{
  notifications: Notification[];
  unreadCount: number;
  nextCursor: string | null;
}> => {
  const page = cursor ? Number(cursor) : 1;
  const res = await apiClient.get<{
    notifications: Notification[];
    unreadCount: number;
    pagination: { page: number; pages: number };
  }>('/notifications', { params: { page, limit: 20 } });
  const { page: cur, pages } = res.data.pagination ?? { page: 1, pages: 1 };
  return {
    notifications: res.data.notifications ?? [],
    unreadCount: res.data.unreadCount ?? 0,
    nextCursor: cur < pages ? String(cur + 1) : null,
  };
};

export const markRead = async (id: string): Promise<void> => {
  await apiClient.put(`/notifications/${id}/read`);
};

export const markAllRead = async (): Promise<void> => {
  await apiClient.put('/notifications/read-all');
};

export const getUnreadCount = async (): Promise<{ count: number }> => {
  const res = await apiClient.get<{ count: number }>('/notifications/unread-count');
  return res.data;
};

export const registerFcmToken = async (token: string, platform: 'ios' | 'android'): Promise<void> => {
  await apiClient.post('/notifications/fcm-token', { token, platform });
};

export const removeFcmToken = async (token: string): Promise<void> => {
  await apiClient.delete('/notifications/fcm-token', { data: { token } });
};

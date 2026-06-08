import { apiClient } from './client';
import type { Notification } from '../types';

export const getNotifications = async (cursor?: string): Promise<{
  notifications: Notification[];
  nextCursor: string | null;
}> => {
  const res = await apiClient.get('/notifications', { params: { cursor, limit: 20 } });
  return res.data;
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

import { apiClient } from './client';

export const blockUser = async (userId: string): Promise<void> => {
  await apiClient.post(`/block/${userId}`);
};

export const unblockUser = async (userId: string): Promise<void> => {
  await apiClient.delete(`/block/${userId}`);
};

export type ReportReason =
  | 'fake_profile'
  | 'harassment'
  | 'spam'
  | 'inappropriate_content'
  | 'underage'
  | 'other';

export interface ReportPayload {
  userId: string;
  reason: ReportReason;
  description?: string;
}

export const reportUser = async ({ userId, reason, description }: ReportPayload): Promise<void> => {
  await apiClient.post(`/report/${userId}`, { reason, description });
};

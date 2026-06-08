import { apiClient } from './client';

export const blockUser = async (userId: string): Promise<void> => {
  await apiClient.post(`/block/${userId}`);
};

export const unblockUser = async (userId: string): Promise<void> => {
  await apiClient.delete(`/block/${userId}`);
};

export interface ReportPayload {
  userId: string;
  category: string;
  description?: string;
}

export const reportUser = async (payload: ReportPayload): Promise<void> => {
  await apiClient.post('/report', payload);
};

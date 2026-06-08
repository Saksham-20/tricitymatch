import { apiClient } from './client';

export const getVerificationQueue = async () => {
  const res = await apiClient.get('/admin/verifications', { params: { status: 'pending' } });
  return res.data;
};

export const approveVerification = async (id: string) => {
  await apiClient.put(`/admin/verifications/${id}`, { status: 'approved' });
};

export const rejectVerification = async (id: string, reason: string) => {
  await apiClient.put(`/admin/verifications/${id}`, { status: 'rejected', adminNotes: reason });
};

export const getReportsQueue = async () => {
  const res = await apiClient.get('/admin/reports');
  return res.data;
};

export const getAdminStats = async () => {
  const res = await apiClient.get('/admin/analytics');
  return res.data;
};

export const updateReport = async (reportId: string, status: 'reviewed' | 'dismissed', adminNotes?: string) => {
  await apiClient.put(`/admin/reports/${reportId}`, { status, adminNotes });
};

export const updateUserStatus = async (userId: string, status: 'active' | 'suspended' | 'banned') => {
  await apiClient.put(`/admin/users/${userId}/status`, { status });
};

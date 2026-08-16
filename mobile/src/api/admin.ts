import { apiClient } from './client';

/** The `stats` block of GET /admin/analytics, field for field. */
export interface AdminAnalyticsStats {
  totalUsers: number;
  verifiedUsers: number;
  activeSubscribers: number;
  revenueThisMonth: number;
  pendingVerifications: number;
  openReports: number;
}

/**
 * Every GET here returns a `{ success, <key>, … }` envelope. These helpers used
 * to hand `res.data` — the envelope itself — back to the screens, which then
 * read `.length` off an object and every stat field off the wrong level. The
 * admin console rendered blank tiles and a literal "₹undefined" as a result.
 * Same unwrap class as the historical /match, /chat and /subscription bugs.
 */
export const getVerificationQueue = async <T = unknown>(): Promise<T[]> => {
  const res = await apiClient.get<{ verifications: T[] }>('/admin/verifications', {
    params: { status: 'pending' },
  });
  return res.data.verifications ?? [];
};

export const approveVerification = async (id: string) => {
  await apiClient.put(`/admin/verifications/${id}`, { status: 'approved' });
};

export const rejectVerification = async (id: string, reason: string) => {
  await apiClient.put(`/admin/verifications/${id}`, { status: 'rejected', adminNotes: reason });
};

export const getReportsQueue = async <T = unknown>(): Promise<T[]> => {
  const res = await apiClient.get<{ reports: T[] }>('/admin/reports');
  return res.data.reports ?? [];
};

export const getAdminStats = async () => {
  const res = await apiClient.get<{ stats: AdminAnalyticsStats }>('/admin/analytics');
  return res.data.stats;
};

export const updateReport = async (reportId: string, status: 'reviewed' | 'dismissed', adminNotes?: string) => {
  await apiClient.put(`/admin/reports/${reportId}`, { status, adminNotes });
};

export const updateUserStatus = async (userId: string, status: 'active' | 'suspended' | 'banned') => {
  await apiClient.put(`/admin/users/${userId}/status`, { status });
};

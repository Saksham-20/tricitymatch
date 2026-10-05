import api from './axios';

// Users
export const getUsers = (params) => api.get('/admin/users', { params });
export const getUser = (userId) => api.get(`/admin/users/${userId}`);
export const getModerationHistory = (userId) => api.get(`/admin/users/${userId}/moderation-history`);
export const createUser = (data) => api.post('/admin/users', data);
export const updateUserStatus = (userId, data) => api.put(`/admin/users/${userId}/status`, data);
// Quiet hide: { hidden: boolean, reason }. Not shown to the member.
export const updateUserVisibility = (userId, data) => api.put(`/admin/users/${userId}/visibility`, data);
export const updateSubscription = (userId, data) => api.put(`/admin/users/${userId}/subscription`, data);

// Verifications
export const getVerifications = (params) => api.get('/admin/verifications', { params });
export const updateVerification = (verificationId, data) => api.put(`/admin/verifications/${verificationId}`, data);

// Analytics
export const getAnalytics = () => api.get('/admin/analytics');
export const getRevenueReport = (params) => api.get('/admin/revenue', { params });

// Reports
export const getReports = (params) => api.get('/admin/reports', { params });
export const updateReport = (reportId, data) => api.put(`/admin/reports/${reportId}`, data);

// Appeals against a suspension
export const getAppeals = (params) => api.get('/admin/appeals', { params });
export const decideAppeal = (id, data) => api.put(`/admin/appeals/${id}`, data);

// Photo review (auto-held uploads and stolen-photo reports)
export const getMediaReviews = (params) => api.get('/admin/media-reviews', { params });
export const decideMediaReview = (id, data) => api.put(`/admin/media-reviews/${id}`, data);

// Search ranking weights
export const getRankingWeights = () => api.get('/admin/ranking-weights');
export const saveRankingWeights = (weights) => api.put('/admin/ranking-weights', { weights });
export const getRankingExperiment = () => api.get('/admin/ranking-experiment');
export const startRankingExperiment = (experiment) => api.put('/admin/ranking-experiment', { experiment });
export const stopRankingExperiment = () => api.put('/admin/ranking-experiment', { stop: true });
export const resetRankingWeights = () => api.put('/admin/ranking-weights', { reset: true });

// Invoice
export const adminGetInvoice = (subscriptionId) =>
  api.get(`/admin/invoice/${subscriptionId}`, { responseType: 'blob' });

// Grantable plans — served by the API so the override dropdown can never drift
// from the Postgres enum (the old hardcoded list had, and every override 400'd)
// and always reflects what Pricing & Offers currently has on sale.
export const getPlanOptions = () => api.get('/admin/plan-options');

// Admin team (sub-admins, role grants)
export const getAdmins = () => api.get('/admin/admins');
export const createAdmin = (data) => api.post('/admin/admins', data);
export const updateUserRole = (userId, data) => api.put(`/admin/users/${userId}/role`, data);

// Measurement
export const getFunnel = (params) => api.get('/admin/funnel', { params });
export const getAuditLog = (params) => api.get('/admin/audit-log', { params });
export const getAuditActions = () => api.get('/admin/audit-log/actions');
// Same filters as the table, but streamed back as one CSV with no row cap.
export const exportAuditLog = (params) => api.get('/admin/audit-log', { params: { ...params, format: 'csv' }, responseType: 'blob' });

// Subscription lifecycle
export const refundSubscription = (subscriptionId, data) => api.post(`/admin/subscriptions/${subscriptionId}/refund`, data);
export const cancelSubscription = (userId, data) => api.delete(`/admin/users/${userId}/subscription`, { data });

// Member export (CSV — blob so the browser saves it rather than rendering it)
export const exportUsers = (params) => api.get('/admin/users/export', { params, responseType: 'blob' });
// Permanent delete (full admins only). Resolves { deleted, blocked } per account.
export const deleteUsers = (ids) => api.delete('/admin/users', { data: { ids } });

// Trust & safety
export const getSuspicious = (params) => api.get('/admin/suspicious', { params });
export const getModerationStats = () => api.get('/admin/moderation-stats');
export const getPhotoQueue = (params) => api.get('/admin/photos', { params });
export const removePhoto = (data) => api.delete('/admin/photos', { data });
// Flag a photo for review without removing it (files a MediaReview → Photo Review queue)
export const flagPhoto = (data) => api.post('/admin/photos/flag', data);
export const bulkUpdateStatus = (ids, status) => api.put('/admin/users/bulk-status', { ids, status });

// Marketing partner account care
export const updateMarketingUser = (userId, data) => api.put(`/admin/marketing-users/${userId}`, data);
export const resetMarketingUserPassword = (userId, password) =>
  api.post(`/admin/marketing-users/${userId}/reset-password`, { password });
export const resendPartnerWelcome = (userId) => api.post(`/admin/marketing-users/${userId}/resend-welcome`);

// Moving leads between partners (converted leads never move: that partner earned them)
export const assignLead = (leadId, marketingUserId) => api.put(`/admin/leads/${leadId}/assign`, { marketingUserId });
export const reassignPartnerLeads = (fromUserId, toUserId) => api.post(`/admin/marketing-users/${fromUserId}/reassign-leads`, { toUserId });

// Marketing manager's whole-team numbers (numbers only: no member details, no payouts)
export const getMarketingTeam = () => api.get('/marketing/team');

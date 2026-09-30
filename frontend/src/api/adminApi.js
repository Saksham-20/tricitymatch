import api from './axios';

// Users
export const getUsers = (params) => api.get('/admin/users', { params });
export const getUser = (userId) => api.get(`/admin/users/${userId}`);
export const getModerationHistory = (userId) => api.get(`/admin/users/${userId}/moderation-history`);
export const createUser = (data) => api.post('/admin/users', data);
export const updateUserStatus = (userId, data) => api.put(`/admin/users/${userId}/status`, data);
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

// Subscription lifecycle
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
export const bulkUpdateStatus = (ids, status) => api.put('/admin/users/bulk-status', { ids, status });

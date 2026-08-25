import api from './axios';

// Users
export const getUsers = (params) => api.get('/admin/users', { params });
export const getUser = (userId) => api.get(`/admin/users/${userId}`);
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
export const exportUsers = () => api.get('/admin/users/export', { responseType: 'blob' });

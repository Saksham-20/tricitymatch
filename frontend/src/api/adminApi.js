import api from './axios';

// Users
export const getUsers = (params) => api.get('/admin/users', { params });
export const getUser = (userId) => api.get(`/admin/users/${userId}`);
export const createUser = (data) => api.post('/admin/users', data);
export const updateUserStatus = (userId, data) => api.patch(`/admin/users/${userId}/status`, data);
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

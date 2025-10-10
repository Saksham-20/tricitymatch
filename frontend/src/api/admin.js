import api from './config'

// Admin API calls
export const adminAPI = {
  // Get all users
  getUsers: async (filters = {}) => {
    const response = await api.get('/admin/users', { params: filters })
    return response.data
  },

  // Get user by ID
  getUserById: async (userId) => {
    const response = await api.get(`/admin/users/${userId}`)
    return response.data
  },

  // Verify user identity
  verifyUser: async (userId, status, notes) => {
    const response = await api.put(`/admin/users/${userId}/verify`, { status, notes })
    return response.data
  },

  // Ban user
  banUser: async (userId, reason, duration) => {
    const response = await api.put(`/admin/users/${userId}/ban`, { reason, duration })
    return response.data
  },

  // Unban user
  unbanUser: async (userId) => {
    const response = await api.put(`/admin/users/${userId}/unban`)
    return response.data
  },

  // Get reports
  getReports: async (filters = {}) => {
    const response = await api.get('/admin/reports', { params: filters })
    return response.data
  },

  // Resolve report
  resolveReport: async (reportId, action, notes) => {
    const response = await api.put(`/admin/reports/${reportId}/resolve`, { action, notes })
    return response.data
  },

  // Dismiss report
  dismissReport: async (reportId, notes) => {
    const response = await api.put(`/admin/reports/${reportId}/dismiss`, { notes })
    return response.data
  },

  // Get analytics
  getAnalytics: async (params = {}) => {
    const response = await api.get('/admin/analytics', { params })
    return response.data
  },

  // Get dashboard stats
  getDashboardStats: async () => {
    const response = await api.get('/admin/dashboard')
    return response.data
  },

  // Send notification to user
  sendNotification: async (userId, title, content, type = 'admin_message') => {
    const response = await api.post('/admin/notifications/send', { userId, title, content, type })
    return response.data
  },

  // Get verification queue
  getVerificationQueue: async (params = {}) => {
    const response = await api.get('/admin/verification-queue', { params })
    return response.data
  }
}

import api from './config'

// Insights API calls
export const insightsAPI = {
  // Get profile views (premium feature)
  getProfileViews: async (params = {}) => {
    const response = await api.get('/insights/profile-views', { params })
    return response.data
  },

  // Get personal stats
  getPersonalStats: async (period = '7d') => {
    const response = await api.get('/insights/stats', { params: { period } })
    return response.data
  },

  // Get engagement insights
  getEngagementInsights: async (params = {}) => {
    const response = await api.get('/insights/engagement', { params })
    return response.data
  },

  // Get compatibility insights
  getCompatibilityInsights: async (params = {}) => {
    const response = await api.get('/insights/compatibility', { params })
    return response.data
  },

  // Get profile performance
  getProfilePerformance: async () => {
    const response = await api.get('/insights/performance')
    return response.data
  }
}

import api from './config'

// Boost API calls
export const boostAPI = {
  // Get boost status
  getBoostStatus: async () => {
    const response = await api.get('/boost/status')
    return response.data
  },

  // Get boost history
  getBoostHistory: async (params = {}) => {
    const response = await api.get('/boost/history', { params })
    return response.data
  },

  // Get active boosts
  getActiveBoosts: async () => {
    const response = await api.get('/boost/active')
    return response.data
  }
}

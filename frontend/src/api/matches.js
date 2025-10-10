import api from './config'

// Matches API calls
export const matchesAPI = {
  // Get suggested matches
  getSuggestions: async (params = {}) => {
    const response = await api.get('/matches/suggestions', { params })
    return response.data
  },

  // Search profiles
  searchProfiles: async (filters = {}) => {
    const response = await api.get('/matches/search', { params: filters })
    return response.data
  },

  // Like a profile
  likeProfile: async (likedUserId) => {
    const response = await api.post('/matches/like', { likedUserId })
    return response.data
  },

  // Shortlist a profile
  shortlistProfile: async (shortlistedUserId) => {
    const response = await api.post('/matches/shortlist', { shortlistedUserId })
    return response.data
  },

  // Get who liked you (premium feature)
  getLikedBy: async (params = {}) => {
    const response = await api.get('/matches/liked-by', { params })
    return response.data
  },

  // Get my likes
  getMyLikes: async (params = {}) => {
    const response = await api.get('/matches/my-likes', { params })
    return response.data
  },

  // Get shortlists
  getShortlists: async (params = {}) => {
    const response = await api.get('/matches/shortlists', { params })
    return response.data
  },

  // Remove from shortlist
  removeShortlist: async (userId) => {
    const response = await api.delete(`/matches/shortlist/${userId}`)
    return response.data
  },

  // Get Kundli match
  getKundliMatch: async (userId1, userId2) => {
    const response = await api.post('/matches/kundli-match', { userId1, userId2 })
    return response.data
  }
}

import api from './config'

// Profile API calls
export const profileAPI = {
  // Get my profile
  getMyProfile: async () => {
    const response = await api.get('/profile/me')
    return response.data
  },

  // Update profile
  updateProfile: async (profileData) => {
    const response = await api.put('/profile/update', profileData)
    return response.data
  },

  // Upload photo
  uploadPhoto: async (photoFile) => {
    const formData = new FormData()
    formData.append('photo', photoFile)
    
    const response = await api.post('/profile/upload-photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Delete photo
  deletePhoto: async (photoId) => {
    const response = await api.delete(`/profile/photo/${photoId}`)
    return response.data
  },

  // Verify identity
  verifyIdentity: async (documents) => {
    const formData = new FormData()
    
    Object.keys(documents).forEach(key => {
      if (documents[key]) {
        formData.append(key, documents[key])
      }
    })
    
    const response = await api.post('/profile/verify-identity', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Get profile by ID
  getProfileById: async (userId) => {
    const response = await api.get(`/profile/${userId}`)
    return response.data
  },

  // Get profile completion status
  getProfileCompletion: async () => {
    const response = await api.get('/profile/completion')
    return response.data
  },

  // Update preferences
  updatePreferences: async (preferences) => {
    const response = await api.put('/profile/preferences', preferences)
    return response.data
  }
}

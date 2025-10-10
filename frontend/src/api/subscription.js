import api from './config'

// Subscription API calls
export const subscriptionAPI = {
  // Create subscription order
  createOrder: async (plan, duration) => {
    const response = await api.post('/subscription/create-order', { plan, duration })
    return response.data
  },

  // Verify payment
  verifyPayment: async (paymentData) => {
    const response = await api.post('/subscription/verify-payment', paymentData)
    return response.data
  },

  // Get subscription status
  getSubscriptionStatus: async () => {
    const response = await api.get('/subscription/status')
    return response.data
  },

  // Get payment history
  getPaymentHistory: async (params = {}) => {
    const response = await api.get('/subscription/payment-history', { params })
    return response.data
  },

  // Cancel subscription
  cancelSubscription: async () => {
    const response = await api.post('/subscription/cancel')
    return response.data
  },

  // Create boost order
  createBoostOrder: async (duration) => {
    const response = await api.post('/subscription/boost/create-order', { duration })
    return response.data
  },

  // Verify boost payment
  verifyBoostPayment: async (paymentData) => {
    const response = await api.post('/subscription/boost/verify-payment', paymentData)
    return response.data
  }
}

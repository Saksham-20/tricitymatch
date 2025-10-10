import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { authAPI } from '../api/auth'
import toast from 'react-hot-toast'

const AuthContext = createContext()

// Auth reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true, error: null }
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload.user,
        profile: action.payload.profile,
        preference: action.payload.preference,
        token: action.payload.token,
        error: null
      }
    
    case 'LOGIN_FAILURE':
      return {
        ...state,
        loading: false,
        isAuthenticated: false,
        user: null,
        profile: null,
        preference: null,
        token: null,
        error: action.payload
      }
    
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        profile: null,
        preference: null,
        token: null,
        error: null
      }
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      }
    
    case 'UPDATE_PROFILE':
      return {
        ...state,
        profile: { ...state.profile, ...action.payload }
      }
    
    case 'UPDATE_PREFERENCE':
      return {
        ...state,
        preference: { ...state.preference, ...action.payload }
      }
    
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    
    default:
      return state
  }
}

// Initial state
const initialState = {
  isAuthenticated: false,
  user: null,
  profile: null,
  preference: null,
  token: null,
  loading: false,
  error: null
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')
    
    if (token && user) {
      try {
        const userData = JSON.parse(user)
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            token,
            user: userData,
            profile: null,
            preference: null
          }
        })
        
        // Fetch fresh user data
        fetchUserProfile()
      } catch (error) {
        console.error('Error parsing stored user data:', error)
        logout()
      }
    }
  }, [])

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      const response = await authAPI.getProfile()
      dispatch({
        type: 'UPDATE_USER',
        payload: response.data.user
      })
      if (response.data.profile) {
        dispatch({
          type: 'UPDATE_PROFILE',
          payload: response.data.profile
        })
      }
      if (response.data.preference) {
        dispatch({
          type: 'UPDATE_PREFERENCE',
          payload: response.data.preference
        })
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  // Login function
  const login = async (credentials) => {
    dispatch({ type: 'LOGIN_START' })
    
    try {
      const response = await authAPI.login(credentials)
      
      // Store token and user data
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: response.data
      })
      
      toast.success('Login successful!')
      return { success: true }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed'
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage
      })
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Register function
  const register = async (userData) => {
    dispatch({ type: 'LOGIN_START' })
    
    try {
      const response = await authAPI.register(userData)
      
      // Store token and user data
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: response.data
      })
      
      toast.success('Registration successful!')
      return { success: true }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed'
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage
      })
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Logout function
  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    dispatch({ type: 'LOGOUT' })
    toast.success('Logged out successfully')
  }

  // Update user data
  const updateUser = (userData) => {
    dispatch({
      type: 'UPDATE_USER',
      payload: userData
    })
    
    // Update localStorage
    const updatedUser = { ...state.user, ...userData }
    localStorage.setItem('user', JSON.stringify(updatedUser))
  }

  // Update profile data
  const updateProfile = (profileData) => {
    dispatch({
      type: 'UPDATE_PROFILE',
      payload: profileData
    })
  }

  // Update preference data
  const updatePreference = (preferenceData) => {
    dispatch({
      type: 'UPDATE_PREFERENCE',
      payload: preferenceData
    })
  }

  // Check if user is premium
  const isPremium = () => {
    if (!state.user) return false
    return state.user.subscriptionType !== 'free' && 
           state.user.subscriptionExpiry && 
           new Date(state.user.subscriptionExpiry) > new Date()
  }

  // Check if user is admin
  const isAdmin = () => {
    return state.user?.role === 'admin'
  }

  // Check if user has active boost
  const hasActiveBoost = () => {
    if (!state.user) return false
    return state.user.boostExpiry && 
           new Date(state.user.boostExpiry) > new Date()
  }

  const value = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    updateProfile,
    updatePreference,
    fetchUserProfile,
    isPremium,
    isAdmin,
    hasActiveBoost
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

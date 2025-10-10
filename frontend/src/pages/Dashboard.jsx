import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { insightsAPI } from '../api/insights'
import { 
  Heart, 
  Eye, 
  MessageCircle, 
  Users, 
  TrendingUp, 
  Crown,
  Sparkles,
  ArrowRight,
  Star,
  Calendar,
  MapPin
} from 'lucide-react'
import toast from 'react-hot-toast'

const Dashboard = () => {
  const { user, profile, isPremium } = useAuth()
  const [stats, setStats] = useState({
    profileViews: 0,
    likesReceived: 0,
    messagesReceived: 0,
    matches: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const response = await insightsAPI.getPersonalStats('7d')
      setStats(response.data)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const getProfileCompletion = () => {
    if (!profile) return 0
    
    const fields = [
      'name', 'gender', 'dob', 'height', 'weight', 'religion', 'caste',
      'education', 'profession', 'city', 'bio', 'photos'
    ]
    
    const completedFields = fields.filter(field => {
      if (field === 'photos') return profile.photos && profile.photos.length > 0
      return profile[field] && profile[field] !== ''
    })
    
    return Math.round((completedFields.length / fields.length) * 100)
  }

  const completionPercentage = getProfileCompletion()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {getGreeting()}, {profile?.name || user?.email?.split('@')[0]}! 👋
              </h1>
              <p className="text-primary-100 text-lg">
                Ready to find your perfect match in Tricity?
              </p>
            </div>
            {isPremium() && (
              <div className="hidden md:flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                <Crown className="w-5 h-5" />
                <span className="font-medium">Premium Member</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Completion */}
          {completionPercentage < 100 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Complete Your Profile
                </h2>
                <span className="text-sm text-gray-500">
                  {completionPercentage}% Complete
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div 
                  className="bg-gradient-to-r from-primary-500 to-secondary-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
              
              <p className="text-gray-600 mb-4">
                Complete your profile to get {100 - completionPercentage}% more matches!
              </p>
              
              <Link
                to="/profile/edit"
                className="btn-primary inline-flex items-center space-x-2"
              >
                <span>Complete Profile</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          )}

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="card text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {stats.profileViews}
              </div>
              <div className="text-sm text-gray-600">
                Profile Views
              </div>
            </div>

            <div className="card text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {stats.likesReceived}
              </div>
              <div className="text-sm text-gray-600">
                Likes Received
              </div>
            </div>

            <div className="card text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {stats.messagesReceived}
              </div>
              <div className="text-sm text-gray-600">
                Messages
              </div>
            </div>

            <div className="card text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {stats.matches}
              </div>
              <div className="text-sm text-gray-600">
                Matches
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="card"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Quick Actions
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                to="/browse"
                className="flex items-center space-x-4 p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl hover:from-primary-100 hover:to-primary-200 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Browse Profiles</h3>
                  <p className="text-sm text-gray-600">Discover new matches</p>
                </div>
              </Link>

              <Link
                to="/matches"
                className="flex items-center space-x-4 p-4 bg-gradient-to-r from-secondary-50 to-secondary-100 rounded-xl hover:from-secondary-100 hover:to-secondary-200 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-secondary-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">View Matches</h3>
                  <p className="text-sm text-gray-600">See who liked you</p>
                </div>
              </Link>

              <Link
                to="/chat"
                className="flex items-center space-x-4 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Start Chatting</h3>
                  <p className="text-sm text-gray-600">Connect with matches</p>
                </div>
              </Link>

              <Link
                to="/search"
                className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Advanced Search</h3>
                  <p className="text-sm text-gray-600">Find specific matches</p>
                </div>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile Summary */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="card"
          >
            <div className="text-center">
              {profile?.photos?.[0] ? (
                <img
                  src={profile.photos[0].url}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover mx-auto mb-4"
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-r from-primary-400 to-secondary-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-white" />
                </div>
              )}
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {profile?.name || 'Complete your profile'}
              </h3>
              
              {profile && (
                <div className="space-y-2 text-sm text-gray-600">
                  {profile.age && (
                    <div className="flex items-center justify-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>{profile.age} years old</span>
                    </div>
                  )}
                  {profile.city && (
                    <div className="flex items-center justify-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span>{profile.city}</span>
                    </div>
                  )}
                </div>
              )}
              
              <Link
                to="/profile/edit"
                className="btn-outline mt-4 w-full"
              >
                Edit Profile
              </Link>
            </div>
          </motion.div>

          {/* Premium Upgrade */}
          {!isPremium() && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="card bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200"
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upgrade to Premium
                </h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  Unlock unlimited likes, see who viewed your profile, and get priority in search results.
                </p>
                
                <Link
                  to="/pricing"
                  className="btn-primary w-full flex items-center justify-center space-x-2"
                >
                  <Crown className="w-4 h-4" />
                  <span>View Plans</span>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Tips */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="card"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <span>Profile Tips</span>
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-3">
                <Star className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-gray-600">
                  Add multiple photos to increase your profile views by 40%
                </p>
              </div>
              
              <div className="flex items-start space-x-3">
                <Star className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-gray-600">
                  Complete your bio to show your personality
                </p>
              </div>
              
              <div className="flex items-start space-x-3">
                <Star className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-gray-600">
                  Be active daily to appear in more searches
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

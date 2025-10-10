import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { profileAPI } from '../api/profile'
import { 
  User, 
  Edit, 
  Camera, 
  MapPin, 
  Calendar, 
  GraduationCap, 
  Briefcase,
  Heart,
  Star,
  Shield
} from 'lucide-react'

const Profile = () => {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      // Profile data is already available from AuthContext
      setLoading(false)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <button className="btn-primary flex items-center space-x-2">
            <Edit className="w-4 h-4" />
            <span>Edit Profile</span>
          </button>
        </div>

        {profile ? (
          <div className="space-y-8">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
              {profile.photos?.[0] ? (
                <img
                  src={profile.photos[0].url}
                  alt="Profile"
                  className="w-32 h-32 rounded-2xl object-cover"
                />
              ) : (
                <div className="w-32 h-32 bg-gradient-to-r from-primary-400 to-secondary-400 rounded-2xl flex items-center justify-center">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}
              
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
                  {profile.verificationStatus === 'verified' && (
                    <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                      <Shield className="w-4 h-4" />
                      <span>Verified</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-gray-600">
                  {profile.age && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>{profile.age} years old</span>
                    </div>
                  )}
                  {profile.city && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span>{profile.city}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Gender</label>
                    <p className="text-gray-900 capitalize">{profile.gender}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Height</label>
                    <p className="text-gray-900">{profile.height || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Religion</label>
                    <p className="text-gray-900">{profile.religion || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Caste</label>
                    <p className="text-gray-900">{profile.caste || 'Not specified'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Education & Career</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Education</label>
                    <p className="text-gray-900">{profile.education || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Profession</label>
                    <p className="text-gray-900">{profile.profession || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Income</label>
                    <p className="text-gray-900">{profile.income || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">About Me</h3>
                <p className="text-gray-700 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* Photos */}
            {profile.photos && profile.photos.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Photos</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {profile.photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={photo.url}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded-xl"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-r from-primary-400 to-secondary-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Complete Your Profile
            </h3>
            <p className="text-gray-600 mb-6">
              Create your profile to start connecting with potential matches in Tricity.
            </p>
            <button className="btn-primary">
              Create Profile
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default Profile

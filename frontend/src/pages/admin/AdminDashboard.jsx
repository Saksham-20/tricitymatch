import { motion } from 'framer-motion'
import { Users, Shield, BarChart3, AlertTriangle } from 'lucide-react'

const AdminDashboard = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>

        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gradient-to-r from-primary-400 to-secondary-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Admin Dashboard Coming Soon
          </h3>
          <p className="text-gray-600">
            This page will provide comprehensive analytics and user management tools.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default AdminDashboard

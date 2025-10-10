import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Home, ArrowLeft } from 'lucide-react'

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* 404 Animation */}
          <div className="mb-8">
            <div className="text-8xl font-bold text-gradient mb-4">404</div>
            <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-float">
              <Heart className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Oops! Page Not Found
          </h1>
          
          <p className="text-gray-600 mb-8">
            The page you're looking for seems to have wandered off. 
            Don't worry, love is still out there waiting for you!
          </p>

          <div className="space-y-4">
            <Link
              to="/"
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Home className="w-4 h-4" />
              <span>Go Home</span>
            </Link>
            
            <div>
              <button
                onClick={() => window.history.back()}
                className="btn-outline inline-flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Go Back</span>
              </button>
            </div>
          </div>

          <div className="mt-8 text-sm text-gray-500">
            <p>Need help? <Link to="/contact" className="text-primary-600 hover:text-primary-500">Contact us</Link></p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default NotFound

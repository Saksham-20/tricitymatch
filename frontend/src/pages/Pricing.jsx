import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { 
  Crown, 
  Check, 
  Star, 
  Heart, 
  ArrowRight,
  Sparkles,
  Users,
  Eye,
  MessageCircle,
  Shield
} from 'lucide-react'

const Pricing = () => {
  const { isAuthenticated } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState('premium')
  const [billingCycle, setBillingCycle] = useState('monthly')

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: { monthly: 0, yearly: 0 },
      description: 'Perfect for getting started',
      features: [
        'Create profile',
        'Browse profiles (limited)',
        'Send 5 likes per day',
        'Basic search filters',
        'Community support'
      ],
      limitations: [
        'Limited profile views',
        'No chat access',
        'No advanced filters',
        'No profile boost'
      ],
      popular: false,
      color: 'gray'
    },
    {
      id: 'premium',
      name: 'Premium',
      price: { monthly: 999, yearly: 9999 },
      description: 'Most popular for serious daters',
      features: [
        'Unlimited profile browsing',
        'Unlimited likes',
        'Chat with matches',
        'See who viewed your profile',
        'Advanced search filters',
        'Profile boost (1 per month)',
        'Priority customer support',
        'Read receipts in chat'
      ],
      limitations: [],
      popular: true,
      color: 'primary'
    },
    {
      id: 'elite',
      name: 'Elite',
      price: { monthly: 1999, yearly: 19999 },
      description: 'For those who want the best',
      features: [
        'Everything in Premium',
        'Unlimited profile boosts',
        'Verified badge',
        'Priority in search results',
        'Advanced compatibility insights',
        'Personal matchmaker consultation',
        'VIP customer support',
        'Exclusive events access'
      ],
      limitations: [],
      popular: false,
      color: 'secondary'
    }
  ]

  const getPrice = (plan) => {
    const price = billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly
    return price
  }

  const getSavings = (plan) => {
    if (billingCycle === 'yearly' && plan.price.monthly > 0) {
      const monthlyTotal = plan.price.monthly * 12
      const savings = monthlyTotal - plan.price.yearly
      return Math.round((savings / monthlyTotal) * 100)
    }
    return 0
  }

  const handleSelectPlan = (planId) => {
    if (!isAuthenticated) {
      // Redirect to signup with plan selection
      window.location.href = `/signup?plan=${planId}`
      return
    }
    
    setSelectedPlan(planId)
    // Here you would typically redirect to payment or subscription page
    window.location.href = `/subscription?plan=${planId}`
  }

  return (
    <div className="min-h-screen py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Crown className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-medium text-gray-700">Choose Your Plan</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Find Your Perfect Match
            <span className="text-gradient block">With the Right Plan</span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Join thousands of successful couples who found love through Tricity Match. 
            Choose the plan that works best for your journey.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-gray-900' : 'text-gray-500'}`}>
              Yearly
            </span>
            {billingCycle === 'yearly' && (
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                Save up to 17%
              </span>
            )}
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => {
            const price = getPrice(plan)
            const savings = getSavings(plan)
            
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative card ${
                  plan.popular 
                    ? 'ring-2 ring-primary-500 scale-105' 
                    : 'hover:scale-105'
                } transition-all duration-300`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                      <Star className="w-4 h-4" />
                      <span>Most Popular</span>
                    </div>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                    plan.color === 'primary' 
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600'
                      : plan.color === 'secondary'
                      ? 'bg-gradient-to-r from-secondary-500 to-secondary-600'
                      : 'bg-gradient-to-r from-gray-400 to-gray-500'
                  }`}>
                    <Crown className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  
                  <p className="text-gray-600 mb-4">
                    {plan.description}
                  </p>
                  
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">
                      ₹{price.toLocaleString()}
                    </span>
                    {price > 0 && (
                      <span className="text-gray-500 ml-2">
                        /{billingCycle === 'yearly' ? 'year' : 'month'}
                      </span>
                    )}
                    {savings > 0 && (
                      <div className="text-green-600 text-sm font-medium mt-1">
                        Save {savings}% with yearly billing
                      </div>
                    )}
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start space-x-3">
                      <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </div>
                  ))}
                  
                  {plan.limitations.map((limitation, limitationIndex) => (
                    <div key={limitationIndex} className="flex items-start space-x-3 opacity-60">
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 mt-0.5 flex-shrink-0"></div>
                      <span className="text-gray-500 text-sm">{limitation}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-300 ${
                    plan.popular
                      ? 'btn-primary'
                      : plan.id === 'free'
                      ? 'btn-outline'
                      : 'btn-secondary'
                  }`}
                >
                  {plan.id === 'free' ? 'Get Started Free' : 'Choose Plan'}
                  {plan.id !== 'free' && <ArrowRight className="w-4 h-4 ml-2 inline" />}
                </button>
              </motion.div>
            )
          })}
        </div>

        {/* Features Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="card mb-16"
        >
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Why Choose Tricity Match Premium?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Unlimited Access</h3>
              <p className="text-sm text-gray-600">
                Browse unlimited profiles and connect with more people
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Profile Insights</h3>
              <p className="text-sm text-gray-600">
                See who viewed your profile and get detailed analytics
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Premium Chat</h3>
              <p className="text-sm text-gray-600">
                Advanced chat features with read receipts and typing indicators
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Verified Profiles</h3>
              <p className="text-sm text-gray-600">
                Identity verification ensures genuine profiles and safety
              </p>
            </div>
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I change my plan anytime?
              </h3>
              <p className="text-gray-600 text-sm">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 mb-2">
                Is my payment information secure?
              </h3>
              <p className="text-gray-600 text-sm">
                Absolutely. We use industry-standard encryption and secure payment processors.
              </p>
            </div>
            
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 mb-2">
                What happens if I cancel?
              </h3>
              <p className="text-gray-600 text-sm">
                You'll continue to have access to premium features until your current billing period ends.
              </p>
            </div>
            
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600 text-sm">
                We offer a 7-day money-back guarantee for all premium plans.
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl p-8 text-white">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Find Your Perfect Match?
            </h2>
            <p className="text-primary-100 text-lg mb-6">
              Join thousands of successful couples who found love through Tricity Match
            </p>
            
            {!isAuthenticated ? (
              <Link
                to="/signup"
                className="bg-white text-primary-600 hover:bg-gray-50 font-medium py-3 px-8 rounded-xl transition-colors inline-flex items-center space-x-2"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to="/dashboard"
                className="bg-white text-primary-600 hover:bg-gray-50 font-medium py-3 px-8 rounded-xl transition-colors inline-flex items-center space-x-2"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Pricing

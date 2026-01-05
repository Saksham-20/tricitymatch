import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiCheck, FiStar } from 'react-icons/fi';

const Subscription = () => {
  const [plans, setPlans] = useState({});
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, subscriptionRes] = await Promise.all([
        api.get('/subscription/plans'),
        api.get('/subscription/my-subscription')
      ]);
      setPlans(plansRes.data.plans);
      setCurrentSubscription(subscriptionRes.data.subscription);
    } catch (error) {
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planType) => {
    try {
      const response = await api.post('/subscription/create-order', { planType });
      const { order } = response.data;

      // Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxxxxxx',
          amount: order.amount,
          currency: order.currency,
          name: 'TricityMatch',
          description: `${planType} Subscription`,
          order_id: order.id,
          handler: async (response) => {
            try {
              await api.post('/subscription/verify-payment', {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              });
              toast.success('Subscription activated successfully!');
              loadData();
            } catch (error) {
              toast.error('Payment verification failed');
            }
          },
          prefill: {
            email: 'user@example.com',
            contact: '9876543210'
          },
          theme: {
            color: '#9333ea'
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      };
      document.body.appendChild(script);
    } catch (error) {
      toast.error('Failed to create order');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const planFeatures = {
    free: ['Basic search', 'Limited likes', 'Profile viewing', 'View compatibility scores'],
    premium: ['Unlimited likes', 'View contacts', 'Chat with matches', 'See who liked you', 'Advanced search filters', 'Priority support'],
    elite: ['All Premium features', 'Verified badge', 'Profile boost', 'Priority in search results', 'Exclusive events', 'Dedicated support']
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold gradient-text mb-4">Choose Your Plan</h1>
          <p className="text-gray-600 text-lg">Unlock premium features to find your perfect match</p>
        </motion.div>

        {currentSubscription && currentSubscription.status === 'active' && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-green-800">
              You have an active <strong>{currentSubscription.planType}</strong> subscription
              {currentSubscription.endDate && (
                <span> until {new Date(currentSubscription.endDate).toLocaleDateString()}</span>
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {Object.entries(plans).map(([key, plan], index) => {
            const isCurrentPlan = currentSubscription?.planType === key && currentSubscription?.status === 'active';
            const isPopular = key === 'premium';

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`card relative ${isPopular ? 'ring-2 ring-purple-500 scale-105' : ''}`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                      <FiStar className="w-4 h-4" />
                      <span>Most Popular</span>
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold gradient-text">₹{plan.price}</span>
                    {plan.price > 0 && (
                      <span className="text-gray-600">/{plan.duration}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {(planFeatures[key] || []).map((feature, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <FiCheck className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(key)}
                  disabled={isCurrentPlan || key === 'free'}
                  className={`w-full py-3 rounded-lg font-semibold transition-all ${
                    isCurrentPlan
                      ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                      : key === 'free'
                      ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                      : isPopular
                      ? 'btn-primary'
                      : 'btn-secondary'
                  }`}
                >
                  {isCurrentPlan ? 'Current Plan' : key === 'free' ? 'Free Forever' : `Subscribe to ${plan.name}`}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Subscription;


import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, validateName } from '../utils/validators';
import { motion } from 'framer-motion';
import { SignupMultiStepForm } from '../components/ui/signup-multistep-form';
import { FiHeart, FiUsers, FiShield, FiCheckCircle, FiStar } from 'react-icons/fi';
import { fadeInUp, staggerContainer } from '../utils/animations';

const Signup = () => {
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleMultiStepComplete = async (data) => {
    // Split fullName into firstName and lastName (backend requires both, min 2 chars each)
    const nameParts = data.fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || "";
    let lastName = nameParts.slice(1).join(" ") || "";
    if (!lastName) lastName = firstName; // single name: use first name as last name so backend validation passes

    // Validate
    const newErrors = {};
    if (!validateEmail(data.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!validatePassword(data.password)) {
      newErrors.password = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';
    }
    if (!validateName(firstName)) {
      newErrors.fullName = 'Please enter your full name (at least 2 characters)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Prepare form data (backend expects firstName, lastName, email, password)
    const signupData = {
      email: data.email.trim(),
      password: data.password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    };

    setLoading(true);
    try {
      const result = await signup(signupData);
      setLoading(false);
      
      if (result.success) {
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      setLoading(false);
    }
  };

  const benefits = [
    { icon: FiCheckCircle, text: '100% Verified Profiles' },
    { icon: FiShield, text: 'Safe & Secure Platform' },
    { icon: FiUsers, text: 'Tricity Focused Community' },
    { icon: FiStar, text: 'Smart Match Algorithm' },
  ];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-neutral-50 via-primary-50/20 to-gold-50/30">
      {/* Left Side - Decorative (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-hero relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 border border-white rounded-full" />
          <div className="absolute bottom-40 right-10 w-96 h-96 border border-white rounded-full" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 border border-white rounded-full" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-md"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mb-8"
            >
              <FiHeart className="w-20 h-20 mx-auto" />
            </motion.div>
            
            <h1 className="text-4xl font-display font-bold mb-4">
              Begin Your Journey
            </h1>
            <p className="text-lg opacity-90 mb-10">
              Join India's most trusted matrimony platform and find your perfect life partner
            </p>
            
            {/* Benefits List */}
            <div className="space-y-4 text-left">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <benefit.icon className="w-5 h-5" />
                  </div>
                  <span className="text-base">{benefit.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            className="absolute bottom-20 left-20 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <p className="text-sm font-medium">50,000+ Active Members</p>
          </motion.div>

          <motion.div
            className="absolute bottom-32 right-20 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
          >
            <p className="text-sm font-medium">98% Satisfaction Rate</p>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerContainer}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <motion.div variants={fadeInUp} className="lg:hidden text-center mb-8">
            <span className="text-3xl font-display font-bold text-gradient-primary">
              TricityMatch
            </span>
          </motion.div>

          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center mb-8">
            <h2 className="text-3xl font-display font-bold text-neutral-800 mb-3">
              Create Your Profile
            </h2>
            <p className="text-neutral-600">
              Join TricityMatch to find your life partner. Your information is secure and private.
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div 
            variants={fadeInUp}
            className="card"
          >
            <SignupMultiStepForm onComplete={handleMultiStepComplete} errors={errors} loading={loading} />
          </motion.div>

          {/* Footer Link */}
          <motion.div variants={fadeInUp} className="mt-6 text-center">
            <p className="text-sm text-neutral-600">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="font-semibold text-primary-500 hover:text-primary-600 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </motion.div>

          {/* Trust Badges */}
          <motion.div 
            variants={fadeInUp}
            className="mt-8 flex items-center justify-center gap-6 text-xs text-neutral-500"
          >
            <div className="flex items-center gap-1">
              <FiShield className="w-4 h-4 text-success" />
              <span>SSL Secured</span>
            </div>
            <div className="flex items-center gap-1">
              <FiHeart className="w-4 h-4 text-primary-500" />
              <span>100% Privacy</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;

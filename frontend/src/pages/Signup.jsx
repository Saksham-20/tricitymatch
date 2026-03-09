import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, validateName } from '../utils/validators';
import { motion } from 'framer-motion';
import { SignupMultiStepForm } from '../components/ui/signup-multistep-form';
import Logo from '../components/common/Logo';
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
      {/* Left Side — Editorial panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 via-neutral-900 to-neutral-900" />

        {/* Orbit rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[38rem] h-[38rem] rounded-full border border-white/5 pointer-events-none"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] rounded-full border border-white/8 pointer-events-none"
        />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />

        <div className="relative z-10 flex flex-col justify-between w-full p-14 text-white">
          {/* Logo */}
          <div>
            <Logo variant="white" size="lg" linkTo="/" />
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">
              Chandigarh · Mohali · Panchkula
            </p>
          </div>

          {/* Main copy + benefits */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="max-w-sm"
          >
            <p className="text-xs font-semibold text-primary-400 uppercase tracking-widest mb-5">
              Begin your journey
            </p>
            <h2 className="font-display text-5xl font-bold leading-tight mb-5">
              Your forever<br />starts here.
            </h2>
            <p className="text-white/60 text-base leading-relaxed mb-8">
              Join Tricity's most trusted matrimony platform.
              Verified profiles, intelligent matching, family values.
            </p>

            {/* Benefits */}
            <div className="space-y-3">
              {benefits.map(({ icon: Icon, text }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.09 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-white/80" />
                  </div>
                  <span className="text-sm text-white/80">{text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Bottom strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center gap-5 text-xs text-white/40"
          >
            <div className="flex items-center gap-1.5">
              <FiShield className="w-3.5 h-3.5" />
              <span>SSL Secured</span>
            </div>
            <span className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <FiHeart className="w-3.5 h-3.5" />
              <span>100% Privacy</span>
            </div>
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
          <motion.div variants={fadeInUp} className="lg:hidden flex justify-center mb-8">
            <Logo size="lg" linkTo="/" />
          </motion.div>

          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center mb-8">
            <h2 className="text-3xl font-display font-bold text-neutral-800 mb-3">
              Create Your Profile
            </h2>
            <p className="text-neutral-600">
              Join TricityShadi to find your life partner. Your information is secure and private.
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

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, validateName } from '../utils/validators';
import { motion } from 'framer-motion';
import { SignupMultiStepForm } from '../components/ui/signup-multistep-form';

const Signup = () => {
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleMultiStepComplete = async (data) => {
    // Split fullName into firstName and lastName
    const nameParts = data.fullName.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Validate
    const newErrors = {};
    if (!validateEmail(data.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!validatePassword(data.password)) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!validateName(firstName)) {
      newErrors.fullName = 'Please enter your full name';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Prepare form data
    const signupData = {
      email: data.email,
      password: data.password,
      firstName,
      lastName,
    };

    setLoading(true);
    try {
      const result = await signup(signupData);
      setLoading(false);
      
      if (result.success) {
        // Small delay to ensure state is updated
        setTimeout(() => {
          navigate('/profile');
        }, 100);
      }
    } catch (error) {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-neutral-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-semibold text-neutral-800 mb-3">Create Your Account</h2>
          <p className="text-neutral-600 text-base">Join TricityMatch to find your life partner. Your information is secure and private.</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-lg border border-neutral-200 p-8 md:p-10">
          <SignupMultiStepForm onComplete={handleMultiStepComplete} errors={errors} />
        </div>

        {/* Footer Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:text-primary-600 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;


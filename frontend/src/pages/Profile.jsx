import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { ProfileMultiStepForm } from '../components/ui/profile-multistep-form';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({});
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Check if user has premium subscription
  const [isPremium, setIsPremium] = useState(false);
  
  useEffect(() => {
    checkSubscription();
  }, []);
  
  const checkSubscription = async () => {
    try {
      const response = await api.get('/subscription/my-subscription');
      const subscription = response.data.subscription;
      setIsPremium(subscription?.status === 'active' && ['premium', 'elite'].includes(subscription?.planType));
    } catch (error) {
      setIsPremium(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/profile/me');
      const profileData = response.data.profile;
      setProfile(profileData);
      setFormData(profileData || {});
      
      // Determine which step to show based on completion
      if (profileData) {
        const completion = profileData.completionPercentage || 0;
        if (completion < 30) setActiveStep(0);
        else if (completion < 50) setActiveStep(1);
        else if (completion < 70) setActiveStep(2);
        else if (completion < 85) setActiveStep(3);
        else if (completion < 95) setActiveStep(4);
        else setActiveStep(5);
      }
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataObj = new FormData();
    formDataObj.append(field === 'profilePhoto' ? 'profilePhoto' : 'photos', file);

    try {
      const response = await api.put('/profile/me', formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setProfile(response.data.profile);
      setFormData(response.data.profile);
      toast.success('Photo uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload photo');
    }
  };

  const handleMultiStepComplete = async (data) => {
    try {
      const response = await api.put('/profile/me', data);
      setProfile(response.data.profile);
      setFormData(response.data.profile);
      toast.success('Profile updated successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const calculateProgress = () => {
    if (!profile) return 0;
    return profile.completionPercentage || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">Complete Your Profile</h1>
            
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Profile Completion</span>
                <span className="text-sm font-medium text-primary-600">{calculateProgress()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-primary-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
              {calculateProgress() < 100 && (
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Complete your profile for better matches
                </p>
              )}
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 md:p-10">
            <ProfileMultiStepForm
              initialData={formData}
              onComplete={handleMultiStepComplete}
              onStepChange={(step) => setActiveStep(step)}
              isPremium={isPremium}
              profile={profile}
              onFileUpload={handleFileUpload}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};


export default Profile;


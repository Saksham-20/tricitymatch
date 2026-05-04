import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { OnboardingProvider, useOnboarding } from '../context/OnboardingContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiX, FiArrowLeft, FiArrowRight, FiCheck, FiAlertCircle } from 'react-icons/fi';

// Import step components
import BasicInfoStep from '../components/onboarding/steps/BasicInfoStep';
import LocationStep from '../components/onboarding/steps/LocationStep';
import ReligionStep from '../components/onboarding/steps/ReligionStep';
import MaritalStatusStep from '../components/onboarding/steps/MaritalStatusStep';
import EducationStep from '../components/onboarding/steps/EducationStep';
import FamilyStep from '../components/onboarding/steps/FamilyStep';
import LifestyleStep from '../components/onboarding/steps/LifestyleStep';
import AboutYourselfStep from '../components/onboarding/steps/AboutYourselfStep';
import PreferencesStep from '../components/onboarding/steps/PreferencesStep';
import PhotosStep from '../components/onboarding/steps/PhotosStep';
import Progress from '../components/ui/Progress';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

const EditStepComponents = [
  BasicInfoStep,
  LocationStep,
  ReligionStep,
  MaritalStatusStep,
  EducationStep,
  FamilyStep,
  LifestyleStep,
  AboutYourselfStep,
  PreferencesStep,
  PhotosStep,
];

// Step definitions for editing (no account/welcome steps)
const EDIT_STEPS = [
  { number: 0, title: 'Basic Information', icon: 'Info' },
  { number: 1, title: 'Location', icon: 'MapPin' },
  { number: 2, title: 'Religion & Community', icon: 'Heart' },
  { number: 3, title: 'Marital Status', icon: 'Ring' },
  { number: 4, title: 'Education & Career', icon: 'Briefcase' },
  { number: 5, title: 'Family Background', icon: 'Users' },
  { number: 6, title: 'Lifestyle', icon: 'Smile' },
  { number: 7, title: 'About Yourself', icon: 'BookOpen' },
  { number: 8, title: 'Preferences', icon: 'Heart' },
  { number: 9, title: 'Photos', icon: 'Camera' },
];

/**
 * ModernProfileEditor - Edit existing profile using modern onboarding UI
 * Shows same beautiful interface as signup but for updating existing profile
 */
const ModernProfileEditorContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formData, currentStep, nextStep, prevStep, goToStep, isLoading, setIsLoading } = useOnboarding();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [existingProfile, setExistingProfile] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load existing profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/profile/me');
      const profile = response.data.profile;
      setExistingProfile(profile);
    } catch (error) {
      toast.error('Failed to load profile');
      navigate('/profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!formData) return;

    setIsLoading(true);
    try {
      // Prepare FormData for file uploads
      const submitData = new FormData();

      // Add all form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (value instanceof File) {
          submitData.append(key, value);
        } else if (Array.isArray(value)) {
          value.forEach((item) => {
            // Append multiple items with the exact same key name
            // Multer/busboy natively parses this into an array, and correctly identifies 'photos' without rejecting it as an unexpected field
            submitData.append(key, item);
          });
        } else if (typeof value === 'object' && value !== null) {
          submitData.append(key, JSON.stringify(value));
        } else if (value !== null && value !== undefined && value !== '') {
          submitData.append(key, value);
        }
      });

      const response = await api.put('/profile/me', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setSaveSuccess(true);
        toast.success('Profile updated successfully!');
        
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate('/profile');
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving profile:', error.response?.data || error);
      
      // Try to extract detailed validation errors if they exist
      const details = error.response?.data?.error?.details;
      let errorMessage = error.response?.data?.message || 'Failed to update profile';
      
      if (Array.isArray(details) && details.length > 0) {
        errorMessage = details.map(d => d.message).join(', ');
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!existingProfile) {
    return <LoadingSpinner fullScreen message="Loading your profile..." />;
  }

  const CurrentStepComponent = EditStepComponents[currentStep];
  const completionPercentage = Math.round((currentStep / EditStepComponents.length) * 100);
  const isLastStep = currentStep === EditStepComponents.length - 1;

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-neutral-50 via-primary-50/20 to-gold-50/30">
      {/* Left Panel - Desktop Only */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 via-neutral-900 to-neutral-900" />

        {/* Orbital rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[38rem] h-[38rem] rounded-full border border-white/5 pointer-events-none"
        />

        {/* Content */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-10">
          <div>
            <h2 className="text-4xl font-bold text-white mb-4">
              Update Your Profile
            </h2>
            <p className="text-lg text-neutral-300 mb-8">
              Keep your profile fresh and complete to get better matches
            </p>

            {/* Benefits */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <FiCheck className="text-white" size={16} />
                </div>
                <div>
                  <p className="text-white font-semibold">More Visibility</p>
                  <p className="text-neutral-400 text-sm">Complete profiles get 3x more matches</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <FiCheck className="text-white" size={16} />
                </div>
                <div>
                  <p className="text-white font-semibold">Better Matches</p>
                  <p className="text-neutral-400 text-sm">Detailed info helps us suggest perfect matches</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <FiCheck className="text-white" size={16} />
                </div>
                <div>
                  <p className="text-white font-semibold">Auto-Save</p>
                  <p className="text-neutral-400 text-sm">Changes saved automatically as you go</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div>
            <p className="text-neutral-400 text-sm mb-2">Profile Completion</p>
            <Progress value={completionPercentage} max={100} showLabel />
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-neutral-200 px-6 py-4 flex justify-between items-center">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-neutral-900 lg:hidden">Edit Profile</h1>
          </div>
          <button
            onClick={() => setShowExitDialog(true)}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Close editor"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Progress bar for mobile */}
        <div className="lg:hidden bg-white px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-neutral-900">
              {EDIT_STEPS[currentStep].title}
            </span>
            <span className="text-xs text-neutral-600">
              {currentStep + 1} of {EditStepComponents.length}
            </span>
          </div>
          <Progress value={completionPercentage} max={100} />
        </div>

        {/* Desktop stepper */}
        <div className="hidden lg:flex bg-white border-b border-neutral-200 overflow-x-auto">
          {EDIT_STEPS.map((step, idx) => (
            <motion.button
              key={idx}
              onClick={() => goToStep(idx)}
              className={`flex-1 py-4 px-4 text-center border-b-2 flex flex-col items-center gap-2 ${
                idx === currentStep
                  ? 'border-b-primary-600'
                  : idx < currentStep
                  ? 'border-b-green-500'
                  : 'border-b-neutral-200 hover:border-b-neutral-300'
              }`}
              whileHover={{ backgroundColor: idx === currentStep ? 'transparent' : '#f5f5f5' }}
            >
              <span className={`text-xs font-semibold ${
                idx === currentStep
                  ? 'text-primary-600'
                  : idx < currentStep
                  ? 'text-green-600'
                  : 'text-neutral-600'
              }`}>
                {idx < currentStep ? '✓' : `${idx + 1}`}
              </span>
              <span className={`text-xs hidden xl:block ${
                idx === currentStep
                  ? 'text-primary-600'
                  : 'text-neutral-600'
              }`}>
                {step.title}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {saveSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col items-center justify-center"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <FiCheck className="text-green-600" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900 mb-2">Profile Updated!</h2>
                <p className="text-neutral-600">
                  Your profile has been successfully updated.
                </p>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {CurrentStepComponent && <CurrentStepComponent />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer with navigation */}
        {!saveSuccess && (
          <div className="bg-white border-t border-neutral-200 p-6 lg:p-8">
            <div className="flex gap-3 justify-between max-w-2xl mx-auto">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0 || isLoading}
                className="flex items-center gap-2"
              >
                <FiArrowLeft size={18} />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <div className="text-center">
                <p className="text-sm text-neutral-600">
                  Step {currentStep + 1} of {EditStepComponents.length}
                </p>
              </div>

              {isLastStep ? (
                <Button
                  onClick={handleSaveProfile}
                  loading={isLoading}
                  className="flex items-center gap-2"
                >
                  <FiCheck size={18} />
                  <span className="hidden sm:inline">Save Profile</span>
                  <span className="sm:hidden">Save</span>
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <span className="hidden sm:inline">Next</span>
                  <span className="sm:hidden">Next</span>
                  <FiArrowRight size={18} />
                </Button>
              )}
            </div>

            {/* Mobile save note */}
            <p className="text-xs text-neutral-500 text-center mt-4 lg:hidden">
              Changes saved when you click Save
            </p>
          </div>
        )}
      </div>

      {/* Exit Dialog */}
      <AnimatePresence>
        {showExitDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg p-6 max-w-sm"
            >
              <h3 className="text-lg font-bold text-neutral-900 mb-2 flex items-center gap-2">
                <FiAlertCircle className="text-orange-500" />
                Exit Editor?
              </h3>
              <p className="text-neutral-600 mb-6">
                Any unsaved changes will be lost. Are you sure?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowExitDialog(false)}
                  className="flex-1"
                >
                  Continue Editing
                </Button>
                <Button
                  variant="danger"
                  onClick={() => navigate('/profile')}
                  className="flex-1"
                >
                  Exit
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Main export with context wrapper
const ModernProfileEditor = () => {
  return (
    <OnboardingProvider mode="edit">
      <ModernProfileEditorContent />
    </OnboardingProvider>
  );
};

export default ModernProfileEditor;

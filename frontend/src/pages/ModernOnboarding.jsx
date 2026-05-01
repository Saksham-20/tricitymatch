import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding, STEPS, OnboardingProvider } from '../context/OnboardingContext';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/common/Logo';
import Progress from '../components/ui/Progress';
import { Button } from '../components/ui/Button';
import {
  FiChevronRight,
  FiChevronLeft,
  FiX,
  FiCheckCircle,
  FiLock,
  FiDollarSign,
  FiTrendingUp,
  FiAward,
} from 'react-icons/fi';

// Import step components
import WelcomeStep from '../components/onboarding/steps/WelcomeStep';
import CreatingForStep from '../components/onboarding/steps/CreatingForStep';
import CreateAccountStep from '../components/onboarding/steps/CreateAccountStep';
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
import VerificationStep from '../components/onboarding/steps/VerificationStep';

// All available step components (mapped by step id)
const allStepComponents = {
  0: WelcomeStep,
  0.5: CreatingForStep,
  1: CreateAccountStep,
  2: BasicInfoStep,
  3: LocationStep,
  4: ReligionStep,
  5: MaritalStatusStep,
  6: EducationStep,
  7: FamilyStep,
  8: LifestyleStep,
  9: AboutYourselfStep,
  10: PreferencesStep,
  11: PhotosStep,
  12: VerificationStep,
};

const ModernOnboarding = () => {
  const [searchParams] = useSearchParams();
  const createForOther = searchParams.get('createFor') === 'other';

  return (
    <OnboardingProvider mode={createForOther ? 'create_for_other' : 'signup'}>
      <ModernOnboardingContent />
    </OnboardingProvider>
  );
};

const ModernOnboardingContent = () => {
  const {
    currentStep,
    nextStep,
    prevStep,
    goToStep,
    formData,
    getCompletionPercentage,
    clearDraft,
    isLoading,
    setIsLoading,
    mode,
    visibleSteps,
    validateCurrentStep,
  } = useOnboarding();

  const navigate = useNavigate();
  const { signup } = useAuth();
  const [searchParams] = useSearchParams();
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const referralCode = searchParams.get('ref');

  // Build stepComponents array based on visible steps
  const stepComponents = visibleSteps.map(step => allStepComponents[step.id]);

  useEffect(() => {
    setCompletionPercentage(getCompletionPercentage());
  }, [formData, getCompletionPercentage]);

  const handleQuit = () => {
    setShowQuitDialog(true);
  };

  const confirmQuit = () => {
    // Keep draft for resume later
    navigate('/');
  };

  const handleNext = () => {
    if (validateCurrentStep()) nextStep();
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      if (mode === 'signup' || mode === 'create_for_other') {
        const signupData = { ...formData };
        if (referralCode) {
          signupData.referralCode = referralCode;
        }
        const result = await signup(signupData);
        if (result.success) {
          clearDraft();
          navigate('/dashboard');
        }
      } else {
        clearDraft();
        navigate('/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const Step = stepComponents[currentStep];

  if (!visibleSteps || !visibleSteps[currentStep] || !Step) {
    return null; // Return null while synchronizing steps to prevent crash
  }

  const progressPercentage = ((currentStep + 1) / visibleSteps.length) * 100;

  const benefits = [
    { icon: FiCheckCircle, text: '100% Verified Profiles' },
    { icon: FiLock, text: 'Safe & Secure' },
    { icon: FiDollarSign, text: 'Premium Features' },
    { icon: FiAward, text: 'Smart Matching' },
  ];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-neutral-50 via-primary-50/20 to-gold-50/30">
      {/* Mobile: Hide left panel, show only on desktop */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-neutral-900">
        {/* Animated background */}
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

        {/* Top gradient line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />

        <div className="relative z-10 flex flex-col justify-between w-full p-14 text-white">
          {/* Logo */}
          <div>
            <Logo variant="white" size="lg" linkTo="/" />
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">
              Chandigarh · Mohali · Panchkula
            </p>
          </div>

          {/* Main message */}
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
              Join Tricity's #1 matrimony platform. Verified profiles, intelligent matching, family values.
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

            {/* Current step indicator (desktop) */}
            <div className="mt-12 pt-8 border-t border-white/10">
              <p className="text-xs text-white/50 mb-3">Step {currentStep + 1} of {visibleSteps.length}</p>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-white">{visibleSteps[currentStep].title}</p>
                <span className="text-xs text-white/60">{Math.round(progressPercentage)}%</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </motion.div>

          {/* Bottom security note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center gap-5 text-xs text-white/40"
          >
            <div className="flex items-center gap-1.5">
              <FiLock className="w-3.5 h-3.5" />
              <span>SSL Secured</span>
            </div>
            <span className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <FiTrendingUp className="w-3.5 h-3.5" />
              <span>100% Privacy</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative">
        {/* Close button (mobile) */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={handleQuit}
          className="absolute top-4 right-4 lg:hidden p-2 hover:bg-neutral-100 rounded-full transition-colors"
          title="Exit onboarding"
        >
          <FiX className="w-6 h-6 text-neutral-600" />
        </motion.button>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-2xl"
        >
          {/* Mobile Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden flex justify-center mb-8"
          >
            <Logo size="lg" linkTo="/" />
          </motion.div>

          {/* Progress stepper - Desktop */}
          <motion.div className="hidden lg:flex justify-between mb-12">
            {visibleSteps.map((step, idx) => (
              <motion.button
                key={step.id}
                onClick={() => idx <= currentStep && goToStep(idx)}
                disabled={idx > currentStep}
                className={`flex flex-col items-center gap-2 group transition-opacity ${
                  idx > currentStep ? 'opacity-40' : 'opacity-100'
                }`}
                whileHover={idx <= currentStep ? { scale: 1.05 } : {}}
              >
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                    idx < currentStep
                      ? 'bg-primary-600 text-white'
                      : idx === currentStep
                      ? 'bg-primary-600 text-white ring-2 ring-primary-300 ring-offset-2'
                      : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {idx < currentStep ? <FiCheckCircle className="w-5 h-5" /> : idx + 1}
                </motion.div>
                <p className="text-xs font-medium text-neutral-700 text-center w-16 leading-tight">
                  {step.title}
                </p>
              </motion.button>
            ))}
          </motion.div>

          {/* Progress bar - Mobile */}
          <motion.div className="lg:hidden mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-neutral-900">
                {visibleSteps[currentStep].title}
              </p>
              <p className="text-xs text-neutral-500">
                {currentStep + 1}/{visibleSteps.length}
              </p>
            </div>
            <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>

          {/* Form content with fade/slide animation */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-xl p-8 sm:p-10"
            >
              <div className="mb-8">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-xs font-semibold text-primary-600 uppercase tracking-widest mb-2"
                >
                  {visibleSteps[currentStep].icon && `Step ${currentStep + 1}`}
                </motion.p>
                <motion.h2
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-3"
                >
                  {visibleSteps[currentStep].title}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-neutral-600"
                >
                  {visibleSteps[currentStep].description}
                </motion.p>
              </div>

              {/* Step component */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Step />
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 flex gap-4"
          >
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="lg"
                onClick={prevStep}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <FiChevronLeft className="w-5 h-5" />
                Back
              </Button>
            )}

            <Button
              size="lg"
              onClick={currentStep === visibleSteps.length - 1 ? handleComplete : handleNext}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {isLoading ? 'Processing...' : currentStep === visibleSteps.length - 1 ? 'Complete' : 'Next'}
              {!isLoading && currentStep !== visibleSteps.length - 1 && <FiChevronRight className="w-5 h-5" />}
            </Button>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-center text-sm text-neutral-600"
          >
            {currentStep === 0 ? (
              <p>
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
                  Sign in
                </Link>
              </p>
            ) : (
              <button
                onClick={handleQuit}
                className="text-primary-600 hover:text-primary-700 font-medium underline"
              >
                Save & Exit
              </button>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Quit confirmation dialog */}
      <AnimatePresence>
        {showQuitDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowQuitDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-sm shadow-2xl"
            >
              <h3 className="text-lg font-bold text-neutral-900 mb-2">Save your progress?</h3>
              <p className="text-neutral-600 mb-6">
                Your draft is saved. You can continue anytime you're ready.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowQuitDialog(false)}
                  className="flex-1"
                >
                  Continue
                </Button>
                <Button onClick={confirmQuit} className="flex-1">
                  Exit & Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModernOnboarding;

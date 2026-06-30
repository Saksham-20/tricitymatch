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
  FiTrendingUp,
} from 'react-icons/fi';

// Import step components
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
    updateFormData,
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
  const referralCodeParam = searchParams.get('ref');

  // Build stepComponents array based on visible steps
  const stepComponents = visibleSteps.map(step => allStepComponents[step.id]);

  useEffect(() => {
    setCompletionPercentage(getCompletionPercentage());
  }, [formData, getCompletionPercentage]);

  // Reset scroll to top on every step change so users start at the top of the
  // new step (especially on mobile, where the previous step may have been long).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  useEffect(() => {
    if (referralCodeParam && !formData.referralCode) {
      updateFormData('referralCode', referralCodeParam);
    }
  }, [referralCodeParam]);

  const handleQuit = () => {
    setShowQuitDialog(true);
  };

  const confirmQuit = () => {
    // Keep draft for resume later
    navigate('/');
  };

  // Surface the first validation error when a step fails — otherwise on long
  // steps the error renders off-screen and Next looks broken.
  const scrollToFirstError = () => {
    setTimeout(() => {
      const el = document.querySelector('[aria-invalid="true"], .text-red-600, .text-destructive');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const field = el.closest('div')?.querySelector('input, select, textarea');
        field?.focus({ preventScroll: true });
      }
    }, 60);
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      nextStep();
    } else {
      scrollToFirstError();
    }
  };

  const handleComplete = async () => {
    if (!validateCurrentStep()) { scrollToFirstError(); return; }
    setIsLoading(true);
    try {
      if (mode === 'signup' || mode === 'create_for_other') {
        const signupData = { ...formData };
        if (signupData.phone) signupData.phone = String(signupData.phone).replace(/[\s-]/g, '');
        if (!signupData.email) delete signupData.email; // phone-only signup
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

  const ringR = 26;
  const ringC = 2 * Math.PI * ringR;

  return (
    <div className="min-h-screen flex bg-neutral-50 dark:bg-[#0f1117]">
      {/* Desktop: LIGHT brand / progress rail (burgundy as accent, never a slab) */}
      <div className="hidden lg:flex lg:w-[22rem] xl:w-96 relative overflow-hidden bg-white dark:bg-[#1a1f2e] border-r border-neutral-100 dark:border-neutral-800">
        {/* Subtle primary wash + faint rings (neutral, not white-on-burgundy) */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/70 dark:from-primary-900/20 via-white dark:via-[#1a1f2e] to-white dark:to-[#1a1f2e] pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-72 h-72 border border-neutral-200/60 dark:border-neutral-700/40 rounded-full pointer-events-none" />
        <div className="absolute top-1/3 -right-16 w-48 h-48 border border-gold-200/50 rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col w-full p-9">
          {/* Logo */}
          <div className="mb-8">
            <Logo size="lg" linkTo="/" />
            <p className="text-[11px] text-neutral-400 mt-1.5 uppercase tracking-widest">
              Chandigarh · Mohali · Panchkula
            </p>
          </div>

          {/* Progress ring */}
          <div className="flex items-center gap-4 mb-8">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                <circle cx="32" cy="32" r={ringR} fill="none" stroke="currentColor" className="text-neutral-200 dark:text-neutral-700" strokeWidth="5" />
                <motion.circle
                  cx="32" cy="32" r={ringR} fill="none" stroke="#8B2346" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={ringC}
                  initial={false}
                  animate={{ strokeDashoffset: ringC - (progressPercentage / 100) * ringC }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-primary-600 dark:text-primary-300">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-primary-600 dark:text-primary-300 uppercase tracking-widest">Begin your journey</p>
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-neutral-100 leading-tight">Your forever starts here</h2>
            </div>
          </div>

          {/* Vertical 14-step stepper */}
          <nav className="flex-1 overflow-y-auto scrollbar-hide -mr-2 pr-2">
            <ol className="space-y-0.5">
              {visibleSteps.map((step, idx) => {
                const done = idx < currentStep;
                const active = idx === currentStep;
                const reachable = idx <= currentStep;
                return (
                  <li key={step.id}>
                    <button
                      onClick={() => reachable && goToStep(idx)}
                      disabled={!reachable}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors ${
                        active ? 'bg-primary-50 dark:bg-primary-900/30' : reachable ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50' : ''
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-all ${
                          done
                            ? 'bg-primary-500 text-white'
                            : active
                            ? 'bg-primary-500 text-white ring-2 ring-primary-300 ring-offset-2 ring-offset-white dark:ring-offset-[#1a1f2e]'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {done ? <FiCheckCircle className="w-4 h-4" /> : idx + 1}
                      </span>
                      <span className={`text-sm leading-tight ${active ? 'font-semibold text-neutral-900 dark:text-neutral-100' : done ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-400'}`}>
                        {step.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Trust strip */}
          <div className="flex items-center gap-5 text-xs text-neutral-400 mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-1.5">
              <FiLock className="w-3.5 h-3.5" />
              <span>SSL Secured</span>
            </div>
            <span className="w-px h-3 bg-neutral-200" />
            <div className="flex items-center gap-1.5">
              <FiTrendingUp className="w-3.5 h-3.5" />
              <span>100% Privacy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative">
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
            className="lg:hidden flex justify-center mb-6"
          >
            <Logo size="lg" linkTo="/" />
          </motion.div>

          {/* Mobile tab switcher */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden flex rounded-2xl bg-neutral-100 p-1 mb-6"
          >
            <Link
              to="/login"
              className="flex-1 py-3 text-center text-sm font-semibold rounded-xl text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              Sign In
            </Link>
            <span className="flex-1 py-3 text-center text-sm font-semibold rounded-xl bg-white shadow-sm text-neutral-900">
              Create Profile
            </span>
          </motion.div>

          {/* Progress bar - Mobile (desktop uses the left rail stepper) */}
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
              className="bg-white dark:bg-[#1a1f2e] border border-neutral-100 dark:border-neutral-800 rounded-2xl shadow-card p-8 sm:p-10"
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
                  className="font-display text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-3"
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

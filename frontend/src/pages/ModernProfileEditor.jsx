import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { OnboardingProvider, useOnboarding } from '../context/OnboardingContext';
import api from '../api/axios';
import { buildProfileFormData } from '../utils/profileSubmit';
import { validateAge } from '../utils/validators';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import toast from 'react-hot-toast';
import { FiX, FiArrowLeft, FiArrowRight, FiCheck, FiAlertCircle } from 'react-icons/fi';

// Import step components
import BasicInfoStep from '../components/onboarding/steps/BasicInfoStep';
import LocationStep from '../components/onboarding/steps/LocationStep';
import ReligionStep from '../components/onboarding/steps/ReligionStep';
import HoroscopeStep from '../components/onboarding/steps/HoroscopeStep';
import MaritalStatusStep from '../components/onboarding/steps/MaritalStatusStep';
import EducationStep from '../components/onboarding/steps/EducationStep';
import FamilyStep from '../components/onboarding/steps/FamilyStep';
import LifestyleStep from '../components/onboarding/steps/LifestyleStep';
import AboutYourselfStep from '../components/onboarding/steps/AboutYourselfStep';
import SocialConnectionsStep from '../components/onboarding/steps/SocialConnectionsStep';
import PreferencesStep from '../components/onboarding/steps/PreferencesStep';
import PhotosStep from '../components/onboarding/steps/PhotosStep';
import Progress from '../components/ui/Progress';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Step id → component. The editor renders whatever `visibleSteps` (from the
// OnboardingContext, filtered for mode='edit') contains — the SAME list that
// bounds navigation. Deriving both from one source is what keeps the last step
// reachable; the old parallel arrays drifted (11 nav steps vs 12 rendered) and
// made Photos unreachable.
const EDIT_STEP_COMPONENTS = {
  2: BasicInfoStep,
  3: LocationStep,
  4: ReligionStep,
  4.5: HoroscopeStep,
  5: MaritalStatusStep,
  6: EducationStep,
  7: FamilyStep,
  8: LifestyleStep,
  9: AboutYourselfStep,
  9.5: SocialConnectionsStep,
  10: PreferencesStep,
  11: PhotosStep,
};

/**
 * ModernProfileEditor - Edit existing profile using modern onboarding UI
 * Shows same beautiful interface as signup but for updating existing profile
 */
// Deep-linkable sections (e.g. the post-signup preview card sends members
// straight to Photos with /profile/edit?section=photos).
const SECTION_INDEX = {
  basic: 0, location: 1, religion: 2, horoscope: 3, marital: 4, education: 5,
  family: 6, lifestyle: 7, about: 8, social: 9, preferences: 10, photos: 11,
};

const ModernProfileEditorContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formData, currentStep, nextStep, prevStep, goToStep, isLoading, setIsLoading, visibleSteps } = useOnboarding();
  const stepComponents = visibleSteps.map((s) => EDIT_STEP_COMPONENTS[s.id]);
  const totalSteps = stepComponents.length;
  // `leaveTo` doubles as the exit-dialog trigger: a destination string (or the
  // '__back__' sentinel) when a navigation is pending, null when closed.
  const [leaveTo, setLeaveTo] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Dirty tracking ─────────────────────────────────────────────────────────
  // Baseline snapshot of the hydrated form; File photos stringify to {} which is
  // stable, so selecting a photo still flips dirty. Reset after a save.
  const baselineRef = useRef(null);
  if (baselineRef.current === null) baselineRef.current = JSON.stringify(formData);
  const isDirty = useMemo(
    () => !saveSuccess && JSON.stringify(formData) !== baselineRef.current,
    [formData, saveSuccess]
  );

  // ── Focus management on section change ───────────────────────────────────────
  const sectionRef = useRef(null);
  const focusSectionRef = useRef(false);
  const goWithFocus = (fn) => (...args) => { focusSectionRef.current = true; fn(...args); };
  const handleNext = goWithFocus(nextStep);
  const handlePrev = goWithFocus(prevStep);
  const handleGoTo = goWithFocus(goToStep);

  useUnsavedChangesGuard(isDirty, setLeaveTo);

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section');
    if (section && SECTION_INDEX[section] !== undefined) {
      goToStep(SECTION_INDEX[section]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lenient pre-save check — the editor never blocks section navigation, but a
  // few numeric fields would 400/500 the PUT. Validate ONLY filled fields (edit
  // mode must not force optional signup fields) and jump to the offending
  // section. Returns null when OK, else { section, message }.
  const validateBeforeSave = () => {
    if (formData.weight !== '' && formData.weight != null) {
      const w = Number(formData.weight);
      if (!Number.isInteger(w) || w < 30 || w > 300) {
        return { section: SECTION_INDEX.basic, message: 'Weight must be between 30–300 kg' };
      }
    }
    if (formData.dateOfBirth && !validateAge(formData.dateOfBirth, 18, 100)) {
      return { section: SECTION_INDEX.basic, message: 'You must be at least 18 years old' };
    }
    const min = Number(formData.preferredAgeMin);
    const max = Number(formData.preferredAgeMax);
    if (formData.preferredAgeMin && formData.preferredAgeMax && min > max) {
      return { section: SECTION_INDEX.preferences, message: 'Minimum age cannot exceed maximum age' };
    }
    return null;
  };

  // Persist; returns true on success (no navigation — callers decide what next).
  const saveProfile = async () => {
    if (!formData) return false;
    const problem = validateBeforeSave();
    if (problem) {
      handleGoTo(problem.section);
      toast.error(problem.message);
      return false;
    }
    setIsLoading(true);
    try {
      // Whitelisted multipart build (never sends password/identifier/email/flags)
      const submitData = buildProfileFormData(formData);
      const response = await api.put('/profile/me', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        baselineRef.current = JSON.stringify(formData); // clean → disarm guard
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error saving profile:', error.response?.data || error);
      const details = error.response?.data?.error?.details;
      let errorMessage = error.response?.data?.message || 'Failed to update profile';
      if (Array.isArray(details) && details.length > 0) {
        errorMessage = details.map((d) => d.message).join(', ');
      }
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const ok = await saveProfile();
    if (ok) {
      setSaveSuccess(true);
      toast.success('Profile updated successfully!');
      setTimeout(() => navigate('/profile'), 2000);
    }
  };

  // Exit-dialog resolutions.
  const resolveDest = (dest) => (dest === '__back__' ? '/profile' : dest);
  const discardAndLeave = () => {
    const dest = resolveDest(leaveTo);
    baselineRef.current = JSON.stringify(formData); // disarm so navigate isn't re-caught
    setLeaveTo(null);
    navigate(dest);
  };
  const saveAndLeave = async () => {
    const dest = resolveDest(leaveTo);
    const ok = await saveProfile();
    if (ok) { setLeaveTo(null); toast.success('Profile updated'); navigate(dest); }
  };

  const CurrentStepComponent = stepComponents[currentStep];
  const completionPercentage = Math.round((currentStep / totalSteps) * 100);
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="min-h-screen flex bg-neutral-50 dark:bg-[#0f1117] pb-16 md:pb-0">
      {/* Left Panel — LIGHT brand rail (burgundy accent, not a slab) */}
      <div className="hidden lg:flex lg:w-[24rem] xl:w-[28rem] relative overflow-hidden bg-white dark:bg-[#1a1f2e] border-r border-neutral-100 dark:border-neutral-800">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/70 dark:from-primary-900/20 via-white dark:via-[#1a1f2e] to-white dark:to-[#1a1f2e] pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-72 h-72 border border-neutral-200/60 dark:border-neutral-700/40 rounded-full pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-10">
          <div>
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-gold-50 border border-gold-200 rounded-full">
              <span className="text-gold-700 text-xs font-semibold uppercase tracking-wide">Your Profile</span>
            </div>
            <h2 className="font-display text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              Update Your Profile
            </h2>
            <p className="text-base text-neutral-500 mb-8">
              Keep your profile fresh and complete to get better matches
            </p>

            {/* Benefits */}
            <div className="space-y-4">
              {[
                { t: 'More Visibility', d: 'Complete profiles get 3x more matches' },
                { t: 'Better Matches', d: 'Detailed info helps us suggest perfect matches' },
                { t: 'Easy Editing', d: 'Step through sections and save when ready' },
              ].map(({ t, d }) => (
                <div key={t} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiCheck className="text-primary-600 dark:text-primary-300" size={14} />
                  </div>
                  <div>
                    <p className="text-neutral-900 dark:text-neutral-100 font-semibold">{t}</p>
                    <p className="text-neutral-500 text-sm">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Wizard position (NOT profile completeness — this is how far through
              the editor you are, so it must not read as a completion %). */}
          <div>
            <p className="text-neutral-500 text-sm mb-2">
              Section {currentStep + 1} of {totalSteps}
            </p>
            <Progress value={completionPercentage} max={100} />
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-[#1a1f2e] border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex justify-between items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-neutral-900 lg:hidden">Edit Profile</h1>
          </div>
          {/* Save is available from any step — no need to walk the whole wizard
              to change one field. Dirty-aware: nothing to save when clean. */}
          {!saveSuccess && (
            <Button
              onClick={handleSaveProfile}
              loading={isLoading}
              disabled={!isDirty}
              size="sm"
              className="flex items-center gap-1.5"
            >
              <FiCheck size={16} />
              {isDirty ? 'Save' : 'Saved'}
            </Button>
          )}
          <button
            onClick={() => (isDirty ? setLeaveTo('/profile') : navigate('/profile'))}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Close editor"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Progress + section jump for mobile/tablet (no stepper below lg, so
            this is the only way to reach an arbitrary section without paging). */}
        <div className="lg:hidden bg-white dark:bg-[#1a1f2e] px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-3 gap-3">
            <label htmlFor="section-jump" className="sr-only">Jump to section</label>
            <select
              id="section-jump"
              value={currentStep}
              onChange={(e) => handleGoTo(Number(e.target.value))}
              className="flex-1 min-w-0 text-sm font-semibold text-neutral-900 dark:text-neutral-100 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {visibleSteps.map((step, idx) => (
                <option key={idx} value={idx}>{step.title}</option>
              ))}
            </select>
            <span className="text-xs text-neutral-600 flex-shrink-0">
              {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <Progress value={completionPercentage} max={100} />
        </div>

        {/* Desktop stepper */}
        <nav aria-label="Profile sections" className="hidden lg:flex bg-white dark:bg-[#1a1f2e] border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          {visibleSteps.map((step, idx) => (
            <motion.button
              key={idx}
              onClick={() => handleGoTo(idx)}
              aria-current={idx === currentStep ? 'step' : undefined}
              className={`flex-1 py-4 px-4 text-center border-b-2 flex flex-col items-center gap-2 ${
                idx === currentStep
                  ? 'border-b-primary-600'
                  : idx < currentStep
                  ? 'border-b-success'
                  : 'border-b-neutral-200 hover:border-b-neutral-300'
              }`}
              whileHover={{ backgroundColor: idx === currentStep ? 'transparent' : '#f5f5f5' }}
            >
              <span className={`text-xs font-semibold ${
                idx === currentStep
                  ? 'text-primary-600'
                  : idx < currentStep
                  ? 'text-success'
                  : 'text-neutral-600'
              }`}>
                {idx < currentStep ? <FiCheck className="inline w-3.5 h-3.5" /> : `${idx + 1}`}
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
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {saveSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col items-center justify-center"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-4">
                  <FiCheck className="text-success" size={32} />
                </div>
                <h2 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Profile Updated!</h2>
                <p className="text-neutral-600">
                  Your profile has been successfully updated.
                </p>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                ref={sectionRef}
                tabIndex={-1}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onAnimationComplete={() => {
                  if (focusSectionRef.current) {
                    sectionRef.current?.focus({ preventScroll: true });
                    focusSectionRef.current = false;
                  }
                }}
                className="focus:outline-none"
              >
                {CurrentStepComponent && <CurrentStepComponent />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer with navigation */}
        {!saveSuccess && (
          <div className="bg-white dark:bg-[#1a1f2e] border-t border-neutral-200 dark:border-neutral-800 p-6 lg:p-8">
            <div className="flex gap-3 justify-between max-w-2xl mx-auto">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0 || isLoading}
                className="flex items-center gap-2"
              >
                <FiArrowLeft size={18} />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <div className="text-center">
                <p className="text-sm text-neutral-600">
                  Step {currentStep + 1} of {totalSteps}
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
                  onClick={handleNext}
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

      {/* Unsaved-changes dialog — fired by ✕, browser Back, or any internal link
          while there are unsaved edits. */}
      <ExitGuardDialog
        open={leaveTo !== null}
        isLoading={isLoading}
        onKeep={() => setLeaveTo(null)}
        onDiscard={discardAndLeave}
        onSave={saveAndLeave}
      />
    </div>
  );
};

/**
 * Confirm dialog with three outcomes when leaving with unsaved edits.
 * Proper modal semantics: role="dialog", Escape closes (= Keep editing), and
 * focus moves to the primary action on open.
 */
const ExitGuardDialog = ({ open, isLoading, onKeep, onDiscard, onSave }) => {
  const saveBtnRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    saveBtnRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onKeep(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onKeep]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={onKeep}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-guard-title"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#1a1f2e] rounded-2xl p-6 max-w-sm shadow-card"
          >
            <h3 id="exit-guard-title" className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
              <FiAlertCircle className="text-warning" />
              Unsaved changes
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              You have edits that haven't been saved yet. What would you like to do?
            </p>
            <div className="space-y-2.5">
              <Button ref={saveBtnRef} onClick={onSave} loading={isLoading} className="w-full">
                Save &amp; leave
              </Button>
              <Button variant="danger" onClick={onDiscard} disabled={isLoading} className="w-full">
                Discard changes
              </Button>
              <Button variant="outline" onClick={onKeep} disabled={isLoading} className="w-full">
                Keep editing
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Main export with context wrapper.
// The profile is fetched BEFORE the provider mounts: OnboardingProvider seeds
// formData from `existingProfile` in a useState initializer, so passing it
// after mount would leave every field blank (the bug this fixes).
const ModernProfileEditor = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/profile/me')
      .then((res) => { if (!cancelled) setProfile(res.data.profile); })
      .catch(() => {
        toast.error('Failed to load profile');
        navigate('/profile');
      });
    return () => { cancelled = true; };
  }, [navigate]);

  if (!profile) {
    return <LoadingSpinner fullScreen message="Loading your profile..." />;
  }

  return (
    <OnboardingProvider mode="edit" existingProfile={profile}>
      <ModernProfileEditorContent />
    </OnboardingProvider>
  );
};

export default ModernProfileEditor;

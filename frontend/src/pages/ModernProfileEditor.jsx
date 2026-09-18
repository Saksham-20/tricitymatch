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
import { modal, backdrop, stepSlide } from '../utils/animations';

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
import Skeleton from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';

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
  // Mirrors ModernOnboarding's stepDirection: 1 for Next/a forward jump, -1 for
  // Previous/a backward jump, so stepSlide's exit mirrors the entry path.
  const [stepDirection, setStepDirection] = useState(1);
  const goWithFocus = (fn) => (...args) => { focusSectionRef.current = true; fn(...args); };
  const handleNext = () => { setStepDirection(1); goWithFocus(nextStep)(); };
  const handlePrev = () => { setStepDirection(-1); goWithFocus(prevStep)(); };
  const handleGoTo = (idx) => { setStepDirection(idx >= currentStep ? 1 : -1); goWithFocus(goToStep)(idx); };

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
    <div className="min-h-[100dvh] flex bg-neutral-50 dark:bg-surface-dark-1 pb-16 md:pb-0">
      {/* Left Panel — LIGHT brand rail (burgundy accent, not a slab) */}
      <div className="hidden lg:flex lg:w-[24rem] xl:w-[28rem] relative overflow-hidden bg-white dark:bg-surface-dark-3 border-r border-neutral-100 dark:border-neutral-800">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/70 dark:from-primary-900/20 via-white dark:via-surface-dark-3 to-white dark:to-surface-dark-3 pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-72 h-72 border border-neutral-200/60 dark:border-neutral-700/40 rounded-full pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-10">
          <div>
            {/* Eyebrow label removed (doctrine §2 ruling 2 — an outright ban:
                the heading carries its own weight). It was also gold on a
                surface with nothing premium about it (§3.1). */}
            <h2 className="font-display text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              Update your profile
            </h2>
            <p className="text-base text-neutral-500 mb-8">
              Keep your profile fresh and complete to get better matches
            </p>

            {/* Benefits */}
            <div className="space-y-4">
              {[
                { t: 'More visibility', d: 'Complete profiles get more matches' },
                { t: 'Better matches', d: 'Detailed info helps us suggest perfect matches' },
                { t: 'Easy editing', d: 'Step through sections and save when ready' },
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
            {/* "Section X of Y" already says where you are — a % here reads as
                profile completion, which this is not. */}
            <Progress value={completionPercentage} max={100} showLabel={false} />
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-surface-dark-3 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex justify-between items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-neutral-900 lg:hidden">Edit profile</h1>
          </div>
          {/* Save is available from any step — no need to walk the whole wizard
              to change one field. Dirty-aware: nothing to save when clean.
              min-h floor (doctrine §3.5): size="sm" alone measures ~37px tall. */}
          {!saveSuccess && (
            <Button
              onClick={handleSaveProfile}
              loading={isLoading}
              disabled={!isDirty}
              size="sm"
              className="flex items-center gap-1.5 min-h-[2.75rem]"
            >
              <FiCheck size={16} />
              {isDirty ? 'Save' : 'Saved'}
            </Button>
          )}
          {/* Shared Button (was a hand-rolled <button> with an ungated hover and
              a 40x40px target, both below doctrine §3.5/§4.7). The visual mark
              stays 24px; the target is padded to 44px via a fixed box, and the
              hover tint is gated the same way the stepper's hover is 15 lines
              below — a tap must not leave the control visibly "stuck" hovered. */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (isDirty ? setLeaveTo('/profile') : navigate('/profile'))}
            aria-label="Close editor"
            className="w-11 h-11 p-0 text-neutral-600 dark:text-neutral-300 hover:bg-transparent hover:text-neutral-600 dark:hover:text-neutral-300 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-neutral-100 [@media(hover:hover)_and_(pointer:fine)]:hover:text-neutral-900 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-neutral-800 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:text-neutral-100"
          >
            <FiX size={24} />
          </Button>
        </div>

        {/* Progress + section jump for mobile/tablet (no stepper below lg, so
            this is the only way to reach an arbitrary section without paging). */}
        <div className="lg:hidden bg-white dark:bg-surface-dark-3 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
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
          <Progress value={completionPercentage} max={100} showLabel={false} />
        </div>

        {/* Desktop stepper */}
        <nav aria-label="Profile sections" className="hidden lg:flex bg-white dark:bg-surface-dark-3 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          {visibleSteps.map((step, idx) => (
            <motion.button
              key={idx}
              onClick={() => handleGoTo(idx)}
              aria-current={idx === currentStep ? 'step' : undefined}
              className={`flex-1 py-4 px-4 text-center border-b-2 flex flex-col items-center gap-2 transition-colors duration-[160ms] ${
                idx === currentStep
                  ? 'border-b-primary-600'
                  : idx < currentStep
                  ? 'border-b-success dark:border-b-green-400 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-neutral-100 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-neutral-800'
                  : 'border-b-neutral-200 dark:border-b-neutral-800 hover:border-b-neutral-300 dark:hover:border-b-neutral-700 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-neutral-100 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-neutral-800'
              }`}
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
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.28, ease: 'easeOut' } }}
              className="h-full flex flex-col items-center justify-center"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-4">
                  <FiCheck className="text-success" size={32} />
                </div>
                <h2 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Profile updated</h2>
                <p className="text-neutral-600">
                  Your profile has been successfully updated.
                </p>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait" custom={stepDirection}>
              <motion.div
                key={currentStep}
                custom={stepDirection}
                variants={stepSlide}
                initial="initial"
                animate="animate"
                exit="exit"
                onAnimationComplete={() => {
                  if (focusSectionRef.current) {
                    sectionRef.current?.focus({ preventScroll: true });
                    focusSectionRef.current = false;
                  }
                }}
              >
                {/* `ref` lives on this inner plain element, not on the
                    AnimatePresence child itself — mirrors ModernOnboarding's
                    headingRef pattern. Putting it directly on the animated
                    child threw a real React "ref is not a prop" warning via
                    AnimatePresence's internal PopChild on every render. */}
                <div ref={sectionRef} tabIndex={-1} className="focus:outline-none">
                  {CurrentStepComponent && <CurrentStepComponent />}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer with navigation */}
        {!saveSuccess && (
          <div className="bg-white dark:bg-surface-dark-3 border-t border-neutral-200 dark:border-neutral-800 p-6 lg:p-8">
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
                  <span className="hidden sm:inline">Save profile</span>
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
 * Proper modal semantics: role="dialog", Escape closes (= Keep editing),
 * focus moves to the primary action on open, Tab/Shift+Tab is trapped inside
 * the dialog, and focus returns to whatever triggered it on close — mirrors
 * the pattern shipped on Settings.jsx's DangerTab and ImageLightbox.jsx.
 */
const ExitGuardDialog = ({ open, isLoading, onKeep, onDiscard, onSave }) => {
  const dialogRef = useRef(null);
  const saveBtnRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    triggerRef.current = document.activeElement;
    saveBtnRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onKeep();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (typeof triggerRef.current?.focus === 'function') {
        triggerRef.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          {...backdrop}
          className="fixed inset-0 bg-black/50 z-80 flex items-center justify-center p-4"
          onClick={onKeep}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-guard-title"
            ref={dialogRef}
            {...modal}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-surface-dark-3 rounded-2xl p-6 max-w-sm shadow-card"
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

// ── Loading skeleton — matches the final layout's shape (doctrine §6), not a
// spinner. The shape is fully known ahead of the fetch: it's always this
// two-panel wizard shell regardless of what the profile GET returns. ─────────
const ModernProfileEditorSkeleton = () => (
  <div
    className="min-h-[100dvh] flex bg-neutral-50 dark:bg-surface-dark-1 pb-16 md:pb-0"
    aria-busy="true"
    aria-label="Loading your profile"
  >
    {/* Left panel */}
    <div className="hidden lg:flex lg:w-[24rem] xl:w-[28rem] flex-col justify-between bg-white dark:bg-surface-dark-3 border-r border-neutral-100 dark:border-neutral-800 p-10">
      <div>
        <Skeleton className="h-9 w-56 mb-3" />
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton variant="circle" className="w-6 h-6 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-3 w-28 mb-2" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>

    {/* Right panel */}
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-surface-dark-3 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex justify-between items-center gap-3">
        <Skeleton className="h-6 w-32 lg:hidden" />
        <div className="flex-1 hidden lg:block" />
        <Skeleton className="h-11 w-20 rounded-xl" />
        <Skeleton variant="circle" className="w-11 h-11" />
      </div>

      {/* Mobile section jump */}
      <div className="lg:hidden bg-white dark:bg-surface-dark-3 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <Skeleton className="h-9 w-full rounded-lg mb-3" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Desktop stepper */}
      <div className="hidden lg:flex bg-white dark:bg-surface-dark-3 border-b border-neutral-200 dark:border-neutral-800 px-4 py-4 gap-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-12 flex-shrink-0" />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-2xl space-y-6">
          <Skeleton className="h-4 w-40" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white dark:bg-surface-dark-3 border-t border-neutral-200 dark:border-neutral-800 p-6 lg:p-8">
        <div className="flex gap-3 justify-between max-w-2xl mx-auto">
          <Skeleton className="h-11 w-24 rounded-xl" />
          <Skeleton className="h-11 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

// Main export with context wrapper.
// The profile is fetched BEFORE the provider mounts: OnboardingProvider seeds
// formData from `existingProfile` in a useState initializer, so passing it
// after mount would leave every field blank (the bug this fixes).
const ModernProfileEditor = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // A failed fetch used to toast-and-redirect, so a member who hit it never
  // saw why — just bounced back to /profile. Doctrine §6: a failed fetch
  // gets an in-page icon + cause + a retry that actually retries.
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    api.get('/profile/me')
      .then((res) => { if (!cancelled) setProfile(res.data.profile); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retryKey]);

  if (loading) {
    return <ModernProfileEditorSkeleton />;
  }

  if (loadError) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-neutral-50 dark:bg-surface-dark-1 px-4">
        <ErrorState
          title="Couldn't load your profile"
          description="Something went wrong on our side or your connection dropped."
          onRetry={() => setRetryKey((k) => k + 1)}
          className="max-w-md"
        />
      </div>
    );
  }

  return (
    <OnboardingProvider mode="edit" existingProfile={profile}>
      <ModernProfileEditorContent />
    </OnboardingProvider>
  );
};

export default ModernProfileEditor;

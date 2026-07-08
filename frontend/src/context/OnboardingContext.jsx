import React, { createContext, useState, useCallback, useContext, useEffect, useRef } from 'react';

// Create context for onboarding state management
const OnboardingContext = createContext();

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

export const OnboardingProvider = ({ children, mode = 'signup', existingProfile = null }) => {
  // Mode: 'signup' (create for self), 'edit' (edit existing), 'create_for_other' (guardian creating)
  const [onboardingMode, setOnboardingMode] = useState(mode);

  // Draft data (auto-saved to localStorage)
  const [formData, setFormData] = useState(() => {
    if (mode === 'edit' && existingProfile) {
      // Merge onto the known form shape so raw API extras (id, userId,
      // timestamps) never leak into the submit payload, and normalize the
      // ISO dateOfBirth to the YYYY-MM-DD the date input expects.
      const base = getInitialFormData();
      const merged = { ...base };
      Object.keys(base).forEach((k) => {
        if (existingProfile[k] !== undefined && existingProfile[k] !== null) {
          merged[k] = existingProfile[k];
        }
      });
      if (typeof merged.dateOfBirth === 'string' && merged.dateOfBirth.length > 10) {
        merged.dateOfBirth = merged.dateOfBirth.slice(0, 10);
      }
      return merged;
    }
    const saved = localStorage.getItem('onboarding_draft');
    return saved ? JSON.parse(saved) : getInitialFormData();
  });

  const [currentStep, setCurrentStep] = useState(() => {
    const initialVisibleSteps = STEPS.filter(step => {
      if (!step.showIn) return true;
      return step.showIn.includes(mode);
    });
    const maxStep = Math.max(0, initialVisibleSteps.length - 1);

    // Edit mode's visible steps already exclude the account steps, so index 0
    // IS Basic Information. (The old Math.min(2,...) offset dated from when
    // welcome/account occupied indexes 0-1 and silently opened the editor on
    // the Religion step instead.)
    if (mode === 'edit') {
      return 0;
    }
    // In create_for_other mode, start at "Who are you creating for?" step
    if (mode === 'create_for_other') {
      return 0; // Start at account type selection
    }
    const saved = localStorage.getItem('onboarding_step');
    const parsed = saved ? parseInt(saved) : 0;
    return Math.min(parsed, maxStep);
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const stepValidatorRef = useRef(null);

  // Auto-save form data and current step to localStorage — signup/guardian
  // drafts only. Edit mode must never write the member's full profile into
  // the shared signup draft (it would prefill a later logged-out signup).
  useEffect(() => {
    if (onboardingMode === 'edit') return;
    localStorage.setItem('onboarding_draft', JSON.stringify(formData));
  }, [formData, onboardingMode]);

  useEffect(() => {
    if (onboardingMode === 'edit') return;
    localStorage.setItem('onboarding_step', String(currentStep));
  }, [currentStep, onboardingMode]);

  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // Changing the email invalidates any prior email verification, so a typo
      // fixed late in the flow can never submit with a stale "verified" flag.
      ...(field === 'email' && prev.email !== value ? { emailVerification: false } : {}),
    }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const setFieldTouched = useCallback((field, isTouched = true) => {
    setTouched(prev => ({
      ...prev,
      [field]: isTouched
    }));
  }, []);

  const setStepErrors = useCallback((stepErrors) => {
    setErrors(stepErrors);
  }, []);

  const registerStepValidator = useCallback((fn) => {
    stepValidatorRef.current = fn;
    return () => { stepValidatorRef.current = null; };
  }, []);

  const validateCurrentStep = useCallback(() => {
    if (stepValidatorRef.current) {
      return stepValidatorRef.current();
    }
    return true;
  }, []);

  const visibleSteps = STEPS.filter(step => {
    if (!step.showIn) return true;
    return step.showIn.includes(onboardingMode);
  });

  // Ensure current step is always within bounds
  useEffect(() => {
    if (currentStep >= visibleSteps.length) {
      setCurrentStep(Math.max(0, visibleSteps.length - 1));
    }
  }, [visibleSteps.length, currentStep]);

  const goToStep = useCallback((step) => {
    setCurrentStep(Math.max(0, Math.min(step, visibleSteps.length - 1)));
  }, [visibleSteps.length]);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, visibleSteps.length - 1));
  }, [visibleSteps.length]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem('onboarding_draft');
    localStorage.removeItem('onboarding_step');
    setFormData(getInitialFormData());
    setCurrentStep(0);
    setErrors({});
    setTouched({});
  }, []);

  const getCompletionPercentage = useCallback(() => {
    const fieldsPerStep = {
      1: ['email', 'password'], // account
      2: ['firstName', 'lastName', 'gender', 'dateOfBirth'], // basic info
      3: ['city'], // location
      4: ['religion', 'caste', 'motherTongue'], // religion
      5: ['maritalStatus', 'numberOfChildren'], // marital
      6: ['education', 'degree', 'profession', 'income'], // career
      7: ['familyType', 'familyStatus', 'numberOfSiblings'], // family
      8: ['skinTone', 'diet', 'smoking', 'drinking'], // lifestyle
      9: ['bio', 'interestTags'], // about
      10: ['preferredAgeMin', 'preferredAgeMax', 'preferredEducation'], // preferences
      11: ['photos', 'profilePhoto'], // photos
      12: ['phoneVerification', 'emailVerification'], // verification
    };

    let completedFields = 0;
    let totalFields = 0;

    Object.values(fieldsPerStep).forEach(fields => {
      fields.forEach(field => {
        totalFields++;
        const value = formData[field];
        if (value !== null && value !== undefined && value !== '' && value !== false) {
          completedFields++;
        }
      });
    });

    return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  }, [formData]);

  const value = {
    formData,
    updateFormData,
    currentStep,
    goToStep,
    nextStep,
    prevStep,
    errors,
    setStepErrors,
    touched,
    setFieldTouched,
    isLoading,
    setIsLoading,
    clearDraft,
    getCompletionPercentage,
    mode: onboardingMode,
    setMode: setOnboardingMode,
    visibleSteps,
    registerStepValidator,
    validateCurrentStep,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

// Initial form data structure matching backend Profile model
function getInitialFormData() {
  return {
    // Account (from User model)
    // `identifier` = the single smart contact box (email OR mobile); it fans out
    // into email/phone below. Kept in the draft so a resumed signup repaints it.
    identifier: '',
    email: '',
    password: '',
    confirmPassword: '',
    account_agree: false,

    // Creating by guardian for someone else
    creatingFor: 'self', // 'self', 'parent', 'sibling', 'child', 'relative', 'friend'
    relationshipToProfile: '', // detailed relationship description
    yourName: '', // guardian's name
    yourPhone: '', // guardian's phone
    yourEmail: '', // guardian's email

    // Basic Info
    firstName: '',
    lastName: '',
    gender: '', // 'male', 'female', 'other'
    dateOfBirth: '',
    height: '',
    weight: '',

    // Location
    city: 'Chandigarh', // default
    state: 'Punjab',

    // Religion & Community
    religion: '',
    caste: '',
    subCaste: '',
    gotra: '',
    motherTongue: '',

    // Marital Status
    maritalStatus: '', // 'never_married', 'divorced', 'widowed'
    numberOfChildren: 0,

    // Horoscope. nakshatra/rashi MUST live in this base shape or edit-mode
    // hydration (which merges existingProfile onto base keys only) silently drops
    // them and the Nakshatra field never repopulates.
    placeOfBirth: '',
    birthTime: '',
    manglikStatus: '',
    zodiacSign: '',
    rashi: '',
    nakshatra: '',

    // Family
    familyType: '', // 'joint', 'nuclear'
    familyStatus: '', // 'middle_class', 'upper_middle_class', 'affluent', 'rich'
    fatherOccupation: '',
    motherOccupation: '',
    numberOfSiblings: 0,

    // Lifestyle
    skinTone: '', // 'fair', 'wheatish', 'dark'
    diet: '', // 'vegetarian', 'non-vegetarian', 'vegan', 'jain'
    smoking: '', // 'never', 'occasionally', 'regularly'
    drinking: '', // 'never', 'occasionally', 'regularly'

    // Education & Career
    education: '',
    degree: '',
    profession: '',
    income: '',

    // Profile Content
    bio: '',
    interestTags: [],
    personalityValues: {},
    // Social connections — display-only links, per-link visibility.
    // Shape: { instagram: { url, visibility }, ... }
    socialMediaLinks: {},

    // Preferences
    preferredAgeMin: '',
    preferredAgeMax: '',
    preferredHeightMin: '',
    preferredHeightMax: '',
    preferredEducation: '',
    preferredProfession: '',
    preferredCity: ['Chandigarh', 'Mohali', 'Panchkula'],

    // Photos & Verification
    photos: [],
    profilePhoto: null,
    phoneVerification: false,
    emailVerification: false,
    // Single canonical contact number used for BOTH the account (User.phone) and
    // phone verification — never re-asked. (Was split across `phone`/`phoneNumber`.)
    phone: '',
  };
}

// Step definitions for the onboarding flow
export const STEPS = [
  // NOTE: the old standalone "Welcome" step (a Terms-only gate) was removed — the
  // Terms & Privacy agreement now lives inline on the Create Account step, cutting
  // a friction step out of signup for higher conversion.
  {
    id: 0.5,
    number: 0,
    title: 'Creating Profile For',
    icon: 'Users',
    description: 'Is this profile for you or someone else?',
    fields: ['creatingFor', 'relationshipToProfile', 'yourName', 'yourPhone', 'yourEmail'],
    required: ['creatingFor', 'yourName', 'yourPhone', 'yourEmail'],
    showIn: ['create_for_other'],
  },
  {
    id: 1,
    number: 1,
    title: 'Create Account',
    icon: 'User',
    description: 'Use your email or mobile — set a password, verify, and you’re in.',
    fields: ['identifier', 'password'],
    required: ['identifier', 'password'],
    showIn: ['signup', 'create_for_other'],
  },
  {
    id: 2,
    number: 2,
    title: 'Basic Information',
    icon: 'Info',
    description: 'Just your name, gender and birthday — the rest can wait.',
    // height/weight render in edit + create_for_other modes only (BasicInfoStep)
    fields: ['firstName', 'lastName', 'gender', 'dateOfBirth', 'height', 'weight'],
    required: ['firstName', 'lastName', 'gender', 'dateOfBirth'],
    showIn: ['signup', 'edit', 'create_for_other'],
  },
  {
    id: 3,
    number: 3,
    title: 'Location',
    icon: 'MapPin',
    description: 'Where are you based?',
    fields: ['city'],
    required: ['city'],
    showIn: ['edit', 'create_for_other'],
  },
  {
    id: 4,
    number: 4,
    title: 'Religion & Community',
    icon: 'Heart',
    description: 'Your religious background',
    fields: ['religion', 'caste', 'subCaste', 'gotra', 'motherTongue'],
    required: [],
    showIn: ['edit', 'create_for_other'],
  },
  {
    id: 4.5,
    number: 4,
    title: 'Horoscope & Kundli',
    icon: 'Sun',
    description: 'Your Kundli details — all optional',
    fields: ['manglikStatus', 'nakshatra', 'placeOfBirth', 'birthTime'],
    required: [],
    showIn: ['edit', 'create_for_other'],
  },
  {
    id: 5,
    number: 5,
    title: 'Marital Status',
    icon: 'Ring',
    description: 'Tell us about your relationship status',
    fields: ['maritalStatus', 'numberOfChildren'],
    required: ['maritalStatus'],
    showIn: ['edit', 'create_for_other'],
  },
  {
    id: 6,
    number: 6,
    title: 'Education & Career',
    icon: 'Briefcase',
    description: 'Your professional background',
    fields: ['education', 'degree', 'profession', 'income'],
    required: [],
    showIn: ['edit', 'create_for_other'],
  },
  {
    id: 7,
    number: 7,
    title: 'Family Background',
    icon: 'Users',
    description: 'Tell us about your family',
    fields: ['familyType', 'familyStatus', 'numberOfSiblings'],
    required: [],
    showIn: ['edit', 'create_for_other'],
  },
  {
    id: 8,
    number: 8,
    title: 'Lifestyle',
    icon: 'Smile',
    description: 'Your lifestyle preferences',
    fields: ['skinTone', 'diet', 'smoking', 'drinking'],
    required: [],
    showIn: ['edit', 'create_for_other'],
  },
  {
    id: 9,
    number: 9,
    title: 'About Yourself',
    icon: 'BookOpen',
    description: 'Tell us more about yourself',
    fields: ['bio', 'interestTags'],
    required: [],
    showIn: ['edit', 'create_for_other'],
  },
  {
    // Edit-only: the profile editor renders a Social Connections step. It lives in
    // STEPS so `visibleSteps` (the single source the editor navigates by) matches
    // the editor's rendered components — otherwise nav bounds < rendered steps and
    // the last step (Photos) becomes unreachable.
    id: 9.5,
    number: 10,
    title: 'Social Connections',
    icon: 'Link',
    description: 'Add your social links — all optional',
    fields: ['socialMediaLinks'],
    required: [],
    showIn: ['edit'],
  },
  {
    id: 10,
    number: 10,
    title: 'Preferences',
    icon: 'Heart',
    description: 'What are you looking for?',
    fields: ['preferredAgeMin', 'preferredAgeMax', 'preferredEducation', 'preferredCity'],
    required: [],
    showIn: ['edit', 'create_for_other'],
  },
  {
    id: 11,
    number: 11,
    title: 'Photos',
    icon: 'Camera',
    description: 'Upload your profile photo',
    fields: ['profilePhoto', 'photos'],
    required: ['profilePhoto'],
    showIn: ['edit', 'create_for_other'],
  },
  {
    id: 12,
    number: 12,
    title: 'Verification',
    icon: 'Shield',
    description: 'Verify your contact information',
    fields: ['phoneVerification', 'emailVerification'],
    required: [],
    // Self-signup verifies inline on the Create Account step (single combined
    // page). Only the guardian flow keeps a dedicated verification step.
    showIn: ['create_for_other'],
  },
];


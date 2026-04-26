import React, { createContext, useState, useCallback, useContext, useEffect } from 'react';

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
      return existingProfile;
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

    // In edit mode, don't need welcome/account steps
    if (mode === 'edit') {
      return Math.min(2, maxStep); // Start at Basic Info or max step
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

  // Auto-save form data and current step to localStorage
  useEffect(() => {
    localStorage.setItem('onboarding_draft', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem('onboarding_step', String(currentStep));
  }, [currentStep]);

  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
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
      0: ['account_agree'], // welcome step
      1: ['email', 'password', 'confirmPassword'], // account
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

    // Horoscope
    placeOfBirth: '',
    birthTime: '',
    manglikStatus: '',
    zodiacSign: '',

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
    phoneNumber: '',
  };
}

// Step definitions for the onboarding flow
export const STEPS = [
  {
    id: 0,
    number: 0,
    title: 'Welcome',
    icon: 'Heart',
    description: 'Start your journey to find your perfect match',
    fields: ['account_agree'],
    required: ['account_agree'],
    showIn: ['signup', 'create_for_other'],
  },
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
    description: 'Secure your account with email and password',
    fields: ['email', 'password', 'confirmPassword'],
    required: ['email', 'password', 'confirmPassword'],
    showIn: ['signup', 'create_for_other'],
  },
  {
    id: 2,
    number: 2,
    title: 'Basic Information',
    icon: 'Info',
    description: 'Tell us about yourself',
    fields: ['firstName', 'lastName', 'gender', 'dateOfBirth'],
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
    fields: ['religion', 'caste', 'motherTongue'],
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
    showIn: ['signup', 'create_for_other'],
  },
];


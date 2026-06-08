import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { updateMyProfile, getMyProfile } from '../../api/profile';
import type { Profile, Gender, MaritalStatus, ManglikStatus, Diet, SmokingDrinking, FamilyType } from '../../types';

type Exercise = 'daily' | 'weekly' | 'rarely' | 'never';
type FamilyValues = 'orthodox' | 'traditional' | 'moderate' | 'liberal';

type OnboardingNav = NativeStackNavigationProp<OnboardingStackParamList>;

export type RegisteringFor = 'self' | 'son' | 'daughter' | 'sibling' | 'relative' | 'friend';

export interface OnboardingData {
  // Step 0
  registeringFor: RegisteringFor | null;
  // Step 1
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender | null;
  height: number | null;
  weight: number | null;
  // Step 2
  religion: string;
  caste: string;
  subCaste: string;
  gotra: string;
  motherTongue: string;
  // Step 3
  manglikStatus: ManglikStatus | null;
  birthTime: string;
  placeOfBirth: string;
  kundliUrl: string;
  // Step 4
  education: string;
  degree: string;
  institution: string;
  // Step 5
  profession: string;
  employer: string;
  income: number | null;
  // Step 6
  city: string;
  state: string;
  isNRI: boolean;
  country: string;
  visaStatus: string;
  // Step 7
  maritalStatus: MaritalStatus | null;
  hasChildren: boolean;
  numberOfChildren: number | null;
  // Step 8 — Lifestyle (skippable)
  diet: Diet | null;
  drinking: SmokingDrinking | null;
  smoking: SmokingDrinking | null;
  exercise: Exercise | null;
  // Step 9 — Family Details (skippable)
  fatherOccupation: string;
  motherOccupation: string;
  numberOfBrothers: number;
  numberOfSisters: number;
  familyType: FamilyType | null;
  familyValues: FamilyValues | null;
  // Step 10 — About Me (skippable)
  bio: string;
  interestTags: string[];
  // Step 11 — Partner Preferences (skippable)
  preferredAgeMin: number | null;
  preferredAgeMax: number | null;
  preferredHeightMin: number | null;
  preferredHeightMax: number | null;
  preferredMaritalStatus: MaritalStatus[];
  preferredReligion: string[];
  preferredEducation: string;
  preferredDiet: Diet[];
  preferredManglik: string;
  // Step 12 — Photos
  photos: string[];
  // Step 13 — Phone Verification
  phoneVerified: boolean;
}

const DEFAULT_DATA: OnboardingData = {
  registeringFor: null,
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: null,
  height: null,
  weight: null,
  religion: '',
  caste: '',
  subCaste: '',
  gotra: '',
  motherTongue: '',
  manglikStatus: null,
  birthTime: '',
  placeOfBirth: '',
  kundliUrl: '',
  education: '',
  degree: '',
  institution: '',
  profession: '',
  employer: '',
  income: null,
  city: '',
  state: '',
  isNRI: false,
  country: '',
  visaStatus: '',
  maritalStatus: null,
  hasChildren: false,
  numberOfChildren: null,
  diet: null,
  drinking: null,
  smoking: null,
  exercise: null,
  fatherOccupation: '',
  motherOccupation: '',
  numberOfBrothers: 0,
  numberOfSisters: 0,
  familyType: null,
  familyValues: null,
  bio: '',
  interestTags: [],
  preferredAgeMin: null,
  preferredAgeMax: null,
  preferredHeightMin: null,
  preferredHeightMax: null,
  preferredMaritalStatus: [],
  preferredReligion: [],
  preferredEducation: '',
  preferredDiet: [],
  preferredManglik: '',
  photos: [],
  phoneVerified: false,
};

const STEP_NAMES: (keyof OnboardingStackParamList)[] = [
  'Step0', 'Step1', 'Step2', 'Step3', 'Step4',
  'Step5', 'Step6', 'Step7', 'Step8', 'Step9',
  'Step10', 'Step11', 'Step12', 'Step13', 'Step14',
];

interface OnboardingContextValue {
  data: OnboardingData;
  currentStep: number;
  isSaving: boolean;
  update: (patch: Partial<OnboardingData>) => void;
  saveAndNext: (patch: Partial<OnboardingData>, profilePatch: Partial<Profile>) => Promise<void>;
  goBack: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<OnboardingNav>();
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Resume logic — check profile on mount, jump to first incomplete step
  useEffect(() => {
    (async () => {
      try {
        const profile = await getMyProfile();
        // Hydrate context from existing profile
        setData((prev) => ({
          ...prev,
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          dateOfBirth: profile.dateOfBirth || '',
          gender: profile.gender,
          height: profile.height,
          weight: profile.weight,
          religion: profile.religion || '',
          caste: profile.caste || '',
          subCaste: profile.subCaste || '',
          gotra: profile.gotra || '',
          motherTongue: profile.motherTongue || '',
          manglikStatus: profile.manglikStatus,
          birthTime: profile.birthTime || '',
          placeOfBirth: profile.placeOfBirth || '',
          education: profile.education || '',
          degree: profile.degree || '',
          profession: profile.profession || '',
          income: profile.income,
          city: profile.city || '',
          state: profile.state || '',
          maritalStatus: profile.maritalStatus,
          numberOfChildren: profile.numberOfChildren || null,
        }));

        // Determine first incomplete required step (0–7)
        let resumeStep = 0;
        if (profile.firstName && profile.gender && profile.dateOfBirth) resumeStep = 2;
        if (resumeStep >= 2 && profile.religion) resumeStep = 3;
        if (resumeStep >= 3 && profile.manglikStatus) resumeStep = 4;
        if (resumeStep >= 4 && profile.education) resumeStep = 5;
        if (resumeStep >= 5 && profile.profession) resumeStep = 6;
        if (resumeStep >= 6 && profile.city) resumeStep = 7;
        if (resumeStep >= 7 && profile.maritalStatus) resumeStep = 8;

        if (resumeStep > 0) {
          setCurrentStep(resumeStep);
          navigation.navigate(STEP_NAMES[resumeStep] as any);
        }
      } catch {
        // New user — start from Step 0
      }
    })();
  }, []);

  const update = useCallback((patch: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const saveAndNext = useCallback(
    async (patch: Partial<OnboardingData>, profilePatch: Partial<Profile>) => {
      setData((prev) => ({ ...prev, ...patch }));
      setIsSaving(true);
      try {
        await updateMyProfile(profilePatch);
      } catch {
        // Non-blocking — user advances regardless; backend syncs on next open
      } finally {
        setIsSaving(false);
      }
      const next = currentStep + 1;
      if (next < STEP_NAMES.length) {
        setCurrentStep(next);
        navigation.navigate(STEP_NAMES[next] as any);
      }
    },
    [currentStep, navigation],
  );

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      navigation.goBack();
    }
  }, [currentStep, navigation]);

  return (
    <OnboardingContext.Provider value={{ data, currentStep, isSaving, update, saveAndNext, goBack }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}

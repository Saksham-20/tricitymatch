/**
 * D6 journey provider. The old 14-step signup gate is gone — account creation
 * happens in the Auth stack (CreateAccount → Basics), and the preference
 * screens (Step2–12) now run as a skippable, resumable "journey" inside the
 * MAIN stack. This provider is mounted once around MainNavigator and does
 * nothing until `start()` is called (auto-present logic lives in HomeScreen);
 * it never navigates on mount.
 *
 * Navigation is injected (`navigateToStep`) because the provider sits ABOVE
 * the Main stack: it holds the root navigation, and journey routes are nested
 * (`navigate('Main', { screen })`). Screens themselves never navigate — they
 * call saveAndNext/goBack/exit.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateMyProfile, getMyProfile } from '../../api/profile';
import type { Profile, Gender, MaritalStatus, ManglikStatus, Diet, SmokingDrinking, FamilyType } from '../../types';

type Exercise = 'daily' | 'weekly' | 'rarely' | 'never';
type FamilyValues = 'orthodox' | 'traditional' | 'moderate' | 'liberal';

export const JOURNEY_STEPS = [
  'Step2', 'Step3', 'Step4', 'Step5', 'Step6', 'Step7',
  'Step8', 'Step9', 'Step10', 'Step11', 'Step12', 'JourneyFinale',
] as const;
export type JourneyStepName = (typeof JOURNEY_STEPS)[number];

/** AsyncStorage keys for the auto-present / re-prompt (7d) logic. */
export const JOURNEY_PROMPTED_AT_KEY = 'journey:promptedAt';
export const JOURNEY_DONE_KEY = 'journey:completed';

export interface OnboardingData {
  // Basics come from signup now; kept for edit prefill in journey screens.
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
}

const DEFAULT_DATA: OnboardingData = {
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
};

interface OnboardingContextValue {
  data: OnboardingData;
  currentStep: number;
  stepCount: number;
  isSaving: boolean;
  update: (patch: Partial<OnboardingData>) => void;
  saveAndNext: (patch: Partial<OnboardingData>, profilePatch: Partial<Profile>) => Promise<void>;
  goBack: () => void;
  /**
   * Enter the journey at the first incomplete step. `auto` = the HomeScreen
   * auto-prompt: it declines to open when every required field is already
   * filled. Returns whether the journey was actually presented.
   */
  start: (opts?: { auto?: boolean }) => Promise<boolean>;
  /** Leave the journey (close affordance / finale done) back to MainTabs. */
  exit: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** First journey step whose backing profile field is still empty. */
const firstIncompleteStep = (p: Partial<Profile>): JourneyStepName => {
  if (!p.religion) return 'Step2';
  if (!p.manglikStatus) return 'Step3';
  if (!p.education) return 'Step4';
  if (!p.profession) return 'Step5';
  if (!p.city) return 'Step6';
  if (!p.maritalStatus) return 'Step7';
  if (!p.bio) return 'Step10';
  if (!p.photos || p.photos.length === 0) return 'Step12';
  return 'JourneyFinale';
};

interface ProviderProps {
  children: React.ReactNode;
  /** Navigate to a journey route (nested inside the Main stack). */
  navigateToStep: (name: JourneyStepName | 'MainTabs' | 'Quiz') => void;
}

export function OnboardingProvider({ children, navigateToStep }: ProviderProps) {
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const update = useCallback((patch: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const start = useCallback(async ({ auto = false }: { auto?: boolean } = {}): Promise<boolean> => {
    let profile: Partial<Profile> = {};
    try {
      profile = await getMyProfile();
    } catch {
      // Offline / transient failure: an explicit tap still opens at Step2;
      // the auto-prompt stays quiet rather than opening on stale knowledge.
      if (auto) return false;
    }
    setData((prev) => ({
      ...prev,
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      dateOfBirth: profile.dateOfBirth || '',
      gender: profile.gender ?? null,
      height: profile.height ?? null,
      weight: profile.weight ?? null,
      religion: profile.religion || '',
      caste: profile.caste || '',
      subCaste: profile.subCaste || '',
      gotra: profile.gotra || '',
      motherTongue: profile.motherTongue || '',
      manglikStatus: profile.manglikStatus ?? null,
      birthTime: profile.birthTime || '',
      placeOfBirth: profile.placeOfBirth || '',
      education: profile.education || '',
      degree: profile.degree || '',
      profession: profile.profession || '',
      income: profile.income ?? null,
      city: profile.city || '',
      state: profile.state || '',
      maritalStatus: profile.maritalStatus ?? null,
      numberOfChildren: profile.numberOfChildren ?? null,
      bio: profile.bio || '',
      photos: profile.photos ?? [],
    }));

    const resumeName = firstIncompleteStep(profile);
    if (auto && resumeName === 'JourneyFinale') return false; // nothing left to collect
    const index = JOURNEY_STEPS.indexOf(resumeName);
    setCurrentStep(index);
    navigateToStep(resumeName);
    return true;
  }, [navigateToStep]);

  const saveAndNext = useCallback(
    async (patch: Partial<OnboardingData>, profilePatch: Partial<Profile>) => {
      setData((prev) => ({ ...prev, ...patch }));
      if (Object.keys(profilePatch).length > 0) {
        setIsSaving(true);
        try {
          await updateMyProfile(profilePatch);
        } catch {
          // Non-blocking — user advances regardless; backend syncs on next open
        } finally {
          setIsSaving(false);
        }
      }
      setCurrentStep((step) => {
        const next = step + 1;
        if (next < JOURNEY_STEPS.length) {
          navigateToStep(JOURNEY_STEPS[next]);
          return next;
        }
        return step;
      });
    },
    [navigateToStep],
  );

  const goBack = useCallback(() => {
    setCurrentStep((step) => {
      if (step <= 0) return step;
      navigateToStep(JOURNEY_STEPS[step - 1]);
      return step - 1;
    });
  }, [navigateToStep]);

  const exit = useCallback(() => {
    AsyncStorage.setItem(JOURNEY_PROMPTED_AT_KEY, String(Date.now())).catch(() => {});
    navigateToStep('MainTabs');
  }, [navigateToStep]);

  return (
    <OnboardingContext.Provider
      value={{ data, currentStep, stepCount: JOURNEY_STEPS.length, isSaving, update, saveAndNext, goBack, start, exit }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}

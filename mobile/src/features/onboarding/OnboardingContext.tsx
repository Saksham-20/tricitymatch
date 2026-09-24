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
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { updateMyProfile, getMyProfile } from '../../api/profile';
import { showToast } from '../../utils/toast';
import { haptics } from '../../utils/haptics';
import type { Profile, Gender, MaritalStatus, ManglikStatus, Diet, SmokingDrinking, FamilyType } from '../../types';

/**
 * Profile columns PUT /profile/me accepts (backend PROFILE_EDITABLE_FIELDS) that
 * the shared `Profile` type does not model yet. Step6 needs them: without these
 * the NRI declaration was collected and then dropped on the floor.
 */
type ProfileNriExtras = { residenceCountry?: string | null; residenceStatus?: string | null };
export type JourneyProfilePatch = Partial<Profile> & ProfileNriExtras;

type Exercise = 'daily' | 'weekly' | 'rarely' | 'never';
type FamilyValues = 'orthodox' | 'traditional' | 'moderate' | 'liberal';

export const JOURNEY_STEPS = [
  'Step2', 'Step3', 'Step4', 'Step5', 'Step6', 'Step7',
  'Step8', 'Step9', 'Step10', 'Step11', 'Step12', 'JourneyFinale',
] as const;
export type JourneyStepName = (typeof JOURNEY_STEPS)[number];

/**
 * Chapters, not steps (NN/g: keep a clear mental model of process length, but
 * numerals read as bureaucracy — 4 named chapters orient without counting).
 * `i18nKey` resolves under `journey.chapters.*`; `doneKey` is the warm one-line
 * celebration shown at the top of the NEXT chapter's first screen.
 */
export const JOURNEY_CHAPTERS = [
  { i18nKey: 'roots', fallback: 'Your Roots', steps: ['Step2', 'Step3'] },
  { i18nKey: 'life', fallback: 'Your Life', steps: ['Step4', 'Step5', 'Step6', 'Step7'] },
  { i18nKey: 'world', fallback: 'Your World', steps: ['Step8', 'Step9', 'Step10'] },
  { i18nKey: 'match', fallback: 'Your Match', steps: ['Step11', 'Step12'] },
] as const;

/** Signup already collected name/gender/DOB — the bar starts endowed, not at 0. */
export const JOURNEY_ENDOWED_PROGRESS = 0.2;

export interface ChapterPosition {
  chapterIndex: number;
  i18nKey: string;
  fallback: string;
  stepInChapter: number;
  chapterLength: number;
  isChapterStart: boolean;
}

export const chapterForStep = (stepIndex: number): ChapterPosition => {
  let offset = 0;
  for (let ci = 0; ci < JOURNEY_CHAPTERS.length; ci++) {
    const ch = JOURNEY_CHAPTERS[ci];
    if (stepIndex < offset + ch.steps.length) {
      return {
        chapterIndex: ci,
        i18nKey: ch.i18nKey,
        fallback: ch.fallback,
        stepInChapter: stepIndex - offset,
        chapterLength: ch.steps.length,
        isChapterStart: stepIndex === offset,
      };
    }
    offset += ch.steps.length;
  }
  // Finale (or out of range): report as past the last chapter.
  const last = JOURNEY_CHAPTERS[JOURNEY_CHAPTERS.length - 1];
  return {
    chapterIndex: JOURNEY_CHAPTERS.length - 1,
    i18nKey: last.i18nKey,
    fallback: last.fallback,
    stepInChapter: last.steps.length,
    chapterLength: last.steps.length,
    isChapterStart: false,
  };
};

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
  // Step 4
  education: string;
  degree: string;
  // Step 5
  profession: string;
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
  education: '',
  degree: '',
  profession: '',
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
  saveAndNext: (patch: Partial<OnboardingData>, profilePatch: JourneyProfilePatch) => Promise<void>;
  /** The last save failed and the member is still on the same step. Cleared on the next attempt. */
  saveFailed: boolean;
  /**
   * A screen that renders `saveFailed` inline (OnboardingLayout) registers here
   * so the provider does not ALSO toast the same failure. Screens with their own
   * chrome that never register still get the toast, so a failed save is never silent.
   */
  registerInlineSaveError: () => () => void;
  goBack: () => void;
  /**
   * Re-align the provider with the journey screen that is actually on screen.
   * The step lives here, but navigation can move without us (Android's system
   * back pops the native stack and never calls goBack), so each journey screen
   * reports its own index whenever it gains focus. No-op when already aligned;
   * a real change also clears a stale save-failed banner.
   */
  syncStep: (index: number) => void;
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
  const { t } = useTranslation();
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // The step lives in a ref as well as state: navigation is a side effect and
  // must never run inside a setState updater (updaters are replayed by StrictMode
  // and concurrent rendering, which would push the same route twice).
  const stepRef = useRef(0);
  const inFlight = useRef(false);
  const inlineHosts = useRef(0);

  // Every step change goes through here, and a failed save belongs to the step
  // it happened on: moving (Skip, back, resume) must not carry its banner along.
  const gotoStep = useCallback((index: number) => {
    stepRef.current = index;
    setCurrentStep(index);
    setSaveFailed(false);
  }, []);

  const syncStep = useCallback((index: number) => {
    if (index < 0 || index >= JOURNEY_STEPS.length) return;
    if (stepRef.current === index) return;
    gotoStep(index);
  }, [gotoStep]);

  const update = useCallback((patch: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const registerInlineSaveError = useCallback(() => {
    inlineHosts.current += 1;
    return () => { inlineHosts.current = Math.max(0, inlineHosts.current - 1); };
  }, []);

  const start = useCallback(async ({ auto = false }: { auto?: boolean } = {}): Promise<boolean> => {
    let profile: JourneyProfilePatch | null = null;
    try {
      profile = await getMyProfile();
    } catch {
      // Never open a blank journey on a failed load. Every step saves its whole
      // answer object, optional fields included ('' / null), so a member who
      // skipped one would overwrite what they had saved before once the network
      // came back. Stay where they are: the auto-prompt says nothing, and an
      // explicit tap says why, and tapping the same entry point again is the retry.
      if (!auto) showToast.error(t('onboarding.loadFailedTitle', "Couldn't load your saved answers"), t('onboarding.loadFailedBody', 'Check your connection, then tap again.'));
      return false;
    }
    if (profile) {
      const p = profile;
      setData((prev) => ({
        ...prev,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        dateOfBirth: p.dateOfBirth || '',
        gender: p.gender ?? null,
        height: p.height ?? null,
        weight: p.weight ?? null,
        religion: p.religion || '',
        caste: p.caste || '',
        subCaste: p.subCaste || '',
        gotra: p.gotra || '',
        motherTongue: p.motherTongue || '',
        manglikStatus: p.manglikStatus ?? null,
        birthTime: p.birthTime || '',
        placeOfBirth: p.placeOfBirth || '',
        education: p.education || '',
        degree: p.degree || '',
        profession: p.profession || '',
        income: p.income ?? null,
        city: p.city || '',
        state: p.state || '',
        isNRI: !!p.isNri,
        country: p.residenceCountry || '',
        visaStatus: p.residenceStatus || '',
        maritalStatus: p.maritalStatus ?? null,
        numberOfChildren: p.numberOfChildren ?? null,
        bio: p.bio || '',
        photos: p.photos ?? [],
      }));
    }

    const resumeName = firstIncompleteStep(profile ?? {});
    if (auto && resumeName === 'JourneyFinale') return false; // nothing left to collect
    const index = JOURNEY_STEPS.indexOf(resumeName);
    gotoStep(index);
    navigateToStep(resumeName);
    return true;
  }, [navigateToStep, gotoStep, t]);

  const saveAndNext = useCallback(
    async (patch: Partial<OnboardingData>, profilePatch: JourneyProfilePatch) => {
      // A second Continue while a save is in flight would submit twice.
      if (inFlight.current) return;
      setData((prev) => ({ ...prev, ...patch }));
      // Every attempt starts clean, including a Skip that sends no patch: a
      // banner from an earlier failed save must not follow the member forward.
      setSaveFailed(false);
      if (Object.keys(profilePatch).length > 0) {
        inFlight.current = true;
        setIsSaving(true);
        try {
          await updateMyProfile(profilePatch);
        } catch {
          // Nothing re-sends a failed patch, so advancing would silently drop
          // this step's answers. Stay on the step; Continue is the retry.
          setSaveFailed(true);
          if (inlineHosts.current > 0) {
            haptics.warning();
          } else {
            showToast.error(t('onboarding.saveFailedTitle', "Couldn't save your answers"), t('onboarding.saveFailedToast', 'Check your connection and try again.'));
          }
          return;
        } finally {
          inFlight.current = false;
          setIsSaving(false);
        }
      }
      const next = stepRef.current + 1;
      if (next < JOURNEY_STEPS.length) {
        gotoStep(next);
        navigateToStep(JOURNEY_STEPS[next]);
      }
    },
    [navigateToStep, gotoStep, t],
  );

  const goBack = useCallback(() => {
    const step = stepRef.current;
    if (step <= 0) return;
    gotoStep(step - 1);
    navigateToStep(JOURNEY_STEPS[step - 1]);
  }, [navigateToStep, gotoStep]);

  const exit = useCallback(() => {
    AsyncStorage.setItem(JOURNEY_PROMPTED_AT_KEY, String(Date.now())).catch(() => {});
    setSaveFailed(false);
    navigateToStep('MainTabs');
  }, [navigateToStep]);

  return (
    <OnboardingContext.Provider
      value={{
        data, currentStep, stepCount: JOURNEY_STEPS.length, isSaving, saveFailed,
        update, saveAndNext, goBack, syncStep, start, exit, registerInlineSaveError,
      }}
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

export type Gender = 'male' | 'female' | 'other';
export type MaritalStatus = 'never_married' | 'divorced' | 'widowed' | 'awaiting_divorce';
export type ManglikStatus = 'manglik' | 'non_manglik' | 'anshik_manglik' | 'not_sure';
export type FamilyType = 'joint' | 'nuclear';
export type FamilyStatus = 'middle_class' | 'upper_middle_class' | 'affluent' | 'rich';
export type Diet = 'vegetarian' | 'non-vegetarian' | 'vegan' | 'jain';
export type SmokingDrinking = 'never' | 'occasionally' | 'regularly';
export type SkinTone = 'fair' | 'wheatish' | 'dark';
export type PhotoPrivacy = 'all' | 'shortlisted' | 'matched';

export interface ProfilePrompts {
  prompt1?: string;
  answer1?: string;
  prompt2?: string;
  answer2?: string;
  prompt3?: string;
  answer3?: string;
}

export interface SocialMediaLinks {
  instagram?: string;
  linkedin?: string;
  facebook?: string;
  twitter?: string;
}

export interface PersonalityValues {
  familyOriented?: boolean;
  careerFocused?: boolean;
  traditional?: boolean;
  [key: string]: boolean | undefined;
}

export interface FamilyPreferences {
  jointFamily?: boolean;
  children?: number;
  [key: string]: boolean | number | undefined;
}

export interface LifestylePreferences {
  travel?: boolean;
  hobbies?: string[];
  [key: string]: boolean | string[] | undefined;
}

export interface QuizAnswer {
  questionId: string;
  answer: string;
}

export interface Profile {
  id: string;
  userId: string;
  // Basic Info
  firstName: string;
  lastName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  height: number | null;
  weight: number | null;
  // Location
  city: string;
  state: string;
  // Community
  religion: string | null;
  caste: string | null;
  subCaste: string | null;
  gotra: string | null;
  motherTongue: string | null;
  // Marital
  maritalStatus: MaritalStatus | null;
  numberOfChildren: number;
  // Horoscope
  placeOfBirth: string | null;
  birthTime: string | null;
  manglikStatus: ManglikStatus | null;
  zodiacSign: string | null;
  rashi: string | null;
  nakshatra: string | null;
  // Family
  familyType: FamilyType | null;
  familyStatus: FamilyStatus | null;
  fatherOccupation: string | null;
  motherOccupation: string | null;
  numberOfSiblings: number;
  // Lifestyle
  skinTone: SkinTone | null;
  diet: Diet | null;
  smoking: SmokingDrinking | null;
  drinking: SmokingDrinking | null;
  // Education & Career
  education: string | null;
  degree: string | null;
  profession: string | null;
  income: number | null;
  // Preferences
  preferredAgeMin: number | null;
  preferredAgeMax: number | null;
  preferredHeightMin: number | null;
  preferredHeightMax: number | null;
  preferredEducation: string | null;
  preferredProfession: string | null;
  preferredCity: string[];
  // Personality & Lifestyle JSON
  personalityValues: PersonalityValues | null;
  familyPreferences: FamilyPreferences | null;
  lifestylePreferences: LifestylePreferences | null;
  // Photos
  photos: string[];
  profilePhoto: string | null;
  // Status
  completionPercentage: number;
  isActive: boolean;
  bio: string | null;
  // Privacy
  showPhone: boolean;
  showEmail: boolean;
  incognitoMode: boolean;
  photoBlurUntilMatch: boolean;
  // Enhanced
  interestTags: string[];
  profilePrompts: ProfilePrompts | null;
  spotifyPlaylist: string | null;
  socialMediaLinks: SocialMediaLinks | null;
  personalityType: string | null;
  languages: string[];
  quizAnswers: QuizAnswer[] | null;
  voiceIntroUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSummary {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  height: number | null;
  city: string;
  state: string;
  religion: string | null;
  caste: string | null;
  profession: string | null;
  education: string | null;
  profilePhoto: string | null;
  photos: string[];
  completionPercentage: number;
  isVerified?: boolean;
  compatibilityScore?: number;
  isBoosted?: boolean;
}

export interface SearchFilters {
  gender?: Gender;
  ageMin?: number;
  ageMax?: number;
  heightMin?: number;
  heightMax?: number;
  religion?: string;
  caste?: string;
  motherTongue?: string;
  maritalStatus?: MaritalStatus[];
  city?: string[];
  state?: string;
  education?: string;
  profession?: string;
  incomeMin?: number;
  incomeMax?: number;
  diet?: Diet[];
  manglikStatus?: ManglikStatus;
  excludeGotra?: string[];
  isVerified?: boolean;
  recentlyActive?: boolean;
  sort?: 'compatibility' | 'newest' | 'recently_active';
  cursor?: string;
  limit?: number;
}

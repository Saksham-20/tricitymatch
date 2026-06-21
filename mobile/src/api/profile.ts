import { apiClient } from './client';
import type { Profile, ProfileSummary } from '../types';

// Viewers / recently-viewed return a FLAT profile-ish item (userId + a subset of
// profile fields + a viewedAt timestamp), not the full ProfileSummary the cards
// read. Map it to a card-friendly summary — same idiom as matches.ts:toMatch.
interface RawViewedItem {
  userId: string;
  firstName: string;
  lastName: string;
  city?: string;
  profilePhoto?: string | null;
  gender?: string;
  dateOfBirth?: string | null;
  education?: string;
  profession?: string;
  viewedAt?: string;
}

const toSummary = (v: RawViewedItem): ProfileSummary =>
  ({
    id: v.userId,
    userId: v.userId,
    firstName: v.firstName,
    lastName: v.lastName,
    city: v.city,
    profilePhoto: v.profilePhoto ?? null,
    gender: v.gender,
    dateOfBirth: v.dateOfBirth ?? null,
    education: v.education,
    profession: v.profession,
  }) as unknown as ProfileSummary;

// Profile endpoints wrap the record in `{ success, profile }`; unwrap to the record.
export const getMyProfile = async (): Promise<Profile> => {
  const res = await apiClient.get<{ profile: Profile }>('/profile/me');
  return res.data.profile;
};

export const getProfile = async (userId: string): Promise<Profile> => {
  const res = await apiClient.get<{ profile: Profile }>(`/profile/${userId}`);
  return res.data.profile;
};

export const updateMyProfile = async (data: Partial<Profile>): Promise<Profile> => {
  const res = await apiClient.put<{ profile: Profile }>('/profile/me', data);
  return res.data.profile;
};

// The backend has no standalone photo endpoint — photos are set through the
// multipart `PUT /profile/me` route (fields `profilePhoto` and `photos`). The
// caller passes a FormData already keyed with the right field; we return the
// newly-stored URL out of the updated profile.
export const uploadPhoto = async (
  formData: FormData,
  field: 'profilePhoto' | 'photos' = 'photos',
): Promise<{ url: string }> => {
  const res = await apiClient.put<{ profile: Profile }>('/profile/me', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const profile = res.data.profile;
  if (field === 'profilePhoto') return { url: profile.profilePhoto ?? '' };
  const photos = profile.photos ?? [];
  return { url: photos[photos.length - 1] ?? '' };
};

// Backend deletes a gallery photo by its URL (`DELETE /profile/me/photo` body `{ photoUrl }`).
export const deletePhoto = async (photoUrl: string): Promise<void> => {
  await apiClient.delete('/profile/me/photo', { data: { photoUrl } });
};

export const logProfileView = async (userId: string): Promise<void> => {
  await apiClient.post(`/profile/${userId}/view`);
};

export interface SuccessStoryPayload {
  groomName: string;
  brideName: string;
  weddingDate: string;
  story: string;
  photoUri?: string;
}

// Public submission — lands as a draft for admin review (GET /success-stories
// returns published only). Maps the form fields to the backend story shape.
export const submitSuccessStory = async (payload: SuccessStoryPayload): Promise<void> => {
  await apiClient.post('/success-stories', {
    groomName: payload.groomName,
    brideName: payload.brideName,
    weddingDate: payload.weddingDate,
    story: payload.story,
  });
};

export interface CompatibilityCategory {
  score: number;
  detail: string;
}

export interface CompatibilityBreakdownResponse {
  overallScore: number;
  breakdown: {
    categories: {
      community?: CompatibilityCategory;
      age?: CompatibilityCategory;
      location?: CompatibilityCategory;
      lifestyle?: CompatibilityCategory;
      horoscope?: CompatibilityCategory;
    };
  } | null;
}

export const getCompatibilityBreakdown = async (
  userId: string,
): Promise<CompatibilityBreakdownResponse> => {
  const res = await apiClient.get<CompatibilityBreakdownResponse>(
    `/profile/${userId}/compatibility`,
  );
  return res.data;
};

export const uploadVoiceIntro = async (audioUri: string): Promise<{ voiceIntroUrl: string }> => {
  const formData = new FormData();
  const filename = audioUri.split('/').pop() ?? 'voice-intro.m4a';
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'm4a';
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/x-m4a',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    webm: 'audio/webm',
  };
  formData.append('voiceIntro', { uri: audioUri, name: filename, type: mimeMap[ext] ?? 'audio/x-m4a' } as any);
  const res = await apiClient.post<{ voiceIntroUrl: string }>('/profile/voice-intro', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deleteVoiceIntro = async (): Promise<void> => {
  await apiClient.delete('/profile/voice-intro');
};

// ─── Horoscope ────────────────────────────────────────────────────────────────

export interface GunaDetail {
  score: number | null;
  max: number;
  name: string;
  detail: string;
}

export interface AshtakootResult {
  totalScore: number;
  totalMax: number;
  rawOut36: number | null;
  percentageScore: number | null;
  interpretation: string;
  hasNadiDosha: boolean;
  hasBhakootDosha: boolean;
  hasGanaDosha: boolean;
  manglikCompatible: boolean;
  manglikDetail: string;
  gunas: Record<string, GunaDetail>;
}

export interface HoroscopeCompatibilityResponse {
  ashtakoot: AshtakootResult | null;
  manglikCompatible: boolean;
  manglikDetail: string;
  rashiScore: number | null;
  summary: string;
}

export const getHoroscopeCompatibility = async (
  userId: string,
): Promise<HoroscopeCompatibilityResponse> => {
  const res = await apiClient.get<HoroscopeCompatibilityResponse>(
    `/profile/${userId}/horoscope-match`,
  );
  return res.data;
};

// ─── Astrologer marketplace ───────────────────────────────────────────────────

export interface Astrologer {
  id: string;
  name: string;
  speciality: string[];
  experience: number;
  rating: number;
  reviewCount: number;
  pricePerMin: number;
  languages: string[];
  avatarUrl: string;
  isOnline: boolean;
  nextAvailable?: string;
}

export interface ConsultBooking {
  id: string;
  astrologerId: string;
  astrologerName: string;
  scheduledAt: string;
  durationMin: number;
  amount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  meetLink?: string;
}

export const getAstrologers = async (): Promise<Astrologer[]> => {
  const res = await apiClient.get<{ astrologers: Astrologer[] }>('/astrologers');
  return res.data.astrologers ?? [];
};

export const bookAstrologer = async (payload: {
  astrologerId: string;
  scheduledAt: string;
  durationMin: number;
}): Promise<ConsultBooking> => {
  const res = await apiClient.post<ConsultBooking>('/astrologers/book', payload);
  return res.data;
};

export const getMyConsultations = async (): Promise<ConsultBooking[]> => {
  const res = await apiClient.get<{ bookings: ConsultBooking[] }>('/astrologers/my-bookings');
  return res.data.bookings ?? [];
};

// ─── Profile activity (visitors / recently viewed) ──────────────────────────────

// Premium-gated. A 403 propagates so the screen can show an upsell.
export const getProfileViewers = async (): Promise<ProfileSummary[]> => {
  const res = await apiClient.get<{ viewers: RawViewedItem[] }>('/profile/me/viewers?limit=20');
  return (res.data.viewers ?? []).map(toSummary);
};

// All tiers — profiles the current user recently opened.
export const getRecentlyViewed = async (): Promise<ProfileSummary[]> => {
  const res = await apiClient.get<{ profiles: RawViewedItem[] }>('/profile/me/recently-viewed?limit=20');
  return (res.data.profiles ?? []).map(toSummary);
};

// ─── Privacy ────────────────────────────────────────────────────────────────

export interface PrivacySettings {
  profileVisibility?: 'everyone' | 'matches_only';
  showOnlineStatus?: boolean;
  showLastSeen?: boolean;
}

export const updatePrivacy = async (settings: PrivacySettings): Promise<void> => {
  await apiClient.put('/profile/privacy', settings);
};

// ─── Success stories (public read) ──────────────────────────────────────────

export interface SuccessStory {
  id: string;
  coupleNames: string;
  location: string | null;
  marriedOn: string | null;
  quote: string;
  photoUrl: string | null;
  tag: string | null;
}

export const getSuccessStories = async (): Promise<SuccessStory[]> => {
  const res = await apiClient.get<{ stories: SuccessStory[] }>('/success-stories');
  return res.data.stories ?? [];
};

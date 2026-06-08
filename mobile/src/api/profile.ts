import { apiClient } from './client';
import type { Profile, ProfileSummary } from '../types';

export const getMyProfile = async (): Promise<Profile> => {
  const res = await apiClient.get<Profile>('/profile/me');
  return res.data;
};

export const getProfile = async (userId: string): Promise<Profile> => {
  const res = await apiClient.get<Profile>(`/profile/${userId}`);
  return res.data;
};

export const updateMyProfile = async (data: Partial<Profile>): Promise<Profile> => {
  const res = await apiClient.put<Profile>('/profile/me', data);
  return res.data;
};

export const uploadPhoto = async (formData: FormData): Promise<{ url: string; publicId: string }> => {
  const res = await apiClient.post('/profile/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deletePhoto = async (photoId: string): Promise<void> => {
  await apiClient.delete(`/profile/gallery/${photoId}`);
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

export const submitSuccessStory = async (payload: SuccessStoryPayload): Promise<void> => {
  await apiClient.post('/stories', payload);
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
  const res = await apiClient.get<Astrologer[]>('/astrologers');
  return res.data;
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
  const res = await apiClient.get<ConsultBooking[]>('/astrologers/my-bookings');
  return res.data;
};

import { apiClient } from './client';
import type { ProfileSummary } from '../types';

export interface GuardianLink {
  id: string;
  guardianId: string | null;
  candidateId: string;
  guardianPhone: string;
  guardianName: string;
  status: 'pending' | 'active' | 'revoked';
  createdAt: string;
}

export interface GuardianShortlist {
  profiles: ProfileSummary[];
  total: number;
}

// ─── Candidate APIs (manage their own guardian links) ─────────────────────────

export const getMyGuardianLinks = async (): Promise<GuardianLink[]> => {
  const res = await apiClient.get<GuardianLink[]>('/guardian/links');
  return res.data;
};

export const inviteGuardian = async (phone: string, name: string): Promise<GuardianLink> => {
  const res = await apiClient.post<GuardianLink>('/guardian/invite', { phone, name });
  return res.data;
};

export const revokeGuardian = async (linkId: string): Promise<void> => {
  await apiClient.delete(`/guardian/links/${linkId}`);
};

// ─── Guardian APIs (read-only view of their candidate's data) ─────────────────

export const getGuardianCandidates = async (): Promise<GuardianLink[]> => {
  const res = await apiClient.get<GuardianLink[]>('/guardian/candidates');
  return res.data;
};

export const getGuardianMatches = async (candidateId: string): Promise<GuardianShortlist> => {
  const res = await apiClient.get<GuardianShortlist>(`/guardian/candidates/${candidateId}/matches`);
  return res.data;
};

export const getGuardianShortlist = async (candidateId: string): Promise<GuardianShortlist> => {
  const res = await apiClient.get<GuardianShortlist>(`/guardian/candidates/${candidateId}/shortlist`);
  return res.data;
};

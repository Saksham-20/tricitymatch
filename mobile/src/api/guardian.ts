import { apiClient } from './client';
import type { ProfileSummary } from '../types';

export interface GuardianLink {
  id: string;            // linkId
  guardianId: string | null;
  candidateId: string;
  guardianEmail: string; // backend identifies guardians by email
  guardianName: string;  // candidate name (guardian-side) or email (candidate-side)
  city?: string;
  status: 'pending' | 'active' | 'revoked';
  createdAt: string;
}

export interface GuardianShortlist {
  profiles: ProfileSummary[];
  total: number;
}

// Backend returns minimal { matchId, userId, name, city } rows; map onto ProfileSummary.
const toSummary = (m: { userId: string; name?: string; city?: string }): ProfileSummary => {
  const [firstName, ...rest] = (m.name ?? '').split(' ');
  return {
    id: m.userId,
    firstName: firstName ?? '',
    lastName: rest.join(' '),
    city: m.city,
  } as ProfileSummary;
};

// ─── Candidate APIs (manage their own guardian links) ─────────────────────────

export const getMyGuardianLinks = async (): Promise<GuardianLink[]> => {
  const res = await apiClient.get<{ guardians: Array<{ linkId: string; guardianId: string | null; email: string; status: GuardianLink['status']; addedAt: string }> }>('/guardian/my-guardians');
  return (res.data.guardians ?? []).map((g) => ({
    id: g.linkId,
    guardianId: g.guardianId,
    candidateId: '',
    guardianEmail: g.email,
    guardianName: g.email,
    status: g.status,
    createdAt: g.addedAt,
  }));
};

export const inviteGuardian = async (email: string): Promise<void> => {
  await apiClient.post('/guardian/invite', { email });
};

export const revokeGuardian = async (linkId: string): Promise<void> => {
  await apiClient.delete(`/guardian/${linkId}`);
};

// ─── Guardian APIs (read-only view of their candidate's data) ─────────────────

export const getGuardianCandidates = async (): Promise<GuardianLink[]> => {
  const res = await apiClient.get<{ candidates: Array<{ candidateId: string; linkId: string; name: string; city?: string }> }>('/guardian/my-candidates');
  return (res.data.candidates ?? []).map((c) => ({
    id: c.linkId,
    guardianId: null,
    candidateId: c.candidateId,
    guardianEmail: '',
    guardianName: c.name,
    city: c.city,
    status: 'active',
    createdAt: '',
  }));
};

export const getGuardianMatches = async (candidateId: string): Promise<GuardianShortlist> => {
  const res = await apiClient.get<{ matches: Array<{ userId: string; name?: string; city?: string }> }>(`/guardian/candidate/${candidateId}/matches`);
  const profiles = (res.data.matches ?? []).map(toSummary);
  return { profiles, total: profiles.length };
};

export const getGuardianShortlist = async (candidateId: string): Promise<GuardianShortlist> => {
  const res = await apiClient.get<{ shortlisted: Array<{ userId: string; name?: string; city?: string }> }>(`/guardian/candidate/${candidateId}/shortlisted`);
  const profiles = (res.data.shortlisted ?? []).map(toSummary);
  return { profiles, total: profiles.length };
};

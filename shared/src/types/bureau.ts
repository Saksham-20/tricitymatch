import type { ProfileSummary } from './profile';

export type ProposalStatus = 'pending' | 'viewed' | 'accepted' | 'declined';

export interface BureauClient {
  id: string;
  bureauId: string;
  userId: string;
  profile: ProfileSummary;
  createdAt: string;
}

export interface MatchProposal {
  id: string;
  bureauId: string;
  clientUserId: string;
  proposedUserId: string;
  status: ProposalStatus;
  notes: string | null;
  clientProfile: ProfileSummary;
  proposedProfile: ProfileSummary;
  createdAt: string;
  updatedAt: string;
}

export interface BureauEarnings {
  total: number;
  pending: number;
  paid: number;
  breakdown: Array<{
    date: string;
    amount: number;
    description: string;
  }>;
}

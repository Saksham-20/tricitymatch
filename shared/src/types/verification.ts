export type DocumentType = 'aadhaar' | 'pan' | 'passport' | 'driving_license';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export interface Verification {
  id: string;
  userId: string;
  documentType: DocumentType | null;
  documentFront: string | null;
  documentBack: string | null;
  selfiePhoto: string | null;
  status: VerificationStatus;
  adminNotes: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationTier {
  tier: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  badge: string;
  isEarned: boolean;
  status?: VerificationStatus;
}

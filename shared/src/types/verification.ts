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

/**
 * What a member sees on the verification screen — the shape of
 * `GET /verification/status`.
 *
 * There is exactly ONE member-facing verification: a live selfie an admin
 * matches against the profile photos. Government-ID collection was removed
 * 2026-07-02 and the background-check tier 2026-07-07. The previous
 * `VerificationTier` type modelled a four-tier ladder (mobile / ID / education
 * / income) whose upper two tiers have never had a backend and whose second
 * tier no longer describes the product; it is gone rather than left as a
 * template for rebuilding removed features.
 */
export interface PhotoVerification {
  /** `not_submitted` is synthesised by the server when no row exists. */
  status: VerificationStatus | 'not_submitted';
  selfiePhoto: string | null;
  /** Only populated when rejected — the reason to show the member. */
  adminNotes: string | null;
  verifiedAt: string | null;
  submittedAt: string | null;
}

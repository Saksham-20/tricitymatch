import React from 'react';
import { FiStar } from 'react-icons/fi';
import Badge from '../ui/Badge';

/**
 * "Founding member" badge (Phase S, F12).
 *
 * Gold is legitimate here and only here among free-tier surfaces: founding
 * membership carries a premium-grade entitlement, so it is not a decorative
 * gold. It reads off `Users.isFoundingMember`, NOT off the subscription row —
 * the row is superseded when a founding member upgrades (verifyPayment) and the
 * whole cohort's rows expire on the deadline, but the badge is meant to outlive
 * both.
 */
export default function FoundingBadge({ user, size = 'sm', className = '' }) {
  if (!user?.isFoundingMember) return null;

  return (
    <Badge variant="premium" size={size} className={className} title="One of the first members of the Tricity community">
      <FiStar className="w-3 h-3" aria-hidden="true" />
      Founding member
    </Badge>
  );
}

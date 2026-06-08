export type NotificationType =
  | 'new_match'
  | 'new_message'
  | 'verification_approved'
  | 'verification_rejected'
  | 'subscription_expiring'
  | 'profile_view'
  | 'report_reviewed'
  | 'system'
  | 'interest_received'
  | 'interest_accepted';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  relatedId: string | null;
  createdAt: string;
  updatedAt: string;
}

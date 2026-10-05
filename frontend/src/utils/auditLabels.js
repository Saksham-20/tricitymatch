/**
 * Plain-language wording for the audit log.
 *
 * `logAudit` records one JSON blob per action and the shape differs per action,
 * so the table used to print raw JSON. That is faithful but unreadable: the
 * person asking "who ended this member's plan, and why" has to decode field
 * names. `summarise()` turns the fields we know into a sentence; anything we do
 * not recognise falls back to `key: value` pairs, and the page keeps the raw
 * JSON one click away so a prettified guess can never hide the field that matters.
 */

export const ACTION_LABELS = {
  account_deletion_cancelled: 'Deletion cancelled',
  account_deletion_scheduled: 'Deletion scheduled',
  account_erased_after_grace: 'Account erased',
  account_handover_completed: 'Handover completed',
  account_handover_started: 'Handover started',
  admin_account_created: 'Admin created',
  admin_role_changed: 'Role changed',
  appeal_decided: 'Appeal decided',
  appeal_submitted: 'Appeal sent',
  audit_log_exported: 'Audit log exported',
  chat_scam_pattern: 'Chat scam signal',
  contact_message_assigned: 'Enquiry assigned',
  contact_message_replied: 'Enquiry answered',
  contact_message_status_changed: 'Enquiry status changed',
  email_opt_in: 'Reminder mail back on',
  email_opt_out: 'Reminder mail off',
  evidence_read: 'Evidence opened',
  guardian_accepted: 'Guardian accepted',
  guardian_declined: 'Guardian declined',
  guardian_invited: 'Guardian invited',
  launch_offer_updated: 'Pricing changed',
  lead_reassigned: 'Lead moved',
  lead_status_changed: 'Lead status changed',
  leads_reassigned: 'Leads moved',
  marketing_commission_updated: 'Commission rate changed',
  marketing_payout_batch_paid: 'Payouts marked paid',
  marketing_payout_batch_prepared: 'Payouts prepared',
  marketing_payout_details_changed: 'Payout details changed',
  marketing_payout_details_read: 'Payout details opened',
  marketing_payout_export: 'Bank file downloaded',
  marketing_payout_recorded: 'Payout recorded',
  marketing_payout_settings_changed: 'Payout rules changed',
  marketing_payout_updated: 'Payout updated',
  marketing_payout_voided: 'Payout voided',
  marketing_user_created: 'Partner created',
  marketing_user_password_reset: 'Partner password reset',
  marketing_user_status_changed: 'Partner status changed',
  marketing_user_updated: 'Partner details edited',
  marketing_user_welcome_resent: 'Welcome mail resent',
  media_review_decided: 'Photo review decided',
  member_data_exported: 'Member data downloaded',
  member_identity_changed: 'Date of birth / gender changed',
  member_record_viewed: 'Member record opened',
  mfa_disabled: 'Two-step sign-in off',
  mfa_enabled: 'Two-step sign-in on',
  moderation_history_viewed: 'Moderation history opened',
  partner_agreement_accepted: 'Partner Guide accepted',
  photo_flagged: 'Photo flagged',
  photo_removed: 'Photo removed',
  profile_paused: 'Profile paused',
  profile_resumed: 'Profile resumed',
  ranking_weights_updated: 'Search ranking changed',
  referral_code_created: 'Referral code created',
  referral_code_toggled: 'Referral code switched',
  refund_failed: 'Refund failed',
  refund_recorded: 'Refund recorded',
  report_status_changed: 'Report status changed',
  subscription_activated: 'Plan activated',
  subscription_activated_googleplay: 'Plan activated (Google Play)',
  subscription_activated_webhook: 'Plan activated (webhook)',
  subscription_cancelled: 'Plan cancelled',
  subscription_order_cancelled: 'Checkout cancelled',
  subscription_order_created: 'Checkout started',
  subscription_overridden: 'Plan granted',
  subscription_plan_ended_by_refund: 'Plan ended by refund',
  subscription_reconciled: 'Payment reconciled',
  subscription_refunded_manual: 'Refund issued',
  success_story_created: 'Story created',
  success_story_deleted: 'Story deleted',
  success_story_updated: 'Story updated',
  terms_accepted: 'Terms accepted',
  unlock_bundle_credited: 'Unlock pack credited',
  unlock_bundle_order_created: 'Unlock pack checkout',
  user_blocked: 'Member blocked',
  user_created_by_admin: 'Member created',
  user_reported: 'Member reported',
  user_status_changed: 'Member status changed',
  member_hidden: 'Member made invisible',
  member_unhidden: 'Member made visible again',
  user_unblocked: 'Member unblocked',
  users_bulk_status_changed: 'Members status changed (bulk)',
  users_exported: 'Members exported',
  users_hard_deleted: 'Members deleted',
  verification_status_changed: 'Verification reviewed',
};

export const actionLabel = (action) => {
  if (!action) return 'Unknown';
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const text = String(action).replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const inr = (paise) => `₹${(Number(paise) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const words = (v) => String(v).replace(/_/g, ' ');
const has = (v) => v !== undefined && v !== null && v !== '';

// Fields that are identifiers or already shown elsewhere in the row: not worth
// repeating in a fallback summary.
const HIDDEN_KEYS = new Set([
  'targetUserId', 'userId', 'leadId', 'leadIds', 'fromUserId', 'newUserId', 'payoutId', 'subscriptionId',
  'reportId', 'reviewId', 'memberId', 'appealId', 'storyId', 'codeId', 'evidenceId', 'verificationId', 'linkId', 'ids',
]);

const fallback = (details) => {
  const parts = [];
  for (const [k, v] of Object.entries(details || {})) {
    if (HIDDEN_KEYS.has(k) || !has(v)) continue;
    if (typeof v === 'object') continue;
    parts.push(`${words(k.replace(/([A-Z])/g, ' $1').toLowerCase())}: ${typeof v === 'boolean' ? (v ? 'yes' : 'no') : v}`);
  }
  return parts.join(' · ');
};

const SUMMARISERS = {
  users_exported: (d) => {
    const sentence = d.expected != null ? `${plural(d.rows ?? 0, 'member', 'members')} of ${d.expected}` : plural(d.rows ?? 0, 'member', 'members');
    const filters = Array.isArray(d.filters) && d.filters.length ? ` · filtered by ${d.filters.join(', ')}` : '';
    return `${sentence}${d.complete === false ? ' · INCOMPLETE file' : ''}${filters}`;
  },
  audit_log_exported: (d) => `${plural(d.rows ?? 0, 'row', 'rows')}${Array.isArray(d.filters) && d.filters.length ? ` · filtered by ${d.filters.join(', ')}` : ''}`,
  member_hidden: (d) => (has(d.reason) ? `"${d.reason}"` : ''),
  user_status_changed: (d) => `${words(d.previousStatus || '?')} → ${words(d.newStatus || '?')}${has(d.reason) ? ` · "${d.reason}"` : ''}`,
  marketing_user_status_changed: (d) => `${words(d.previousStatus || '?')} → ${words(d.newStatus || '?')}${d.codesDeactivated ? ` · ${plural(d.codesDeactivated, 'code', 'codes')} switched off` : ''}`,
  users_bulk_status_changed: (d) => `${plural(d.count ?? 0, 'member', 'members')} set to ${words(d.status || '?')}`,
  subscription_overridden: (d) => `${words(d.planType || '?')} (${words(d.status || 'active')})${has(d.reason) ? ` · "${d.reason}"` : ''}`,
  subscription_cancelled: (d) => `${words(d.planType || 'plan')} ended${has(d.reason) ? ` · "${d.reason}"` : ''}`,
  subscription_refunded_manual: (d) => `${d.amountPaise != null ? inr(d.amountPaise) : 'Refund'}${has(d.reason) ? ` · "${d.reason}"` : ''}`,
  refund_recorded: (d) => `${d.amountPaise != null ? inr(d.amountPaise) : 'Refund'}${d.full ? ' · full' : ' · partial'}${has(d.source) ? ` · via ${d.source}` : ''}`,
  admin_role_changed: (d) => `${words(d.previousRole || '?')} → ${words(d.nextRole || '?')}${Array.isArray(d.permissions) && d.permissions.length ? ` · ${d.permissions.join(', ')}` : ''}`,
  member_identity_changed: (d) => `Reason: "${d.reason || '—'}"`,
  verification_status_changed: (d) => `${words(d.previousStatus || '?')} → ${words(d.newStatus || '?')}`,
  report_status_changed: (d) => `${words(d.previous || '?')} → ${words(d.status || '?')}`,
  contact_message_status_changed: (d) => `${words(d.previous || '?')} → ${words(d.status || '?')}`,
  contact_message_replied: (d) => (d.to ? `To ${d.to}` : ''),
  lead_status_changed: (d) => `Now ${words(d.status || '?')}`,
  lead_reassigned: () => 'One lead moved to this partner',
  leads_reassigned: (d) => {
    const bits = [`${plural(d.moved ?? 0, 'lead', 'leads')} moved to this partner`];
    if (d.skippedDuplicate) bits.push(`${d.skippedDuplicate} skipped (already theirs)`);
    if (d.skippedConverted) bits.push(`${d.skippedConverted} kept (already members)`);
    return bits.join(' · ');
  },
  marketing_payout_recorded: (d) => `${d.amount != null ? rupees(d.amount) : 'Payout'} · ${words(d.status || '?')}${has(d.method) ? ` · ${d.method}` : ''}${has(d.reference) ? ` · ref ${d.reference}` : ''}${d.overpay ? ' · over the balance' : ''}`,
  marketing_payout_batch_paid: (d) => `${plural(d.count ?? 0, 'payout', 'payouts')}${d.total != null ? ` · ${rupees(d.total)}` : ''}${d.failed ? ` · ${d.failed} failed` : ''}`,
  marketing_payout_export: (d) => plural(d.rows ?? 0, 'row', 'rows'),
  marketing_user_updated: (d) => (Array.isArray(d.fields) && d.fields.length ? `Changed ${d.fields.join(', ')}` : ''),
  marketing_user_welcome_resent: (d) => (d.welcomeEmailSent === false ? 'Mail could not be sent' : 'Sent'),
  marketing_user_created: (d) => `${d.email || ''}${d.role ? ` · ${words(d.role)}` : ''}`,
  user_created_by_admin: (d) => d.email || '',
  admin_account_created: (d) => d.email || '',
  partner_agreement_accepted: (d) => `Version ${d.version || '?'}`,
  photo_flagged: (d) => (has(d.reason) ? `"${d.reason}"` : ''),
  photo_removed: (d) => (has(d.reason) ? `"${d.reason}"` : ''),
  media_review_decided: (d) => `${words(d.decision || '?')}${has(d.source) ? ` · ${words(d.source)}` : ''}`,
  appeal_decided: (d) => words(d.decision || ''),
  referral_code_created: (d) => d.code || '',
  referral_code_toggled: (d) => (d.isActive ? 'Switched on' : 'Switched off'),
  email_opt_out: (d) => (d.via ? `via ${d.via}` : ''),
  account_deletion_scheduled: (d) => (d.scheduledFor ? `Erases on ${new Date(d.scheduledFor).toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : ''),
  terms_accepted: (d) => `Version ${d.termsVersion || '?'}`,
  ranking_weights_updated: (d) => (d.reset ? 'Back to defaults' : 'Weights edited'),
};

/** One readable line for a log row. Never throws on an odd shape. */
export const summarise = (action, details) => {
  const d = details && typeof details === 'object' ? details : {};
  try {
    const fn = SUMMARISERS[action];
    const text = fn ? fn(d) : '';
    return text || fallback(d) || '';
  } catch {
    return fallback(d);
  }
};

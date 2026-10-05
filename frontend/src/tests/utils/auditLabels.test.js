import { describe, it, expect } from 'vitest';
import { actionLabel, summarise } from '../../utils/auditLabels';

describe('audit log wording', () => {
  it('uses plain labels, and a readable fallback for an action it has never seen', () => {
    expect(actionLabel('subscription_overridden')).toBe('Plan granted');
    expect(actionLabel('lead_reassigned')).toBe('Lead moved');
    expect(actionLabel('some_new_thing')).toBe('Some new thing');
    expect(actionLabel(undefined)).toBe('Unknown');
  });

  it('turns the details of known actions into a sentence', () => {
    expect(summarise('user_status_changed', { previousStatus: 'active', newStatus: 'banned', reason: 'stolen photos' }))
      .toBe('active → banned · "stolen photos"');
    expect(summarise('subscription_refunded_manual', { amountPaise: 109900, reason: 'duplicate payment' }))
      .toBe('₹1,099 · "duplicate payment"');
    expect(summarise('leads_reassigned', { moved: 3, skippedDuplicate: 1, skippedConverted: 2 }))
      .toBe('3 leads moved to this partner · 1 skipped (already theirs) · 2 kept (already members)');
    expect(summarise('leads_reassigned', { moved: 1 })).toBe('1 lead moved to this partner');
  });

  it('says plainly when an export was incomplete or filtered', () => {
    expect(summarise('users_exported', { rows: 12, expected: 40, complete: false, filters: ['search', 'status'] }))
      .toBe('12 members of 40 · INCOMPLETE file · filtered by search, status');
    expect(summarise('users_exported', { rows: 1, expected: 1, complete: true, filters: [] })).toBe('1 member of 1');
  });

  it('falls back to key: value pairs and never prints internal ids', () => {
    const text = summarise('brand_new_action', { targetUserId: 'abc', leadId: 'def', colour: 'red', retried: true, nested: { a: 1 } });
    expect(text).toBe('colour: red · retried: yes');
    expect(text).not.toMatch(/abc|def/);
  });

  it('survives details that are missing or the wrong shape', () => {
    expect(summarise('user_status_changed', null)).toBe('? → ?');
    expect(summarise('whatever', undefined)).toBe('');
    expect(summarise('marketing_payout_recorded', 'oops')).toBe('Payout · ?');
  });
});

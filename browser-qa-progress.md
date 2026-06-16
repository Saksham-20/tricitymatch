# Browser UX QA — Progress (Single Source of Truth)

**Started:** _pending_ · **Target:** https://tricityshadi.com · **Tool:** gstack browse
**Status legend:** ✅ pass · ⚠️ pass w/ note · ❌ fail (→ findings) · 🔄 testing · ⏳ pending · ⏭️ skipped (config-gated)

## Phase status
| Phase | Scope | Status |
|-------|-------|--------|
| A | Public pages (12) | ⏳ |
| B | Authenticated pages (13) | ⏳ |
| C | Admin pages (10) | ⏳ |
| D | Interactive flows (5) | ⏳ |

## Phase A — Public pages
| Route | Desktop | Tablet | Mobile | Console | Notes |
|-------|:--:|:--:|:--:|:--:|------|
| / | ⏳ | ⏳ | ⏳ | ⏳ | |
| /login | ⏳ | ⏳ | ⏳ | ⏳ | |
| /signup | ⏳ | ⏳ | ⏳ | ⏳ | |
| /onboarding | ⏳ | ⏳ | ⏳ | ⏳ | |
| /forgot-password | ⏳ | ⏳ | ⏳ | ⏳ | |
| /reset-password | ⏳ | ⏳ | ⏳ | ⏳ | |
| /terms | ⏳ | ⏳ | ⏳ | ⏳ | |
| /privacy | ⏳ | ⏳ | ⏳ | ⏳ | |
| /about | ⏳ | ⏳ | ⏳ | ⏳ | |
| /contact | ⏳ | ⏳ | ⏳ | ⏳ | |
| /safety | ⏳ | ⏳ | ⏳ | ⏳ | |
| /success-stories | ⏳ | ⏳ | ⏳ | ⏳ | |

## Phase B — Authenticated pages
| Route | Desktop | Tablet | Mobile | Console | Notes |
|-------|:--:|:--:|:--:|:--:|------|
| /dashboard | ⏳ | ⏳ | ⏳ | ⏳ | |
| /profile | ⏳ | ⏳ | ⏳ | ⏳ | |
| /profile/edit | ⏳ | ⏳ | ⏳ | ⏳ | |
| /search | ⏳ | ⏳ | ⏳ | ⏳ | |
| /chat | ⏳ | ⏳ | ⏳ | ⏳ | premium-gated |
| /subscription | ⏳ | ⏳ | ⏳ | ⏳ | |
| /settings | ⏳ | ⏳ | ⏳ | ⏳ | |
| /notifications | ⏳ | ⏳ | ⏳ | ⏳ | |
| /verification | ⏳ | ⏳ | ⏳ | ⏳ | |
| /guardian | ⏳ | ⏳ | ⏳ | ⏳ | |
| /astrologers | ⏳ | ⏳ | ⏳ | ⏳ | |
| /astrologers/bookings | ⏳ | ⏳ | ⏳ | ⏳ | |
| /payment/history | ⏳ | ⏳ | ⏳ | ⏳ | |

## Phase C — Admin pages
| Route | Desktop | Tablet | Mobile | Console | Notes |
|-------|:--:|:--:|:--:|:--:|------|
| /admin/dashboard | ⏳ | ⏳ | ⏳ | ⏳ | |
| /admin/users | ⏳ | ⏳ | ⏳ | ⏳ | |
| /admin/verifications | ⏳ | ⏳ | ⏳ | ⏳ | |
| /admin/subscriptions | ⏳ | ⏳ | ⏳ | ⏳ | |
| /admin/revenue | ⏳ | ⏳ | ⏳ | ⏳ | |
| /admin/reports | ⏳ | ⏳ | ⏳ | ⏳ | |
| /admin/marketing-users | ⏳ | ⏳ | ⏳ | ⏳ | |
| /admin/referral-codes | ⏳ | ⏳ | ⏳ | ⏳ | |
| /admin/leads | ⏳ | ⏳ | ⏳ | ⏳ | |
| /admin/success-stories | ⏳ | ⏳ | ⏳ | ⏳ | |

## Phase D — Interactive flows
| Flow | Status | Notes |
|------|:--:|------|
| Onboarding 14-step wizard | ⏳ | |
| Login bad-password inline error (BUG-002 in browser) | ⏳ | |
| Checkbox label-click toggle (BUG-003 in browser) | ⏳ | |
| Search filter open/apply/clear | ⏳ | |
| Logout → redirect → re-login | ⏳ | |

## Regression after any fix
- [ ] Console clean across sampled pages
- [ ] Frontend tests 31/31
- [ ] Prod build green + redeployed
- [ ] Test data cleaned from DB

## Log
- _(entries appended as testing proceeds)_

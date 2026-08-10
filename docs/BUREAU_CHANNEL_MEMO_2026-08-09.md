# Bureau Channel — Decision Memo (Phase S deliverable)

**Decide by: 2026-08-23** · Owner: Saksham · Options: USE / PARTNER / DELETE

## What exists today

Dead code, fully unreachable:

- `mobile/src/features/bureau/` — 4 screens, 1,143 lines (BureauHome, ClientRoster with
  match proposals, MatchProposal 3-step, Earnings) + `mobile/src/api/bureau.ts`.
- The RN navigator role-gates a BureauStack on role `bureau` — **which does not exist**:
  the backend `User.role` enum is `user | admin | super_admin | marketing_manager | marketing`.
- **Zero backend routes.** `api/bureau.ts` calls `/bureau/clients` and `/bureau/earnings`;
  neither is mounted anywhere. Every screen would 404 even if the role existed.
- Deep-QA 2026-07-08 already flagged this as DQ-015 dead code. The apps are in no store,
  so no user has ever seen any of it.

## Why the channel matters (independent of the code)

Offline marriage bureaus + WhatsApp groups hold ~100% of the Tricity market today. Both
outside voices in the 2026-08-09 plan review called bureaus the single best cold-start
supply channel for a trust-heavy hyperlocal matrimonial product: a bureau brings verified,
serious families in batches, with a human who vouches for them.

## Options

**A) USE — build the bureau product.** Backend vertical (role, clients, proposals,
earnings/commission ledger), revive the RN screens, web portal parity.
Effort: L (multi-week even with CC). Builds a two-sided B2B2C product before the B2C side
has liquidity — and before a single bureau has agreed to anything. Premature.

**B) PARTNER — manual channel now, zero code.** Founder approaches 2–3 local bureaus with
a manual arrangement: bureau sends family details → profiles created through the normal
signup (or admin-assisted), tagged founding members; bureau compensated per placed profile
or via a simple side agreement tracked in a spreadsheet. Product stays single-sided; the
bureau relationship is a sales channel, not a feature. If a pilot works, THEN spec the
product version with real requirements from a real bureau.

**C) DELETE — remove the dead code.** Kill `mobile/src/features/bureau/`, `api/bureau.ts`,
and the BureauStack navigator wiring in the RN store-launch initiative's cleanup pass
(the code is unreachable, so deletion changes nothing user-visible; git history keeps it
resurrectable if a bureau pilot ever justifies rebuilding).

## Recommendation: B + C together

PARTNER now (the channel test costs conversations, not code) and DELETE the dead stack
when the store-launch initiative touches the navigator anyway. A rebuilt bureau product,
if ever warranted, should be specced from a live pilot's actual needs — the current
screens were built without a single bureau conversation and guess at everything
(commission model, proposal flow, roster shape).

If we're wrong: B costs nothing to reverse; C costs a git revert.

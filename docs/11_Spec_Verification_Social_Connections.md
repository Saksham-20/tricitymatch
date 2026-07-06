# Spec + Implementation — Trust & Credibility: Verification funnel + Social connections

Status: **Implemented** on branch `feat/verification-social-trust` (2026-07-06). Web only (member + admin). No government-ID collection. Verification stays selfie-only.

## Why

Selfie verification and a `socialMediaLinks` field both already existed but neither drove behavior:
- The verified badge was invisible on the one page members look at (profile detail) because of a real bug.
- Verification gave no concrete perk, so members had no reason to complete it.
- Members had no UI to add social links at all — only seed data populated the column.

Goal: make verification something members *want* (perks + nudges, no hard gates) and turn social links into a real, member-controlled profile signal.

## Decisions (locked with product owner)

- **Verification push** = perks + soft nudges. Badge everywhere, trust-score, search ranking boost, "Verified only" search filter, dismissible dashboard nudge. No hard gates — unverified members keep full access.
- **Social depth** = display-only links. No OAuth, no ownership proof, no credibility score, no admin review. Verification (selfie) remains the trust anchor; socials are profile enrichment.
- **Social visibility** = per-link member choice: `everyone` / `matches_only` (default) / `hidden`. Decoupled from the premium contact paywall.
- **Admin** = can change a verification's status at any time (approve / reject / re-open to pending / flag), re-review already-decided cards, and members are notified on every real transition.

---

## CHILD 1 — Verification funnel: badge fix + perks + admin controls

### Bug fixed
`getProfile` never included the `Verification` association, so `ProfileDetail`'s badge (`profile.User?.Verification?.status === 'approved'`) was always false. Only search cards showed the badge.

### Changes
| Area | File | Change |
|---|---|---|
| Badge on profile detail | `backend/controllers/profileController.js` (getProfile) | Look up an approved `Verification`, attach `profileData.isVerified` |
| | `frontend/src/pages/ProfileDetail.jsx` | Read `profile.isVerified` (fallback kept) |
| Ranking boost | `backend/controllers/searchController.js` (compat sort) | `+ (isVerified ? 8 : 0)` — verified members rank on par with a referral boost |
| "Verified only" filter | `backend/controllers/searchController.js` | New `verifiedOnly=true` query param; pre-fetches the approved set into the DB `where` so pagination stays correct |
| | `frontend/src/components/search/FilterPanel.jsx` + `Search.jsx` | Toggle above the fold; wired through the existing filters/params/chip pipeline |
| Dashboard nudge | `frontend/src/pages/Dashboard.jsx` | Fetches `/verification/status`; perks-led, dismissible (sessionStorage), hidden for approved/pending members |
| Member page tabs | `frontend/src/pages/Verification.jsx` | Photo Verification / Background Check tabs; perks panel; admin-note banner + status messaging per tab |
| Admin: change status anytime | `backend/controllers/adminController.js` (updateVerification) | Allowlist widened to `approved / rejected / pending / flagged`; member re-notified only on a real transition (no spam on note-only edits); `pending` re-open sends an in-app "under review" notice; `flagged` is internal (no member notify) |
| Admin: act on any card | `frontend/src/pages/admin/AdminVerifications.jsx` | "Change status" on every card (not just pending); modal gains Re-open + Flag; `flagged` tab + badge |

### Acceptance criteria — met
1. Approved member's profile detail shows the verified tick to every viewer. ✅ (getProfile attaches isVerified)
2. `GET /search?verifiedOnly=true` returns only approved-verified profiles with correct pagination. ✅
3. Verified profiles get a +8 ranking nudge in compatibility sort. ✅
4. Unverified member sees the dismissible "Get verified" nudge on Dashboard; verified/pending members never do. ✅
5. No hard gate — unverified members search/match/message unchanged. ✅
6. Admin can move a verification through any status at any time; member notified on each real change; note-only saves don't notify. ✅
7. Admin can re-review already-approved/rejected cards. ✅
8. Member verification page has Photo / Background Check tabs; rejected member sees the admin note + resubmit CTA. ✅

---

## CHILD 2 — Social connections: member-editable links + per-link visibility

### Data shape
`Profile.socialMediaLinks` (JSONB, no migration) evolves from `{ instagram: "url" }` to
`{ instagram: { url, visibility }, ... }`, `visibility ∈ everyone | matches_only | hidden` (default `matches_only`). Legacy string rows read as `{ url, visibility: 'matches_only' }`.

Platforms: instagram, linkedin, facebook, twitter (X), youtube, website.

### Changes
| Area | File | Change |
|---|---|---|
| Shared logic | `backend/utils/socialLinks.js` (new) | `normalizeSocialLinks` (shape + unsafe-URL rejection, only http/https, handles→URLs), `visibleSocialLinks` (owner/everyone/matches_only/hidden filter) |
| Save path | `backend/controllers/profileController.js` (updateProfile) | `socialMediaLinks` added to JSON-parsed fields + normalized before save |
| Visibility on view | `backend/controllers/profileController.js` (getProfile) | Replaced the premium hard-null with `visibleSocialLinks(..., { isMutual })` — no longer premium-gated |
| Editor | `frontend/src/components/onboarding/steps/SocialConnectionsStep.jsx` (new) + `ModernProfileEditor.jsx` | New "Social Connections" editor section (URL/handle + per-link visibility). `socialMediaLinks` added to onboarding initial form data + `SECTION_INDEX` (`?section=social`) |
| Display | `frontend/src/pages/ProfileDetail.jsx` | Standalone "Social Connections" card (moved out of the contact-unlock block); reads `{url,visibility}` or legacy string; `rel="noopener nofollow"` |
| Own view | `frontend/src/pages/MyProfileView.jsx` | New shape + per-link visibility label (Public / Matches only / Hidden) |

### Acceptance criteria — met
1. Member can add/edit Instagram/LinkedIn/Facebook/X/YouTube/website in the editor; persists. ✅
2. `everyone` shows to any viewer; `matches_only` only after a mutual match; `hidden` only to the owner. ✅
3. Social links are no longer premium-gated. ✅
4. Legacy string-shaped links still render. ✅
5. URLs validated/normalized (http/https only, javascript:/data: rejected); rendered with `rel="noopener nofollow"`. ✅

---

## Tests

- New: `backend/tests/unit/socialLinks.test.js` (14 tests — normalize, unsafe-URL rejection, bare-domain vs handle, per-link visibility).
- Regression: backend unit **157/157**, frontend vitest **48/48**, frontend build green.

## Live QA (localhost, Playwright) — 3 bugs found + fixed

Walked all 8 flows logged in as a VIP member + admin. All passed. Three real bugs surfaced and were fixed in the same pass:
1. 🔴 **Admin re-open 400** — `updateVerificationValidation` (validators/index.js) allowed `approved/rejected/flagged` but not `pending`, so "Re-open" failed with 400 even though the controller allowed it. The admin re-open feature was dead without this. Fixed.
2. 🟠 **Social URL host-doubling** — a bare domain like `facebook.com/you` was treated as a handle → `https://facebook.com/facebook.com/you`. `toSafeUrl` now detects domains and prepends only the scheme.
3. 🟡 **Stale "Submit your ID" copy** — the MyProfileView get-verified card said "Submit your ID" (contradicts selfie-only) and linked to `/settings`. Now "Take a quick selfie" → `/verification`.

Verified live: dashboard nudge, verified badge on profile detail (the bug fix), verified-only search (16→1), social editor round-trip + per-link visibility persistence + normalization, MyProfileView social labels, member Photo/Background tabs, admin Flagged tab + change-status on decided cards + re-open with member notification.

## Rollback

Both children are additive — revert the PR. The social shape change is backward-compatible (legacy strings still read), so there is no data migration to undo.

## Out of scope / deferred

- OAuth / ownership verification of socials, credibility-score contribution, admin review of socials.
- RN app (verification screens already stale after the 2026-07-02 selfie-only change — tracked separately).
- Hard gates on unverified members.

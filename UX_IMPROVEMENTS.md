# UX Improvements — Friction Elimination Log

Running log of user-friction fixes. Goal: make every interaction effortless. Evidence-backed (`file:line`), implemented + verified, not just reported.

**Status legend:** ✅ done & build-verified · 🔬 needs live QA · 🚧 in progress · ⏳ backlog
**Deploy:** nothing auto-deployed to prod — batches deploy only on explicit user approval.

---

## Batch 1 — Auth flow (2026-06-25)

### 1. Login: dead "Remember me" checkbox ✅
- **Problem:** Checkbox at `Login.jsx:366` had no state, no `onChange`, no effect — purely decorative.
- **Why it hurts:** False promise. User checks it expecting to stay signed in; it does nothing. Erodes trust + adds visual noise.
- **Fix:** Removed the dead control; forgot-password link now right-aligned. (Refresh token already persists 7d via httpOnly cookie, so the box was redundant anyway.)
- **Files:** `frontend/src/pages/Login.jsx`
- **Impact:** Removes misleading control. Priority: Medium.
- **Verify:** ✅ build green · 🔬 visual QA pending.

### 2. ForgotPassword: mistyped email = dead end ✅
- **Problem:** Success screen (`ForgotPassword.jsx:75`) only offered "Back to Login". A user who mistyped their email had to navigate back to Login, then back to Forgot Password, and retype everything.
- **Why it hurts:** Exactly the restart-the-whole-flow friction. Wrong email → no link arrives → user stuck with no obvious recovery.
- **Fix:** Added "Wrong email? Use a different one" button that returns to the form. Email state is preserved (not cleared) so it's pre-filled + editable — fix one character, resend.
- **Files:** `frontend/src/pages/ForgotPassword.jsx`
- **Impact:** Eliminates a dead end on the recovery path. Priority: High (account recovery is critical).
- **Verify:** ✅ build green · 🔬 visual QA pending.

### 3. Onboarding: password validated only on "Next" (type→reject→retype) ✅
- **Problem:** Account-creation password field (`CreateAccountStep.jsx:278`) showed a static hint; the symbol/case/number rules were only checked when the user pressed Next. Users typed a password, advanced, got rejected, came back, and guessed which rule failed.
- **Why it hurts:** Blind requirements → repeated failed attempts → drop-off at the highest-intent step (account creation).
- **Fix:** New reusable `PasswordRequirements` component — live strength bar (Weak→Strong) + 5 requirement ticks that turn green in real time as the user types. Replaces the static hint once typing begins. Reuses existing `getPasswordStrength` util (was already in the codebase, unused on web).
- **Files:** `frontend/src/components/common/PasswordRequirements.jsx` (new), `frontend/src/components/onboarding/steps/CreateAccountStep.jsx`
- **Impact:** Self-correcting password entry, fewer failed submits. Brings web to parity with the mobile signup strength bar. Priority: High.
- **Verify:** ✅ build green · 🔬 visual QA pending.

---

## Batch 2 — Onboarding 14-step (2026-06-25)

### 4. Validation failure was invisible on long steps ✅
- **Problem:** On a long step, pressing Next/Complete with an invalid field rendered the error above the fold; the page didn't move, so it looked like the button was broken.
- **Why it hurts:** User can't tell why they're stuck → rage-clicks → abandons.
- **Fix:** On failed validation, smooth-scroll the first error into view and focus its field. Applied to both `handleNext` and `handleComplete`.
- **Files:** `frontend/src/pages/ModernOnboarding.jsx`
- **Impact:** Clear, immediate feedback on what to fix. Priority: High.

### 5. No scroll-to-top between steps ✅
- **Problem:** After a long step, advancing kept the window scrolled down; the next step started mid-page.
- **Why it hurts:** User lands in the middle of the new step's content, misses the heading/intro, feels disoriented (esp. mobile).
- **Fix:** Smooth scroll to top on every `currentStep` change.
- **Files:** `frontend/src/pages/ModernOnboarding.jsx`
- **Impact:** Each step starts cleanly at the top. Priority: Medium.

### 6. DOB native picker opened at today (28+ years of paging) ✅
- **Problem:** `type="date"` had `max=today`, so the native picker opened on the current month. A 28-year-old had to page back ~28 years. Under-18 was only rejected after submit.
- **Why it hurts:** Tedious date entry + post-submit rejection loop on a required field.
- **Fix:** `max` = today − 18 years (picker opens near the right era + blocks under-18 inline), `min` = today − 100 years (blocks impossible dates).
- **Files:** `frontend/src/components/onboarding/steps/BasicInfoStep.jsx`
- **Impact:** Far fewer clicks to set DOB; invalid ages can't be picked. Priority: Medium.

---

## Batch 3 — Search & Filters (2026-06-25)

### 7. Result count understated the catalog ✅
- **Problem:** Meta bar showed `profiles.length` (the count loaded so far, e.g. 18) even when `totalCount` was 200+. Header pill said "200+ profiles" while the bar said "18 profiles found" — contradictory.
- **Why it hurts:** User believes only 18 matches exist and stops looking / over-broadens filters.
- **Fix:** Show `max(totalCount, loaded)` so the count reflects the real result set.
- **Files:** `frontend/src/pages/Search.jsx`
- **Impact:** Accurate sense of how many matches exist. Priority: Medium.

### 8. Removing a single filter required opening the whole panel ✅
- **Problem:** To drop one active filter, the user had to open the filter sidebar/sheet, find the field, and reset it to "Any". Only a blunt "Clear all" was one-click.
- **Why it hurts:** Iterating a search (drop just "Diet", keep the rest) was slow and fiddly.
- **Fix:** Added a row of dismissible active-filter chips above the results (readable labels, e.g. "Age ≥ 25", "₹10L+ income"). Tapping the × removes just that filter and re-searches instantly.
- **Files:** `frontend/src/pages/Search.jsx`
- **Impact:** One-tap filter removal; faster search iteration. Priority: Medium-High.

### 9. Dead `showFilters` state + unused import ✅
- **Problem:** `showFilters` state and `FiFilter` import in `Search.jsx` were unused (FilterPanel handles its own mobile sheet).
- **Fix:** Removed both. (Code hygiene — no UX change, but prevents future confusion.)
- **Files:** `frontend/src/pages/Search.jsx`

---

## Batch 4 — Profile editing (2026-06-25)

### 10. Profile editor: Save was gated to the last step ✅
- **Problem:** `ModernProfileEditor` only showed a Save button on the final wizard step. To change one field (e.g. "About Yourself"), the user had to click Next through every remaining step to reach Save — even though the desktop stepper lets you jump straight to any step. The mobile hint "Changes saved when you click Save" was misleading because Save was hidden.
- **Why it hurts:** A one-field edit became a multi-click slog; users likely abandoned small edits.
- **Fix:** Added an always-visible "Save" button in the editor header (works from any step). Footer last-step Save retained.
- **Files:** `frontend/src/pages/ModernProfileEditor.jsx`
- **Impact:** Edit any field and save immediately. Priority: High.
- **Verify:** ✅ build green · FE 35/35 tests green · 🔬 visual QA pending.

### Reviewed, no change needed
- **Subscription / payment flow** — already polished (recent dedicated fix passes): real-user Razorpay prefill, double-submit guard, processing states, skeletons, accurate active-sub banner. No friction worth changing.
- **PaymentFailed** — clear cause list + Try Again / Contact Support / Dashboard. Fine.

---

## Batch 5 — Chat & Notifications (2026-06-25)

### 11. Chat: dead "More options" button ✅
- **Problem:** The ⋮ button in the chat header had no handler — clicking it did nothing.
- **Why it hurts:** Dead control; users tap it expecting actions and get nothing.
- **Fix:** Wired ⋮ to open the match's full profile. Also made the header avatar+name a tappable button to view the profile (previously no way to reach a match's profile from chat).
- **Files:** `frontend/src/pages/Chat.jsx`
- **Impact:** No dead-end; quick access to the profile mid-conversation. Priority: Medium.

### 12. Chat: fake "Online" presence for everyone ✅
- **Problem:** The header always read "Online" and every avatar (sidebar + header) showed a green online dot — hardcoded, regardless of real status.
- **Why it hurts:** Misleads users into thinking matches are live/available; erodes trust when they realize it's fake.
- **Fix:** Replaced the always-"Online" subtitle with "typing…" (real) or "View profile" (an honest affordance). Removed the fabricated green presence dots. (Real presence can be wired later via the existing online-status socket — backlogged.)
- **Files:** `frontend/src/pages/Chat.jsx`
- **Impact:** No false presence signals. Priority: Medium.

### 13. Notifications were dead-ends ✅
- **Problem:** Notification cards showed `cursor-pointer` but clicking only marked them read — never navigated. A "new message" or "someone liked you" notification took you nowhere.
- **Why it hurts:** The whole point of a notification is to jump to the thing; users had to manually go find it.
- **Fix:** Added type→route mapping (`message`→/chat, `match`/`interest`/`profile_view`→the related profile or /search, `verification`→/verification, `subscription`→/subscription). Clicking now marks read **and** navigates.
- **Files:** `frontend/src/pages/Notifications.jsx`
- **Impact:** Notifications become actionable shortcuts. Priority: High.
- **Verify:** ✅ build green · FE 35/35 · 🔬 visual QA pending.

---

## Backlog (found, not yet fixed)
- Chat real online presence — wire the existing `online-status` socket so the dot/label reflect reality (instead of removed-fake).
- Settings → Notification Preferences persist to **localStorage only**; toggling has no server effect (push/email still send). Needs a backend notif-preferences endpoint to be real. Toast currently overstates ("Preference saved").
- ForgotPassword: support phone-based reset (Login already accepts phone).
- Onboarding referral code: "applied" shows on any input, not real validation.
- PaymentFailed "Try Again" loses the previously-selected plan.

---

## Batch 6 — Dashboard, Astrologers, Verification, Guardian (2026-06-25) — verified live
### 14. Dashboard stat cards were dead-end affordances ✅
- **Problem:** Stat cards had a hover-lift (implying clickable) but none navigated.
- **Fix:** "Mutual Matches" stat now links to /chat (its sublabel literally says "Ready to chat"); removed the hover-lift from the non-navigating cards so they don't imply a click that goes nowhere.
- **Files:** `frontend/src/pages/Dashboard.jsx` · **Verified:** clicked → /chat.

### 15. Astrologers page blank when list empty ✅
- **Problem:** Empty `astrologers` (the current prod state) rendered a title over nothing. Loading was a bare "Loading…".
- **Fix:** Added a proper empty state ("No astrologers available yet") + a skeleton loader.
- **Files:** `frontend/src/pages/Astrologers.jsx` · **Verified:** build + code path (seeded rows present locally so empty state not triggered live).

### 16. Verification upload had no preview ✅
- **Problem:** ID/selfie upload showed only a filename — no way to confirm the photo is clear/correct, no way to remove a wrong pick.
- **Fix:** `FileField` now renders an image thumbnail preview + a remove (×) button (object URL with cleanup).
- **Files:** `frontend/src/pages/Verification.jsx` · **Verified:** uploaded → thumbnail + remove shown; remove clears back to "Choose file".

### 17. Guardian revoke had no confirmation ✅
- **Problem:** "Revoke" deleted a guardian's access instantly on one click — irreversible (re-invite needed).
- **Fix:** Inline "Revoke access? Yes/No" confirm (matches the chat-delete pattern).
- **Files:** `frontend/src/pages/Guardian.jsx` · **Verified:** Revoke → confirm shown, guardian intact; Yes → revoked.

---

## Summary so far
13 friction fixes across 5 batches (auth, onboarding, search, profile editing, chat, notifications). All build-verified; FE 35/35 unit tests green. Reviewed-and-clean: Subscription, PaymentFailed, Settings (mostly).

## Live QA pass (2026-06-25, browser, branch `ux/friction-pass`)
Logged in as a seeded member, drove each flow in a real browser. **10/13 verified live**, 3 covered by build + tests:
- ✅ #1 Login — no "Remember me" present (screenshot)
- ✅ #2 Forgot pw — success screen shows email + "Wrong email?" → returns to form with email preserved/editable
- ✅ #3 Onboarding password — live strength label + requirement ticks update as you type (screenshot)
- ✅ #4 Validation fail — focus jumps to first error field (email)
- ✅ #6 DOB — input min=today-100yr, max=today-18yr (attributes confirmed)
- ✅ #8 Search — applied "Hindu" → dismissible chip rendered, × removes it, count updates (screenshot)
- ✅ #10 Profile editor — "Save" present on Step 3 of 10, click → "Profile Updated"
- ✅ #11 Chat — header click → /profile/:id
- ✅ #12 Chat — no "Online" text, fake presence dots gone
- ✅ #13 Notifications — click navigates (see bug below)
- ☑️ #5/#7/#9 — passive/logic-only, covered by build + 35/35 tests

### 🐞 Bug found & fixed by QA (commit 7213079)
**Notifications never navigated.** Live test showed clicking a real notification marked it read but stayed on the page. Root cause: my `notifLink` matched guessed type strings (`match`, `verification`), but the backend actually emits `new_match`, `verification_approved`, `verification_rejected`, `system`. Also `new_match`'s `relatedId` is a **match id**, not a userId — so it can't link to `/profile/:id`; routed to `/dashboard` (matches hub) instead. Fixed the mapping + aligned `TYPE_ICONS`/`TYPE_COLORS` to the real types (new_match was showing a generic bell). Re-verified live: `new_match` → /dashboard. **This bug also affected the original codebase's icon mapping** — pre-existing, now corrected.

Branch `ux/friction-pass`: 2 commits (4c37b58 the 13-fix pass, 7213079 the QA fix). Nothing pushed/deployed.
- ForgotPassword accepts email only, but Login accepts email **or** phone — phone-signup users have no self-serve reset path. (Needs backend `/auth/forgot-password` to support phone/SMS.)
- Onboarding referral code shows "Referral code applied" the instant any text is typed — not actually validated. Misleading success state.

---

## Batch 7 — Pre-launch resilience pass (workflows / auth / security-UX / speed)

Triggered by a launch-readiness review. Each item: problem → why it hurts → fix → verification.

**1. Post-deploy white-screen (ChunkLoadError).** Routes are lazy-split into 46 hashed chunks. Every frontend deploy renames them, so a user with a tab open before the deploy hits a missing chunk on their next navigation → ChunkLoadError → stuck on the ErrorBoundary screen. With frequent launch-window deploys this hits real active users. **Fix:** `utils/lazyWithRetry.js` wraps `React.lazy` — on a chunk-load failure it reloads the page once (sessionStorage-guarded against reload loops) to fetch the fresh manifest. Aliased `const lazy = lazyWithRetry` in App.jsx so all 46 routes use it with a one-line diff. *Verified:* build still splits chunks; logic deterministic.

**2. No global network/offline feedback.** `api/axios.js` had no `!error.response` branch — a network drop/timeout on flaky mobile failed silently (several callers `catch {}`). **Fix:** interceptor now fires one throttled toast (4s dedupe, online/offline-aware copy) on any no-response error, then still rejects so callers run. Also mapped the raw `"Network Error"` axios string to a friendly inline message in `AuthContext.login` (and skipped its double-toast since the interceptor covers it). *Verified live:* backend down → toast "Can't reach the server…" + inline friendly message.

**3. No autofocus on auth forms.** Login / ForgotPassword / ResetPassword made every visitor click the first field. **Fix:** `autoFocus` on Login email, ForgotPassword email, ResetPassword first password field (`id==='password'` only, so the confirm field doesn't steal focus). *Verified live:* Login loads with email focused.

**4. Login lockout had no distinct UX.** Backend enforces IP rate-limit (429, 5/15m) + account lockout, but the UI showed the raw message as a vanishing toast with no countdown and a still-clickable button. **Fix:** `AuthContext.login` now returns `{status, locked}`; Login shows a distinct gold lock banner with a live `mm:ss` countdown (parsed from the message, fallback 15m for 429 / 30m for account lock), disables the submit button, and relabels it "Try again in m:ss". *Verified live* (mocked 429): banner + disabled button + ticking 14:59 countdown. Server stays the real authority; client countdown is courtesy.

**5. 401 refresh-fail lost the user's place.** `axios.js` hard-redirected to `/login` on session expiry (no returnTo); `ProtectedRoute` saved `state.from` that Login never read (dead). **Fix:** both paths now use `?returnTo=<path>`; Login reads it and routes back after sign-in, with an open-redirect guard (`/^\/(?!\/)/` — blocks `//evil` and absolute URLs) and admin/marketing roles ignoring returnTo. *Verified live:* `/dashboard` logged-out → `/login?returnTo=%2Fdashboard`.

**6 & 7 — assessed, deliberately no code change.**
- *Email verification gating:* requires working SMTP (config-gated) AND the app already gates identity via phone OTP. Forcing email verify adds signup friction for zero security gain. Decision: don't gate on email.
- *Signup "account exists" enumeration:* intentional UX (tells the user to log in); the security-sensitive path (forgot-password) is already enumeration-safe. Industry-standard tradeoff. Decision: leave as-is.

Regression: FE build green · FE 35/35 · 0 new lint errors. Files: `utils/lazyWithRetry.js` (new), `App.jsx`, `api/axios.js`, `context/AuthContext.jsx`, `components/common/ProtectedRoute.jsx`, `pages/Login.jsx`, `pages/ForgotPassword.jsx`, `pages/ResetPassword.jsx`.

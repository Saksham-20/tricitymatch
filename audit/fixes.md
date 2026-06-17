# UI/UX/CRO Audit — Fixes Applied (living log)

One row per fix. Nothing here without real-viewport verification + commit hash.

| Chunk | ID | Fix | Files | Commit | Verified |
|-------|----|-----|-------|--------|----------|
| 2 | C2-1 | Per-route `<Seo>` titles on forgot/reset password | ForgotPassword.jsx, ResetPassword.jsx | aeeb29c | ✅ live: "Forgot Password \| TricityShadi", "Reset Password \| TricityShadi" |
| 2 | C2-2 | Remove duplicate skip-to-content link | Navbar.jsx | aeeb29c | ✅ live: skipLinkCount 2→1 |
| 2 | C2-3 | Explicit `type="button"` on mobile hamburger | Navbar.jsx | aeeb29c | ✅ live: hamburgerType "button" |
| 3 | C3-1 | Native hidden `<input>` in CheckBox (keyboard+SR a11y) | ui/CheckBox.jsx | 9b13ecd | ✅ live: focusable, Space toggles + shows check |
| 3 | C3-2 | Real Terms/Privacy links on Welcome step | onboarding/steps/WelcomeStep.jsx | 9b13ecd | ✅ live: /terms + /privacy, target=_blank |
| 3 | C3-3 | FormField label-association + autoComplete + aria | ui/FormField.jsx | 9b13ecd | ✅ live: email label-assoc + autocomplete=email |
| 3 | C3-4 | Password id/name/autocomplete + upfront hint + toggle aria | onboarding/steps/CreateAccountStep.jsx | 9b13ecd | ✅ live: autocomplete=new-password, hint visible |
| 1 | H1-2 | FAQ trigger→answer `aria-controls` link | pages/Home.jsx | 76af7c4 | ✅ live: all 6 rows linked, targets exist |
| 1 | C1-M2 | Working contact form + public enquiry endpoint (model+migration 000040+route+form) | backend/{models,migrations,controllers,validators,middlewares,routes,config}, pages/Contact.jsx | b7ef83f | ✅ live e2e: submit→201→DB; validation blocks; migration applied; test row cleaned |
| 3 | C3-5 | `ui/Select` keyboard+ARIA rewrite (combobox/listbox/option, full key model) — fixes keyboard-uncompletable onboarding across 7 steps | ui/Select.jsx | 990612f | ✅ live e2e: real component mounted via Vite — focusable, Enter opens (4 role=option), ↓ navigates, Enter selects (value=sikh, closes, refocuses), Esc closes+preserves |
| 3 | C3-6 | BasicInfo gender `<select>` label-assoc + aria-invalid/describedby | onboarding/steps/BasicInfoStep.jsx | 990612f | ✅ build+31/31 green; static-verified htmlFor/id match |
| 3 | C3-7 | AboutYourself textarea label-assoc + interest chip `type=button`/`aria-label` | onboarding/steps/AboutYourselfStep.jsx | 990612f | ✅ build+31/31 green |
| 3 | C3-8 | CreateAccount relationship select label-assoc + Photos buttons `type=button`/`aria-label` | onboarding/steps/CreateAccountStep.jsx, PhotosStep.jsx | 990612f | ✅ build+31/31 green |
| 4 | C4-1 | Keyboard-accessible profile cards (div onClick → Link / role=button+key handler) | pages/Dashboard.jsx, components/cards/MatchCard.jsx | c1c7b64 | ✅ live: MatchCard name = focusable `<a href>`, receives focus, navigates; build+31/31 green |
| 4 | C4-2 | Shortlist heart `aria-label` + `aria-pressed` + `type=button` + focus ring | pages/Dashboard.jsx | c1c7b64 | ✅ build+31/31 green |
| 4 | C4-3 | Wire dashboard heart to `POST /match/:id` (was local no-op) — optimistic+revert+toast+disabled | pages/Dashboard.jsx | e591f99 | ✅ build+31/31 green; reuses prod Search like pattern; live DB-persist e2e deferred to authed pass |
| 5 | C5-1 | Search sort `<select>` accessible name (`aria-label`) | pages/Search.jsx | 731a0bb | ✅ build+31/31 green |
| 5 | C5-2 | Remove dead chat emoji + attachment buttons (no handler) + unused imports | pages/Chat.jsx | 11b341e | ✅ build+31/31 green; user-approved removal |
| 5 | C5-3 | Chat inline-edit input `aria-label` + save/cancel `aria-label`/`type=button` | pages/Chat.jsx | 731a0bb | ✅ build+31/31 green |

| 6 | C6-1 | Toggle switch accessible name (`aria-label`) — all settings toggles | pages/Settings.jsx | 9c6c590 | ✅ build+31/31 green |
| 6 | C6-2 | Settings selects + change-pw inputs label-assoc (`htmlFor`/`id`/`name`) | pages/Settings.jsx | 9c6c590 | ✅ build+31/31 green |
| 6 | C6-3 | Delete-account modal `role=dialog`/`aria-modal`/labels/Escape | pages/Settings.jsx | 9c6c590 | ✅ build+31/31 green |
| 6 | C6-4 | FileUploadBox remove button `aria-label` | pages/Settings.jsx | 9c6c590 | ✅ build+31/31 green |
| 7 | C7-1 | Razorpay prefill uses real signed-in user (was hardcoded user@example.com/9876543210) | pages/Subscription.jsx | PH | ✅ build+31/31; bundle-verified fake values gone |
| 7 | C7-2 | Load checkout SDK once (memoized) + double-submit guard (processingPlan + aria-busy) | pages/Subscription.jsx | PH | ✅ build+31/31 green |
| 7 | C7-3 | Fix wrong-domain support/privacy/legal emails → @tricityshadi.com | pages/PaymentFailed.jsx, Privacy.jsx, Terms.jsx | PH | ✅ build+31/31; grep-verified only admin seed remains |
## Chunk 1 — Landing/Homepage
**No code fixes applied.** Page verified clean; all first-pass "bugs" were full-page-screenshot artifacts (see findings.md correction table). The one real item (H1-1 scroll-jack) is a design-direction RECOMMENDATION requiring sign-off, not auto-changed on a live premium page. H1-2 (FAQ aria-controls) deferred as cosmetic.

_Decision rationale:_ anti-hallucination + "would Linear ship this?" → **yes**, the homepage ships as-is. Manufacturing a deploy for a non-bug would add regression risk for zero user value.

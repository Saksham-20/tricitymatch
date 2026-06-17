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

## Chunk 1 — Landing/Homepage
**No code fixes applied.** Page verified clean; all first-pass "bugs" were full-page-screenshot artifacts (see findings.md correction table). The one real item (H1-1 scroll-jack) is a design-direction RECOMMENDATION requiring sign-off, not auto-changed on a live premium page. H1-2 (FAQ aria-controls) deferred as cosmetic.

_Decision rationale:_ anti-hallucination + "would Linear ship this?" → **yes**, the homepage ships as-is. Manufacturing a deploy for a non-bug would add regression risk for zero user value.

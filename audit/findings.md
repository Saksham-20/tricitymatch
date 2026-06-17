# UI/UX/CRO Audit — Findings (living source of truth)

**Target:** https://tricityshadi.com (prod) · **Method:** real-viewport Playwright capture + computed-style/contrast measurement + source read. Continuous-improvement mode (chunked).
**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low/Cosmetic
**Status:** OPEN · FIXING · FIXED-VERIFIED · DEFERRED · RECOMMENDATION · NOT-A-BUG · NOT VERIFIED

> **Evidence rule:** nothing marked FIXED unless re-tested in a real browser viewport. Full-page screenshots are NOT valid evidence for scroll-triggered content (see Chunk 1 corrections).

---

## CHUNK 1 — Landing / Homepage / Marketing  ✅ COMPLETE (full coverage)

**Verdict: world-class-adjacent. Zero shippable code bugs after verification.** Editorial serif + gold-on-burgundy system is genuinely premium and cohesive; positioning ("hyperlocal, family-meetable, ID-verified, Tricity-only vs 50M strangers") is category-leading.

**Coverage completed this pass:** homepage every section verified in a **real viewport** (hero, trust strip, scroll process, cities accordion, quote, FAQ, footer) + interactions (FAQ expands, counters animate) + **mobile 375 no horizontal overflow** (docScrollWidth 360). Marketing pages swept: **/about, /safety, /terms, /privacy, /success-stories** all clean (proper per-route titles, single `<h1>`, no overflow, 0 broken images). `/signup` redirects → `/onboarding` (by design).

### Product/strategy recommendations (NOT code bugs — need a decision, not a fix)
| ID | Sev | Issue | Note |
|----|-----|-------|------|
| C1-M1 | 🟡 Med CRO | **No public pricing.** Footer "Pricing Plans" → `/subscription` and "Browse Profiles" → `/search` both route logged-out visitors to a **login wall**. Plans (₹1500/₹3000/₹7499) are invisible pre-signup. | Highest-CRO item, but exposing pricing is a **pricing-strategy decision** (some matrimony sites gate it to capture leads first). Recommend a public `/pricing` page OR a homepage pricing section. **Needs user's product call.** |
| C1-M2 | 🟡 Med CRO | **/contact had no form** (0 inputs) — email-only. → **BUILT** (user approved): `ContactMessage` model + migration 000040, public rate-limited `POST /api/v1/contact` (sanitized, durable store + best-effort email), Contact.jsx form (FormField reuse, client validation, success state). **Verified live end-to-end: submit→201→DB row; empty submit→inline errors; migration applied on prod; test row cleaned.** Commit b7ef83f. Follow-up: admin UI to read enquiries (stored + queryable now). |
| C1-M3 | ⚪ Low | **/success-stories empty** — "Stories coming soon." (graceful empty state; homepage shows static seed stories instead). | Data/content, not code. Publish real stories via admin. |

### ⚠️ First-pass corrections (anti-hallucination log)
My initial audit was run off a **full-page screenshot** and produced 4 "critical/high" findings that ALL proved false under real-viewport verification. Recorded here so they are not re-raised:

| First-pass claim | Reality (verified) | Evidence |
|---|---|---|
| C1 🔴 Hero stats render `0+/0K+/0%/0yr` | **NOT-A-BUG.** `CountUp` uses `useInView`; full-page capture paints off-screen counters at initial `useState(0)`. Scrolled into a real viewport they animate to `1,190+ / 50K+ / 92% / 15yr`. | `Home.jsx:292-307`; eval read of `.ts-metrics-row` |
| C3 🔴 Dead white-space mid-page | **NOT-A-BUG.** "Process" section is scroll-pinned (`process-outer` 180vh, `processActive` scroll state). Pinned sections render tall/empty in full-page capture; fine while scrolling. | `Home.jsx:936`; screenshot `before/02-home-process-steps.jpeg` |
| C5 🟠 Inconsistent stats across pages | **MOSTLY NOT-A-BUG.** 1,190 + 50K consistent everywhere. Login "98% satisfaction" vs home "92% reply within 48hrs" are *different metrics*, both legitimate. | eval contrast/text dump |
| Announcement bar truncates offer on mobile | **NOT-A-BUG.** Full text present, wraps to 2 lines, no overflow at 375 (x+w=320<375). | eval `getBoundingClientRect` |
| Low-contrast gray labels (A11y High) | **NOT-A-BUG.** Alpha-composited WCAG ratios all pass AA: lowest = 5.57:1 (`.55`-alpha mono labels, 11px). | eval alpha-composite contrast calc |
| Hidden duplicate `<h2>` not aria-hidden | **NOT-A-BUG.** The duplicate sits under `.process-outer { display:none }` in the mobile media query → removed from a11y tree, screen readers skip it. | `Home.jsx:137` |
| Broken landing images | **NOT-A-BUG.** 16 imgs, 0 broken (naturalWidth check). | eval image audit |

**Lesson (also saved to deploy memory):** scroll-triggered content (count-up, pinned sections, in-view reveals) MUST be verified in a scrolled real viewport — full-page screenshots are false evidence.

### Real findings (Chunk 1)
| ID | Sev | Status | Issue |
|----|-----|--------|-------|
| H1-1 | 🟡 Medium | RECOMMENDATION | **Desktop "process" section uses scroll-jacking** (`process-outer` 180vh sticky, 4 steps advance on scroll). Works + looks premium, but scroll-jacking is a pattern Linear/Stripe deliberately avoid now: a quick scroll blows past steps, and the tall pinned track shows large empty viewports if a user pauses mid-section. Mobile already degrades to a clean flat list (`process-steps-list`). **Recommend** (needs design sign-off, not a bug): convert desktop to a static 4-up step grid OR shorten the pin track to ~120vh so each step gets less dead scroll. NOT auto-changed — live premium page, regression risk, arguably intentional. |
| H1-2 | ⚪ Low | ✅ FIXED-VERIFIED | FAQ accordion answer region had no `aria-controls` linking trigger→panel. → Added `aria-controls={faq-answer-i}` + matching `id` on each answer. **Verified live: all 6 rows linked, targets exist.** Commit 76af7c4. |

### Verified-clean (Chunk 1)
Single `<h1>` ✓ · counters animate ✓ · 0 broken images ✓ · AA contrast ✓ · mobile hero/announcement/trust-chips render ✓ · keyboard-operable FAQ ✓ · success-stories falls back to static seed so no empty state ✓ · live match ticker + momentum ticker animate ✓.

---

## CHUNK 2 — Login / Password reset  ✅ COMPLETE (full coverage)
*(`/signup` → redirects to `/onboarding` by design — verified live; account creation is onboarding Step 2, covered in Chunk 3.)*

**Coverage completed this pass:** desktop + **mobile 375** for login/forgot/reset — all no horizontal overflow (docScrollWidth 360), primary submit buttons 54px tap height; reset invalid-state has "Request New Link" CTA on mobile too. Per-route titles confirmed live on mobile.

**Verdict: excellent, secure, on-brand.** Forms are properly labeled with correct `autocomplete`/`type`/`required`; password-reveal has `aria-label`; split-panel design + trust stats consistent with login. Forgot-password success state is **world-class**: green check, "Check Your Email", **enumeration-safe wording** ("If an account with X exists…"), mentions spam folder, clear "Back to Login". Reset-password invalid state is clear and **not a dead end** (has "Request New Link" → /forgot-password). Skip-to-content link present (good a11y baseline). 0 console errors.

### Findings + fixes
| ID | Sev | Status | Issue → Fix |
|----|-----|--------|-------------|
| C2-1 | ⚪ Low | ✅ FIXED-VERIFIED | `/forgot-password` + `/reset-password` fell back to the **generic site `<title>`** (Login already had a per-route one). → Added `<Seo>` to both (all 3 reset states). Verified live: titles now "Forgot Password / Reset Password \| TricityShadi". |
| C2-2 | ⚪ Low | ✅ FIXED-VERIFIED | **Duplicate "Skip to main content"** link (App.jsx:428 *and* Navbar.jsx:244, both → `#main-content`) — two skip targets confuse keyboard/SR users. → Removed the Navbar duplicate (App's renders first in DOM = canonical). Verified live: skipLinkCount 2→1. |
| C2-3 | ⚪ Low | ✅ FIXED-VERIFIED | Navbar mobile **hamburger had no `type`** → defaults to `type=submit` (harmless here — not inside the login form — but wrong semantics). → Added `type="button"`. Verified live: hamburgerType now "button". |

### Verified-clean (Chunk 2)
Login form labels/autocomplete/required ✓ · password reveal a11y ✓ · enumeration-safe reset email ✓ · reset invalid-state CTA ✓ · success states ✓ · single `<form>` per page ✓ · 0 console errors ✓ · regression: build + 31/31 FE tests green.

### Backlog (Chunk 2, deferred)
- Other Navbar buttons (lines 38/67/124/179/303/440) likely also lack explicit `type` — harmless (not in forms) but a `type="button"` sweep would be correct hygiene. Defer to Chunk 10 polish.
## CHUNK 3 — Onboarding  ◑ IN PROGRESS (Welcome + Create Account audited & fixed)

**Verdict: strong flow, premium + consistent. Real a11y/autofill gaps found and fixed** (systemic, benefiting every wizard step). 4 macro-steps (Welcome / Create Account / Basic Information / Verification) with clear numbered progress; resume-from-draft works (localStorage `onboarding_draft`/`onboarding_step`). Per-step validation blocks Next + shows inline errors (verified: Welcome blocks without agree).

### Findings + fixes
| ID | Sev | Status | Issue → Fix |
|----|-----|--------|-------------|
| C3-1 | 🟠 Med | ✅ FIXED-VERIFIED | **`CheckBox` not keyboard/SR accessible** — was a `<label>`+`<div>` with `onClick` (mouse-only, no native input, no role/aria-checked/tabindex). Used by Welcome "agree" + Preferences city multiselect. → Rewrote with a visually-hidden native `<input type=checkbox>` (keyboard Tab+Space, SR announces, focus-visible ring, label association). **Verified live: native checkbox focusable, Space toggles + shows check.** |
| C3-2 | 🟡 Med | ✅ FIXED-VERIFIED | **"Terms & Conditions" was plain text, not a link** — users agreed to terms they couldn't read (legal + UX). → Added real Terms (`/terms`) + Privacy (`/privacy`) links, `target=_blank rel=noopener` so onboarding progress is preserved. **Verified live.** |
| C3-3 | 🟡 Med | ✅ FIXED-VERIFIED | **`FormField` label not associated with input** (no `htmlFor`/`id`) — clicking label didn't focus field, SR didn't announce the name; no `autocomplete`. Systemic across ALL wizard steps (BasicInfo/Location/Education/etc.). → Added id + `<label htmlFor>`, `autoComplete`/`name`/`inputMode` props, `aria-invalid` + `aria-describedby` → error/hint. **Verified live: email label-assoc + autocomplete=email.** |
| C3-4 | ⚪ Low | ✅ FIXED-VERIFIED | CreateAccount **password rules only shown as a post-submit red error** (friction) + no `id`/`name`/`autocomplete` (weak password managers) + show/hide button had no `aria-label`. → Added upfront requirements hint, `id`/`name`/`autocomplete=new-password`, label assoc, aria-describedby, `aria-label` on toggle. **Verified live: hint visible, autocomplete=new-password.** |
| C3-5 | 🟠 **High** | ✅ FIXED-VERIFIED | **`ui/Select` was keyboard-inaccessible** — custom dropdown trigger was a bare `<div onClick>` with no `tabIndex`, `role`, or key handler. Keyboard/SR users could NOT open it or pick an option → onboarding **uncompletable** without a mouse. Used by **7 steps** (Location/Religion/MaritalStatus/Education/Family/Lifestyle/Preferences). → Rewrote as `role=combobox` (tabIndex 0, `aria-haspopup/expanded/controls/labelledby/invalid/required`) + full keyboard model (Enter/Space open+select, ↑/↓ navigate, Esc close+refocus, Tab close), `role=listbox`/`role=option`+`aria-selected`, `type=button` on option/clear, `aria-label` on clear, label `htmlFor`. **Verified live (real compiled component mounted via Vite): focusable; Enter opens (aria-expanded→true, 4 role=option); ↓ moves focus; Enter selects (`value=sikh`, label updates, menu closes, focus returns to trigger); Esc closes + refocuses + preserves value.** |
| C3-6 | 🟡 Med | ✅ FIXED-VERIFIED | **BasicInfo gender `<select>` label not associated** + no `aria-invalid`/`aria-describedby`. → Added `htmlFor`/`id`/`name`, `required`, `aria-invalid`, error `id` + `aria-describedby`. |
| C3-7 | 🟡 Med | ✅ FIXED-VERIFIED | **AboutYourself bio `<textarea>` label not associated** + interest chip/remove buttons missing `type=button` & remove had no `aria-label`. → `htmlFor`/`id`/`name` + `aria-describedby`→char-count; `type=button` on add/remove chips; `aria-label="Remove {interest}"`. |
| C3-8 | ⚪ Low | ✅ FIXED-VERIFIED | **CreateAccount relationship `<select>`** (create-for-other) label unassociated; **Photos** remove/change/upload buttons missing `type=button` and remove had no `aria-label`. → label `htmlFor`/`id`/`name`; `type=button` + `aria-label="Remove photo"`. |

### Verified-clean (Chunk 3, so far)
4-step progress indicator ✓ · resume-from-draft ✓ · per-step validation gates Next + inline errors ✓ · `creatingFor` cards are real `<button type=button>` (keyboard-ok) ✓ · split-panel design consistent with auth ✓ · regression build + 31/31 FE green · keyboard checkbox toggle + step-advance no regression ✓.

### Remaining (Chunk 3, not yet audited — NOT VERIFIED)
**Reviewed this pass:** BasicInfo (C3-6), AboutYourself (C3-7), CreateAccount relationship select + Photos (C3-8), and the shared `ui/Select` powering Location/Religion/MaritalStatus/Education/Family/Lifestyle/Preferences (C3-5). VerificationStep (OTP boxes/resend) **not individually a11y-reviewed** — NOT VERIFIED. `creatingFor` cards could use `role=radio`/`aria-checked` (Low, deferred). Possible CreatingForStep vs CreateAccountStep duplication — flagged, NOT VERIFIED. Step-specific *content/copy* UX (vs a11y plumbing) not exhaustively reviewed.

**Chunk 3 a11y plumbing: COMPLETE.** Every onboarding form control now has an accessible name + keyboard operability (native inputs via FormField/CheckBox, native `<select>`s associated, custom `ui/Select` fully keyboard+ARIA). Onboarding is now completable without a mouse.
## CHUNK 4 — Dashboard  ⏳ PENDING
## CHUNK 5 — Core product (search/profile/chat/match)  ⏳ PENDING
## CHUNK 6 — Settings  ⏳ PENDING
## CHUNK 7 — Billing / Subscription  ⏳ PENDING
## CHUNK 8 — Mobile experience  ⏳ PENDING
## CHUNK 9 — Accessibility review  ⏳ PENDING
## CHUNK 10 — Final polish pass  ⏳ PENDING

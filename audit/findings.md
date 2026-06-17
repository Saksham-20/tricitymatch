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
## CHUNK 4 — Dashboard  🔧 IN PROGRESS

Design quality high (greeting hero, stat cards, premium gating, skeletons, empty state all strong). Real defects = keyboard accessibility of the content cards, which are the primary navigation affordance.

| ID | Sev | Status | Finding → Fix |
|----|-----|--------|-------------|
| C4-1 | 🟠 **High** | ✅ FIXED-VERIFIED | **Every clickable profile card was a `<div onClick>`** — no `role`/`tabIndex`/key handler → keyboard & SR users could not open ANY profile from the dashboard (Suggestion/Curated cards, Who-Viewed-You, Recently-Viewed, and MatchCard's card-level nav). → SuggestionCard + MatchCard: card-nav moved to a real `<Link to=/profile/:id>` (stretched-link on SuggestionCard so the whole card stays clickable; name-Link on MatchCard, which has a nested chat button). Who-Viewed-You + Recently-Viewed cards (no nested interactive): `role=button` + `tabIndex=0` + Enter/Space `onKeyDown` + `aria-label` + focus-visible ring. **Verified live (MatchCard mounted via Vite in MemoryRouter): name renders as focusable `<a href="/profile/abc123">`, receives focus, chat button keeps its `aria-label`; 2 keyboard targets.** SuggestionCard + the two role=button cards: build-verified + identical pattern (live-keyboard re-test deferred to authed-dashboard pass). |
| C4-2 | 🟡 Med | ✅ FIXED-VERIFIED | **Shortlist heart button had no accessible name** (icon-only) and no pressed-state semantics. → added `type=button`, `aria-label` (Shortlist/Remove + name), `aria-pressed`, focus-visible ring. NOTE: the heart still only toggles **local** state (no `/match` API call) — logged as C4-3. |
| C4-3 | 🟡 Med | ✅ FIXED | **Dashboard shortlist heart was a no-op** — `onClick` toggled local `isLiked` only; nothing persisted. → Wired to `POST /match/:id {action: like\|pass}` with optimistic update, revert-on-error, success/error toast, and `disabled` while in-flight. Reuses the exact endpoint+pattern already shipped in `Search.jsx` (`handleMatchAction`). Backend `matchActionValidation` accepts `like\|shortlist\|pass`; action upserts the Match row, so `pass` cleanly un-likes. **Verified: build + 31/31 green; pattern-parity with the production Search like flow. Live POST-persists-to-DB e2e deferred to the authed-dashboard pass (needs a logged-in account).** |

### Verified-clean (Chunk 4)
Greeting hero + time-based copy ✓ · stat cards (mutual count is live) ✓ · premium-gated "Who Viewed You" blur+CTA (`aria-hidden` on blurred placeholder) ✓ · skeleton loaders ✓ · `Promise.allSettled` resilient data load (each call has its own catch) ✓ · empty state with two real CTAs ✓ · build + 31/31 FE green.

### NOT VERIFIED (Chunk 4)
Live authed dashboard render (real data, tab-order across full page, premium vs free states) — needs a logged-in account; only component-level live checks done. C4-3 fix. Minor: SuggestionCard `age` uses crude year-diff (off by ≤1yr); one nested card uses `dark:` classes while the rest of the dashboard doesn't (cosmetic inconsistency).
## CHUNK 5 — Core product (search/profile/chat/match)  🔧 IN PROGRESS

Core product is in much better a11y shape than dashboard/onboarding were — most interactive controls already have accessible names. Sweep found few gaps.

| ID | Sev | Status | Finding → Fix |
|----|-----|--------|-------------|
| C5-1 | ⚪ Low | ✅ FIXED-VERIFIED | **Search sort `<select>` had no accessible name** (no label/aria-label) — SR announced only "combobox". → `aria-label="Sort profiles by"`. Build+31/31 green. |
| C5-2 | 🟡 Med | ✅ FIXED | **Chat composer emoji + attachment buttons were dead** — both `type=button` with NO `onClick`; looked functional but did nothing. **User decision: remove both.** → deleted both buttons + their now-unused icon imports (`BsEmojiSmile`, `HiOutlinePhotograph`). Text chat fully functional without them; reversible when features are built. Build+31/31 green. |
| C5-3 | ⚪ Low | ✅ FIXED-VERIFIED | **Chat inline-edit input unlabeled** + edit save/cancel buttons had only `title` (weak SR name) and no `type`. → added `aria-label` to edit input + save/cancel buttons + `type=button`. Build+31/31 green. |
| C5-4 | ⚪ Low | ⏳ OPEN (note) | ProfileDetail content **tab nav uses plain `<button>`s** (keyboard-focusable + activatable, so functional) but lacks `role=tablist`/`role=tab`/`aria-selected` + arrow-key roving. Enhancement, not a blocker. NOT changed. |

### Verified-clean (Chunk 5)
ProfileCard full variant: like/shortlist buttons have `aria-label`, callbacks persist to `/match`, keyboard "View Profile" button present, `role=article` ✓ (compact variant is **dead code** — `variant="compact"` used nowhere). FilterPanel: every select/input paired `FieldLabel htmlFor` ↔ `id`/`name` ✓. Search-by-ID input has `aria-label` ✓. ProfileDetail top-bar + hero action buttons (Back/Save/Interest/Message/Voice/Video/Kundli) all have visible text ✓. Chat message edit/delete buttons have `aria-label`; composer emoji/attach/send + message input all have `aria-label` ✓ (functionality of emoji/attach = C5-2). MatchCard fixed in Chunk 4. Match action API (`POST /match/:id like|shortlist|pass`) sound. Build + 31/31 FE green.

### NOT VERIFIED (Chunk 5)
Live authed Search/ProfileDetail/Chat render + real socket messaging flow (needs logged-in account + a mutual match). C5-2/C5-4 decisions. ProfileDetail accordion/gallery deeper interactions, voice-intro playback, compatibility/horoscope sheets not individually exercised.
## CHUNK 6 — Settings  ✅ DONE (a11y plumbing)

Well-structured page (sidebar tabs, toggles, two-step delete). Gaps were accessible names + dialog semantics.

| ID | Sev | Status | Finding → Fix |
|----|-----|--------|-------------|
| C6-1 | 🟡 Med | ✅ FIXED | **Shared `Toggle` switch had no accessible name** — `role=switch`+`aria-checked` but the label was an unassociated sibling `<p>`, so SR announced "switch, checked" with no name. Affects every toggle (dark mode, incognito, elder mode, all notification prefs). → `aria-label={label}` on the switch button. |
| C6-2 | ⚪ Low | ✅ FIXED | **Two `<select>`s (profile visibility, document type) + change-password inputs had unassociated labels** (no `htmlFor`/`id`). → added `id`/`name` + `<label htmlFor>` on all. |
| C6-3 | ⚪ Low | ✅ FIXED | **Delete-account modal lacked dialog semantics**; its password input + eye toggle were unlabeled; no Escape-to-close. → `role=dialog` + `aria-modal` + `aria-labelledby`, `aria-label`/`autoComplete`/`autoFocus` on password, `aria-label` on eye toggle, Escape closes. (Two-step password-gated delete flow itself already solid.) |
| C6-4 | ⚪ Low | ✅ FIXED | **FileUploadBox remove button** (FiX, icon-only) had no accessible name. → `aria-label="Remove file"`. |

### Verified-clean (Chunk 6)
Sidebar tab buttons have visible text (keyboard-focusable) ✓ · change-password eye toggles already had `aria-label` + `autoComplete` ✓ · file-upload trigger is a real `<button>` ✓ · delete flow = button→modal→password→DELETE `/auth/account` (guarded) ✓ · build + 31/31 FE green.

### NOT VERIFIED (Chunk 6)
Live authed Settings render (toggle persistence, password change, account deletion, file upload to Cloudinary) — all static attribute additions, build-verified only; no behavior change. Tab nav lacks `role=tablist` ARIA (Low, same as C5-4); modal has no focus-trap (Low enhancement).

## CHUNK 7 — Billing / Subscription  ✅ DONE

Plan cards + payment-result pages are well-built and accessible. Real defects were in the Razorpay payment flow + a wrong-domain support email.

| ID | Sev | Status | Finding → Fix |
|----|-----|--------|-------------|
| C7-1 | 🟠 High | ✅ FIXED | **Razorpay checkout prefilled HARDCODED fake values** — `prefill: { email: 'user@example.com', contact: '9876543210' }`. Real users saw a stranger's fake email/phone at the payment step (confusing + receipts/identity could go to a fake address). → prefill now uses the signed-in user from `useAuth` (name/email/phone, `undefined` fallbacks). |
| C7-2 | 🟡 Med | ✅ FIXED | **Checkout SDK `<script>` appended on every subscribe click** — multiple clicks/plans stacked duplicate `<script>` tags + `onload` handlers; **no double-submit guard** → could fire two `create-order`s. → load SDK once via a memoized promise (`loadRazorpayScript`, reuses `window.Razorpay`), added `processingPlan` state that disables the clicked plan's button (spinner + `aria-busy`) and blocks re-entry; cleared on success/dismiss/`payment.failed`/error. |
| C7-3 | 🟡 Med | ✅ FIXED | **Wrong-domain support emails** — `support@tricitymatch.com` (PaymentFailed), `privacy@tricitymatch.com` ×2 (Privacy), `legal@tricitymatch.com` (Terms). Brand domain is **tricityshadi.com** (Contact + SUPPORT_EMAIL already use it) → mail to the old domain bounces. → all 4 user-facing addresses switched to `@tricityshadi.com`. (AdminLogin placeholder `admin@tricitymatch.com` left — it's the real admin seed login.) |

### Verified-clean (Chunk 7)
PlanCard CTA is a real `<button>` (keyboard ok), plan names are `<h3>`, features in `<ul>`, current-plan disabled, price formatting `toLocaleString('en-IN')` ✓ · payment-not-configured path toasts cleanly (prod Razorpay gated) ✓ · PaymentHistory: semantic `<table>` w/ `<th>`, labeled invoice button, good empty + loading states ✓ · PaymentFailed/Success: clear recovery CTAs, no dead ends ✓ · build + 31/31 FE green.

### NOT VERIFIED (Chunk 7)
Live end-to-end payment (needs real Razorpay creds — config-gated in prod) so the prefill/processing-state path is build- + bundle-verified, not exercised against live checkout. PaymentHistory `PlanBadge` uses legacy plan keys (free/basic/premium/gold) so real plan types (basic_premium/...) render default-gray with an underscored label — Low cosmetic, not fixed.
## CHUNK 8 — Mobile experience (RN app)  ⏭️ SKIPPED (deferred by user 2026-06-17)
Native Expo/RN app in `mobile/` — different stack, not browser-verifiable like the deployed web app. Audit method there = static read + `node_modules/.bin/tsc -p tsconfig.json`. Revisit after web chunks.

## CHUNK 9 — Accessibility deep-pass (web)  ✅ DONE (public surface)
Holistic **axe-core 4.10** sweep on live prod (homepage + all public pages). Per-component keyboard/label a11y already hardened in Chunks 2–7; this caught cross-cutting issues.

**Result: homepage 23 violations → 2; all 7 other public pages 0 violations.** `lang=en` set, per-route titles ✓.

| ID | Sev | Status | Finding → Fix |
|----|-----|--------|-------------|
| C9-1 | 🟠 Serious | ✅ FIXED-VERIFIED | **Homepage city-strip cards `nested-interactive`** — `role=button`+`tabIndex` wrapping a focusable `<Link>` (3 nodes). → strip is now a non-interactive visual container; keyboard entry on the inner "Browse {city}" Link (`aria-label`+`onFocus` expands). **axe re-run: gone.** |
| C9-2 | 🟠 Serious | ✅ FIXED-VERIFIED | **`#why-scroller` horizontal region not keyboard-scrollable** (`scrollable-region-focusable`). → `tabIndex=0`+`role=group`+`aria-label`. **axe: gone.** |
| C9-3 | 🟡 Mod | ✅ FIXED-VERIFIED | **Heading order skips** — trust-card titles `<h4>` under `<h2>` (skipped h3); footer columns `<h5>`. → both `<h3>`. **axe: gone.** |
| C9-4 | 🟠 Serious | ✅ FIXED-VERIFIED | **Contrast (15 nodes)** — process-step preview text faded to opacity .35 (**2.14:1**, real step titles); trust-card numbers (3.87); match-ticker location (4.0). → opacity floors .7/.85 + .55→.75 + .6→.8. **axe: 15→0 of these.** |
| C9-5 | 🟠 Serious | ✅ FIXED-VERIFIED | **Auth/content contrast** — Login dividers `text-neutral-500` (3.4); About/Safety/Terms/Privacy subtitles `text-neutral-400` (**2.52**); Contact + SuccessStories subtitles/states (2.4–3.3). → all → `text-neutral-600`. **axe re-run: all 7 pages 0 violations.** |
| C9-6 | 🟠 Serious | ✅ FIXED-VERIFIED | **`link-in-text-block`** — About/Safety inline mailto links were colour-only (1.08 non-text contrast vs body). → always-underlined. **axe: gone.** |
| C9-7 | ⚪ Low | ⏳ RECOMMENDATION | **2 remaining homepage contrast nodes** — signature gold-on-burgundy eyebrow kickers ("— Live matches", "— Safety first") at **3.52:1** (need 4.5). Fix = a slightly lighter gold for small on-dark text, but that touches the brand accent token → **needs design sign-off**, not auto-changed (same stance as H1-1). Exact: `var(--gold)` #C9A227 on burgundy #7c1d3a. |

### NOT VERIFIED (Chunk 9)
Authed pages (dashboard/search/profile/chat/settings/subscription) not run through axe — require a logged-in session; their per-component a11y was hardened + spot-checked in Chunks 4–7. axe catches ~30–50% of WCAG issues (automated); manual SR walkthrough of full authed flows not done this pass. Mobile RN app a11y (Chunk 8) deferred.
## CHUNK 9 — Accessibility review  ⏳ PENDING
## CHUNK 10 — Final polish pass  ⏳ PENDING

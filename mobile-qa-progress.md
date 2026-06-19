# Web Mobile-View QA — Progress (Single Source of Truth)

**Started:** 2026-06-18 · **Target:** http://localhost:3000 · **Viewport:** 375×812 (mobile only) · **Tool:** Playwright MCP
**Goal:** Remove unprofessional slop (emoji in copy, childish colored info boxes, rainbow gradients, `✓`/`✦` unicode-as-icon), fix mobile layout + workflow bugs. RN apps deferred.
**Method:** TEST → FAIL → root-cause → FIX → RETEST → VERIFY. Fix-on-discovery, one area at a time, evidence (screenshot) per finding.
**Status legend:** ✅ pass · ⚠️ pass w/ note · ❌ fail (→ fix) · 🔄 testing · ⏳ pending

## Area status
| Area | Scope | Status |
|------|-------|--------|
| A | Global chrome (Navbar drawer, BottomNav) | ✅ no fixes |
| B | Public marketing (Home, About, Contact, Safety, Privacy, Terms, SuccessStories) | ✅ 1 fix |
| C | Auth (Login, Forgot, Reset) | ✅ no fixes |
| D | Onboarding wizard (14 steps) | ✅ many fixes |
| E | Dashboard | ✅ 1 fix |
| F | Search + ProfileCard + FilterPanel | ✅ 4 fixes (1 bug) |
| G | Chat | ✅ 1 fix |
| H | Profile (view/detail/editor) | ✅ big recolor |
| I | Subscription | ✅ no fixes |
| J | Settings/Notifications/Verification + ErrorBoundary | ✅ 2 fixes |

## Findings log
_(URL · finding · fix · re-verify)_

### Area A — Global chrome ✅
- `/` + `/dashboard` @375 — navbar (logo+hamburger), public drawer (Sign In/Create Profile), authed drawer (avatar+nav+Sign Out), BottomNav (Home/Search/Chat/Profile active states). No overflow, no slop, tap targets OK. **No fixes needed.**

### Area J — Account pages + ErrorBoundary ✅
- `/settings` (Account/Privacy/Notifications/Verification/Danger-Zone tabs), `/notifications` (empty state), `/verification` (status chips + doc-submit form + bg-check) — all render clean @375, on-brand burgundy, no overflow, no slop.
- **FIX:** Notifications type-color chips were a rainbow — off-brand `match` rose→`primary`, `profile_view` purple→`slate` (kept semantic blue/amber/green/red). `pages/Notifications.jsx`.
- **FIX:** ErrorBoundary `from-rose-50 via-white to-pink-50` bg → `bg-neutral-50`; "Try Again" `from-rose-500 to-pink-500` gradient → solid `bg-primary-500`. `components/common/ErrorBoundary.jsx`.

### Area I — Subscription ✅
- `/subscription` @375 — plan cards (Free active / Basic / Premium Plus "Most Popular" / VIP "Best Value") stack clean, on-brand tier colors (burgundy + gold), FiCheck feature lists, no overflow, no slop. Grep clean (0 emoji/✓/rose/pink/purple). Payment is Razorpay config-gated (not charged). **No fixes needed.**

### Area H — Profile (view/detail/editor) ✅ (major fix)
- **FIX (whole-page off-brand):** `MyProfileView.jsx` (29 `rose-*`) and `ProfileDetail.jsx` (34 `rose-*`) were themed entirely in **rose/pink** (≠ brand burgundy). Global `rose-`→`primary-` recolor (buttons, links, icons, pills, chips, badges). Re-verified @375: both render in burgundy, professional.
- **FIX (placeholder gradients):** photo/header fallbacks `from-rose-100 via-rose-50 to-pink-50` + `from-rose-50 to-amber-50` → `from-primary-100 via-primary-50 to-gold-50` (matches ProfileCard).
- **FIX (`✓`/`!` glyphs):** MyProfileView verified/unverified StatBadge `'✓'`/`'!'` → `<FiCheck/>` / `<FiAlertCircle/>` (import added). ModernProfileEditor step indicator `'✓'` → `<FiCheck/>`.
- Re-verify: `/profile` (own) + `/profile/:id` (other user, Anjali S.) both on-brand burgundy/cream, no pink, no glyphs, no overflow.

### Area G — Chat ✅
- `/chat` empty state ("No Matches Yet" + Find Your Match) renders clean @375, on-brand. Thread/bubble view needs premium+mutual-match fixtures (not reachable with free QA user); bubble styles live in `index.css` (on-brand burgundy/gray).
- **FIX:** premium-gate lock chip `from-amber-100 to-orange-100` + `text-amber-600` → `bg-gold-50 border-gold-100` + `text-gold-600` (premium = gold convention). `pages/Chat.jsx`.

### Area F — Search + ProfileCard + FilterPanel ✅
- `/search` renders @375 (sort dropdown, profile-ID search, card grid). Card no-photo placeholder is on-brand (primary/gold) — left as-is.
- **BUG (mobile, real):** FilterPanel bottom-sheet "Apply Filters" was un-tappable — sheet `z-50` == BottomNav `z-50`, BottomNav intercepted pointer events. Fix: overlay `z-40→z-[55]`, sheet `z-50→z-[60]` (above BottomNav). Re-verified: open Filters → Apply now fires, sheet closes, results refresh (15 profiles). `components/search/FilterPanel.jsx`.
- **FIX (slop):** ProfileCard premium crown badge multi-color gradients (amber→yellow / purple→indigo / rose→pink) → solid brand (`bg-gold-500` VIP / `bg-primary-600` Plus / `bg-primary-400`); crown icon colors likewise (gold/primary, dropped rose+purple); `'✓ Interest Sent'` → `<FiCheck/>` + text. `components/cards/ProfileCard.jsx`.
- **FIX (slop):** InterestTags pill `from-pink-100 to-purple-100 text-purple-700` → `bg-primary-50 text-primary-700 border-primary-100`. `components/profile/InterestTags.jsx`.

### Area E — Dashboard ✅
- Hero, stat cards (icon chips are on-brand `primary-50`/`gold-50`/`success-50`), greeting, Upgrade bar, Who-Viewed/Today's-Matches/Curated sections render clean @375, no overflow.
- **FIX:** plan-tier badge colors were off-brand — `basic_premium` rose, `premium_plus` purple → normalized to `primary` (burgundy) + `gold` (`pages/Dashboard.jsx` PLAN_META). VIP amber kept (gold-family).
- Kept as-is: ProfileCompletionMeter emerald/amber/rose = conventional traffic-light progress UX (semantic, not slop). Match-card rose/pink placeholder gradients are ProfileCard → fixed in Area F (propagates here).

### Area D — Onboarding wizard ✅ (slop hotspot)
- **FIX (emoji + childish colored boxes):** every step info-box converted bright pastel (`bg-cyan/yellow/orange/blue/indigo/pink/purple/green-50`) → one muted standard `bg-neutral-50 border-neutral-200 text-neutral-600`, emoji headers stripped, copy tightened:
  - PreferencesStep (🎯→"Smarter match recommendations"), LifestyleStep (🌟), AboutYourselfStep (✨ "Make yourself shine"→"A complete profile stands out"), LocationStep (📍), EducationStep (📚 "Career matters"→"Education & career"), FamilyStep (👨‍👩‍👧‍👦), ReligionStep (🙏 "Cultural values matter"→"Cultural compatibility"), MaritalStatusStep (💚), PhotosStep (📸 + 💡, 2 boxes + icon recolored to primary), VerificationStep (🔐 box + 🛡️ box).
- **FIX (`✓` unicode-as-icon → `<FiCheck/>`):** CreateAccountStep (selected-option check + "Referral code applied"), CreatingForStep (selected-option check). FiCheck added to imports.
- Grep: 0 emoji / 0 `✓` / 0 `✦` left in `components/onboarding/`. Browser re-verify @375: Verification step renders muted "Account security" box, no overflow. ✅

### Area C — Auth ✅
- `/login` (Sign In/Create tabs, SSL/Privacy trust row), `/forgot-password` (email + Send Reset Link), `/reset-password` (no token → "Invalid Reset Link" state). Clean, professional, no slop, no overflow @375. Minor: auth pages show page logo under global navbar logo (common pattern, left as-is). **No fixes needed.**

### Area B — Public marketing ✅
- `/` Home, `/about`, `/safety`, `/success-stories` (empty state), `/privacy` — render clean @375, serif headings, no emoji/gradient slop, no overflow. ✅
- `/contact` — **form works** (prior "display-only" note was stale): filled + submitted → success state "received your message…". ✅
- **FIX:** `/terms` + `/privacy` used old brand "TricityMatch" (Terms 3×, Privacy 1×) → replaced with "TricityShadi" (`pages/Terms.jsx`, `pages/Privacy.jsx`). Re-verified: 0 "TricityMatch" in rendered DOM. ✅ (admin pages still use TricityMatch — out of scope)

## Admin panel pass (2026-06-19, @1440 desktop — admin is a desktop tool)
Walked all 10 admin routes + workflows. All render, functional, console clean.
| Route | Status |
|-------|--------|
| /admin/dashboard | ✅ stats + 3 charts + quick actions |
| /admin/users (list/detail/create) | ✅ table, search, status dropdown, View→detail, Create form |
| /admin/verifications | ✅ Pending/Approved/Rejected/All tabs, empty state |
| /admin/subscriptions | ✅ table + search + edit action |
| /admin/revenue | ✅ year filter, Export CSV, stat cards + charts (no 2026 data) |
| /admin/reports | ✅ 5 status tabs, search, empty state |
| /admin/marketing-users | ✅ list + Create User |
| /admin/referral-codes | ✅ list + Create Code |
| /admin/leads | ✅ 3 filters, empty state |
| /admin/success-stories | ✅ table + New Story CRUD modal (full form) |

**Fixes:**
- **Brand:** sidebar/header/login said "TricityMatch" → "TricityShadi"; logo "TC"→"TS" (`AdminLayout`, `AdminDashboard`, `AdminLogin`).
- **Off-brand theme:** entire admin was rose-themed (~47 `rose-*` across 12 files) → `rose-`→`primary-` (burgundy). Active nav, buttons, links, charts-region now on-brand.
- **Accent blue:** primary action buttons/links were blue in marketing-side admin pages (`AdminMarketingUsers`, `AdminReferralCodes`, `AdminLeads`, `AdminMarketingUserDetail`) → `bg-blue-600`/`text-blue-600` accent → `primary` (kept semantic `bg-blue-100` status chips for contacted/reviewing/basic).
- **UX:** AdminUserDetail DOB showed raw ISO `1994-05-10T00:00:00.000Z` → formatted `10 May 1994`.
- Verified @1440: dashboard/users/marketing all burgundy + branded; build green, FE 31/31.

**Observations (not fixed, low-value/out-of-scope):** sidebar footer "Admin TricityMatch" + `admin@tricitymatch.com` = DB account data (not static); dashboard revenue chart shows an Apr bar while Revenue page reads "No data 2026" (different queries); pie-chart slice labels slightly clipped; a few admin page titles have uneven top padding. Marketing-role portal (`pages/marketing/*`) still has blue accents — separate portal, not the admin panel.

## Regression (final)
- [x] FE tests **31/31 green**
- [x] FE **build green** (all edits compile — new FiCheck/FiAlertCircle imports OK)
- [~] lint: 15 errors ALL pre-existing (`test/setup.js` afterEach, `validators.d.ts` parse, RHF deps) — none in files touched this pass
- [x] Home `✓`/`✦` reviewed — tasteful brand typography (burgundy/gold royal motif), page reads professional → kept (plan: "fix only if childish")
- [x] Dead unused `components/ui/profile-multistep-form.tsx` (zodiac glyphs) — not imported/routed, out of scope

## Summary
**10 areas audited @375px, screen-by-screen, fix-on-discovery.** Fixes across **~20 files**:
- **Slop removed:** all onboarding emoji (11 boxes) + childish multi-color info boxes → 1 muted neutral standard; `✓`/`!`/`✦` unicode-as-icon → `FiCheck`/`FiAlertCircle`; rose/pink/purple/amber→yellow gradients → solid brand (burgundy/gold).
- **Whole-page off-brand recolor:** MyProfileView + ProfileDetail were 100% rose-themed → recolored to burgundy (`rose-`→`primary-`).
- **Brand bug:** Terms/Privacy said "TricityMatch" → "TricityShadi".
- **Real mobile bug:** FilterPanel "Apply Filters" un-tappable (z-index under BottomNav) → fixed.
- **Workflow verified:** Contact form submit ✓, Search filter apply ✓, login/nav ✓.
- Clean (no fixes): Home, About, Safety, SuccessStories, Login/Forgot/Reset, Subscription, Settings, Verification, global chrome.

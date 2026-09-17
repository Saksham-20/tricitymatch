# TricityMatch Web — Current State Audit (2026-09-17)

**Purpose:** establish what the web frontend actually is today, so a full UI/UX rework can be scoped against reality rather than against the changelog. Read-only audit — nothing was edited.

**Method.** (1) Full code inventory of `frontend/src` — 36 pages, 12 component directories, 349 files scanned. (2) Live visual audit of production `https://tricitymatch.com` at 375 / 768 / 1440, signed in as the QA member (`globoniksprod@gmail.com`, free tier), plus dark mode and elder mode. 57 screenshots in `scratchpad/audit-shots/`. Driven through a dedicated Playwright instance (the shared MCP browser was in use by another agent).

**Prior-QA warnings respected:** scroll-animated content (`react-countup`, `whileInView`) was scrolled into view before capture; no third-party-host 503s were treated as CDN failures.

---

## 0. Corrections to the record

Three things in `CLAUDE.md` are stale and would mislead the rework:

| Claim in CLAUDE.md | Reality on disk today |
|---|---|
| "`npm run lint` still **exits 1** on a PRE-EXISTING slop-lint failure (4 off-token hexes in `BiodataCard.jsx` + `toastConfig.tsx`)" | `node scripts/slop-lint.mjs` → **`slop-lint: clean (349 files scanned)`, exit 0.** The `BiodataCard.jsx:123` hexes are `#25D366`/`#1fb958` — the WhatsApp brand colour, correctly hardcoded and correctly allowlisted. Do not budget rework time for this. |
| PROGRESS.md: "**Status: COMPLETE (2026-06-23)** … 0 off-system tokens in pages" | True only for the colour audit, and only for `pages/`. 293 literal hex values remain in `frontend/src/**/*.{jsx,js}`; most are legitimate dark-surface values, but they are **un-tokenized** (see §4.2). |
| 2026-08-19 changelog: "**Skeleton/EmptyState/ErrorState primitives + adoption** (Dashboard/Search/Matches/PaymentHistory)" | Only `Skeleton` was adopted. **`EmptyState.jsx` and `ErrorState.jsx` have zero importers anywhere in the codebase** (`ui/index.js:12-13` re-exports them; nothing imports them). Every empty and error state in the app is hand-rolled. |

---

## Part 1 — Code inventory

### 1.1 Headline numbers

| Metric | Value |
|---|---|
| Pages | 36 (13 public/member core, 18 admin, 5 marketing) |
| Largest page | `pages/Home.jsx` — 1,441 lines |
| Files importing `framer-motion` directly with ad-hoc inline variants | **45** |
| Files importing the sanctioned `utils/animations.js` | **5** (`Dashboard`, `Search`, `Login`, `ForgotPassword`, `ResetPassword` — and 4 of those 5 *also* import framer-motion directly) |
| `ui/` primitives with **zero** importers | **4** — `Card.jsx`, `Input.jsx`, `EmptyState.jsx`, `ErrorState.jsx` |
| Component directories with zero importers | `components/matching/` (all 3 files dead) |
| Member/public pages with **zero** `dark:` classes | **15** |
| Hand-rolled `<table>` blocks in admin, no shared `<Table>` | ~12, in **3** copy-pasted skins |
| Independent hand-rolled "badge/status chip" components in admin | **~8**, despite `ui/Badge.jsx` existing |
| Independent hand-rolled circular compatibility rings | **3** |
| Tailwind keyframes defined vs. used | 22 defined, 7 used ≥1 file, **6 used by zero files** |

### 1.2 Member + public pages

State legend: **D** default · **L** loading · **E** empty · **R** error · **🔒** premium gold-lock.

| Page | Who | Visual pattern | L | E | R | 🔒 | Motion | Notes / debt |
|---|---|---|---|---|---|---|---|---|
| `Home.jsx` (1441) | public | Bespoke editorial: dark-burgundy hero, mono eyebrows, Playfair+italic, ticker marquee, numbered horizontal-scroll cards, scroll-progress bar | n/a | n/a | n/a | n/a | framer-motion ad-hoc + CSS `animation-timeline: scroll()` | **Page-local palette of 11 literal hexes at `Home.jsx:27-37`** (`#7C1D3A #5C1229 #9B2248 #FDF8F2 #F5EDE0 #FFFAF6 #2D1A22 #4A3B30 #B8952A #F0D080 #D4B048`) — a second design system parallel to Tailwind tokens. Unicode-as-icon survives: `✦` ×4 (`:405,599,714,834`), `✓` ×3 (`:495`), `★` ×2 (`:1305`). Zero `dark:` classes (intentional — page is its own dark treatment). |
| `Login.jsx` (549) | public | Two-phase progressive: identifier → password, split rail | button text | n/a | inline `apiError` | n/a | imports `animations.js` **and** framer-motion | 0 `dark:` classes. |
| `ModernOnboarding.jsx` (783) | public | Left rail + step card, 2 steps | `isLoading` button text `:611` | n/a | persistent inline + **Retry** `:629` | n/a | framer-motion ad-hoc | Best error handling on the site (non-destructive Retry re-runs only the failed PUT). `✕` unicode close at `:467`. Renders **under the global public Navbar**, so two TricityMatch logos stack 100px apart (live-confirmed). |
| `Dashboard.jsx` (1122) | member | Stacked banner cards → greeting hero → checklist tiles → sections | ✅ real `Skeleton` `:30-50,528` | ✅ hand-rolled | ✅ banner + retry | ✅ | `animations.js` + framer-motion | 6 `gradient-to` (most in app). 5 different card background treatments stacked vertically (see §2.2). |
| `Search.jsx` (506) | member | Sticky filter sidebar + 3-col card grid | ✅ real `Skeleton` `:42-51` | ✅ icon+line+2 CTAs `:397-443` — supply-aware, the best-written empty state | ✅ icon+line+**Try Again** `:379-394` | via `ProfileCard` | `animations.js` + framer-motion | The only page shipping all four states properly — **and it hand-rolls all of them instead of using `EmptyState`/`ErrorState`.** |
| `Matches.jsx` (295) | member | 4 tabs + card grid | ✅ `Skeleton` `:70-79` | ✅ per-tab copy `:25-62` | ✅ | ✅ gold star on Likes-You tab | framer-motion | **Only page with an explicit state machine** (`:93` `'loading' \| 'ready' \| 'empty' \| 'error' \| 'premium'`). **🐞 51px horizontal overflow at 375px** — tab row `Matches.jsx:160` `flex-1 sm:flex-none`. |
| `ProfileDetail.jsx` (1040) | member | Single-column `max-w-3xl`, photo → facts → tabs | ⚠️ bare `loading` flag `:120`, no skeleton | n/a | ❌ **ABSENT** | ✅ `Message (Premium)` gold outline | framer-motion ad-hoc | Third hand-rolled compat ring (`CompatRing` `:515,578`). 7 call sites open the broken `UpgradeModal` (§3.1). At 1440 the page is ~50% empty background. |
| `Chat.jsx` (875) | member (premium) | Sidebar + thread + composer | ⚠️ `animate-pulse` **text** "Loading conversations…" `:523`, no skeleton | text only | ❌ **ABSENT** | ✅ PaywalledComposer, ReplyMeter, DS7 gold discipline | CSS `message-enter` class | `components/chat/` is the most disciplined directory in the codebase — every file used, every file documents its own DS rule. The *page* is the weak part. |
| `Subscription.jsx` (1059) | member | Long-scroll plan cards + compare table | ⚠️ hand-rolled `animate-pulse` divs `:848-854` (not `Skeleton`) | n/a | ❌ | ✅ correct gold | framer-motion | Two near-identical cream notice bars stack (launch offer + founding offer). |
| `Settings.jsx` (899) | member | Left tab rail + right panel | ✅ `:237` | partial | ✅ `setError` `:190,200` | n/a | none | **🐞 129px horizontal overflow at 375px** — `Settings.jsx:892` `flex-1 min-w-0 …`. Defines a **second component also named `SectionHeader`** (`:50-55`) that shadows `common/SectionHeader.jsx` with a plainer, non-Playfair treatment. |
| `MyProfileView.jsx` (586) | member | Completion meter → nag rows → profile sections | ⚠️ `loading` flag `:111` | n/a | ❌ | n/a | framer-motion | 6 social-brand hexes `:77-82`, Spotify green ×5 `:403-409`. See §2.3 — worst information hierarchy on the site. |
| `ModernProfileEditor.jsx` (521) | member | Section rail + form + exit guard | ✅ `LoadingSpinner` `:511` | n/a | toast | n/a | framer-motion | `✕` unicode `:418`. |
| `Notifications.jsx` (252) | member | List | ⚠️ ad-hoc `:182` | text | ❌ | n/a | framer-motion | |
| `Verification.jsx` (178) | member | Trust ring → status → tier card | ❌ none | n/a | ❌ | n/a | none | Trust-score ring renders **gold at 0%** for a free member (§4.1). |
| `Guardian.jsx` (212) | member | Two lists | ⚠️ `:95,131` | `common.empty` text `:204` | ❌ | n/a | none | 0 `dark:`. |
| `Astrologers.jsx` (92) / `AstrologerDetail` / `AstrologerBookings` | member | List + detail | ⚠️ `animate-pulse` `:38` | — | ❌ | n/a | none | 0 `dark:` on all three. |
| `SuccessStories.jsx` (112) | public | Card grid | ⚠️ `animate-pulse` `:58` | text `:71` | ❌ | n/a | none | 0 `dark:`. |
| `PaymentHistory.jsx` (202) | member | Table | ✅ `Skeleton` `:50-56` | — | ❌ | n/a | none | One of only 4 real `Skeleton` consumers. |
| `Help / About / Safety / Contact / Terms / Privacy / RefundPolicy / DeleteAccount` | public | Prose | n/a | n/a | Contact: inline `errors` | n/a | none | **All 0–1 `dark:` classes.** |
| `CityMatrimony` / `CommunityMatrimony` | public SEO | Prose + locality blocks | ❌ | ❌ | ❌ | n/a | none | Good `dark:` coverage (unusual for public pages). |
| `PaymentSuccess` / `PaymentFailed` | member | Centered card | n/a | n/a | n/a | n/a | framer-motion | 1–2 `dark:` classes. |

### 1.3 `components/ui/` — the design-system layer

The core finding: **adoption is inversely correlated with quality.**

| File | Variants | Importers | Verdict |
|---|---|---|---|
| `Card.jsx` | 4 (`elevated/outlined/filled/gradient`, `:38-43`) + `Card.Header/Body/Footer` | **0** | Best-documented file in the folder. **Dead.** `gradient` variant is an off-token literal `#FDF8F2` (`:42`). |
| `Input.jsx` | icon slots, password toggle, animated error | **0** | **Dead.** Duplicate-intent with `FormField.jsx`, which won. |
| `EmptyState.jsx` | none (fixed layout, `:1-35`) | **0** | Correct spec — icon circle, Playfair title, description, CTA, dark-aware. **Never wired to anything.** |
| `ErrorState.jsx` | none (fixed layout, `:1-34`) | **0** | Correct spec — `FiAlertCircle` + `FiRefreshCw` retry, dark-aware. **Never wired to anything.** |
| `Button.jsx` | 8 variants × 6 sizes (CVA, `:27-49`) | **2** (`ModernOnboarding`, `ModernProfileEditor`) | Well-formed matrix, barely used. Everything else hand-rolls `<button className="…">`. `gradient-to` on primary and gold (`:29,36`). |
| `Badge.jsx` | 10 (`:23-34`), 3 of them gold/burgundy gradients | 1 direct | Grab-bag: 6 semantic tones + 3 tier gradients in one map. **0 `dark:` classes.** |
| `Avatar.jsx` | no variant prop — `size` + boolean flags | 1 (+ Navbar hand-rolls its own at `:141,413`) | Different API *shape* to Card/Button/Badge. No `onError` → a broken URL renders a blank img, not initials. |
| `Skeleton.jsx` | 2 + `Skeleton.Text` | **4** | Smallest, cleanest API; the only well-adopted state primitive. |
| `FormField.jsx` | none | **12** | The real workhorse. **0 `dark:` classes** — the most-used form primitive does not explicitly participate in the dark theme. |
| `Select.jsx` | none | **9** | Most-used onboarding primitive. **0 `dark:` classes**; floating panel hardcodes `bg-white border-neutral-300` (`:194`). Dropdown opens with no transition. |
| `RetryImage.jsx` | none | **9** | Newest, simplest, best-adopted file. No variant system at all. |
| `OtpBoxes.jsx`, `DobField.jsx`, `CheckBox.jsx`, `Progress.jsx`, `ImageLightbox.jsx`, `StagedLoader.jsx` | — | 2–3 each | Fine. `ImageLightbox` appears/disappears instantly (no transition). |

`ui/index.js` re-exports only 8 of 17 files, so half the folder is not barrel-importable — which is why most consumers deep-import by path.

**Four different API shapes coexist** across 7 primitives: CVA variants (`Button`), plain-object variants (`Card`, `Badge`), boolean flags (`Avatar`), no-variant fixed layout (`EmptyState`, `ErrorState`). There is no shared naming convention.

### 1.4 `components/common/`

- `Navbar.jsx` (525 lines, the most page-visible component) — **entirely ad-hoc inline framer-motion**, zero `animations.js`. Hand-rolls its own stagger (`:436-439`) duplicating `staggerContainer`/`staggerIndex`. **16 repeated hardcoded dark-surface hexes** (`dark:bg-[#1a1f2e]`, `dark:border-[#252b3b]`, `dark:bg-[#14182a]`, `dark:bg-[#0f1117]`). Reimplements `Avatar` inline at `:141,413`.
- `SectionHeader.jsx` — the canonical tick-bar + Playfair header. Used by **2 pages only** (`Matches.jsx:141`, `Dashboard.jsx:818,854,941,976,1019`). 22 other pages hand-roll headings; `Settings.jsx:50-55` defines a same-named shadow component.
- `UpgradeModal.jsx` — see §3.1.
- `LanguageSwitcher.jsx:13,17` — raw inline `style` with hex (`#6b6b6b`, `#E8E8E8`), invisible to both Tailwind and the global dark override. Guaranteed wrong in dark mode.
- `LoadingSpinner.jsx` — its `PageSkeleton` export (`:66-87`) hand-rolls shimmer boxes rather than using `ui/Skeleton`. Third distinct spinner implementation (`LoadingSpinner`, `ProtectedRoute.jsx:13`, CSS `.skeleton`).
- `ErrorBoundary.jsx` — the site-wide crash card. **0 `dark:` classes**: a white card in dark mode.

### 1.5 `components/onboarding/steps/` — 14 files

Visually consistent **by copy-paste, not by composition**:
- 10 of 14 end with a byte-identical info-tip box (`bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600`) that was never extracted into a `<StepTip>`.
- 12 of 14 hand-type `motion.div initial={{opacity:0,y:10}} … transition={{delay:0.1/0.15/0.2/0.25…}}` per field, with manually incrementing delays. **Not one of the 14 imports `utils/animations.js`** — this is precisely what `fadeRise` + `staggerIndex` exist to replace.
- `SocialConnectionsStep.jsx` has zero motion and 6 third-party brand hexes (`:8-13`).
- `CreateAccountStep.jsx` (388 lines) is the outlier: two entirely separate UIs (self-signup vs guardian) in one file.

### 1.6 `components/profile/` and `cards/`

- `ProfileCompletionMeter.jsx:208,322` — ring/bar colour is `percent>=85 ? '#2E7D32' : percent>=60 ? '#C9A227' : '#8B2346'`. **Gold is used as a 60–85%-complete tier colour for free members**, directly against "gold = premium/VIP only".
- `VideoIntroManager.jsx:61,88,99` — the **only surviving file** using off-brand `rose-`/`slate-` classes; predates the 2026-06-18 sweep and was missed.
- `FloatingActionBar.jsx:101` — `bg-gold text-white` for the *shortlist-active* state. Shortlisting is a free action; gold again outside its scope.
- `ProfileCard.jsx` (505) — two full layouts in one component; `CompatArc` (`:16-44`) is the second of three hand-rolled rings; mixes `style={{boxShadow:…}}` literals (`:249,252,255`) with `shadow-burgundy` utilities (`:161,412`) in the same file.
- `components/matching/` — `CompatibilityMeter.jsx`, `MatchPopup.jsx`, `index.js` are **all dead code** (zero importers). `MatchPopup` is a fully-built, recently-touched "It's a Match!" celebration that is mounted nowhere.

### 1.7 Admin — 18 pages + 4 components

The admin panel is not part of the design system. It is a separate, older codebase:

- **Zero admin files import anything from `components/ui/`** — not `Skeleton`, `EmptyState`, `ErrorState`, `Card`, `Badge`, `Button`, or `Avatar`.
- **Zero motion anywhere.** No framer-motion, no `animations.js`, no keyframes. Every tab switch, filter apply and modal open is an instant hard cut.
- **Zero `dark:` classes in any of the 22 files.** Dark mode works only via a global `html.dark .admin-panel .bg-green-100 {…}` override block in `index.css:1046-1111`, scoped by the `.admin-panel` wrapper (`AdminLayout.jsx:175`). Clever, but it only catches a fixed allowlist of utility classes.
- **~8 independent badge components** re-inventing the same pill: `StatusBadge` ×3 (`AdminUsers.jsx:14-27`, `AdminReports.jsx:8-20`, `AdminVerifications.jsx:10-22`), `PlanBadge` (`AdminSubscriptions.jsx:21-35`), `RoleBadge` (`AdminTeam.jsx:27-35`), plus inline chips in four more pages — each with a drifting colour map.
- **3 copy-pasted table skins** across ~12 tables. Pattern A (`AdminUsers.jsx:141` +5 files), Pattern B (`AdminContactMessages.jsx:262` +3), Pattern C (one-off, `AdminSuccessStories.jsx:87`).
- **No `AdminPageHeader`.** Every page hand-rolls `<h1>`; four pages drift to `text-3xl` against the other fourteen's `text-2xl`.
- **Loading quality is arbitrary and bimodal:** spinners in ~11 files, literal unstyled `"Loading..."` text in 5, `animate-pulse` blocks in 2.
- **`AdminDashboard.jsx:39` swallows fetch errors** with `.catch(() => {})` — a backend failure renders as a dashboard full of zeros.
- **`AdminSuccessStories.jsx` is hardcoded dark** (`text-white`, `bg-gray-800/900`, `:75,87-176`) regardless of theme — it is visibly broken against the other 17 light pages.
- Best-in-panel patterns that should become the shared components: `AdminContactMessages.jsx:235-243` (icon + message + Retry) and `:251-258` (Inbox icon + line + context).

### 1.8 Marketing portal — 5 pages + 3 components

A **third parallel design language**. It imports zero `components/ui/` primitives, zero `components/admin/` components, and uses a **different icon library** (`lucide-react`) from the entire member surface (`react-icons/fi`). `MarketingLayout.jsx:6-8` documents this as deliberate. Three loading treatments exist inside this one 5-page portal: plain `"Loading…"` (`MarketingDashboard.jsx:42`), icon+text (`MarketingLeads.jsx:116-118`), plain `"Loading..."` (`MarketingReferralCodes.jsx:135`). Errors are inline red banners with no retry, while the same portal uses toasts for the same class of error elsewhere. Dark mode **is** present and real (9–46 `dark:` occurrences per file) — the 2026-08-29 fix holds.

### 1.9 Motion

`utils/animations.js` is a good, short, opinionated standard (78 lines: `fadeRise` ≤8px/280ms, `fade`, `pageFade`, `staggerContainer` 60ms, `staggerIndex(i)` capped at 6, `stepSlide`). **It lost.** 45 files import framer-motion directly and write their own variants; 5 import the standard, and 4 of those 5 also bypass it.

`tailwind.config.js` still ships a 22-entry keyframe library from an earlier era — `bounce-in`, `glow`, `float`, `sparkle`, `confetti`, `heart-pulse`, `shake`, `gradient-shift`, `spin-slow`, `typing-bounce`. Six of them are used by **zero** files; the survivors (`bounce-in`, `glow`, `float`, `heart-pulse`, `shake`) directly contradict the standard's own rule: *"No bounce/spring/scale-pop on CONTENT."*

Screens with a real state change and **no motion at all**: `Select.jsx` dropdown, `ImageLightbox.jsx`, `PhotoNudge.jsx`, `FirstReplyUpsell.jsx`, `LiveSelfieCapture.jsx` phase swaps, `StagedLoader.jsx` copy swaps, and the entire admin panel.

---

## Part 2 — Live visual audit

All paths below are in `/private/tmp/claude-502/-Users-sakshampanjla-Desktop-REACT-tricitymatch/d59f0ea0-140f-4ecf-baf7-b1e67093e942/scratchpad/audit-shots/`.

### 2.1 What is genuinely good

**Home** (`home-1440-top.png`, `home-1440-hero.png`, `home-375.png`, `home-768.png`) is a premium 2026 landing page. Warm cream field, Playfair with a gold italic accent line, monospace eyebrow tracking, a rotating verified seal, fanned profile cards, a burgundy ticker marquee, numbered feature cards with geometric glyph icons rather than stock iconography, and honest copy ("We're starting the honest way: no inflated numbers"). It is art-directed, not assembled.

**Signup** (`signup-1440.png`) is close behind: a restrained left rail ("Two steps. About two minutes."), slim segmented progress, two quiet step rows, one clean card.

**Search filter sheet at 375** (`search-filters-375.png`) is textbook — grabber, sticky "Apply Filters" CTA, bottom nav correctly suppressed.

**Elder mode works** (`search-elder-1440.png`): `html.elder`, root font 18.5px, layout holds, nothing breaks.

**Dark mode works on the authed core** (`search-dark-1440.png`, `dashboard-dark-1440.png`, `subscription-dark-1440.png`, `settings-dark-1440.png`): `html.dark`, surfaces resolve to `#1a1f2e`/`#0f1117`, no white flashes.

**Fonts load correctly** — every `h1/h2/h3` across 11 routes × 3 viewports computes to `"Playfair Display"`. The August CSP font-fallback bug is fixed.

### 2.2 Dashboard — the banner stack (`dashboard-1440.png`, `dashboard-375.png`)

The signed-in home page opens with **five consecutive full-width bands, each a different background colour**: a pink photo-nudge card → a pink-gradient greeting hero with decorative circle outlines → a **yellow/amber** verification card → a white 3-tile checklist → a burgundy "Unlock Premium" bar. This is the pastel-stack pattern the 2026-06-18 pass was meant to eliminate, reassembled at page level instead of component level.

At **375px the entire first viewport is nag** — banner + greeting, zero product content above the fold — and the "Find Matches" CTA **wraps to two lines inside its own pill** ("Find / Matches").

One checklist item renders **struck through** with a green tick, which reads as a defect rather than as completion.

### 2.3 Profile — nine identical rows (`profile-1440.png`, `profile-375b.png`)

`/profile` opens on a 49% strength meter followed by **eight visually identical nag rows** — "Add profile photo", "Write about yourself", "Add education", "Add profession", "Add height", "Add weight", "Add marital status", "Add lifestyle preferences" — each an identical white pill with the identical pink `!` icon, differing only by a `+N%` number. The member's actual profile is entirely below the fold. This is a to-do list wearing a profile page's URL, and it has no visual hierarchy of any kind.

### 2.4 Search and Matches — the pink void (`search-1440.png`, `matches-1440.png`)

Every card in the browse grid renders a **~220px flat pink rectangle with a monogram** because those production profiles have no photo. The layout treats a missing photo as a full-bleed hero slot, so a matrimonial browse grid reads as three empty pink blocks. On `ProfileDetail` it becomes a **280px pink block containing one giant serif letter** (`profiledetail-1440.png`).

Also live:
- Match scores of **39% / 38% / 37%** (Search) and **30% / 21%** (Matches) are rendered prominently in burgundy arcs — the UI advertises how bad the matches are.
- The **shortlist button is gold** (`search-1440.png`, third card) — shortlisting is a free action; gold is reserved for premium.
- The count is rendered twice, two different ways: a `5+ profiles` chip beside the title *and* a `5 profiles found` bar below it. At 375 the chip wraps mid-value ("5+" / "profiles").
- Two cards in a three-column grid leave a third of the 1440 viewport empty, and the cards' bottoms **do not align** because chip rows wrap to different heights (`matches-1440.png`).
- At 375 the floating **Filters FAB overlaps the first profile card's content** (`search-375.png`).

### 2.5 ProfileDetail at 1440 (`profiledetail-1440.png`)

The single-column `max-w-3xl` rework fixed the two-column void by creating a different one: ~370px of empty background on **each** side, so the page is roughly 50% empty at desktop width. The five fact pills wrap 3+2 and sit ragged. `Message (Premium)` in gold outline is correct gold usage.

### 2.6 Settings (`settings-1440.png`)

Two rail items appear active simultaneously — "Account" (active, pink) and "Danger Zone" (also pink-tinted). The right ~270px of the content card is dead space because inner cards are width-constrained inside a much wider panel. The Language row says "Language" twice. **129px horizontal overflow at 375px** (`Settings.jsx:892`).

### 2.7 Verification (`verification-1440.png`)

Trust Score ring reads **`0%` in gold**. The "WHY GET VERIFIED" panel is a **cream/yellow tinted box with green tick icons** — a third and fourth colour family inside a burgundy/gold system. "Verification status" and "Selfie verification" are two different heading levels rendered at indistinguishable size.

### 2.8 Overflow probe

Programmatic sweep, 11 routes × 3 viewports:

| Route | Viewport | Overflow | Owner |
|---|---|---|---|
| `/matches` | 375 | **51px** | `pages/Matches.jsx:160` — `flex-1 sm:flex-none` tab button |
| `/settings` | 375 | **129px** | `pages/Settings.jsx:892` — `flex-1 min-w-0 …` content panel |

All other routes clean at all three widths.

---

## Part 3 — The one live bug that is not a design issue

### 3.1 🔴 The premium paywall quotes three prices that do not exist

`components/common/UpgradeModal.jsx:8-33` hardcodes a plan array that is **never fetched from the API**:

```js
{ key: 'basic_premium', name: 'Basic Premium', price: '₹1,500', duration: '15 days',  contactUnlocks: '5 unlocks'  },
{ key: 'premium_plus',  name: 'Premium Plus',  price: '₹3,000', duration: '1 month',  contactUnlocks: '10 unlocks' },
{ key: 'vip',           name: 'VIP',           price: '₹7,499', duration: '3 months', contactUnlocks: 'Unlimited'  },
```

Confirmed rendered live to the free QA account (`chat-1440.png`). None of these figures match anything the backend has ever sold — not the regular ladder (₹1,299 / ₹2,499 / ₹5,999) and not the live launch offer, which the `/subscription` page on the same session correctly renders as **one** plan: *Premium, ₹1,100 / 3 months / unlimited unlocks* (`subscription-1440.png`). Two of the three tiers shown (`basic_premium`, `vip`) are **withdrawn**, so `createOrder` would 400 them.

This modal is the paywall for the entire product: `Chat.jsx` (4 triggers incl. the whole free-user gate at `:549`), `ProfileDetail.jsx` (**7** triggers — messaging, voice call, video call, contact unlock, depleted quota), and `Dashboard.jsx:1112`. A free member clicking "Messages" gets a blank page plus a modal advertising three fictional products.

Worth noting alongside it: a free user's entire `/chat` experience is an empty page behind a modal. There is no gated preview, no conversation list, no reason to want the thing being sold.

---

## Part 4 — Cross-cutting system problems

### 4.1 Gold is not reserved for premium

The rule is "gold `#C9A227` = premium/VIP only." Live violations:

| Where | What gold marks |
|---|---|
| `profile/ProfileCompletionMeter.jsx:208,322` | a free member's 60–85% profile-completion tier |
| `pages/Verification.jsx:80` | a trust score of **0%** |
| `profile/FloatingActionBar.jsx:101` | the *shortlisted* state (a free action) |
| `cards/ProfileCard.jsx` shortlist button | same, visible live in `search-1440.png` |
| `admin/CommissionSettingsCard.jsx:54` | a B2B commission-rate setting |

Correct uses do exist and are well-documented — `chat/PaywalledComposer.jsx:5`, `chat/ReplyMeter.jsx:3-4`, `common/FoundingBadge.jsx:8-13`, the `Message (Premium)` button, the Likes-You tab star. The `chat/` directory in particular applies the rule deliberately and comments its reasoning. The rule is understood; it is just not enforced.

### 4.2 Dark mode is half a feature

`html.dark` works on the authed core. But **15 member and public pages carry zero `dark:` classes** — `Home`, `Login`, `ForgotPassword`, `ResetPassword`, `About`, `Safety`, `Contact`, `Help`, `Guardian`, `SuccessStories`, `Astrologers`, `AstrologerDetail`, `AstrologerBookings`, `DeleteAccount`, and near-zero on `PaymentSuccess`/`PaymentFailed`. So do `ui/FormField.jsx`, `ui/Select.jsx`, `ui/Badge.jsx`, `ui/Card.jsx`, `common/ErrorBoundary.jsx`, and all 22 admin files.

These survive only on a blanket `html.dark .bg-white { … !important }` override block in `index.css`, which catches a fixed allowlist of utility classes and misses anything outside it — inline styles (`LanguageSwitcher.jsx:13,17`), composite focus rings (`focus:ring-primary-500/20`), and floating panel shadows.

Where dark **is** implemented, the surface colour is an un-tokenized literal repeated 15+ times across Navbar, Chat, Profile, Search, Matches, Settings, Subscription: `#1a1f2e`, `#0f1117`, `#14182a`, `#252b3b`. There is no `dark-surface` token.

### 4.3 Elder mode is purely a font-size bump

Zero components in `ui/`, `common/`, `chat/`, `profile/` or `onboarding/` reference `.elder`. All behaviour lives in global CSS. Live-verified working (root font 18.5px), but it makes already-ragged card grids more ragged, and no component adapts its layout — only its scale.

### 4.4 Three design languages, one product

| Surface | Icons | Primitives | Motion | Dark |
|---|---|---|---|---|
| Member site | `react-icons/fi` | partial `ui/` | ad-hoc framer-motion | partial |
| Admin panel | `react-icons/fi` + `lucide` | **none** | **none** | global CSS hack |
| Marketing portal | `lucide-react` only | **none** | **none** | real `dark:` classes |

Three navigation chromes (`Navbar`, `AdminLayout`, `MarketingLayout`) with no shared ancestor. `MarketingLayout.jsx:6-8` documents the split as intentional.

---

## Part 5 — Designer's read: the 10 worst things, ranked

### Genuinely broken or ugly

**1. The paywall sells three products that don't exist.** `components/common/UpgradeModal.jsx:8-33`. Every premium wall on the site — chat, calls, contact unlock, dashboard — opens a modal quoting ₹1,500 / ₹3,000 / ₹7,499 against a live catalogue of exactly one ₹1,100 plan, two of the three tiers being un-purchasable. This is the single highest-value screen in a paid product and it is lying. Nothing else on this list costs money.

**2. `/profile` is eight identical grey nag rows.** `pages/MyProfileView.jsx` + `components/profile/ProfileCompletionMeter.jsx`. A member opens their own profile and sees a homework list: same pill, same pink `!`, same weight, eight times, differing only by `+10% / +8% / +6% / +6% / +4% / +4% / +2% / +4%`. Their actual profile is below the fold. There is no hierarchy, no grouping, no sense of what matters. It is the most demoralising screen in the product and it is the one every member visits most.

**3. A matrimonial browse grid made of empty pink rectangles.** `components/cards/ProfileCard.jsx` (+ `pages/Search.jsx`, `Matches.jsx`, `ProfileDetail.jsx`). Photoless profiles are a real production condition, and the design's response is to reserve a 220px full-bleed hero for a two-letter monogram on flat `bg-primary-50`. On ProfileDetail it becomes a 280px pink slab with one enormous serif letter. The most important visual asset in the category is missing and the layout has no fallback worth the name — the card should restructure, not leave a void.

**4. The Dashboard is five stacked coloured bands before any content.** `pages/Dashboard.jsx`. Pink banner → pink-gradient hero → **yellow** banner → white tiles → burgundy bar. The exact pastel-stack the June pass killed at component level, rebuilt at page level. At 375 the whole first screen is nag and the primary CTA wraps inside its own pill. The signed-in home page has no product on it.

**5. Two hard horizontal-overflow bugs at 375.** `pages/Settings.jsx:892` (129px) and `pages/Matches.jsx:160` (51px). Live, reproducible, on a mobile-first Indian product.

**6. The design system's own best components are dead.** `ui/EmptyState.jsx`, `ui/ErrorState.jsx`, `ui/Card.jsx`, `ui/Input.jsx` — four files, zero importers. `EmptyState` and `ErrorState` are on-brand, dark-aware, and exactly match the documented four-state requirement, and **not one page uses them**. Meanwhile `Search.jsx:379-443` hand-writes the best empty and error states in the app from scratch. The system isn't wrong; it's ignored. `Card.jsx` is unused while at least 8 distinct inline card treatments exist across `components/` alone, mixing `rounded-lg`/`rounded-2xl`/`rounded-3xl` and `shadow-sm`/`shadow-card`/`shadow-xl`/`shadow-2xl`/none for conceptually identical containers.

**7. Gold means nothing.** Gold currently marks: a paid plan, a 0% trust score, a 62%-complete free profile, a shortlist toggle, and an admin commission field. When the premium colour also marks "you have done slightly more than half of your homework", the upsell stops reading as an upsell. `ProfileCompletionMeter.jsx:208,322`, `Verification.jsx:80`, `FloatingActionBar.jsx:101`.

**8. `admin/AdminSuccessStories.jsx` is hardcoded dark inside a light panel** (`:75,87-176`), and `admin/AdminDashboard.jsx:39` swallows fetch errors with `.catch(() => {})` so a backend outage renders as a dashboard of confident zeros. The admin panel also has **zero motion and zero design-system imports across 22 files** — ~8 reinvented badges, 3 copy-pasted table skins, 5 different loading treatments.

### Fine, but dated

**9. The motion standard exists and lost 45–5.** `utils/animations.js` is genuinely good and genuinely ignored. `Navbar.jsx:436-439` hand-rolls a parallel stagger; 12 of 14 onboarding steps hand-type incrementing `delay: 0.1, 0.15, 0.2…` per field. `tailwind.config.js` still ships `bounce-in`, `glow`, `float`, `sparkle`, `confetti`, `heart-pulse`, `shake` — six used by nothing, the rest contradicting the standard's own "no bounce/spring on content" rule. The result isn't ugly, it's *incoherent*: every surface eases slightly differently, and the admin panel doesn't ease at all.

**10. Desktop layouts don't use the desktop.** `ProfileDetail.jsx` is ~50% empty background at 1440. `Settings.jsx` leaves 270px of dead panel. `Matches.jsx` leaves a third of the grid empty with two cards and misaligned card bottoms. Each is individually defensible; together they make the product feel like a phone app that was stretched.

### Where it looks like a 2024 AI-generated React app vs. a 2026 premium product

**The premium product is the front door.** `Home.jsx` and `ModernOnboarding.jsx` were art-directed by someone with a point of view — a page-local palette (`Home.jsx:27-37`), monospace eyebrows, editorial Playfair with italic accents, a ticker, geometric glyphs instead of stock icons, honest copy. Nothing about them reads as generated.

**The 2024 AI React app starts the moment you log in.** Dashboard, MyProfileView and Verification are the tell: rounded-2xl white card, pastel-tinted icon chip in a circle, bold title, grey subtitle, right-aligned chevron — repeated eight, nine, ten times down a page with no rhythm, no grouping, and no decision made about what matters most. Pink card, then yellow card, then green tick, then burgundy bar. That is the shape of code that was generated section-by-section against a prompt rather than laid out against a hierarchy.

**Where burgundy/gold/Playfair is used well:** Home end to end; the signup rail; `chat/` (every file documents and follows its own gold rule); `Subscription`'s price hierarchy; `Matches`' tab bar; the `Message (Premium)` gold-outline button; `FoundingBadge`.

**Where it is applied without judgement:** burgundy as a *flat fill* for entire hero bands and nag cards rather than as an accent (`Dashboard.jsx`, `UpgradeModal.jsx:76`'s three-stop hardcoded gradient) — the stated rule is "accent-only, never flat fills"; gold as a generic "good/progress" colour; and Playfair applied at so many sizes across hand-rolled headings (22 pages bypass `SectionHeader`) that the type scale no longer signals level — on `Verification` two different heading levels render at visually identical size.

The system is not the problem. The system is good, documented, and mostly unused. The rework's real job is adoption and hierarchy, not a new palette.

---

## Appendix — evidence index

- Screenshots (57): `scratchpad/audit-shots/` — `{home,login,signup,help}-{375,768,1440}`, `{dashboard,search,matches,chat,subscription,settings,profile,notifications,verification}-{375,768,1440}`, `profiledetail-1440{,-b,-c}`, `{dashboard,search,subscription,settings}-dark-1440`, `{search,dashboard}-elder-1440`, `dashboard-dark-elder-1440`, `search-filters-{375,768}`, `privacy-1440`, `login-phase2-password-1440`.
- Session: signed in as `globoniksprod@gmail.com` (free tier). No data was changed, nothing deleted, no payment attempted, admin not touched.
- Tooling: dedicated Chromium via the repo's `@playwright/test@1.61.0`. `node scripts/slop-lint.mjs` run to verify the lint claim.

# Handoff: TricityShadi Web App Redesign

## Overview
A complete visual redesign of the TricityShadi matrimony **web app** (logged-in experience). It refreshes every core and secondary page to feel premium, trustworthy, and family-safe: burgundy used as an **accent** (never heavy flat fills), gold reserved for premium/VIP, Playfair Display headings + Inter body, a refined avatar/empty-photo treatment, one standardized SectionHeader, consistent components, and full **default / loading / empty / error** states. Every screen is designed at **desktop + mobile**, in **light + dark**, with an **elder mode** (larger type, higher contrast).

**Target repo:** `Saksham-20/tricitymatch` → `frontend/` (React 18 SPA + Vite + Tailwind `darkMode:'class'` + react-router v7 + react-helmet-async + framer-motion, i18n en/hi/pa, icons from `react-icons/fi`).

## About the Design Files
The files in this bundle are **design references created in static HTML/CSS** — prototypes that show the intended look, layout, and behavior. **They are not production code to copy directly.** The task is to **recreate each design inside the existing `frontend/` React app**, reusing its established patterns: Tailwind utility classes, the CSS-variable tokens already in `frontend/src/index.css` and `frontend/tailwind.config.js`, existing components under `frontend/src/components/`, routes in `App.jsx`, and the `react-icons/fi` icon set.

**Critical:** the design tokens used in these mockups are the SAME tokens already defined in the repo (see Design Tokens below). Do not introduce new brand colors or a new CSS system — map every value in the mockups back to the existing Tailwind classes (`bg-primary-500`, `text-gold-600`, `shadow-card`, `rounded-2xl`, etc.) and CSS variables. **Keep all flows, routes, data shapes, and component contracts identical** — change only the visual design, hierarchy, spacing, states, and polish. Add no new features.

Each mockup has a **harness bar across the very top** (viewport / theme / elder / state toggles). That bar is a **review tool only — do not implement it.** It exists so you can preview each responsive size, theme, and data state. The actual screen is everything below the harness, inside the `.device` frame.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, shadows, and interaction states are all intentional and map 1:1 to the repo tokens. Recreate the UI faithfully using the codebase's existing Tailwind/CSS-variable system and component library. Where a mockup shows striped placeholder boxes, those are **photo/image slots** — wire them to the real image components (`getImageUrl`, Cloudinary, `ImageLightbox`, `VideoIntroManager`) that already exist in the repo.

---

## Design Tokens
These already live in `frontend/tailwind.config.js` and `frontend/src/index.css`. Use them — do not redefine.

### Colors
- **Primary "Burgundy Rose"** — 50 `#FDF2F5` · 100 `#F8E8EC` · 200 `#F0CDD7` · 300 `#E5A3B8` · 400 `#D66E8E` · **500/DEFAULT `#8B2346`** · 600 `#6B1D3A` · 700 `#55172E` · 800 `#401123` · 900 `#2A0B17`
- **Gold "Royal Gold"** (premium/VIP only) — 50 `#FEFCF3` · 100 `#FDF6E3` · 200 `#F9EABC` · 300 `#F2D88A` · 400 `#E8C34A` · **500 `#C9A227`** · 600 `#B8941F` · 700 `#96781A`
- **Neutrals** — 50 `#FAFAFA` (page bg) · 100 `#F5F5F5` · 200 `#E8E8E8` (borders) · 300 `#D4D4D4` · 400 `#A3A3A3` · 500 `#8B8B8B` (muted text) · 600 `#5A5A5A` · 700 `#404040` · 800 `#2D2D2D` (body) · 900 `#1A1A1A`
- **Surfaces** — card/popover `#FFFFFF`, foreground `#2D2D2D`
- **Status** — success `#2E7D32` (light `#E8F5E9`) · info `#1565C0` (light `#E3F2FD`) · warning `#F57C00` (light `#FFF3E0`) · destructive `#C62828` (light `#FFEBEE`)

### Typography
- Headings/display: **Playfair Display** (400/500/600/700) — page & section titles only
- Body/UI: **Inter** (300–800) — everything else
- Scale (px / line-height): xs 12/1.5 · sm 14/1.5 · base 16/1.6 · lg 18/1.6 · xl 20/1.5 · 2xl 24/1.4 · 3xl 30/1.3 · 4xl 36/1.2 · 5xl 48/1.1 · 6xl 56/1.1
- On 1920-wide marketing nothing applies here; for app UI keep body ≥14px, never below 12px.

### Radius
`--radius` 0.75rem (`rounded-lg`). Also xl .875 · 2xl 1rem · 3xl 1.5rem. Cards use `rounded-2xl`/`rounded-3xl`, buttons/inputs `rounded-lg`/`rounded-xl`.

### Shadows (BURGUNDY-TINTED — never flat black)
- card `0 4px 20px rgba(139,35,70,.08)`
- card-hover `0 8px 30px rgba(139,35,70,.15)`
- burgundy `0 10px 30px rgba(139,35,70,.2)`
- gold `0 10px 30px rgba(201,162,39,.2)`

### Spacing
Strict 4 / 8px rhythm (Tailwind 1/2/3/4/6/8…).

### Dark mode + elder mode
- Dark: driven by `html.dark` (Tailwind `darkMode:'class'`). Surfaces go to ink/`#0f1117`, cards `#1a1f2e`, borders `#303748`, primary lightens to ~`#c75d7e` for contrast. Keep parity with the values in `index.css`.
- Elder mode: base type steps 16→~18.5px (≈+15%), muted text darkens to neutral-700 (light) / lighter slate (dark) for AA+ contrast, hit targets stay ≥44px. Layout & hierarchy unchanged — only scale & contrast shift. (In the repo, implement as an additional class/flag on `<html>` or a context, paralleling the existing theme system.)

> The bundled `ts-system.css` is the mockups' standalone re-implementation of these exact tokens (CSS variables + a few component classes). Use it **only as a value reference** — in the app, prefer the existing Tailwind classes and `index.css` variables.

---

## The reusable system (build these shared pieces first)
Before doing pages, establish/extend these so pages compose cleanly:

- **SectionHeader** — colored tick bar (4px) + Playfair title + optional count chip + subtext. Rule: **gold tick = premium sections, burgundy tick = standard.** Used on every page section. Replace the current inconsistent gold/primary-300/primary-400/neutral tick variations.
- **Avatar / empty-photo fallback** — solid `bg-primary-100` circle (or `rounded-2xl` block), **Playfair initials in `text-primary-700`**, optional verified badge (success dot w/ check), optional compatibility ring. **Replaces** the pastel `from-primary-100 via-gold-50 to-primary-50` gradient + faded initials EVERYWHERE it renders (SuggestionCard, Who-Viewed, Recently-Viewed, ProfileCard, MyProfile, Chat, etc.). Dark mode: `bg-` accent-soft, `text-primary-300`.
- **Buttons** — primary (burgundy gradient 500→600, white), gold (gradient 500→600, dark text — premium/VIP only), secondary (white, burgundy border+text), ghost (transparent, neutral border), link. States: hover lift `-translate-y-0.5` + deeper shadow, processing (spinner), disabled (opacity .5).
- **Compatibility ring + Ashtakoot bars** — ring = burgundy→gold gradient stroke with % in Playfair; guna rows = label + burgundy fill on `bg-neutral-200` track + got/max. Authoritative, not toy-like.
- **One info panel** — single muted `bg-neutral-100` panel with burgundy icon. **Kill** all rainbow blue/green/cyan/yellow-50 info boxes.
- **Data states** — every data view ships: skeleton (shimmer), empty (icon + one line + CTA), error (icon + retry), and where relevant a gold premium-lock (blur + unlock CTA).
- **Plan card, chat bubble, stepper/progress ring, accordion, tabs, badges/tier chips, sticky action bar, toast, modal, bottom sheet** — see `Design System.html` for the canonical version of each.

`Design System.html` is the single source of truth for all of the above (open it and toggle light/dark/elder).

---

## Screens / Views
Each maps to a page under `frontend/src/pages/`. The bundled HTML file name is given per screen. Open each file and use its harness to inspect every responsive size, theme, and state.

### 1. Design System — `Design System.html`
Reference only. Color/type/spacing/radius/shadow scales + every component with states. Build the shared pieces above from here.

### 2. Dashboard — `Dashboard.html` → `pages/Dashboard.jsx`
- **Section order (keep exactly):** greeting hero → 4 stat tiles → subscription status → profile completion (if incomplete) → Mutual Matches → Who Viewed You → Today's Matches → Recently Viewed → Curated for You → empty state. Loading = skeletons.
- **Hero (the #1 fix):** drop the heavy 3-stop dark-burgundy slab. Make it LIGHT — white/neutral-50 surface, thin **burgundy left rail (4px)** + subtle `primary-50→white` wash, Playfair greeting in neutral-900, gold micro-accent pill, faint neutral-200 rings. One primary (burgundy) + one ghost action.
- **Stat tiles:** unify to ONE icon-chip treatment (`bg-primary-50` / `text-primary-500`), Playfair number (3xl), 8px rhythm, `shadow-card`, small trend slot.
- **Avatars:** new fallback everywhere. **Who-Viewed locked:** blur grid + gold unlock CTA (gold bg, neutral-900 text). **Today's Matches:** horizontal snap-scroll cards on mobile, grid on desktop.
- States: default / loading(skeleton) / empty("complete profile") / error. Desktop top navbar; mobile bottom nav (Home/Search/Chat/Profile, ≥44px targets).

### 3. Search — `Search.html` → `pages/Search.jsx`
- Header: Playfair title, verified subtext + count chip, sort `<select>` (Best Match % / Age / Location / Recent), and **profile-ID search** (e.g. `TCS-…`).
- **Filters:** sticky left rail on desktop (age & height ranges, city, religion/marital/diet/manglik as tappable chips, community, income) → **bottom sheet** on mobile via a "Filters · N" button.
- **ProfileCard:** striped photo slot + new avatar fallback, score badge (top-left), verified badge (top-right), name/age/profession over scrim, fact chips, Interest (primary) + Shortlist (ghost). 3-up desktop / 2-up tablet / 1-up mobile.
- States: results + Load more / skeleton grid / empty ("No profiles found" + clear-filters).

### 4. Profile Detail — `Profile Detail.html` → `pages/ProfileDetail.jsx`
- **Photo gallery** header (main + thumbnails; gold-locked extra photo for free users) → identity cluster (Playfair name/age + verified/premium/online badges, location·profession·education·income, quick-fact pills).
- **Sticky action bar:** desktop top-right (Shortlist ghost / Express Interest primary / ⋮ menu); mobile bottom-fixed safe bar (Interest / star / gold unlock / chat / ⋮). Primary = Express Interest (burgundy), Unlock Contact = gold (premium).
- **Compatibility** ring + 4-row breakdown bars. **Horoscope/Ashtakoot** = all 8 kootas as got/max bars, total /36, Non-Manglik + rashi/nakshatra chips, **gold "Download Kundli PDF"** button (premium).
- Calm accordions (one icon set, no rainbow), voice-intro player, Details card. **Locked contact** for free users (blurred number + gold unlock) → unlocked phone/email for premium.
- States: free(locked) / premium(unlocked) / loading skeleton / not-found-or-blocked.

### 5. My Profile — `My Profile.html` → `pages/MyProfileView.jsx` + `pages/ModernProfileEditor.jsx`
- **View:** profile-strength panel (ring + completion chips), photo gallery, identity with **verified badge + copyable profile-ID**, 3 stat badges (Profile% / Photos / Verified), bio, "Get to know me" prompts, interests, right-column Details / Horoscope / Family cards, gold voice-intro nudge. (Note: the current `MyProfileView.jsx` uses off-system `slate-*`/`amber-*` — normalize to neutral + primary + gold.)
- **Edit (`ModernProfileEditor.jsx`):** tabbed editor (Basics / About / Details / Family / Preferences / Photos) with system inputs/selects/textarea, tag editing, photo manager w/ primary slot, sticky save bar + auto-save indicator.
- States: view / edit / loading / empty(set-up-profile).

### 6. Chat — `Chat.html` → `pages/Chat.jsx`
- **Sidebar** conversation list (new avatars, online dots, read-tick previews, unread counts, **family group** thread w/ gold users-icon) — header lightened to a burgundy-tinted wash (not a slab).
- **Thread:** clean header (avatar + Online/typing), matched pill, date separators, sent (burgundy gradient) / received bubbles, **read receipts** (gold double-tick), **edited** label, hover **edit/delete** w/ inline confirm, typing indicator, rounded composer (emoji + send).
- Mobile = list↔thread pane switch. States: conversation / loading / no-matches empty / premium-gate(gold).

### 7. Auth — `Auth.html` → `pages/Login.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx` (+ OTP)
- Split screen: **premium brand panel** (deep burgundy→ink radial, faint orbit rings, gold top-line + accents, logo, stat pills, trust strip) + form side. Collapses to mobile logo + Sign In/Create tab.
- Login (icon inputs, show/hide password, remember + forgot, Google, Create Profile, error alert) · **OTP 6-box** (filled/empty, resend countdown) · Forgot (email → reset link) · Reset (new password + strength meter + confirm).

### 8. Onboarding — `Onboarding.html` → `pages/ModernOnboarding.jsx`
- **The #1 fix:** replace the heavy dark-burgundy left panel with a **light brand/progress rail** — `primary-50→white` wash, **progress ring**, vertical **14-step stepper** (done = burgundy check, current = ringed, upcoming = muted), trust strip. Mobile shows a top progress bar + step count instead.
- 14 steps: Welcome, CreatingFor, BasicInfo, CreateAccount, AboutYourself, Location, Education, MaritalStatus, Religion, Lifestyle, Family, Preferences, Photos, Verification. Redesigned controls: option cards, segmented toggles, photo grid w/ primary slot, verification tiers. Footer nav (Back / Next / Save & exit). (Key steps shown in mockup: Welcome / Basics / Photos / Verification — apply the same system to all 14.)

### 9. Verification — `Verification.html` → `pages/Verification.jsx`
- Trust-score ring header + 4 tiers: Mobile (verified) / Government ID (under-review) / Education (optional) / Income (optional), with required-vs-optional pills and per-tier action buttons. Plus premium **selfie verification** (live-selfie frame) and gold **background check** card. Encryption assurance panel.

### 10. Subscription — `Subscription.html` → `pages/Subscription.jsx`
- Centered header (gold "Membership Plans" pill, Playfair "Choose your plan"). Optional active-member banner. **4-plan ladder:** Free (quiet neutral, "Free Forever" disabled) → Basic Premium ₹1,500/15d (burgundy outline) → **Premium Plus ₹3,000/month** (elevated, scaled, burgundy, "Most Popular", the recommended default) → **VIP ₹7,499/3mo** (gold luxe gradient + glow, "Best Value", "Just ₹2,500/month · billed once").
- "Everything in X, plus" dividers; per-tier check-chip colors (neutral→burgundy→burgundy-solid→gold); big Playfair price, muted duration, micro-copy. Badges sit cleanly above the card edge (no clipping). CTA states: default / processing(spinner) / current("Current Plan", disabled) / free(disabled). Keep exact prices + feature copy (PLAN_FEATURES/PLAN_CONFIG). Razorpay theme stays `#8B2346`. States: skeleton cards / error / active-member banner. 4-up → 2-up → stacked.

### 11. Payments — `Payments.html` → `pages/PaymentSuccess.jsx`, `PaymentFailed.jsx`, `PaymentHistory.jsx`
- **Success:** success-ring (with reduced-motion-safe ripple) + receipt (plan, amount, payment ID, dates) + Go to Dashboard / Download receipt; Razorpay+SSL trust footer.
- **Failed:** destructive icon + reason + Try again / Choose another plan + "money debited?" support line.
- **History:** summary cards (total spent / active plan / renews on) + status-coded transaction rows (paid/failed/pending) + per-row receipt download.

### 12. Astrologers — `Astrologers.html` → `pages/Astrologers.jsx`, `AstrologerDetail.jsx`, `AstrologerBookings.jsx`
- **List:** filter chips + verified astrologer cards (rating / experience / price / online dot). Gold-accented (premium feature).
- **Detail + Book:** hero (avatar, rating/experience/consults/price stats, about, languages, modes) + day selector + time slots + booking summary + gold "Confirm & pay" (video/voice).
- **My Bookings:** upcoming (join / reschedule, confirmed/awaiting) and past (rated / book again / view notes) tabs.

### 13. Settings + Notifications — `Settings.html` → `pages/Settings.jsx`, `Notifications.jsx`
- **Settings:** left section nav (Account / Privacy / Notifications / Preferences / Security) with system toggles & selects; danger zone (pause / delete) with destructive styling; membership row.
- **Notifications:** tabbed feed (All/Interests/Matches/System), grouped by date, status-iconed items (heart/match/msg/shield), unread left-rail accent + dot, inline actions, mark-all-read.

### 14. Guardian + Success Stories + Calls — `Guardian Stories Calls.html` → `pages/Guardian.jsx`, `SuccessStories.jsx`, `CallOverlay` component
- **Guardian:** linked guardians (accepted/invited), invite form (name / relationship / mobile), **granular permission toggles** (view matches / shortlist / send interests / read messages / join family chat), revoke-anytime note.
- **Success Stories:** featured story (duo avatars + Playfair pull-quote + couple/location/timeline) + 3-up story grid + "Share your story" CTA band.
- **Call overlay:** full-bleed burgundy→ink in-call screen (connected status, big avatar, timer, self-preview, control bar with mute/video toggles, end) + an **incoming-call** banner (accept/decline). Implement as the `CallOverlay` component over `react-icons/fi`.

---

## Interactions & Behavior
- **Navigation/flows unchanged** — keep all existing routes (`App.jsx`) and data fetching. Redesign is visual only.
- **Hover:** cards lift `-translate-y-1` + `shadow-card-hover`; buttons lift `-translate-y-0.5` + deeper tinted shadow (~180ms).
- **Animations (already in repo, use tastefully):** `fade-in-up`, `scale-in`, `shimmer` (skeletons), `typing-bounce` (chat), `heart-pulse` (like), `pulse-soft`. Avoid float/glow/confetti/sparkle except true celebration moments (match made, payment success — and gate those on `prefers-reduced-motion`).
- **Loading:** shimmer skeletons matching the final layout (not spinners) for every data view.
- **Empty:** icon + one guidance line + CTA. **Error:** icon + message + retry. **Locked (premium):** blur + gold unlock CTA.
- **Responsive:** design at 375 / 768 / 1440. Mobile-web first-class — sticky action bars, bottom nav, ≥44px targets. Layouts must tolerate longer Hindi/Punjabi strings (i18n en/hi/pa) without breaking — avoid fixed-width text containers, allow wrap.
- **Themes:** light/dark via `html.dark`; elder mode as an additional flag (type scale + contrast). Maintain parity across all three.

## State Management
No new app state beyond what each page already manages. The mockups expose UI states (default/loading/empty/error, free/premium, view/edit, etc.) that correspond to existing data conditions in each page component — wire them to the real flags (`loading`, `profile`, subscription tier, verification status, etc.) already present in the `.jsx` files. The harness toggles in the mockups are NOT app state — ignore them.

## Assets
- **Icons:** `react-icons/fi` (Feather) — already used. The mockups use inline SVGs that mirror Fi glyphs; substitute the matching `Fi*` component. No emoji as icons.
- **Images/photos:** striped boxes in mockups = real photo slots. Use the repo's existing `getImageUrl` / Cloudinary util, `ImageLightbox`, and `VideoIntroManager`. New avatar fallback renders when no photo exists.
- **Fonts:** Playfair Display + Inter — already linked in `frontend/index.html` via Google Fonts.
- No external brand assets introduced; everything uses the repo's existing token system.

## Files (in this bundle — design references)
- `Design System.html` — tokens + all components (source of truth)
- `Index.html` — visual index linking every screen
- `Dashboard.html`, `Search.html`, `Profile Detail.html`, `My Profile.html`, `Chat.html`
- `Auth.html`, `Onboarding.html`, `Verification.html`
- `Subscription.html`, `Payments.html`, `Astrologers.html`
- `Settings.html`, `Guardian Stories Calls.html`
- `ts-system.css` — the mockups' shared token/Component CSS (value reference only; in the app use existing Tailwind classes + `frontend/src/index.css` variables)

Open any HTML file in a browser; use the top harness bar to switch viewport (desktop/mobile), theme (light/dark), elder mode, and data state. Everything below the harness is the actual screen to recreate.

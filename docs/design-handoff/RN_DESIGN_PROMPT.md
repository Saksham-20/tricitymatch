# Claude Design Prompt — TricityShadi React Native Apps

> Paste everything below into Claude Design. It specifies the brand system, every screen, all four data-states, and the micro-interaction spec for a native iOS + Android matrimonial app.

---

## 0. Project & role

You are the lead product designer for **TricityShadi** — a premium, hyperlocal **matrimonial** (arranged-marriage) app for the Tricity region of India (Chandigarh, Mohali, Panchkula). This is **not** a casual dating app: tone is trustworthy, family-oriented, culturally Indian, premium-but-restrained. Users are marriage-seekers and their families (guardians).

Design the **complete React Native mobile app** for both **iOS and Android**, native idioms first — every screen, every state, and the micro-interactions that connect them. Output high-fidelity mockups (1 per screen + per key state), a component library, a motion spec, and per-screen redline notes a React Native engineer can build from directly. Target stack: **Expo SDK51, RN 0.74, react-navigation v6, Reanimated, Zustand + React Query**. Keep everything buildable with those tools (no web-only effects).

There is an **existing web design system** (this same brand) — mobile must feel like the same product, translated to native idioms (bottom tabs, native sheets, swipe/long-press, haptics, platform back behavior), **not** a web port.

---

## 1. Brand & design tokens (locked — do not change)

**Colors**
- Burgundy `#8B2346` — primary accent. **Accent only**: borders, ticks, active states, key CTAs. **Never** flat-fill large areas with it.
- Gold `#C9A227` — premium / VIP signals **only** (locks, VIP badges, "Most Popular", boost). Never decorative.
- Neutrals (web parity): bg `#FAFAFA`, surface/card `#FFFFFF`, border `#E8E8E8`, text primary `#2D2D2D`.
- Semantic tints, muted not loud: success / warning / error / info backgrounds. One muted info panel style — **no rainbow of colored info boxes**.

**Type**
- Headings: **Playfair Display** (serif, the premium voice).
- Body / UI: **Inter**.
- Provide a full type scale (display → caption) with native point sizes + line heights.

**Logo:** serif "TS" wordmark (already exists). Use it on Splash / Welcome / auth.

**Themes (all screens must support):**
- Light + **Dark** (class-equivalent; dark navy call screens).
- **Elder mode** — base font 16→18.5px, muted text darkens to AA+, hit targets ≥44px, layout unchanged. This is a real toggle in Settings; design the elder variant for primary screens.

**Anti-slop rules (hard):** no emoji-as-icons (use a consistent line icon set, e.g. Ionicons), no pastel gradient cards, no childish multi-color callouts, no `✓`/`✦`-as-text. Restrained, premium, trust-first.

---

## 2. Every-screen requirements

**Each data view ships 4 states** — design all four:
1. **Default** (populated, realistic Indian matrimonial data — real-sounding names, ages, cities Chandigarh/Mohali/Panchkula, professions, communities).
2. **Loading** — **shimmer skeleton matching the real layout**, not a spinner.
3. **Empty** — icon + one line + a clear CTA.
4. **Error** — icon + message + retry.

**Premium-gated views** add a 5th: **gold lock state** (content blurred + gold lock + unlock CTA → Subscription).

Plans (for gating + subscription UI): free ₹0 · basic_premium ₹1500/15d · premium_plus ₹3000/30d · **vip ₹7499/90d** (unlimited + boost). Chat, contact-unlock, advanced filters, profile visitors are premium-gated.

---

## 3. Navigation architecture

- **RootNavigator** → Auth stack | Onboarding stack | Main.
- **Main = bottom tabs:** Home · Search · Matches · Chat · Profile. (Elder mode **hides the Chat tab** — account for this layout.)
- Role-gated stacks (design entry points, lower priority): **Admin** (admin/super_admin), **Bureau** (matchmaker), **Guardian** (family read-only).
- **IncomingCallModal** lives above the stack (full-screen, can appear over anything).

---

## 4. Screens to design (member app — primary scope)

### Auth
- Splash (logo) · Welcome (value prop + Login/Signup) · **Login** (email/pw + **biometric**, error + 429 lockout state — no countdown shown) · **Signup** (live password-strength bar) · Forgot Password · Reset Password · **OTP** (6-box auto-advance input).

### Onboarding — 14 steps (single flow, progress indicator, resumable)
Welcome → CreatingFor (self/son/daughter/relative) → BasicInfo → CreateAccount → AboutYourself → Location → Education → MaritalStatus → Religion → Lifestyle → Family → Preferences → Photos (upload up to 6) → Verification.
Design: the shared **OnboardingLayout** (progress bar + back/next + step count), plus each step's body. Show the resume state.

### Home
Match feed, **profile-completeness strip**, quick actions, "Today's Matches" / new profiles rail. Cards = photo with scrim, name, age, city, compatibility %, verified badge.

### Search
- Search list (infinite scroll, sort, saved-searches entry).
- **FilterPanel** = native bottom sheet: range sliders (age/height/income), community/gotra exclude, manglik, religion, location radius, save-search.
- **ProfileCard** (the reusable result card) + CompatibilityMeter + verification badges.

### Profile (self + others)
- **OwnProfile**: photo gallery, **completion ring** (10-tick rim, not starburst), badges, "preview as others see me", milestone, quiz CTA, **Profile Visitors** + **Recently Viewed** horizontal rails.
- **ProfileDetail** (other user): sticky action bar (like/shortlist/message), accordions (about/family/education/lifestyle/preferences), **compatibility → breakdown sheet**, **horoscope → Ashtakoot** guna view, **voice-intro playback**, video-intro, ⋮ → Block/Report sheet, contact-unlock (premium).
- **EditProfile** · **Privacy Controls** (visibility everyone/matches-only, online-status, last-seen toggles) · **SelfieVerification** · **BackgroundCheck** · **Verification** (4 tiers — Mobile/ID backed; Education/Income show "Coming soon").

### Matches
4 tabs: **Mutual · Shortlisted · Liked Me · My Interests**. Offline banner state (cached shortlist).

### Chat (premium)
- Conversations list (Plus+ gate state for free users).
- **ChatThread**: inverted list, read receipts, typing indicator, optimistic send, edit/delete message, long-press actions.
- **FamilyGroups** list + **FamilyGroupChat** (group messaging between families).

### Calls (Agora — design the UI; native navy theme)
- **Voice call** · **Video call** (draggable PiP self-view) · **IncomingCall** (full-screen, 30s timeout, accept/decline). Connecting / ringing / active / ended states.

### Subscription & marketplace
- **Subscription**: plan cards (free/basic/plus/**vip**), "Most Popular" / "Best Value" floating gold badges, per-plan feature matrix, Razorpay checkout flow, billing history.
- **AstrologerMarketplace** + **AstrologerDetail** (book consultation flow).

### Notifications & Settings
- **Notifications**: infinite list, mark-read, deep-link rows.
- **Settings**: incognito, **elder mode**, language (en/hi/pa), **dark mode**, delete account, guardian/family/astrologer entries, Success Stories browse + submit.

### Guardian / Family (read-only role)
GuardianSetup · GuardianView (read-only candidate view) · GuardianCandidates.

### Horoscope
HoroscopeMatch (guna bars, dosha, manglik) · CompatibilityBreakdownSheet · Quiz (10 questions).

### Role stacks (design key screens, secondary priority)
- **Admin**: AdminHome, VerificationQueue, ReportsQueue.
- **Bureau** (matchmaker): BureauHome, ClientRoster, MatchProposal (3-step), Earnings, Support, SuccessStory.

---

## 5. i18n

Support **English / Hindi / Punjabi**. Design with text-expansion headroom (Hindi/Punjabi run longer); show at least the primary screens in a non-English render so layouts are proven to flex.

---

## 6. Micro-interactions & motion spec (deliver as its own section)

Specify trigger → animation → duration/easing → haptic for each. Keep all RN-buildable (Reanimated / Layout animations / Gesture Handler). Cover at minimum:

- **Like / shortlist tap** — icon fill + scale-pop + success haptic; mutual-match celebration moment (tasteful, premium — no confetti spam).
- **Card press** — scale-down 0.97 on press-in, spring back; navigate with shared-element-style continuity to ProfileDetail.
- **Swipe / long-press** on cards and chat messages → action reveal.
- **Pull-to-refresh** on feeds (branded indicator).
- **Skeleton shimmer** timing/direction.
- **Bottom-sheet** open/close (spring, backdrop fade, snap points) for filters, compatibility breakdown, block/report.
- **Tab switches** + screen transitions (iOS push vs Android pattern).
- **Completion ring** fill animation + milestone reach.
- **Compatibility meter / guna bars** fill-in on view.
- **Typing indicator**, message send (optimistic slide-in), receipt tick transitions.
- **OTP box** focus advance, password-strength bar fill, form-field error shake.
- **Incoming-call** full-screen entrance + accept/decline.
- **Toasts / inline errors**, button press + loading spinner-in-button states.
- **Premium lock** reveal (blur + gold lock fade-in) + unlock CTA.

Define a small **motion token set** (durations: e.g. fast/base/slow; easing curves; spring configs; standard haptic map) and reference it per interaction.

---

## 7. Deliverables

1. **Design system page** — colors, type scale, spacing, icons, elevation/shadows (burgundy-tinted), all reusable components (Button [primary + gold variants], Avatar with initials fallback, SectionHeader, ProfileCard, CompatibilityMeter, VerificationBadges, BottomSheet, Skeletons, Toast, Lock state).
2. **All screens** above, each in light + dark, primary screens also in **elder mode**, and each data view in its **4 (or 5) states**.
3. **Motion spec** (Section 6) as a standalone doc.
4. **Per-screen redline notes** — spacing, sizes, token names, behavior — buildable by an RN engineer.

**Constraints recap:** native idioms (not web port) · brand tokens locked · anti-slop rules enforced · every view 4 states · premium gold-lock where gated · light/dark/elder · en/hi/pa · iOS + Android.

# Handoff: TricityShadi — Native Mobile App (iOS + Android)

## Overview
This is the complete member-facing **React Native** design for **TricityShadi**, a premium, hyperlocal matrimonial app for the Tricity region (Chandigarh, Mohali, Panchkula). It is the native translation of the existing TricityShadi **web** design system — same brand, same tokens, rebuilt around native idioms (bottom tabs, sheets, gestures, haptics, platform back). Tone is trustworthy, family-first, premium-but-restrained — **not** a casual dating app.

The package covers: a mobile design-system reference, the five bottom-tab destinations, auth, the 14-step onboarding wizard, subscription/monetization, the astrologer marketplace, Agora call UI, and the horoscope/Ashtakoot surfaces — each data view in its 4–5 states, in light, dark and (on primary screens) elder mode.

## About the Design Files
The files in this bundle are **design references created in HTML/CSS/JS** — high-fidelity prototypes showing intended look, layout and behavior. **They are not production code to copy directly.** Each screen is rendered inside an HTML "iOS frame" on a pannable design canvas purely so reviewers can compare states side by side; that frame chrome is **not** part of the app.

The task is to **recreate these designs in a React Native codebase** using its established patterns and libraries. Target stack (from the brief):

- **Expo SDK 51 · React Native 0.74**
- **react-navigation v6** (native-stack + bottom-tabs)
- **Reanimated** (+ `react-native-gesture-handler`) for all motion/gestures
- **Zustand** (client state) **+ React Query** (server state / data fetching)
- **expo-haptics**, **expo-local-authentication** (biometric), **Agora** (calls), **Razorpay** (payments)
- Icons: **Ionicons** (`@expo/vector-icons`) — the HTML uses inline SVGs that map 1:1 to Ionicons line glyphs.
- Fonts: **Playfair Display** (headings) + **Inter** (UI/body) via `expo-font`.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, shadows and interaction intent are final and should be matched precisely. Reproduce the layouts pixel-faithfully with RN primitives; the HTML class names and CSS variables map directly to a theme object (see Design Tokens).

---

## Target architecture

**RootNavigator** → `Auth` stack | `Onboarding` stack | `Main`.

**Main = bottom tab navigator (5 tabs):** Home · Search · Matches · Chat · Profile.
- Active tint = **burgundy**. Chat tab shows an unread count badge.
- **Elder mode hides the Chat tab** → the bar reflows to 4 tabs. Account for this in the tab layout (conditional `Tab.Screen`).

**Above the stack:** `IncomingCallModal` — a full-screen modal that can appear over anything (Agora).

**Role-gated stacks (entry points only, secondary priority):** Admin (admin/super_admin), Bureau (matchmaker), Guardian (family read-only).

Pushed (non-tab) screens: ProfileDetail, ChatThread, EditProfile, Subscription, Checkout, AstrologerDetail, Booking, HoroscopeMatch, Quiz, all Auth/Onboarding steps, all call screens.

---

## Design Tokens

All tokens live in `ts-mobile.css` as CSS custom properties. Port them to a single theme object (e.g. `theme.light` / `theme.dark`) consumed via context.

### Brand palette (LOCKED — do not alter)
**Burgundy (primary accent — borders, ticks, active states, primary CTA. NEVER flat-fill large areas):**
`p-50 #FDF2F5 · p-100 #F8E8EC · p-200 #F0CDD7 · p-300 #E5A3B8 · p-400 #D66E8E · p-500 #8B2346 · p-600 #6B1D3A · p-700 #55172E · p-800 #401123 · p-900 #2A0B17`

**Gold (premium signal ONLY — VIP, locks, "Most Popular"/"Best Value", boost. Never decorative):**
`g-100 #FDF6E3 · g-200 #F9EABC · g-300 #F2D88A · g-400 #E8C34A · g-500 #C9A227 · g-600 #B8941F · g-700 #96781A`

**Neutrals:** `n-50 #FAFAFA · n-100 #F5F5F5 · n-200 #E8E8E8 · n-300 #D4D4D4 · n-400 #A3A3A3 · n-500 #8B8B8B · n-600 #5A5A5A · n-700 #404040 · n-800 #2D2D2D · n-900 #1A1A1A`

**Semantic (muted, not loud — one info style, no rainbow of colored boxes):**
`success #2E7D32 / bg #E8F5E9 · info #1565C0 / bg #E3F2FD · warning #F57C00 / bg #FFF3E0 · destructive #C62828 / bg #FFEBEE`

### Semantic mapping — LIGHT
bg `#FAFAFA` · card `#FFFFFF` · surface-2 `#F5F5F5` · fg `#2D2D2D` · fg-strong `#1A1A1A` · muted `#8B8B8B` · border `#E8E8E8` · accent `#8B2346` · accent-soft `#FDF2F5` · hairline `rgba(0,0,0,.08)`

### Semantic mapping — DARK (navy)
bg `#0F1117` · card `#1A1F2E` · surface-2 `#252B3B` · fg `#E2E8F0` · fg-strong `#F1F5F9` · muted `#94A3B8` · border `#303748` · accent `#C75D7E` · accent-soft `#2A1020`

### Elder mode
Base body bumps **16 → 18.5px**; `muted` darkens to `n-700` (light) / `#C5CFDB` (dark) for AA+; hit targets ≥ 44pt; **layout unchanged**. Real toggle in Settings. Hides the Chat tab.

### Type scale (RN points — line-heights are fixed, RN has no unitless lh)
| Token | Font / weight | Size / LH |
|---|---|---|
| display | Playfair 700 | 34 / 40 |
| title1 | Playfair 600 | 28 / 34 |
| title2 | Playfair 600 | 22 / 28 |
| title3 | Inter 600 | 20 / 25 |
| headline | Inter 600 | 17 / 22 |
| body | Inter 400 | 17 / 23 |
| callout | Inter 400 | 16 / 21 |
| subhead | Inter 500 | 15 / 20 |
| footnote | Inter 400 | 13 / 18 |
| caption | Inter 600 | 12 / 16 |
| micro | Inter 600 | 11 / 13 |

### Radii & spacing
radius: sm 10 · md 14 · lg 20 · xl 28 · pill 999. Tap target min 44. Screen gutters 18. Card padding 13–18.

### Elevation (burgundy-tinted shadows)
`e1 0 1px 2px rgba(139,35,70,.06)` · `e2 0 2px 8px rgba(139,35,70,.08)` · `e3 0 6px 20px rgba(139,35,70,.10)` · `e4 0 16px 40px rgba(139,35,70,.16)` · gold `0 8px 24px rgba(201,162,39,.22)`. In dark mode use black-based shadows.

---

## Motion & Haptic tokens (Reanimated-buildable)
Durations: **fast 120ms · base 240ms · slow 360ms**. Easing: std `cubic-bezier(.2,0,0,1)` · out `cubic-bezier(0,0,.2,1)`. Springs: `pop` (stiffness 380, damping 18), `sheet` (stiffness 240, damping 28).

Haptic map (`expo-haptics`):
- **light** `selectionAsync()` — tab switch, chip/segmented toggle, slider step, send
- **success** `notificationAsync(Success)` — interest sent, mutual match, payment success
- **warning** `notificationAsync(Warning)` — form error shake, 429 lockout
- **medium** `impactAsync(Medium)` — long-press reveal, incoming call

Per-interaction spec (full list also printed on each canvas as redline cards):
- **Like / shortlist tap** → icon fill + scale-pop (`spring.pop`) + `haptic.success`. Mutual match → tasteful full-screen seal celebration (no confetti spam).
- **Card press** → scale 0.97 press-in, spring back; navigate with shared-element-style continuity to ProfileDetail.
- **Swipe / long-press** on cards & chat bubbles → action reveal (Gesture Handler) + `haptic.medium`.
- **Pull-to-refresh** → branded burgundy indicator + `haptic.light` at trigger.
- **Skeleton shimmer** → 1.5s linear left→right; cross-fade to data over `dur.slow`.
- **Bottom sheet** → `spring.sheet`, backdrop scrim fade `dur.base`, grabber drag-to-dismiss, half/full snap points.
- **Completion ring / compat ring / guna bars** → fill 0→value on view, `dur.slow` ease-out; koota bars stagger 40ms.
- **Typing indicator** → 3-dot bounce 1.2s. **Message send** → optimistic bubble at 50% opacity, slides in, solidifies on ack. **Receipt** single→double tick fade `dur.fast`.
- **OTP** → auto-advance on entry, focus = burgundy ring, paste auto-fills. **Password strength** → 4-seg bar fills live red→amber→gold→green. **Field error** → shake (translateX ±6, 3×) + `haptic.warning`.
- **Incoming call** → slides up full-screen, pulsing avatar rings, ringtone loop + `haptic.medium`; 30s auto-decline (no countdown shown).
- **Premium lock reveal** → content `blur(9)` + gold lock fade-in `dur.base`; CTA → Subscription.

---

## Premium gating model
Plans: **free ₹0 · basic_premium ₹1,500/15d · premium_plus ₹3,000/30d · vip ₹7,499/90d** (unlimited + monthly boost).
Gated behind Premium+: **chat, contact-unlock, advanced filters, profile visitors, "who liked you"**. Gated views render a **gold lock state** (blurred content + gold lock + unlock CTA → Subscription). Gold is used **only** on these premium signals.

---

## Every data view ships its states
1. **Default** (populated, realistic Tricity matrimonial data)
2. **Loading** — shimmer **skeleton matching the real layout** (never a spinner)
3. **Empty** — icon + one line + clear CTA
4. **Error** — icon + message + retry
5. *(premium-gated views)* **Gold lock** — blur + gold lock + unlock CTA

---

## Screens / Views
Each bullet = one canvas file; frames listed are the states/variants designed. Open the file to read exact layout; redline cards on each canvas give per-screen sizes, token names and motion.

### Foundations — `Mobile Design System.html`
Color ramps + usage rules, full type scale (with elder preview), native idioms (status bar, Dynamic Island, blurred nav, large title, bottom tabs, home indicator), the component library (buttons incl. gold variant, avatar+verify, badges, chips, ProfileCard, compat ring, guna bars, completion ring, segmented/tabs, OTP, password strength, switch, skeleton, toast, empty/error, gold lock), iconography, and the motion/haptic table.

### Home — `mobile/Home.html`  (tab root)
Match feed. Frames: Default · Loading · Empty · Error · Dark · **Elder (4 tabs)**. Components: greeting header (avatar 42, bell w/ burgundy dot), profile-completeness strip (completion ring 58 + CTA), quick-action chips, **Today's Matches** horizontal rail of ProfileCards (166×226, scroll-snap, compat %, verified badge), "New near you" list rows, pull-to-refresh.

### Search — `mobile/Search.html`  (tab root)
Frames: Results · **FilterPanel bottom sheet** · Loading · Empty · Dark. Result card = photo 92×118 + Playfair name + tag chips + 2 actions. Infinite scroll (prefetch ~80%). Filter sheet: age/height/income **range sliders**, community/gotra exclude (switch default ON), manglik segmented (Any/Yes/No), location radius chips, save-search. Saved-search chip row.

### Profile Detail — `mobile/Profile Detail.html`  (pushed)
Frames: Default · **Premium gold lock** (contact) · **Compatibility breakdown sheet** · **Block/Report sheet** · Loading · Dark. Hero 430pt gallery (dots, status flips white), sticky action bar (like 52 / shortlist 52 / message primary, 24pt safe area), stat bar (height/edu/community/manglik), compat card (ring fills to 87% → breakdown sheet of 5 dimensions), **voice-intro** waveform playback, accordions (About/Family/Education/Lifestyle/Preferences), **horoscope mini → Ashtakoot**, contact card blurred behind gold lock, ⋮ → mute/block/report.

### Matches — `mobile/Matches.html`  (tab root)
4 segmented tabs: **Mutual · Shortlisted · Liked Me · My Interests**. Frames: Mutual · **Liked Me gold-lock grid** · Empty (shortlisted) · **Offline/cached banner** · Dark. Match row (photo 58, "Matched Nd ago", message FAB 42). Mutual first-reveal → seal celebration (`spring.pop` + `haptic.success`). Liked Me = blurred 2-col grid + count headline + Premium CTA.

### Chat — `mobile/Chat.html`  (tab root + pushed thread)
Frames: Conversations list · **Thread** · **Free-user gold lock** · Empty · Dark thread. List row (avatar 54 + online dot, unread burgundy badge + bold preview). Thread = inverted FlatList, incoming surface-2 / outgoing burgundy bubbles, date divider, read receipts (single→double tick), typing 3-dot, optimistic send, long-press → reply/edit/delete sheet, "edited" prefix. Family-group thread variant. Input bar: + attach, grows to 5 lines, mic when empty / send when typed. Whole list blurred + gold lock for free users.

### Auth — `mobile/Auth.html`
Frames: Splash · Welcome · Login · **Login error** · **Login 429 lockout (no countdown)** · Signup · OTP · Forgot/Reset · Dark login. Splash = burgundy gradient + glass logo + 3-dot loader. Login: email/pw 50pt + "Forgot?" + **Face ID biometric** below divider. Error → field err border + shake + `haptic.warning`. 429 → warning panel + disabled button, **no timer**. Signup: live 4-seg password-strength bar. OTP: 6 boxes 46×56 auto-advance, focus burgundy ring.

### Onboarding — `mobile/Onboarding.html`  (14-step resumable wizard)
Shared **OnboardingLayout** = 6pt progress bar (fills step/14) + back (hidden step 1) + step count + sticky footer CTA. Steps designed: 1 Welcome · 2 CreatingFor (radio cards self/son/daughter/relative) · 3 BasicInfo · 5 AboutYourself · 6 Location (Tricity chips) · 10 Lifestyle (diet/drink/smoke chips) · 13 **Photos** (3×2 grid, max 6, primary badge, drag-reorder) · 14 **Verification** (4 tiers: Mobile verified, ID "Verify now", Education/Income "Coming soon"). Plus **Resume** state (re-entry → completion ring + "Step 7 · Education" deep-link + Start over). Each step persists to store on Next → resumable from any exit. Full step order in §4 of the brief: Welcome→CreatingFor→BasicInfo→CreateAccount→AboutYourself→Location→Education→MaritalStatus→Religion→Lifestyle→Family→Preferences→Photos→Verification.

### Subscription — `mobile/Subscription.html`
Frames: Plans · Feature matrix · **Razorpay checkout** · **Payment success** · **Payment failed** · Active member + billing · Dark plans. Plan cards: Free (current) / Basic / Plus (**Most Popular**, gold) / VIP (**Best Value**, gold + BOOST). Gold border + `sh-gold` on Plus/VIP only; gold flags float -11pt. Checkout: order summary + GST + coupon + Razorpay sheet. Success: seal scale-in + `haptic.success` + receipt. Failed: "no money deducted" reassurance + retry. Active: burgundy member card + days-left bar + boost CTA (VIP) + billing history rows.

### Astrologers — `mobile/Astrologers.html`
Frames: Marketplace · Detail + reviews · **Book consultation flow** · My bookings · Loading · Dark. Card: avatar 62, rating star (gold acceptable here as a quality signal), ₹/min in accent, online dot, Consult. Detail: 4-up stat bar, reviews, sticky book bar (live price). Booking: type selector chat/voice/video, date chips, time-slot grid (disabled=dashed), est. cost summary, Razorpay → My bookings (upcoming/past tabs).

### Calls & Horoscope — `mobile/Calls Horoscope.html`
**Calls (Agora, navy theme #141a2e→#0a0d18, status white):** Incoming (pulsing avatar rings, accept green / decline red 66pt, 30s auto-decline, swipe-up to message) · Voice active (mute/video/speaker + end, timer) · Video (full-bleed remote, **draggable PiP self-view 104×150**, auto-hide controls) · Ended (callback/message). Lives in `IncomingCallModal` above the stack.
**Horoscope:** HoroscopeMatch (28/36 guna ring + 8 **Ashtakoot koota** bars, Nadi 0-score = warning, **manglik** muted-warn panel, → astrologer CTA) · Compatibility quiz (progress N/10, single-select cards). Dark variant included.

---

## i18n
Support **English / Hindi / Punjabi**. Design with text-expansion headroom (Hindi/Punjabi run ~20–30% longer) — avoid fixed-width text containers, allow 2-line wrapping on labels/buttons, never truncate primary actions. This pass renders in English; prove the flex on Home, Search and ProfileDetail in a follow-up.

## Themes & accessibility
Every screen supports **light + dark**; primary screens also support **elder mode** (Settings toggle: base 16→18.5, muted darkens to AA+, Chat tab hidden, ≥44pt targets, layout unchanged). Honor `prefers-reduced-motion` equivalent (RN `AccessibilityInfo.isReduceMotionEnabled`) — skip entrance animations, show end-state.

## Assets
No raster assets ship in this bundle. Striped placeholders labelled (e.g. "profile photo") mark where user-uploaded images go — wire to the real photo/gallery URLs. Icons → Ionicons. Fonts → Playfair Display + Inter (Google Fonts / `expo-font`). Logo → serif "TS" wordmark (burgundy tile).

## Files
- `ts-mobile.css` — the full token + component system (port to a theme object). **Start here.**
- `Mobile Design System.html` — visual reference for tokens, type, components, motion.
- `Mobile Index.html` — hub linking every canvas.
- `mobile/frame.js` — canvas helper (icon sprite + iOS frame chrome). **Reference only — not app code.**
- `mobile/Home.html`, `mobile/Search.html`, `mobile/Profile Detail.html`, `mobile/Matches.html`, `mobile/Chat.html`
- `mobile/Auth.html`, `mobile/Onboarding.html`
- `mobile/Subscription.html`, `mobile/Astrologers.html`
- `mobile/Calls Horoscope.html`

> The HTML "iOS frame", status bar, Dynamic Island and home indicator are **prototype chrome** — the OS provides these natively. Build only the screen content inside each frame.

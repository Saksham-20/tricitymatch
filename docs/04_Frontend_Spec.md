# TricityShadi Mobile App — Frontend Specification
**Version:** 1.0 | **Date:** June 2026 | **Framework:** React Native (Expo Bare, SDK 51+)

---

## 1. Design Principles

1. **Mobile-first, India-first.** Assume variable network (2G–4G), older Android devices (budget segment), and users switching between English and Hindi mid-session.
2. **Trust over aesthetics.** Verification badges, authenticity scores, and safety controls must be visually prominent — users make life decisions here.
3. **Family-appropriate.** This is a family context app. No swipe-left-for-rejection animations that feel like a dating app. Respectful, clean, warm design.
4. **Speed.** Perceived performance matters more than actual performance. Skeleton loaders on every list. Optimistic UI on match actions.
5. **Elder-compatible.** Design all screens to be readable at 1.5x font scale before activating Elder Mode. Elder Mode is an enhancement, not an accessibility patch.

---

## 2. Design Tokens

### 2.1 Colour Palette

```javascript
// constants/theme.ts
export const colours = {
  // Primary — Rose/maroon (from existing web theme-color: #E11D48)
  primary:       '#E11D48',  // rose-600
  primaryDark:   '#BE123C',  // rose-700
  primaryLight:  '#FFF1F2',  // rose-50

  // Secondary — Gold/amber (wedding context)
  secondary:     '#D97706',  // amber-600
  secondaryLight:'#FFFBEB',  // amber-50

  // Neutrals
  background:    '#FFFFFF',
  surfaceCard:   '#F9FAFB',  // gray-50
  border:        '#E5E7EB',  // gray-200
  textPrimary:   '#111827',  // gray-900
  textSecondary: '#6B7280',  // gray-500
  textMuted:     '#9CA3AF',  // gray-400

  // Status
  success:       '#10B981',  // emerald-500
  warning:       '#F59E0B',  // amber-500
  error:         '#EF4444',  // red-500
  info:          '#3B82F6',  // blue-500

  // Verification badge colours
  badgeMobile:   '#10B981',  // green
  badgeID:       '#3B82F6',  // blue
  badgeEducation:'#8B5CF6',  // purple
  badgeIncome:   '#F59E0B',  // amber

  // Plan tier colours
  planFree:      '#6B7280',
  planPlus:      '#3B82F6',
  planPremium:   '#8B5CF6',
  planElite:     '#D97706',
};
```

### 2.2 Typography

```javascript
export const typography = {
  // Font family
  fontFamily: {
    regular: 'Inter-Regular',
    medium:  'Inter-Medium',
    semiBold:'Inter-SemiBold',
    bold:    'Inter-Bold',
  },
  
  // Base sizes (Elder Mode adds +4 to all)
  fontSize: {
    xs:   12,
    sm:   14,
    base: 16,
    lg:   18,
    xl:   20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  
  lineHeight: {
    tight:   1.25,
    normal:  1.5,
    relaxed: 1.75,
  },
};
```

### 2.3 Spacing & Layout

```javascript
export const spacing = {
  xs:  4,   sm:  8,   md: 12,
  lg: 16,   xl: 20,   '2xl': 24,
  '3xl': 32,'4xl': 40, '5xl': 48,
};

export const borderRadius = {
  sm: 6, md: 12, lg: 16, xl: 24, full: 9999,
};

// Minimum tap targets
export const tapTarget = {
  default: 48,  // dp
  elder:   60,  // dp (Elder Mode)
};
```

---

## 3. Component Library

### 3.1 Base UI Components (`src/components/ui/`)

Each component must support `testID` prop for testing.

**Button**
```typescript
type ButtonProps = {
  variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: ReactNode;
  fullWidth?: boolean;
  testID?: string;
};
// Minimum height: 48dp. Loading state shows ActivityIndicator replacing label.
// Primary: rose-600 bg, white text
// Secondary: amber-600 bg, white text
// Outline: transparent bg, rose-600 border + text
// Ghost: transparent bg, rose-600 text
// Danger: red-500 bg, white text
```

**Input**
```typescript
type InputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;        // Shows below input in red
  hint?: string;         // Shows below input in gray
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  disabled?: boolean;
};
// Error state: red border, red error text below
// Focus state: rose-600 border (2dp)
// Default: gray-200 border (1dp)
```

**Avatar**
```typescript
type AvatarProps = {
  uri?: string;
  name?: string;       // Fallback initials if no image
  size: 'sm' | 'md' | 'lg' | 'xl';  // 32/48/64/96 dp
  blurred?: boolean;   // For non-mutual viewers
  watermarked?: boolean;
  verified?: boolean;  // Shows green tick overlay
  onlineStatus?: 'online' | 'recently' | 'offline';
};
```

**Badge**
```typescript
type BadgeProps = {
  type: 'mobile' | 'id' | 'education' | 'income' | 'plan' | 'status';
  label: string;
  size?: 'sm' | 'md';
};
// Verification badges: small pill with icon + label
// Plan badge: "PREMIUM" in purple, "ELITE" in amber
```

**BottomSheet**
```typescript
// Wraps @gorhom/bottom-sheet
// Used for: FilterPanel, UpgradeModal, ReportModal, ActionMenus
// Snap points: ['50%', '90%'] for filter panel
// Backdrop: semi-transparent overlay, tap to dismiss
```

**SkeletonLoader**
```typescript
// Used on every list/card while loading
// Animated shimmer effect (left-to-right)
// Match the shape of the actual content (card skeleton, list item skeleton)
```

**EmptyState**
```typescript
type EmptyStateProps = {
  illustration: 'no-matches' | 'no-messages' | 'no-notifications' | 'search-empty';
  title: string;
  subtitle: string;
  action?: { label: string; onPress: () => void };
};
```

---

### 3.2 Profile Card (`src/components/cards/ProfileCard.tsx`)

Used in search results, daily matches, and match lists.

```typescript
type ProfileCardProps = {
  profile: ProfileSummary;
  onLike: () => void;
  onShortlist: () => void;
  onPass: () => void;
  onPress: () => void;     // Open full profile
  showCompatibility?: boolean;
  compact?: boolean;       // List view vs card view
};

// Card layout:
// ┌─────────────────────────────────┐
// │  [Photo - blur if not matched]  │
// │  [Verified badges row]          │
// │  Name, Age · City               │
// │  Profession · Education         │
// │  Compatibility: ████░ 78%       │
// │  [Like] [Shortlist] [Pass]      │
// └─────────────────────────────────┘
```

**Swipe gesture support (on card-stack view):**
- Swipe right: Like (green overlay + heart icon)
- Swipe left: Pass (gray overlay + X icon)
- Swipe up: Shortlist (amber overlay + bookmark icon)
- Threshold: 120dp swipe distance to trigger action
- Implemented with react-native-gesture-handler + reanimated

---

### 3.3 Compatibility Meter (`src/components/profile/CompatibilityMeter.tsx`)

```typescript
// Animated horizontal bar, rose-to-green gradient
// Score: 0–100
// Below bar: "Based on community, lifestyle & preferences"
// Tapping shows breakdown (v2 — "Why this match" explainer)
```

---

### 3.4 Verification Badges (`src/components/profile/VerificationBadges.tsx`)

```typescript
// Row of pill badges showing earned verification tiers only
// Mobile ✓ (green) | ID ✓ (blue) | Education ✓ (purple) | Income ✓ (amber)
// Tapping any badge shows tooltip: "Verified by TricityShadi team"
```

---

## 4. Screen Specifications

### 4.1 Auth Screens

**SplashScreen**
- TricityShadi logo centred, rose-600 background
- Auto-navigates after 2 seconds: checks for stored refresh token
  - If found: attempt silent refresh → Main app
  - If not: → Welcome screen

**WelcomeScreen**
- Hero illustration (wedding/couple graphic, culturally appropriate)
- App value props: 3 swipeable cards ("Verified Profiles" / "Private & Safe" / "Find Your Match")
- CTA: "Get Started" (→ Signup) + "Already a member? Sign In" (→ Login)
- Language selector at top-right

**LoginScreen**
- Email + Password inputs
- "Sign In" primary button
- "Forgot password?" link → ForgotPasswordScreen
- Divider "or"
- Google Sign-In button (if EXPO_PUBLIC_GOOGLE_CLIENT_ID is set)
- Biometric prompt (if biometric_enabled in MMKV) — shows on mount
- "New here? Create account" → SignupScreen
- Error: "Your account has been locked. Try again in X minutes." (on 429)

**SignupScreen**
- Email + Password + Confirm Password
- Password strength indicator
- T&C checkbox (link to webview)
- "Create Account" → triggers account creation → navigates to OnboardingNavigator Step 0
- Google Sign-In shortcut

**ForgotPasswordScreen / ResetPasswordScreen**
- Standard email input + "Send reset link"
- On success: confirmation message, auto-navigate back to Login

---

### 4.2 Onboarding Navigator (Steps 0–14)

Each step:
- Progress bar at top (shows current step / 14)
- Back arrow (navigate to previous step)
- "Save & Continue" primary button at bottom
- "Skip for now" ghost text button (for optional steps 8–11)
- Step title + subtitle explain why this info helps matching

**Step 0 — Who are you registering for?**
- 6 large radio tile buttons: Self / Son / Daughter / Sibling / Relative / Friend
- Selection sets `registeringFor` context variable, updates pronouns throughout

**Step 1 — Basic Info**
- Full name input
- Date of birth picker (scrollable wheel, min age 18, max age 65)
- Gender select (Man / Woman / Other)
- Height picker (4'0" – 7'0", metric toggle available)
- Weight input (optional)

**Step 2 — Community**
- Religion dropdown (pre-populated: Hindu, Sikh, Muslim, Christian, Jain, Buddhist, Other)
- Caste input (searchable autocomplete from common castes list)
- Sub-caste input (free text)
- Gotra input (searchable autocomplete — critical for gotra exclusion matching)
- Mother tongue (searchable dropdown)

**Step 3 — Manglik & Kundli**
- Manglik status: Yes / No / Partial / Don't Know (radio buttons)
- Kundli section:
  - Upload kundli option (image/PDF picker)
  - Manual entry: birth date, birth time, birth place (city input with autocomplete)
- Info tooltip: "Kundli details are used for compatibility matching"

**Step 4 — Education**
- Highest qualification (dropdown: 10th / 12th / Graduate / Post-Graduate / PhD / Other)
- Field of study (searchable: Engineering, Medicine, Commerce, Arts, Law, etc.)
- Institution name (free text)

**Step 5 — Career**
- Profession category (searchable dropdown: Doctor / Engineer / Teacher / Business / etc.)
- Employer / Company (free text, optional)
- Income range (dropdown: < ₹3L / ₹3–5L / ₹5–10L / ₹10–20L / ₹20–50L / > ₹50L / Prefer not to say)

**Step 6 — Location**
- Current city (searchable dropdown, India cities prioritised)
- Home state (auto-filled from city, editable)
- NRI toggle: "Living outside India?"
  - If yes: Country dropdown (searchable) + Visa/PR Status dropdown

**Step 7 — Marital Status**
- Marital status radio: Never Married / Divorced / Widowed / Annulled
- Do you have children? (Yes / No) — if Yes: How many? (number input)

**Step 8 — Lifestyle** *(Skippable)*
- Diet: Vegetarian / Non-Vegetarian / Eggetarian / Jain / Vegan (radio)
- Drinking: Never / Socially / Regularly (radio)
- Smoking: Never / Occasionally / Regularly (radio)
- Exercise: Daily / Weekly / Rarely / Never (radio)

**Step 9 — Family Details** *(Skippable)*
- Father's occupation (searchable)
- Mother's occupation (searchable)
- No. of brothers / sisters (number pickers)
- Family type: Nuclear / Joint / Extended (radio)
- Family values: Orthodox / Traditional / Moderate / Liberal (radio)

**Step 10 — About Me** *(Skippable)*
- "Describe yourself" textarea (max 500 chars, live character count)
- Interest tags: multi-select chips (Cooking / Travel / Music / Reading / Sports / etc.) — max 10

**Step 11 — Partner Preferences** *(Skippable)*
- Age range: dual-handle slider (18–65)
- Height range: dual-handle slider
- Marital status: multi-select (Never Married / Divorced / Widowed)
- Religion: multi-select
- Education: minimum level dropdown
- Profession category: multi-select (or "Any")
- Income range: minimum dropdown
- Diet: multi-select (or "Any")
- Manglik preference: Any / Only Manglik / Only Non-Manglik
- Location: city multi-select + NRI toggle

**Step 12 — Photos**
- Photo grid: up to 6 slots, first slot required (profile photo)
- Add photo button: camera or gallery picker
- Per-photo toggle: "Face mask" (blurs face for extra privacy, shown as option not default)
- Drag-to-reorder photos
- Photo guidelines shown: "Clear face photo, no sunglasses, recent"

**Step 13 — Mobile Verification**
- Phone number input with country code picker (India (+91) default)
- "Send OTP" button
- 6-digit OTP input (auto-advance between boxes)
- Resend OTP timer (60 seconds)

**Step 14 — Profile Complete**
- Completion percentage ring animation
- Next steps cards:
  - "Get ID Verified → Add trust badge"
  - "Complete skipped sections → Better matches"
  - "Upload kundli → Horoscope matching"
- "Browse Matches" primary button → MainNavigator

---

### 4.3 Home Screen

**Layout:**
```
┌────────────────────────────────┐
│ [Logo]    TricityShadi  [🔔 3] │  ← Header (notification badge)
├────────────────────────────────┤
│ Welcome back, Priya 👋         │
│ [Plan badge]  [Profile 72% ▓▓▓░] │
├────────────────────────────────┤
│ ── Today's Matches ──          │
│ [Card 1] [Card 2] [Card 3] →  │  ← Horizontal scroll, 10 max
├────────────────────────────────┤
│ ── Quick Actions ──            │
│ [Who liked you: 4] [Profile views: 12] │
├────────────────────────────────┤
│ ── New on TricityShadi ──      │
│ [Vertical list of recent profiles] │
└────────────────────────────────┘
```

- Profile completeness meter taps → EditProfileScreen highlighting incomplete sections
- Notification bell with count badge → NotificationsScreen
- "Today's Matches" section: horizontal-scrollable ProfileCards (swipe actions disabled; tap → full profile)
- "Who liked you" and "Profile views" cards: tappable, Premium gate for views list

---

### 4.4 Search Screen

```
┌────────────────────────────────┐
│ 🔍 Search profiles...          │  ← Search bar (name search)
│ [Filters ⚙] [Saved: 2 ▾]     │  ← Filter + saved search buttons
├────────────────────────────────┤
│ 847 profiles found · Sort: ▾  │
├────────────────────────────────┤
│ [ProfileCard]                  │
│ [ProfileCard]                  │
│ [ProfileCard]                  │
│ ... (infinite scroll)          │
└────────────────────────────────┘
```

- Filter button opens FilterPanel bottom sheet
- Saved search dropdown: select saved filter set
- Sort menu: Compatibility / Newest / Recently Active
- Each card has inline Like/Shortlist/Pass buttons
- Empty state: "No profiles match your filters. Try widening your search."

**FilterPanel (Bottom Sheet):**
- Grouped accordion sections (Community / Demographics / Location / Education & Career / Lifestyle / Cultural)
- Range sliders for age/height
- Multi-select dropdowns for religion, caste, profession
- Gotra exclusion: tag-input (type gotra name → add to exclude list)
- NRI toggle → country multi-select appears
- Manglik radio: Any / Manglik Only / Non-Manglik Only
- Apply button (shows count: "Show 847 profiles") + Reset All link

---

### 4.5 Matches Screen

**Tab bar with 4 sub-tabs:**
- **Mutual** — Users who liked each other (show chat button)
- **Shortlisted** — User's own shortlist (offline-viewable)
- **Liked Me** — Who liked the user (Plus+ gate)
- **My Interests** — Interests sent by user with status (Pending / Accepted / Declined)

Mutual match cards: photo + name + "Chat Now" button
Shortlisted cards: full profile card with "Remove from shortlist" swipe action

---

### 4.6 Chat Screen (Conversations List)

```
┌────────────────────────────────┐
│ Messages                       │
│ [Search conversations 🔍]      │
├────────────────────────────────┤
│ [Avatar] Rahul S.              │
│ You: Looking forward...   2h ● │  ← Blue dot = unread
├────────────────────────────────┤
│ [Avatar] Vikram A.             │
│ Sounds good!              1d   │
└────────────────────────────────┘
```

- Tapping conversation → ChatThreadScreen
- No conversations: EmptyState → "When you both like each other, you can start chatting"

**ChatThreadScreen:**
```
┌────────────────────────────────┐
│ ← [Avatar] Rahul S. 🟢  [📞][📹] │  ← Header: name + online status + call buttons
├────────────────────────────────┤
│                [Their message] │  ← Right-aligned, rose background
│ Your message                   │  ← Left-aligned, gray background
│                [Their message] │
│ Tue, 3 Jun ─── date divider ─── │
│ You: Can we connect?       ✓✓ │  ← Double tick = read
├────────────────────────────────┤
│ [📎] [Type message...]  [Send] │  ← Input bar
└────────────────────────────────┘
```

- Long press message → Edit (if within 15 min) / Delete / Report
- "Unlock contact" banner: if plan has quota → "Request Rahul's phone number (3 unlocks left)"
- Voice/Video call buttons (Premium gate — show UpgradeModal if not Premium)
- Typing indicator: animated 3-dot bubble

---

### 4.7 Voice/Video Call Screen

**Incoming call (app in foreground):**
```
┌────────────────────────────────┐
│         Incoming Call          │
│      [Avatar: Rahul S.]        │
│    Rahul Sharma is calling... │
│                                │
│    [Decline 🔴]  [Accept 🟢]  │
└────────────────────────────────┘
```

**Active voice call:**
```
┌────────────────────────────────┐
│         Rahul Sharma           │
│         04:23 ⏱               │
│      [Agora connection bar]    │
│                                │
│   [🔇 Mute] [🔊 Speaker] [📵] │
└────────────────────────────────┘
```

**Active video call:**
- Full-screen camera feed (other party)
- Small PiP of own camera (top-right corner, draggable)
- Overlay controls: Mute / Camera toggle / Switch camera / End call
- Controls auto-hide after 3 seconds, tap to show

---

### 4.8 Profile Screen (Other User)

```
┌────────────────────────────────┐
│ ← [Profile Photo — full width] │
│    [Scroll for more photos →]  │
│                                │
│ Rahul Sharma, 28 · Delhi       │
│ Software Engineer at Infosys   │
│ ✓ Mobile ✓ ID ✓ Education     │
│ Authenticity Score: ████▒ 85   │
│                                │
│ Compatibility: ████▒ 78%       │
│                                │
│ ─── About ───                  │
│ Loves cricket, travel...       │
│                                │
│ ─── Basic Details ───          │
│ Community | Education | Career │
│ Location | Family | Lifestyle  │
│ (accordion sections)           │
│                                │
│ ─── Horoscope ───              │
│ [View Kundli document]         │
└────────────────────────────────┘
│ [👍 Interested] [🔖 Shortlist] [✗ Pass] │  ← Sticky bottom action bar
```

- Photo gallery: horizontal scroll with page dots
- Blurred photos show "Upgrade to Premium" overlay
- "Report / Block" via ⋮ menu (top-right)
- Sticky bottom action bar (always visible)
- "Send Message" replaces action bar if already mutual match + Plus

---

### 4.9 Own Profile Screen

- Editable sections (tap any to edit inline or navigate to EditProfileScreen)
- Profile completeness ring + percentage
- Verification status + "Get Verified" CTA for unearned tiers
- Subscription status + "Upgrade" button
- "Preview as others see me" toggle (shows blurred version as a non-match would see it)

---

### 4.10 Settings Screen

Grouped list:
- **Account:** Edit profile, Change password, Email preferences
- **Privacy:** Incognito mode toggle, Photo privacy, Contact privacy
- **Notifications:** Per-category toggles
- **Verification:** View status, submit documents
- **Subscription:** Current plan, history, invoices
- **Appearance:** Language (En/Hi/Pa), Elder Mode toggle, (Dark Mode — v2)
- **Security:** Biometric login toggle, Active sessions
- **Family Mode:** Toggle family-to-family intro, Set family contact
- **Support:** Help centre, Contact support, Report a bug
- **Legal:** Privacy policy, Terms of service
- **Danger Zone:** Delete account

---

## 5. Navigation & State Patterns

### 5.1 Bottom Tab Bar

**Standard Mode (5 tabs):**
- 🏠 Home | 🔍 Search | 💕 Matches | 💬 Messages | 👤 Profile

**Elder Mode (4 tabs):**
- 🏠 Home | 🔍 Search | 💕 Matches | 👤 Profile

Tab icons use react-native-vector-icons (Ionicons family). Active tab: rose-600. Inactive: gray-400. Unread badge on Messages tab.

### 5.2 Global State (Zustand)

```typescript
// authStore.ts
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  setUser: (user: User) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

// uiStore.ts
interface UIState {
  language: 'en' | 'hi' | 'pa';
  elderMode: boolean;
  upgradeModalVisible: boolean;
  upgradeModalRequiredPlan: Plan | null;
  setLanguage: (lang: Language) => void;
  setElderMode: (enabled: boolean) => void;
  showUpgradeModal: (plan: Plan) => void;
  hideUpgradeModal: () => void;
}

// callStore.ts
interface CallState {
  activeCall: CallSession | null;
  incomingCall: CallInvitation | null;
  setActiveCall: (call: CallSession | null) => void;
  setIncomingCall: (call: CallInvitation | null) => void;
}
```

### 5.3 React Query Setup

```typescript
// api/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 minutes
      gcTime: 1000 * 60 * 60 * 24,   // 24 hours (offline cache)
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

**Key query keys:**
```typescript
export const queryKeys = {
  me: ['user', 'me'],
  profile: (userId: string) => ['profile', userId],
  search: (filters: SearchFilters) => ['search', filters],
  dailyMatches: ['matches', 'daily'],
  shortlisted: ['matches', 'shortlisted'],
  likedMe: ['matches', 'liked-me'],
  conversations: ['chat', 'conversations'],
  thread: (userId: string) => ['chat', 'thread', userId],
  notifications: ['notifications'],
  subscription: ['subscription'],
};
```

---

## 6. Performance Requirements

| Metric | Target | Implementation |
|--------|--------|---------------|
| Home screen FCP | < 1.5s | Skeleton loaders, pre-fetch daily matches |
| Profile card render | < 100ms | Memoised ProfileCard, recycled FlatList |
| Image load (thumbnail) | < 800ms (4G) | react-native-fast-image, WebP format |
| Chat message delivery | < 500ms (4G) | Optimistic UI, Socket.io |
| Scroll performance | 60fps | VirtualizedList, avoid inline functions |
| App bundle size | < 50MB | Hermes JS engine, AAB splits |
| Memory usage | < 200MB | Image cache limit, FlatList windowSize |

---

## 7. Accessibility

- All interactive elements: `accessibilityLabel` prop
- All images: `accessibilityRole="image"` + meaningful `accessibilityLabel`
- Colour is never the only indicator of state (always paired with icon or text)
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text (WCAG AA)
- Form errors announced via `accessibilityLiveRegion="polite"`
- Respects `AccessibilityInfo.isReduceMotionEnabled()` — disable animations

---

## 8. i18n Implementation

```typescript
// i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';
import pa from './pa.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, pa: { translation: pa } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
```

Language key conventions:
```json
// en.json (excerpt)
{
  "onboarding": {
    "step2": {
      "title": "Your Community",
      "subtitle": "Helps us find compatible matches within your community"
    }
  },
  "matches": {
    "mutualMatch": "It's a Match! 🎉",
    "compatibility": "{{score}}% Compatible"
  }
}
```

Changing language at runtime: `i18n.changeLanguage('hi')` + persist to MMKV.

---

## 9. Error Handling

**Global error boundary:** Wraps the entire app. On error: show branded error screen with "Restart App" button + error ID for support.

**Network errors:**
- 401: Silent token refresh → retry
- 403: Show UpgradeModal (if plan-gate) or "You don't have permission" toast
- 429: Show "Too many requests. Please wait X minutes." with timer
- 5xx: "Something went wrong. Please try again." with retry button
- Network offline: Show offline banner, queue mutations

**Toast notifications (react-native-toast-message):**
- Success: green, bottom of screen, 3s
- Error: red, bottom of screen, 5s
- Info: gray, bottom of screen, 3s

---

*Document owner: Frontend Engineering — Globoniks Studio*

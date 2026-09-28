export const meta = {
  name: 'rn-phase5-preflight',
  description: 'RN doctrine Phase 5: per-group build, cold audit, fix pass against DOCTRINE section 10.10/10.11',
  phases: [
    { title: 'Build', detail: 'one agent per screen group applies the section 10.10 pre-flight to its files' },
    { title: 'Audit', detail: 'a fresh agent audits the result cold against the doctrine' },
    { title: 'Fix', detail: 'a fix agent closes every audit finding' },
    { title: 'Reaudit', detail: 'a second fresh agent confirms the fixes' },
  ],
}

const GROUPS = [
  { key: 'A-money', files: [
    'mobile/src/features/subscription/SubscriptionScreen.tsx',
    'mobile/src/components/ui/GoldLock.tsx',
    'mobile/src/features/profile/AstrologerMarketplaceScreen.tsx',
    'mobile/src/features/profile/AstrologerDetailScreen.tsx',
  ], focus: 'Money surfaces. The premium gate must never fake a count or a photo. Gold means premium only. Catalogue/price data must have loading + error states, never a static fallback that resurrects withdrawn plans. Payment failure and cancellation copy must be honest. Four Alert.alert uses in SubscriptionScreen and two in AstrologerDetail need triage.' },
  { key: 'B-browse', files: [
    'mobile/src/features/home/HomeScreen.tsx',
    'mobile/src/features/home/DiscoverCards.tsx',
    'mobile/src/features/search/SearchScreen.tsx',
    'mobile/src/components/search/FilterPanel.tsx',
    'mobile/src/features/matches/MatchesScreen.tsx',
    'mobile/src/components/cards/ProfileCard.tsx',
    'mobile/src/features/notifications/NotificationsScreen.tsx',
  ], focus: 'Browse surfaces. Photoless profiles must not leave a void (the web campaign found this). All four states, list performance, floating-pill clearance, accessibility labels on cards and chips, score colour rules (no gold on scores).' },
  { key: 'C1-detail', files: [
    'mobile/src/features/profile/ProfileDetailScreen.tsx',
    'mobile/src/features/profile/detail/HeroBlock.tsx',
    'mobile/src/features/profile/detail/PhotoBlock.tsx',
    'mobile/src/features/profile/detail/PhotoGalleryViewer.tsx',
    'mobile/src/features/profile/detail/RevealOnScroll.tsx',
    'mobile/src/features/profile/detail/SectionCard.tsx',
    'mobile/src/features/profile/HoroscopeMatchScreen.tsx',
    'mobile/src/features/profile/CompatibilityBreakdownSheet.tsx',
    'mobile/src/features/profile/BlockReportSheet.tsx',
    'mobile/src/components/profile/PreferenceMatch.tsx',
    'mobile/src/components/profile/AudioIntroChip.tsx',
  ], focus: 'Profile detail. RevealOnScroll currently translates 20px (doctrine cap is 16px, owner ruling: keep and clamp to the cap). The like/shortlist pop uses a 1.3x overshoot; check usePop callers against section 4.4 and clamp if it is a plain tap. Gallery viewer needs tap fallback for every gesture and accessible labels. BlockReportSheet has five Alert.alert uses to triage.' },
  { key: 'C2-chat', files: [
    'mobile/src/features/chat/ChatThreadScreen.tsx',
    'mobile/src/features/chat/VoiceMessage.tsx',
    'mobile/src/features/chat/ConversationsScreen.tsx',
    'mobile/src/features/chat/FamilyGroupsScreen.tsx',
    'mobile/src/features/chat/FamilyGroupChatScreen.tsx',
  ], focus: 'Chat. ChatThreadScreen is 1,280 lines with a virtualized row using an entering animation (should not animate on virtualized rows that remount on scroll). Composer + keyboard behaviour, reply/reaction gestures need a visible tap fallback, message rows must not swallow labels at max text size, live-region announcement for incoming messages, voice playback controls accessible. Alert.alert uses in FamilyGroupChat (6), ChatThread (2), VoiceMessage (2), FamilyGroups (2) need triage.' },
  { key: 'D1-identity', files: [
    'mobile/src/features/profile/OwnProfileScreen.tsx',
    'mobile/src/features/profile/EditProfileScreen.tsx',
    'mobile/src/components/profile/VoiceIntroRecorder.tsx',
    'mobile/src/features/profile/PrivacySettingsScreen.tsx',
    'mobile/src/features/profile/VerificationScreen.tsx',
    'mobile/src/components/profile/VerificationBadges.tsx',
  ], focus: 'Own profile and identity. Verification is selfie-only via LIVE camera, never a library picker. Badges must reflect real state, nothing hardcoded. VoiceIntroRecorder has nine Alert.alert uses to triage (permission-denied and errors are toasts or inline, delete-recording is a legitimate destructive confirm). EditProfile unsaved-changes exit guard: keep a destructive confirm Alert if present.' },
  { key: 'D2-settings', files: [
    'mobile/src/features/profile/SettingsScreen.tsx',
    'mobile/src/features/profile/AccountSecurityScreen.tsx',
    'mobile/src/features/profile/GuardianSetupScreen.tsx',
    'mobile/src/features/profile/GuardianViewScreen.tsx',
    'mobile/src/features/profile/GuardianCandidatesScreen.tsx',
    'mobile/src/features/profile/SupportScreen.tsx',
    'mobile/src/features/profile/SuccessStoryScreen.tsx',
    'mobile/src/features/profile/SuccessStoriesBrowseScreen.tsx',
    'mobile/src/features/profile/QuizScreen.tsx',
    'mobile/src/features/legal/AboutScreen.tsx',
    'mobile/src/features/legal/ContactScreen.tsx',
    'mobile/src/features/legal/LegalLayout.tsx',
    'mobile/src/features/legal/PrivacyScreen.tsx',
    'mobile/src/features/legal/SafetyScreen.tsx',
    'mobile/src/features/legal/TermsScreen.tsx',
  ], focus: 'Settings, account, guardian, support, legal. SettingsScreen is one of two files that know elder mode exists; verify every row still works in elder mode. Delete-account and log-out-everywhere are the legitimate destructive confirms. Support/Contact must never show a placeholder phone or WhatsApp number (hidden when unconfigured). Alert.alert uses: AccountSecurity (4), GuardianSetup (5), SuccessStory (1), Settings (1).' },
  { key: 'E1-auth', files: [
    'mobile/src/features/auth/WelcomeScreen.tsx',
    'mobile/src/features/auth/LoginScreen.tsx',
    'mobile/src/features/auth/CreateAccountScreen.tsx',
    'mobile/src/features/auth/BasicsScreen.tsx',
    'mobile/src/features/auth/ForgotPasswordScreen.tsx',
    'mobile/src/features/auth/ResetPasswordScreen.tsx',
    'mobile/src/features/auth/SplashScreen.tsx',
    'mobile/src/components/forms/OtpInput.tsx',
    'mobile/src/components/forms/SmartContactInput.tsx',
  ], focus: 'Auth funnel. Owner decision 2: audit the current funnel against doctrine WITH EVIDENCE and decide whether it needs to mirror the web one-field-first gate; the current CreateAccountScreen already does identifier+OTP then basics, so most likely record that it already conforms. LoginScreen has 9 TouchableOpacity leftovers check (grep first; earlier phases may have migrated them). Errors on login are inline or toast, never Alert (one Alert.alert in LoginScreen). Chrome buttons must reach 44pt. Password rules 8+ upper/lower/digit/symbol. Screen-reader labels on OTP boxes.' },
  { key: 'E2a-onboarding', files: [
    'mobile/src/features/onboarding/OnboardingLayout.tsx',
    'mobile/src/features/onboarding/OnboardingContext.tsx',
    'mobile/src/features/onboarding/CompleteBasicsScreen.tsx',
    'mobile/src/features/onboarding/JourneyFinaleScreen.tsx',
    'mobile/src/features/onboarding/Step2Screen.tsx',
    'mobile/src/features/onboarding/Step3Screen.tsx',
    'mobile/src/features/onboarding/Step4Screen.tsx',
    'mobile/src/features/onboarding/Step5Screen.tsx',
    'mobile/src/features/onboarding/Step6Screen.tsx',
  ], focus: 'Onboarding journey part 1. OnboardingLayout animates a layout property on an in-flow node (progress bar width): fix per doctrine (absolute childless fill scaled via transform, or the sanctioned equivalent). 40x40 chrome buttons must reach 44pt or carry hitSlop plus tap44-hitslop marker. Each step needs a save-failure state (OnboardingContext already toasts on failure) and accessible selection state on every chip/option.' },
  { key: 'E2b-onboarding', files: [
    'mobile/src/features/onboarding/Step7Screen.tsx',
    'mobile/src/features/onboarding/Step8Screen.tsx',
    'mobile/src/features/onboarding/Step9Screen.tsx',
    'mobile/src/features/onboarding/Step10Screen.tsx',
    'mobile/src/features/onboarding/Step11Screen.tsx',
    'mobile/src/features/onboarding/Step12Screen.tsx',
  ], focus: 'Onboarding journey part 2. Step12 is photos: has three Alert.alert uses to triage (permission and upload errors are toasts or inline; removing a photo is a legit destructive confirm). Photo upload needs loading, error and retry states. Accessible selection state on every chip/option.' },
]

const COMMON = [
  'You are working on the React Native app in mobile/ of the TricityMatch monorepo (repo root: /Users/sakshampanjla/Desktop/REACT/tricitymatch), branch design/rework-2026-09.',
  'BINDING LAW: docs/design-handoff/DOCTRINE_2026-09.md section 10 (10.1 to 10.11) - read at minimum section 10.2, 10.3, 10.4, 10.7, 10.9, 10.10 and 10.11 and the ruling table around line 470. Also read docs/design-handoff/RN_REWORK_PLAN_2026-09.md "Standing rules for every implementing agent" and the Phase 3 and Phase 4 sections (they list what earlier phases already did, so you do not redo it).',
  'Phases 1-4 are DONE and committed: PressableScale replaced TouchableOpacity, Text and Input primitives are adopted, Screen shell adopted, eyebrows/ghost cards/gold-on-scores fixed, error states rendered on every query screen, PickerSheet + list windowing (constants/listPerf.ts) + reduce-motion fade navigation done. Phase 5 is the per-screen pre-flight: what section 10.10 still finds wrong on each screen. Do not redo finished work; verify it with grep and move on.',
  'Existing primitives to ADOPT, never reinvent: components/ui/{Text,Button,Input,Card,EmptyState,Skeleton,ListRow,Badge,IconButton,PickerSheet,SectionHeader,ScreenHeader,Avatar,GoldLock,TickRing,Switch}, components/layout/Screen, components/motion/{PressableScale,useReduceMotion,useReduceTransparency}, utils/toast (showToast.success/error/info), hooks/useTheme ({c,isDark}), constants/listPerf. Motion tokens: shared/src/constants/motion.ts. Theme tokens: shared/src/constants/theme.ts.',
  'HARD BOUNDARIES: (1) Edit ONLY the files listed as yours below. Other agents are editing sibling groups at the same time. (2) Shared primitives (components/ui/*, components/motion/*, components/layout/*, components/navigation/*, shared/*, navigation/*, api/*, constants/*, i18n locale files) are READ-ONLY for you: if one needs a change, put it in primitiveRequests instead. Exception: you may ADD new i18n keys only if the screen already uses t(); otherwise use plain strings like neighbours do. (3) Do NOT git commit, stash, checkout or reset anything. (4) Do NOT touch admin/* or calls/* screens.',
  'THE PRE-FLIGHT you apply to every file (from section 10.10, restricted to what can be verified and fixed in source): (a) STATES: default, loading = skeleton matching the layout, empty = icon + one line + action, error = icon + cause + WORKING retry; premium-gated views also a locked state that never fakes a count or photo. (b) Hi/pa strings 30 percent longer and OS max text size must not clip: no fixed height/minHeight row with text lacking maxFontSizeMultiplier or numberOfLines strategy; controls must not wrap onto a second line. (c) MOTION: every animation from motion tokens; nothing hand-rolled; UI thread; no layout property animated on an in-flow node; no scale(0) entrance; Reduce Motion leaves press feedback as opacity; one haptic per committed action. (d) THEMES: colours via useTheme c, never module-scope light palette; shadows branch on isDark; elder mode does not overlap or become a no-op; nothing depends on hover. (e) ACCESSIBILITY: every pressable has accessibilityRole and a meaningful accessibilityLabel, accessibilityState where it has one (selected/checked/disabled/expanded); decorative groups/icons hidden (accessibilityElementsHidden + importantForAccessibility no-hide-descendants); content that updates without a tap announces (accessibilityLiveRegion or AccessibilityInfo.announceForAccessibility); every target at least 44x44pt or has hitSlop that genuinely reaches 44 in both directions AND the testID suffix marker tap44-hitslop; every gesture has a visible tap fallback. (f) CRAFT: none of the banned patterns in 10.11; no emoji in JSX (Ionicons); no em dashes in UI copy; one accent, burgundy is accent-only never a flat fill except primary CTA, gold is premium only; elevation declared once (border OR shadow); no fabricated number, price, person, offer or count anywhere; existing shared primitives used instead of local one-offs; no console.log left; no Alert.alert except destructive confirmation.',
  'ALERT.ALERT RULING (ruling 22, owner-confirmed): Alert.alert is allowed ONLY to confirm a destructive or irreversible action (delete, remove, log out everywhere, discard changes). Anything else becomes showToast.error/info/success or an inline state: errors -> showToast.error (or inline if the user must act on it on the screen), successes -> showToast.success or simply navigate, permission-denied -> an inline notice or toast that says how to fix it (with an Open Settings action via Linking.openSettings where useful), informational -> toast. For each Alert.alert in your files record a verdict.',
  'VERIFY BEFORE YOU DECLARE: this is a source-level pass (no simulator is booted). Grep and read; do not claim something was seen on a device. When a fix is a judgement call needing a device or an owner, list it under unresolved instead of guessing. Never invent copy that states a fact (price, count, name, claim).',
  'GATE: from the mobile/ directory run node_modules/.bin/tsc --noEmit -p tsconfig.json (NEVER bare tsc, PATH has v4). Other agents are mid-edit in sibling files so errors in files that are not yours are not your problem; make sure zero tsc errors are reported for YOUR files. Do not run the full test suite or lint.',
].join('\n')

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    filesChanged: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    stateCensus: { type: 'array', items: { type: 'object', properties: {
      screen: { type: 'string' }, default: { type: 'string' }, loading: { type: 'string' }, empty: { type: 'string' }, error: { type: 'string' }, locked: { type: 'string' },
    }, required: ['screen'] } },
    alertTriage: { type: 'array', items: { type: 'object', properties: {
      file: { type: 'string' }, verdict: { type: 'string' }, note: { type: 'string' },
    }, required: ['file', 'verdict'] } },
    primitiveRequests: { type: 'array', items: { type: 'string' } },
    unresolved: { type: 'array', items: { type: 'string' } },
    tscCleanForMyFiles: { type: 'boolean' },
  },
  required: ['filesChanged', 'summary', 'tscCleanForMyFiles'],
}

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    findings: { type: 'array', items: { type: 'object', properties: {
      file: { type: 'string' }, line: { type: 'number' },
      severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
      checklistItem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' },
    }, required: ['file', 'severity', 'checklistItem', 'evidence', 'fix'] } },
    note: { type: 'string' },
  },
  required: ['pass', 'findings'],
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    fixed: { type: 'array', items: { type: 'string' } },
    notFixed: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, reason: { type: 'string' } }, required: ['finding', 'reason'] } },
    tscCleanForMyFiles: { type: 'boolean' },
  },
  required: ['fixed', 'notFixed', 'tscCleanForMyFiles'],
}

function filesBlock(g) {
  return 'YOUR FILES (the only files you may edit):\n' + g.files.map(f => '- ' + f).join('\n') + '\n\nGROUP FOCUS: ' + g.focus
}

const results = await pipeline(
  GROUPS,
  (g) => agent([
    COMMON, '', filesBlock(g), '',
    'TASK: BUILD. Read every one of your files in full. Run the section 10.10 pre-flight on each screen, source-level, and FIX every failure you find in your files. Also produce the state census (which of default/loading/empty/error/locked each screen renders) and the Alert.alert triage. Prefer small surgical edits over rewrites; preserve behaviour and testIDs. Finish with tsc and report.',
  ].join('\n'), { label: 'build:' + g.key, phase: 'Build', schema: BUILD_SCHEMA }),
  (built, g) => agent([
    COMMON, '', filesBlock(g), '',
    'TASK: COLD AUDIT. You did not write this code. A builder just edited these files (run git diff on them to see what changed, but audit the FILES AS THEY NOW STAND, not the diff). Re-derive the checklist yourself from DOCTRINE section 10.10 and 10.11, then check every file with real evidence: grep for TouchableOpacity, TextInput outside ui/Input, useSafeAreaInsets outside Screen, hex colour literals, colours. and shadows. without isDark, Animated from react-native, withTiming/withSpring with literals, Alert.alert, emoji, textTransform uppercase, letterSpacing, ALL-CAPS literals, fixed heights around text, pressables missing accessibilityRole/label, targets under 44pt without hitSlop+tap44-hitslop, hitSlop that does not really reach 44, isError never rendered, hooks after an early return, fabricated data. Read the rendered branches, not just the greps. Do NOT edit any file. Be adversarial: the web campaign saw every group fail its first audit. Report findings with file:line and a concrete fix; pass=true ONLY if there are zero critical or major findings. Builder reported unresolved items (do not count those against the builder unless trivially fixable): ' + JSON.stringify((built && built.unresolved) || []),
  ].join('\n'), { label: 'audit:' + g.key, phase: 'Audit', schema: AUDIT_SCHEMA })
    .then(audit => ({ built, audit })),
  (prev, g) => {
    const findings = (prev.audit && prev.audit.findings) || []
    if (!findings.length) return { ...prev, fix: null }
    return agent([
      COMMON, '', filesBlock(g), '',
      'TASK: FIX. A cold auditor reported these findings against your files. Close every one (critical, major and minor) with a real fix in the file, or, if a finding is wrong or needs a device/owner/primitive change, say exactly why under notFixed. Verify each claim yourself before changing code (an audit finding is a hypothesis). Findings:\n' + JSON.stringify(findings, null, 2),
    ].join('\n'), { label: 'fix:' + g.key, phase: 'Fix', schema: FIX_SCHEMA })
      .then(fix => ({ ...prev, fix }))
  },
  (prev, g) => {
    if (!prev.fix) return { ...prev, reaudit: null }
    return agent([
      COMMON, '', filesBlock(g), '',
      'TASK: RE-AUDIT. You did not write or fix this code. A first auditor reported findings, a fixer claimed to close them. Verify the claimed fixes are real IN THE FILES (read them; do not trust the fixer), and re-run the full section 10.10/10.11 audit for anything the first audit missed or the fix broke (hooks order, imports left unused, tsc errors in these files, behaviour regressions). Do NOT edit any file. pass=true ONLY if zero critical or major findings remain. Previous findings: ' + JSON.stringify(prev.audit.findings) + ' Fixer reported: ' + JSON.stringify(prev.fix),
    ].join('\n'), { label: 'reaudit:' + g.key, phase: 'Reaudit', schema: AUDIT_SCHEMA })
      .then(reaudit => ({ ...prev, reaudit }))
  },
)

const summary = results.map((r, i) => r ? ({
  group: GROUPS[i].key,
  built: r.built && { files: r.built.filesChanged, tsc: r.built.tscCleanForMyFiles, unresolved: r.built.unresolved, primitiveRequests: r.built.primitiveRequests, alertTriage: r.built.alertTriage },
  auditPass: r.audit && r.audit.pass,
  auditFindings: r.audit && r.audit.findings ? r.audit.findings.length : null,
  fix: r.fix,
  reauditPass: r.reaudit ? r.reaudit.pass : null,
  remaining: r.reaudit ? r.reaudit.findings : (r.audit ? (r.audit.pass ? [] : r.audit.findings) : null),
}) : { group: GROUPS[i].key, failed: true })

return { summary, censuses: results.map((r, i) => ({ group: GROUPS[i].key, census: r && r.built ? r.built.stateCensus : null })) }

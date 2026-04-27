# Graph Report - .  (2026-04-27)

## Corpus Check
- 235 files · ~407,141 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 781 nodes · 814 edges · 29 communities detected
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 172 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Admin API Layer|Admin API Layer]]
- [[_COMMUNITY_App Routing & Layout|App Routing & Layout]]
- [[_COMMUNITY_Onboarding Flow|Onboarding Flow]]
- [[_COMMUNITY_Profile & Sanitization|Profile & Sanitization]]
- [[_COMMUNITY_Database Seeders|Database Seeders]]
- [[_COMMUNITY_Auth Middleware|Auth Middleware]]
- [[_COMMUNITY_Cloudinary Image Service|Cloudinary Image Service]]
- [[_COMMUNITY_Brand & Visual Assets|Brand & Visual Assets]]
- [[_COMMUNITY_Email & Queue Utils|Email & Queue Utils]]
- [[_COMMUNITY_Performance Monitoring|Performance Monitoring]]
- [[_COMMUNITY_Logger & Socket Handler|Logger & Socket Handler]]
- [[_COMMUNITY_PWA & App Shell|PWA & App Shell]]
- [[_COMMUNITY_shadcnui Components|shadcn/ui Components]]
- [[_COMMUNITY_Test Helpers & Suites|Test Helpers & Suites]]
- [[_COMMUNITY_Security Middleware|Security Middleware]]
- [[_COMMUNITY_Optimized Image Assets|Optimized Image Assets]]
- [[_COMMUNITY_UI Component Library|UI Component Library]]
- [[_COMMUNITY_File Upload & Cloudinary|File Upload & Cloudinary]]
- [[_COMMUNITY_Health Check Utils|Health Check Utils]]
- [[_COMMUNITY_Module 20|Module 20]]
- [[_COMMUNITY_Module 22|Module 22]]
- [[_COMMUNITY_Module 24|Module 24]]
- [[_COMMUNITY_Module 25|Module 25]]
- [[_COMMUNITY_Module 26|Module 26]]
- [[_COMMUNITY_Module 28|Module 28]]
- [[_COMMUNITY_Module 32|Module 32]]
- [[_COMMUNITY_Module 33|Module 33]]
- [[_COMMUNITY_Module 34|Module 34]]
- [[_COMMUNITY_Module 38|Module 38]]

## God Nodes (most connected - your core abstractions)
1. `get()` - 20 edges
2. `useAuth()` - 17 edges
3. `useOnboarding()` - 17 edges
4. `TriCityMatch Application` - 13 edges
5. `getImageUrl()` - 12 edges
6. `Hero Couple Photo (Garden Setting)` - 10 edges
7. `TricityMatch Matrimonial Platform Brand` - 10 edges
8. `errorHandler()` - 9 edges
9. `set()` - 9 edges
10. `MultiStep Form Component (multistep-form.tsx)` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Dashboard()` --calls--> `useAuth()`  [INFERRED]
  /Users/sakshampanjla/Desktop/REACT/tricitymatch/frontend/src/pages/Dashboard.jsx → /Users/sakshampanjla/Desktop/REACT/tricitymatch/frontend/src/context/AuthContext.jsx
- `ModernOnboarding()` --calls--> `get()`  [INFERRED]
  /Users/sakshampanjla/Desktop/REACT/tricitymatch/frontend/src/pages/ModernOnboarding.jsx → /Users/sakshampanjla/Desktop/REACT/tricitymatch/backend/utils/cache.js
- `TricityShadi Application` --conceptually_related_to--> `TricityShadi Seeder Accounts`  [INFERRED]
  frontend/index.html → backend/seeders/SEEDER_ACCOUNTS.txt
- `AppContent()` --calls--> `useAuth()`  [INFERRED]
  /Users/sakshampanjla/Desktop/REACT/tricitymatch/frontend/src/App.jsx → /Users/sakshampanjla/Desktop/REACT/tricitymatch/frontend/src/context/AuthContext.jsx
- `SocketProvider()` --calls--> `useAuth()`  [INFERRED]
  /Users/sakshampanjla/Desktop/REACT/tricitymatch/frontend/src/context/SocketContext.jsx → /Users/sakshampanjla/Desktop/REACT/tricitymatch/frontend/src/context/AuthContext.jsx

## Hyperedges (group relationships)
- **shadcn/ui Component Set** — integration_guide_multistep_form_tsx, integration_guide_button_tsx, integration_guide_input_tsx, integration_guide_label_tsx, integration_guide_utils_ts [EXTRACTED 1.00]
- **Auth API Endpoints** — test_output_auth_signup, test_output_auth_login, test_output_auth_forgot_password, test_output_auth_me [EXTRACTED 1.00]
- **Validator Functions Suite** — test_output_signup_validation, test_output_login_validation, test_output_update_profile_validation, test_output_send_message_validation, test_output_search_validation, test_output_match_action_validation, test_output_pagination_rules [EXTRACTED 1.00]
- **Error Handler Components** — test_output_app_error, test_output_create_error_factory, test_output_error_handler_middleware, test_output_async_handler [EXTRACTED 1.00]
- **Subscription Tier System** — seeder_accounts_subscription_elite, seeder_accounts_subscription_premium, seeder_accounts_subscription_free [EXTRACTED 1.00]

## Communities

### Community 0 - "Admin API Layer"
Cohesion: 0.06
Nodes (29): adminGetInvoice(), getAnalytics(), getReports(), getRevenueReport(), getUser(), getUsers(), getVerifications(), checkHealth() (+21 more)

### Community 1 - "App Routing & Layout"
Cohesion: 0.04
Nodes (15): AdminLayout(), AdminLogin(), AdminProtectedRoute(), AppContent(), useAuth(), Chat(), Login(), Navbar() (+7 more)

### Community 2 - "Onboarding Flow"
Cohesion: 0.05
Nodes (18): AboutYourselfStep(), BasicInfoStep(), CreateAccountStep(), CreatingForStep(), EducationStep(), FamilyStep(), LifestyleStep(), LocationStep() (+10 more)

### Community 3 - "Profile & Sanitization"
Cohesion: 0.06
Nodes (6): MyProfileView(), ProfileDetail(), escapeHtml(), sanitizeObject(), sanitizeText(), sanitizeUrl()

### Community 4 - "Database Seeders"
Cohesion: 0.08
Nodes (16): up(), seed(), close(), initRedis(), createTransporter(), sendEmail(), sendMatchNotification(), sendMessageNotification() (+8 more)

### Community 5 - "Auth Middleware"
Cohesion: 0.08
Nodes (16): ownsResource(), socketRequirePremium(), verifyTargetUser(), AppError, asyncHandler(), errorHandler(), handleJWTError(), handleJWTExpiredError() (+8 more)

### Community 6 - "Cloudinary Image Service"
Cohesion: 0.14
Nodes (13): getAvatarUrl(), getFullSizeUrl(), getGalleryThumbnailUrl(), getImageUrl(), getProfileCardUrl(), getThumbnailUrl(), getTransformedUrl(), isCloudinaryUrl() (+5 more)

### Community 7 - "Brand & Visual Assets"
Cohesion: 0.22
Nodes (22): Brand Identity, Couple Engagement Ceremony Photo, Couple Photography Theme, Couple Testimonial - Indian Couple Sitting in Garden, Couple Walking - Indian Couple Holding Hands at Sunset, Indian Engagement Ceremony, Female Profile Photo Theme, Hero Couple Photo (Garden Setting) (+14 more)

### Community 8 - "Email & Queue Utils"
Cohesion: 0.18
Nodes (16): emailAlertHandler(), getTransporter(), sendEmail(), sendMatchNotification(), sendPasswordResetEmail(), sendSubscriptionConfirmation(), sendVerificationApproved(), sendWelcomeEmail() (+8 more)

### Community 9 - "Performance Monitoring"
Cohesion: 0.13
Nodes (5): monitored(), QueryCounter, timeAsync(), Timer, timeSync()

### Community 10 - "Logger & Socket Handler"
Cohesion: 0.12
Nodes (4): logSecurityEvent(), authenticateSocket(), checkRateLimit(), extractToken()

### Community 11 - "PWA & App Shell"
Cohesion: 0.14
Nodes (17): TricityShadi Test Account Credentials, Cloudinary CDN, Google Fonts (Inter + Playfair Display), Main Application Script (main.jsx), PWA Manifest, Service Worker (sw.js), TricityShadi Application, Sequelize CLI Seeder (+9 more)

### Community 12 - "shadcn/ui Components"
Cohesion: 0.13
Nodes (16): Button Component (button.tsx), clsx, class-variance-authority, Index CSS (shadcn CSS variables), Input Component (input.tsx), Label Component (label.tsx), lucide-react Icon Library, MultiStep Form Component (multistep-form.tsx) (+8 more)

### Community 14 - "Test Helpers & Suites"
Cohesion: 0.16
Nodes (6): createTestAdmin(), createTestUser(), hashPassword(), mockRequest(), mockResponse(), runValidation()

### Community 15 - "Security Middleware"
Cohesion: 0.22
Nodes (8): clearLoginAttempts(), _delLockoutData(), _getLockoutData(), _lockoutTtlSec(), recordFailedLogin(), sanitizeObject(), sanitizeRequest(), _setLockoutData()

### Community 16 - "Optimized Image Assets"
Cohesion: 0.35
Nodes (11): Indian Couple Engagement Ceremony (Optimized WebP), Female User Profile, Indian Engagement Ceremony, Indian Wedding Ceremony, Male User Profile, Profile Photo - Arjun (Optimized WebP), Profile Photo - Meera (Optimized WebP), Profile Photo - Rahul (Optimized WebP) (+3 more)

### Community 17 - "UI Component Library"
Cohesion: 0.24
Nodes (6): Avatar(), Badge(), CardBody(), CardFooter(), CardHeader(), cn()

### Community 18 - "File Upload & Cloudinary"
Cohesion: 0.27
Nodes (5): deleteFromCloudinary(), documentFileFilter(), getCloudinaryPublicId(), hasAllowedExtension(), imageFileFilter()

### Community 19 - "Health Check Utils"
Cohesion: 0.38
Nodes (8): checkCPU(), checkDatabase(), checkDiskSpace(), checkMemory(), checkRedis(), formatUptime(), fullHealthCheck(), readinessCheck()

### Community 20 - "Module 20"
Cohesion: 0.38
Nodes (10): Couple Lifestyle Imagery, Female User Profile Photo, Male User Profile Photo, Couple Testimonial Photo - Garden Setting, Couple Walking at Sunset - Lifestyle Image, TriCityMatch - Matrimonial/Dating Platform, Arjun - Male Profile Photo, Meera - Female Profile Photo (+2 more)

### Community 22 - "Module 22"
Cohesion: 0.22
Nodes (9): loginValidation, matchActionValidation, paginationRules, Sanitization Utilities (sanitize.test.js), searchValidation, sendMessageValidation, signupValidation, updateProfileValidation (+1 more)

### Community 24 - "Module 24"
Cohesion: 0.52
Nodes (6): useIsDesktop(), useIsMobile(), useIsTablet(), useMediaQuery(), usePrefersDarkMode(), usePrefersReducedMotion()

### Community 25 - "Module 25"
Cohesion: 0.43
Nodes (4): generateRefreshToken(), getCookieOptions(), parseDuration(), setAuthCookies()

### Community 26 - "Module 26"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 28 - "Module 28"
Cohesion: 0.4
Nodes (6): AppError Class, asyncHandler, createError Factory, Error Handler Unit Tests, errorHandler.js Middleware File, errorHandler Middleware

### Community 32 - "Module 32"
Cohesion: 0.5
Nodes (2): createOrder(), getRazorpayInstance()

### Community 33 - "Module 33"
Cohesion: 0.5
Nodes (2): formatCompatibilityScore(), CompatibilityMeter()

### Community 34 - "Module 34"
Cohesion: 0.5
Nodes (2): OfflineIndicator(), useOnlineStatus()

### Community 38 - "Module 38"
Cohesion: 1.0
Nodes (3): calculateAge(), calculateCompatibility(), getCompatibilityBreakdown()

## Ambiguous Edges - Review These
- `Priya - Female Profile Photo (Traditional Attire)` → `Male User Profile Photo`  [AMBIGUOUS]
  frontend/public/images/profile-priya.png · relation: conceptually_related_to

## Knowledge Gaps
- **32 isolated node(s):** `PWA Manifest`, `Service Worker (sw.js)`, `Main Application Script (main.jsx)`, `Cloudinary CDN`, `Google Fonts (Inter + Playfair Display)` (+27 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Module 26`** (6 nodes): `ErrorBoundary`, `.componentDidCatch()`, `.constructor()`, `.getDerivedStateFromError()`, `.render()`, `ErrorBoundary.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 32`** (5 nodes): `razorpay.js`, `createOrder()`, `getPlanDetails()`, `getRazorpayInstance()`, `verifyPayment()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 33`** (4 nodes): `formatCompatibilityScore()`, `CompatibilityMeter()`, `CompatibilityMeter.jsx`, `compatibility.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 34`** (4 nodes): `OfflineIndicator.jsx`, `useOnlineStatus.js`, `OfflineIndicator()`, `useOnlineStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Priya - Female Profile Photo (Traditional Attire)` and `Male User Profile Photo`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `get()` connect `Admin API Layer` to `Onboarding Flow`, `Logger & Socket Handler`, `Security Middleware`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `App Routing & Layout` to `Onboarding Flow`, `Profile & Sanitization`, `Cloudinary Image Service`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `ModernOnboardingContent()` connect `Onboarding Flow` to `App Routing & Layout`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `get()` (e.g. with `getUsers()` and `getUser()`) actually correct?**
  _`get()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `useAuth()` (e.g. with `AppContent()` and `SocketProvider()`) actually correct?**
  _`useAuth()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `useOnboarding()` (e.g. with `BasicInfoStep()` and `EducationStep()`) actually correct?**
  _`useOnboarding()` has 16 INFERRED edges - model-reasoned connections that need verification._
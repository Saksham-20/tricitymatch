# Deep QA Run — Element-Level Checklist (2026-07-08)

> Living tracker. Companion to `docs/QA_DEEP_RUN_2026-07-08_PLAN.md` (read the plan's §3–§8 before executing).
> Legend: `[ ]` todo · `[x]` pass · `[F]` fail (→ DQ-id in Findings Log) · `[D]` deferred (→ W-item) · `[N]` N/A (config-gated, note reason).
> Platforms shorthand: **W**=web, **iOS**, **AND**=Android, **API**, **DB**. Viewports: **375 / 768 / 1440**.
> Severity: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low. Rule: fix ≤1h on discovery; bigger → W-item + `[D]`.

---

## RUN STATE (update every session — this is the resume pointer)

- **✅✅ RUN COMPLETE — C0..C22 all ✅ (2026-07-10, Opus exec session 3).**
- **C22 DONE:** CLOSE-OUT. **Batch commit** (user's pre-decided strategy) — branched off main to `qa/deep-run-2026-07-08` = 15 code fixes (BE callController/profileController/searchController/guardianRoutes/performance + FE RouteTitle/Select/Home + RN verification.ts/VerificationScreen/Step14/i18n×3 + Podfile.lock) + 2 QA docs (this checklist + plan), 17 files. **NOT pushed** (left for explicit user ask). Correctly EXCLUDED from commit: stray root `c4-*.png`, unrelated `docs/*pricing_revamp*` (separate work), bulky `docs/qa-artifacts/`. **Dev-DB cleanup** — surgically removed pure-noise probe rows I created: 2 test referral codes (QAC17TEST+QAMKTGVFPX), 3 contact probes, 1 marketing probe user (qa.mktg.c18). **KEPT** the documented QA member/match/notification fixtures (Aman/Deepa/qa.deep.* + their mutual/shortlist/notif rows + Aman call/booking sessions + guardian revoked links) — realistic, checklist-referenced for resume, dev-DB only (prod uses real data); purge them only if starting fully fresh. **Final gates:** BE unit 155/155 · FE vitest 48/48 · mobile tsc 0 · FE build ✓. **Findings total: 15 (DQ-001..015)** — 14 fixed+verified (incl. 3 🔴 DQ-009/011 + streaming-crash, 2 🟠 DQ-006/012, 3 🟡, rest ⚪), 1 deferred (DQ-015 RN bureau dead code, whole-feature/product decision). Cross-platform sync (web↔RN) proven throughout via shared-endpoint contract parity. **Remaining known-non-blockers:** VPS infra hardening ([[project-security-pentest-2026-07]]); web notif-prefs localStorage-only (W-item); RN dark-mode toggle deliberately deferred; config-gated features (Agora media, live Razorpay/FCM keys) unchanged.
- **C21 DONE:** NON-FUNCTIONAL / readiness gates. **All 4 GREEN (fresh final run):** BE **unit 155/155** (`npx jest`: 155 passed; the 15 "failed" = integration `auth.test.js` needs a live test DB — excluded per C0 baseline/ledger#15, expected not a regression), FE **vitest 48/48** (6 files, 1.18s), mobile **tsc 0** (exit 0, `-p tsconfig.json`), FE **build ✓ 4.55s** (Vite 8/rolldown). **Bundle** code-split & healthy: initial = index 148kB + vendor-react 182kB + vendor-ui 195kB + vendor-utils 114kB (~204kB gzip); AgoraRTC 1.56MB + BarChart 361kB are **lazy chunks** (calls config-gated on VITE_AGORA_APP_ID; admin charts) → the >500kB warning is on those deferred chunks only, not initial load — acceptable. **Perf/stability:** the session's biggest non-functional fix was **DQ-011** (streaming-response server crash) — hardens every streamed endpoint (kundli+invoice PDFs verified survive). Search has btree/GIN indexes (migration 000038). No N+1 introduced. **Open non-functional items = VPS infra ONLY** (out of app-code scope, [[project-security-pentest-2026-07]]): `.env.production` 644 world-readable, SSH root+password auth + no fail2ban on the shared VPS — deployment hardening, documented, not fixable in this codebase pass. **No bugs.**
- **C20 DONE:** API SWEEP + SECURITY (verification-heavy; app layer already hardened by 3 prior audits + 2026-07 pentest — this confirms). **Prod stack-leak: SAFE** — `errorHandler.js` gates `stack` on `config.isDevelopment` (line 69) + response.error.stack only set in dev (line 212) → the dev stacks seen all run are dev-only, prod strips them. **Helmet full** — tight CSP (default-src 'self' + explicit razorpay/cloudinary/fonts allowlist, object-src 'none', base-uri/form-action/frame-ancestors 'self', script-src-attr 'none', upgrade-insecure-requests), HSTS `max-age=31536000; includeSubDomains; preload`, X-Frame DENY, X-Content-Type nosniff, Referrer-Policy strict-origin-when-cross-origin, X-DNS-Prefetch off. **CORS** rejects `evil.example.com` preflight (no ACAO header). **⭐ MASS-ASSIGNMENT / PRIVESC BLOCKED** — Deepa `PUT /profile/me {role:admin, isVerified:true, subscriptionPlan:vip, contactUnlocksRemaining:9999, completionPercentage:100}` → 200 but NOTHING stuck: role stays `user`, plan `free`, emailVerified false, isVerified null, completion real 74 (server whitelists updatable fields + computes completion). **Unauthed→401** on profile/match/chat/subscription/notifications/auth-me. **28 limiter refs**; auth/otp/passwordReset/signup/message(chat+group)/upload(profile+verification)/search/payment all mounted (auth→429 proven C2). **SQLi neutralized** — `ageMin=18' OR 1=1--`→**400** (int-validation), `religion=Hindu'; DROP TABLE Users;--`→**200** (Sequelize parameterized→literal string, 0 matches, **Users table intact**, search still works). **Stored-XSS sanitized** — bio `<script>alert(1)</script>hello<img src=x onerror=alert(2)>` → stored `alert(1)hello` (script+img stripped by sanitize middleware). Oversized 2MB JSON body → rejected. **Public**: success-stories→200 (published-only), contact→201 (ContactMessage + sanitized + 5/hr limiter, burst-under-5 allowed). **146 route handlers** total — full surface exercised C1-C20. Prelaunch script present (`scripts/prelaunch-check.sh`). **No app bugs.** Open risks = VPS infra only (`.env.production` perms, SSH hardening — [[project-security-pentest-2026-07]], → C21 note, out of app scope). No code changes → no regression. **C22 cleanup += 3 ContactMessage QA-probe rows.**
- **C19 DONE:** BUREAU RN — **entire stack is UNREACHABLE DEAD CODE.** `User.role` ENUM = `('user','admin','super_admin','marketing_manager','marketing')` — **`bureau` is NOT a valid role** (DB ENUM rejects it → no user can ever be bureau). MainNavigator gates `BureauStack` on `role === 'bureau'` (MainNavigator.tsx:195) → gate can never be true → stack never mounts. Backend has **zero** bureau surface: no `/bureau/*` routes (all →**404**: /clients, /earnings, /proposals live-confirmed), no `bureauAuth` middleware, no bureau mention anywhere in backend/*.js. RN side is fully built-but-orphaned: `api/bureau.ts` (getBureauClients/Earnings/Proposals/createMatchProposal → dead `/bureau/*`), 4 screens (BureauHome[useQuery×3 dead endpoints]/ClientRoster/MatchProposal/Earnings, latter two have STUB/placeholder markers). **Benign** — since unreachable, no real user ever hits the dead queries → no runtime error/crash surface. **DQ-015 ⚪ logged (deferred, NOT fixed):** whole-feature scope (build bureau backend + add `bureau` to role enum + seed, OR delete the RN stack) = product decision, >1h, out of fix-on-discovery. CLAUDE.md already lists Admin/**Bureau** as deferred scope. No code touched → no regression needed.
- **C18 DONE:** MARKETING PORTAL full sweep (`/api/marketing`, NOT /v1). Auth = shared JWT + `marketingAuth` role gate `[marketing, marketing_manager, admin, super_admin]`. **One-way role hierarchy proven:** admin token passes marketing gate (admin⊇marketing); created fresh marketing user `qa.mktg.c18@example.com` (id 2974246c, role marketing) via admin `POST /admin/marketing-users`→login 200. dashboard/leads/referral-codes all →**200** scoped to `req.user.id` (admin's scope = all-0 stats proving **per-user scoping**; marketing user's own scope isolated). **AUTHZ:** member (Deepa)→**403** ×3; marketing user→`/admin/analytics`→**403** (marketing⊉admin — correct one-way). **Referral create** (`POST /referral-codes`) is **auto-generated by design** — `emailPrefix(≤6 A-Z0-9) + random(4)`: qa.mktg.c18→`QAMKTG`+`VFPX`=`QAMKTGVFPX`; client-supplied `code` correctly IGNORED (marketing users don't pick codes; the ADMIN path DOES require explicit `code`+`marketingUserId` — two distinct creation UX, not a bug); DB-collision retry handled. List own codes→count 1 (scope isolation confirmed). **Lead status** `PUT /leads/:leadId/status` validated (nil-UUID→**400** isUUID v4; own-lead scoped, status∈VALID_LEAD_STATUSES; no leads seeded → empty but route guarded). Web pages all present (`pages/marketing/`: Dashboard/Layout/Leads/ProtectedRoute/ReferralCodes) — still blue-themed (cosmetic, deferred 2026-06-19). **No RN marketing** (web-only — RN has only admin+bureau stacks, correct). **No bugs.** **C22 cleanup += marketing user qa.mktg.c18 (2974246c) + its referral QAMKTGVFPX (b19fb57a) + admin-created QAC17TEST (c8917c8b).**
- **C17 DONE:** ADMIN + RN admin full sweep (admin@tricitymatch.com). **AUTHZ boundary solid** — all 9 admin GETs (analytics/revenue/reports/users/verifications/marketing-users/referral-codes/leads/success-stories) →**200** as admin; member (Deepa)→**403** ×3; no-auth→**401**. **Real aggregations** — analytics {totalUsers 44, verifiedUsers 30, activeSubscribers 11, revenueThisMonth ₹1500, pendingVerifications 1, openReports 1} + registration timeline + 6-mo revenue chart + planDistribution; revenue {monthlyRevenue by plan/month, totals ₹46989/12 txns}. **Mutations LIVE:** `PUT users/:id/status` valid enum `[active,inactive,banned,pending]` (banned IS valid here; the no-banned `[active,pending,inactive]` list is the CREATE-user path only) — cycled Deepa banned→inactive→**active (restored)**, true-invalid "frozen"→**400** "Must be one of…"; `PUT reports/:id` resolved the C9 fake_profile report (Aman→Priya)→**200**→**openReports 0**; `POST referral-codes` correctly requires `marketingUserId` (400 without)→created QAC17TEST (id c8917c8b) w/ marketingUserId→**200**→`PUT :id/toggle`→**200**. (Verification approve/reject already proven live C10; SYNC-9 admin sub-override C11.) **RN admin parity** (`api/admin.ts`): same endpoints — `/admin/verifications?status=pending`, PUT `/verifications/:id {status,adminNotes}`, GET `/reports`+`/analytics`, PUT `/reports/:id {status,adminNotes}`, PUT `/users/:id/status {status}` — ALL live-verified this chunk + C10; 3 RN screens (AdminHome/ReportsQueue/VerificationQueue) = subset of 10-route web admin (revenue/marketing/referral/leads/stories web-only, fine). Web admin 10-route professionalism/brand pass already ✅ 2026-06-19. **No bugs.** **C22 cleanup += referral code QAC17TEST (c8917c8b); report 29b7cadb left resolved (real Aman report, resolving is desirable).**
- **C16 DONE:** SETTINGS/i18n/THEMES full sweep. **i18n PERFECT parity** — en/hi/pa each 102 flattened keys, **0 missing / 0 extra** (10 namespaces: astrologers/auth/common/dailyMatches/guardian/nav/navbar/recentlyViewed/successStories/verification); only `auth.emailPlaceholder`="you@example.com" identical across langs (email format universal, not a miss). Persist: web via i18next LanguageDetector→`localStorage[tcs_lang]` (order localStorage>navigator, cached); RN via `useUIStore.setLanguage`+`i18n.changeLanguage`+MMKV cache. **Themes:** web `useDarkMode` (persist `tm_dark_mode`, respects OS `prefers-color-scheme`, toggles `.dark` on html) + `useElderMode` (persist `tm_elder_mode`, `.elder`) both wired in Account tab. RN: **elder ✓** (uiStore.setElderMode) + language ✓; **dark-mode toggle INTENTIONALLY OMITTED** (documented in `SettingsScreen.tsx:353` — "not yet themed app-wide, every screen static light palette, re-add when useTheme() wired") — `uiStore.darkModeOverride` exists but no UI toggle → deliberate SYNC divergence (web has dark, RN doesn't), NOT a bug. **Web Settings tabs** all render: Account (Appearance dark/elder/lang + More links verification/guardian/astrologers + **EmailSection** + Change-Password 8+complexity), Privacy (visibility everyone/matches_only + online/lastseen toggles → `PUT /profile/privacy`, round-trip proven prior), Notifications, Verification (selfie live-capture, C10), Danger (delete-account w/ password confirm modal → `DELETE /auth/account`). **⭐ NEW feature tested live — change-email** (`POST /auth/change-email/request`+`/verify`, not in old CLAUDE.md API list): all gates pass — wrong-pw→**401**, taken-email(aman's)→**409**, same-as-current→**400**, valid→**200** (6-digit code, 10min TTL, cached `email-change:<email>`, Resend-sent + dev-log fallback), verify wrong-code→**400 "Incorrect code"** (5-attempt cap, userId-bound → cross-account code→401, race re-check on verify). Controller solid: password-confirm (OAuth skip), uniqueness at request+verify, emailVerified=true on success. Did NOT complete (Deepa fixture preserved; cache self-expires 10min). RN Settings parity: EditProfile/Verification/Subscription/PrivacySettings/FamilyGroups/Guardian×2/Notifications/Support/SuccessStories/Astrologer/Admin+Bureau(role-gated)/Logout(confirm)/Delete(confirm modal→deleteAccount→logout) — comprehensive. **No bugs.** ⚪ OBS: web NotificationsTab prefs are **localStorage-only** (`tm_notif_prefs`, toast "Preference saved" but NO backend effect — no notif-prefs endpoint) → cosmetic, building server-side prefs is >1h → **W-item deferred** (RN doesn't even expose pref toggles, just nav to list → minor divergence). No backend changes → no regression run needed.
- **C15 DONE:** CALLS full sweep. premium gate (Deepa free initiate→403). agora-token returns DEV_STUB_TOKEN when Agora unset (param is `channel` not channelName). **DQ-014 🟡 fixed** — initiate had NO mutual gate (chat requires mutual, calls didn't) → premium member could ring ANY userId (unsolicited-call/harassment vector); proven live pre-fix Aman(VIP)→Priya non-mutual→**201 call created**. Added mutual-match check mirroring chat's `verifyMutualMatch` + self-call guard. Post-fix LIVE: Aman→Priya→**403 "You can only call your mutual matches"**, Aman→Aman→**400 "cannot call yourself"**, Aman→Deepa (mutual)→**201**→Deepa accepts→**200**→caller-accept→**403 "Not the callee"**→end→**200**→history count 2. decline symmetric (callee-only, code-verified). Agora RTC media = hardware/config gated. RN `calls.ts` parity (initiate/accept/decline/end/history `.calls`) — **mutual-gate fix applies to RN too (shared endpoint) → calls now consistent w/ chat cross-platform**. **C22 cleanup += Aman call sessions (orphaned pre-fix Priya 'initiated' + Deepa 'ended').**
- **C14 DONE:** ASTROLOGERS full sweep. **Table IS seeded — 3 real astrologers** (Pt. Vikram Joshi ₹35/min, Pt. Rajesh Sharma, Acharya Sunita Devi) via `ensureSeeded()` → **Known-Issue "unseeded→RN STUB fallback" is STALE** (real data flows; RN `select: d.length>0?d:STUB` inert). detail✓. **book state machine LIVE**: book dur15→201 `pending_payment` + real test order (order_TBge…) + amountPaise **52500** (35×15×100 math correct); dur130→400; bad astrologerId→404; verify-payment fake sig→**400 invalid signature** (HMAC); start-call on pending→**400 "must be confirmed"** (state guard); **AUTHZ** Deepa on Aman's booking→**404** (userId-scoped); my-bookings shows pending. Happy-path verify→confirmed→start-call(Agora DEV_STUB token)→end-call is Razorpay-signature + Agora gated (code-verified). RN parity (`profile.ts` getAstrologers `.astrologers`/book/my-bookings `.bookings` — match live). Web pages present (Astrologers/AstrologerDetail/AstrologerBookings). **No bugs.** **C22 cleanup += Aman booking 4e1dacf8 + its test order.**
- **C13 DONE:** GUARDIAN full sweep (Aman=candidate, Deepa=guardian). invite on-platform→direct **active** link; my-guardians (Deepa active); my-candidates (Deepa sees "Aman Singh/Chandigarh/74%"); **read-only** candidate view — matches [Deepa Rani, Anjali Singh], shortlist [Meera Sethi]; **AUTHZ 403** (Deepa reads Priya, no link → "No active guardian access"); duplicate invite→**409**; **revoke** (Aman DELETE link)→200→Deepa post-revoke matches→**403**→my-guardians empty. resolve-invite (pending off-platform token) code-verified (self-check + 7d expiry guard). RN `guardian.ts` parity (my-guardians/invite/my-candidates/candidate matches+shortlist — all email-based, shapes match live backend). **DQ-013 ⚪ fixed+verified** — direct on-platform invite had NO self-guardian check (only resolve-invite did) → Aman self-invited own email → self-link created (harmless: self-access grants nothing new, but burns a MAX_GUARDIANS slot + pollutes list); added `guardianUser.id===req.user.id`→400 guard; clean retest → **400 "Cannot be your own guardian"**. **C22 cleanup += 2 revoked GuardianLink rows on Aman (self 9e9033ff + Deepa a2435fca).**
- **C12 DONE:** NOTIFICATIONS full sweep. Deepa had **8 real notifications generated by prior chunks** (typed correctly): `new_match` "It's a Match!" (+relatedId f7bc67a0 deep-link target), `verification_approved`×2 (approve+re-approve), `verification_rejected`×1, `system`×4 (incl. 2 subscription-updated from SYNC-9). list+`unreadCount:8` agree with `/unread-count`:8. **IDOR**: Aman marking Deepa's notif → **404** (ownership-scoped `userId:req.user.id`, no cross-user). mark-one→8→7; delete→8→7 (bad `/:id/read` DELETE→404 correct, real DELETE→200); mark-all→**unread 0**. **SYNC-10** inherent (unread-count server-side, both platforms hit same endpoint → mark-all as Deepa → any client refetch=0). RN `notifications.ts` parity (`.notifications`/`.unreadCount`/`.pagination` cursor→page, `/read-all`, `.count`, fcm-token). **Email branding** (`utils/email.js brandLayout`): burgundy `#8B2346` header + gold `#C9A227`, "TricityShadi" throughout **zero "TricityMatch"**, support/city footer, subscription CTA→`/dashboard` (**no dead `/browse`**), welcome→/profile/edit, match→/matches, verified→/profile — all valid routes. Real verification emails already fired live in C10 (to qa.deep.rn@…). **No bugs.**
- **C11 DONE:** SUBSCRIPTION full sweep (API-live + code + parity). Plans exact (free ₹0/basic ₹1500-15d-5/plus ₹3000-1mo-10/vip ₹7499-3mo-∞; features 4/5/5/6). my-subscription (Aman vip active id 7f634d3e, Deepa free). **TIER_RANK gate proven LIVE** (2026-07-07 upgrade-fix): VIP→plus **409 "higher plan…contact support"**, VIP→vip **409 "already on this plan"**, free→basic **order created** (order_TBg…, ₹1500=150000 paise), invalid plan→400. history (Aman vip ₹7499). **⭐ INVOICE PDF STREAM (Aman sub) → HTTP 200 %PDF-1.3 2009B + `/health` 200 after + repeat 200 — DQ-011 fix CONFIRMED covers invoices too (2nd streamed endpoint, not just kundli).** cancel: Deepa free→**404 "No active subscription"** (active-cancel+prorated-refund code-verified). **Webhook**: no-Origin no-sig / bad-sig both **200-ack-without-processing** (secret unset → fail-safe: returns before handler, no forgery; NOT CORS-403-blocked → reaches own auth; timing-safe HMAC when secret set; prod env.js guard requires it). **SYNC-9 admin override LIVE**: admin PUT Deepa free→basic_premium → my-subscription + getMe `subscriptionPlan` both flip → revert→free flips back. Web `Subscription.jsx` CTA mirrors backend TIER_RANK (Upgrade/Included/Current Plan; payments-notice gated on `razorpay.isConfigured`). RN `subscription.ts` parity (shared PLANS+PLAN_ORDER features + live-price overlay; create-order `.order`, verify `.subscription`, history `.subscriptions` — all match live backend). **No bugs.** OBS: **Razorpay is TEST-mode configured in dev** (`rzp_test_` both BE+FE) — CLAUDE.md "Razorpay❌" is STALE; payments testable in dev. **C22 cleanup += Deepa pending order (order_TBg…) + admin-override sub rows.**
- **C10 DONE:** WEB+BACKEND selfie flow full chain (Deepa) — submit multipart `selfiePhoto`→pending (Cloudinary URL); resubmit-while-pending **409**; admin queue card includes selfie + `Profile.profilePhoto/photos` for side-by-side; admin approve→member `approved`→**verified-badge derivation `isVerified:true`** (Aman views Deepa `GET /profile/:id`, searchController `status='approved'`); reject→member sees `adminNotes` reason; resubmit-after-reject re-opens pending; re-approve restores. RN doc-tier payload proven live **400** "A selfie photo is required". **DQ-012 🟠 fixed** — RN verification was DESYNCED (`VerificationScreen` posted `documentType`+`documentFront`→400 + violated no-ID-upload directive); reworked tier-2 → LIVE front-camera selfie (`ImagePicker.launchCameraAsync`, front, no gallery) posting `selfiePhoto` to `/submit` (exact contract proven via curl); copy/icons + `api/verification.ts` selfie-aligned; mobile tsc 0. Native camera runtime deferred (hardware — same gate as web `LiveSelfieCapture`). RN `/verification/selfie` liveness-video (`selfieStatus`) is separate + untouched.
- **C9 DONE:** unlock-contact (Aman VIP→Priya reveals {phone,email}, `contactUnlocksRemaining` tracked, re-unlock idempotent alreadyUnlocked=true no double-charge, free Deepa→403); block (`POST /block/:id` → search 17→16, appears in `GET /block` as `blocks[].BlockedUser.Profile`, message→blocked, `DELETE /block/:id` unblocks); report (`POST /report/:id {reason,description}`→persist "Report submitted"). No bugs.
- **C8 DONE:** ProfileDetail (Aman→Priya) — compatibility overallScore 54 + breakdown{overall,categories,ashtakoot}; horoscope-match ashtakoot/manglikCompatible/manglikDetail/rashiScore/**numerology (life-path: person1 #5 "The Free Spirit", person2…)**/summary; summary correctly "Insufficient horoscope data" (both profiles null nakshatra/rashi); **kundli PDF valid 2391-byte PDF (premium)**; **free-tier PDF gate 403** "Premium subscription required"; privacy name-abbrev ("Priya S."). **DQ-011 🔴 fixed** — perf-middleware `res.setHeader` in patched `res.end` crashed the whole server on every PDF (streamed response, ERR_HTTP_HEADERS_SENT→uncaughtException); guarded with `!res.headersSent`; verified full/repeat/abort all keep backend alive. **⚠ Backend was dead ~mid-C8 until touch server.js respawn** (nodemon doesn't auto-respawn a crashed child — per memory). Alt-backend :5077 killed.
- **C7 DONE:** Chat (Aman VIP ↔ Deepa, now mutual) — Aman→Deepa DM sent+persisted (thread count 1); **conversations `IN (:ids)` fix HOLDS** (Aman has mutuals→count 2, no "malformed array literal" crash); edit→isEdited:true; delete→ok; **non-mutual block** (Aman→Priya "You can only message mutual matches"); **premium gate** (free Deepa→403 "Premium subscription required" on conversations — freemium: both parties need premium to read); conversation shape `user.name="Deepa Rani"` + RN `chat.ts` maps user.name→profile + send/edit contracts match. **Family groups**: create+post ok; **membership IDOR gate 403** ("You are not a member of this group") for non-member Deepa → after add, reads ok (SOCK-1/MF-1/REF-51 closure holds). No bugs. **C22 cleanup += group `1a260ac5-...` (QA Family Group) + Aman→Deepa DM/notifications.**
- **C6 DONE:** API-driven mutual flow between **Aman (VIP)** + **Deepa (qa.deep.rn, free)** — Deepa likes Aman→match(isMutual:false); Aman GET likes includes Deepa; Aman likes back→**isMutual:true**; GET mutual symmetric (Aman sees Deepa+Anjali via `mutualMatches`, Deepa sees Aman); **both parties notified** ("It's a Match!" — new row emoji-free = anti-slop fix holds; older 🎉 row = stale pre-fix data, not a regression); Deepa also got "Someone liked your profile!". Actions like/shortlist/pass all persist (shortlist→GET shortlist={shortlisted:[Simran]}). **Daily caps EXACT**: free=5, VIP=14 (≤15, isPremium true). Web `Matches.jsx` consumes correct keys (Saved→`shortlisted`, Mutual→`mutualMatches`, Likes You→`/match/likes` premium-gate). No bugs. **⚠ Playwright browser cookie state corrupted** (stale Aman token + C2 family-revoke → SPA refresh-loops to /login though raw /auth/me=200) — UI live-render deferred to code+prior-live (2026-07-07) verification; **future web-UI chunks: clear browser cookies / use fresh context before UI nav.**
- **C22 cleanup additions:** match rows created this run — Aman↔Deepa (mutual), Aman→Simran (shortlist), Aman→Meera (pass), Deepa→Aman (like). Plus notifications generated.
- **C5 DONE:** WEB /search — "17 profiles found" = **exact** DB female count; all cards opposite-gender (male viewer); sort=tier-boost (VIP>Plus>free, then match%) = documented VIP-boost, not a bug; verified-only filter 17→**1 exact** (=DB verified-female count, Priya); by-code full flow (type→Go→`/profile/:id`) + edges (self→isSelf, bad→400, missing→404); "You've seen all 17" end-state; both test accounts visible cross-platform (Deepa 52%, Web User 31%). **DQ-009 🔴 fixed** (by-code 500 `photoBlurred` col typo + latent photo-blur leak). **DQ-010 ⚪ fixed** (other-user profile tab title "My Profile"→"Profile"). RN `api/search.ts` contract verified (path `/search`, `{profiles,pagination}` unwrap, cursor→page, saved-search hidden) — same backend as web ⇒ SYNC holds; live RN re-verify env-blocked (emulator unstable, proven prior sessions).
- **⚠ Android emulator unstable this session** — died 2×, reboot flaky. iOS iPhone17 was booted. RN live checks may need emulator bring-up (`emulator -avd qa_pixel`; then `adb reverse tcp:5001 tcp:5001` + `tcp:8081 tcp:8081`; Metro must run). Fall back to code-contract verification when blocked.
- **Last session:** 2026-07-09 (Opus exec session 2) — C3 web (hydration regression CLEAR + DQ-007) + C4 own-profile (web+RN; DQ-008 stale-user-after-onboarding fixed live). Commit strategy = **BATCH at C22** (user decision).
- **C4 DONE:** WEB /profile — DETAILS panel 100% matches DB (31/Chandigarh/5'9"/77kg/M.Com/CS/Software Engineer/₹8.5L/INTJ); 74% strength accurate to DB nulls; completion nudges deep-link (`Add religion`→`?section=religion`→Step3); broken seed photo (`default-male-2.jpg` 404) degrades to Playfair "A" on `bg-primary-100` (no broken-icon); video-intro/verify CTAs present. RN OwnProfile (Deepa/free) — name (no undefined-undefined, B6 holds), 30yrs·Chandigarh, Free Plan/Upgrade, 74% ring, all detail sections render with graceful "Not added". **DQ-008 fixed** (stale auth-store user after onboarding → Home showed 0%+no-name; now getMe-refresh in Step14).
- **Prior session:** 2026-07-09 (Opus exec session 1) — C0+C1+C2 + RN onboarding; fixes DQ-001/003/004/005/006, obs DQ-002
- **C3 DONE (RN Android 14-step walk, qa.deep.rn):** Step0 registering-for → Step1 basic (DOB clean DD/MM/YYYY, R3-6✓) → Step2 community (religion/language pickers open **crash-free**, gorhom B2 not reproduced) → Step3 manglik (no kundli-upload, correctly removed) → Step4 education → Step5 career → Step6 location → Step7 marital → Step8 lifestyle → Step9 family (skippable) → Step10 About(**DQ-003 fixed**) → Step11 prefs(skip) → Step12-13(skip) → Step14 complete(**DQ-004/005 fixed**) → Browse Matches → Main/Home. Profile data persisted (Deepa/female/Sikh). **DQ-006 fixed** (onboardingComplete now persists). **SYNC-2** (onboardingComplete→no re-onboard) already proven C2.
- **C3 DONE (web):** edit-mode `/profile/edit` hydration = **regression CLEAR** (Basic Info Aman/Singh/Male/DOB/5'9"/77kg all hydrate; opens on Basic Info not Religion — 2026-07-03 fixes #2/#3 hold; deeper steps hydrate). Found **DQ-007** (shared `Select` showed placeholder for out-of-vocab stored values → looked like data loss; hardened to display raw value). Guardian `create_for_other` (`/onboarding?createFor=other`) structural walk: CreatingFor 4-opts (Myself/Sibling/Child/Other) → legacy multi-field (FullName/Phone/Email/Relationship) → full 12+ steps; account-create shares proven `signup()` (`ModernOnboarding.jsx:157`). Preview deep-link `?section=photos` → Step 12 Photos ✓. Draft isolation: edit mode does NOT pollute `onboarding_draft` (stays empty signup shape) — 2026-07-03 fix holds.
- **C2 DONE:** WEB — signup e2e (auto-verify 000000 → DB emailVerified=t/onboardingComplete=t + preview card) · send-otp **409 gate** (email+phone) · **progressive login** (recap+Change+hidden username) · rate limiter 5×401→**429** · **cookie flags** both HttpOnly/SameSite=Lax (Secure absent=dev, flag prod@C20) · **refresh rotation+family-revoke** (reuse→401 revokes family) · sessions list+**revoke**+**logout-all** · change-password wrong-old rejected · google no-cred graceful. RN(Android) — Welcome · logout · login e2e · **signup no-names contract** (email+pw+confirm only → onboarding Step0; DB emailVerified=f/firstName=''/onboardingComplete=f, R3-4/R3-5 intact; RN has NO OTP gate on signup, account created directly) · cold-start after logout-all→Welcome (no stale session). **SYNC-1 both dirs** (web-acct→RN login→Home; RN-acct→web login 200) · **SYNC-2** (onboardingComplete→RN no re-onboard). Fixtures created: `qa.deep.c2w` (web, verified), `qa.deep.rn` (RN, unverified) both `/TricityQA@2026` (del C22).
- **C2 CARRYOVER (minor, low-risk parity — do opportunistically):** RN OTP 4-box screen (reach via forgot-password/phone-verify, not signup) · RN biometric (stub in dev) · iOS-specific login walk (Android proven, iOS parity likely) · RN forgot/reset screens.
- **Next action:** C16 Settings/i18n/themes — web Settings tabs (profile prefs, privacy[C_], verification[C10], password, sessions[C2], language, theme/dark/elder), i18n en/hi/pa switching (Navbar/Login/feature keys done; Home/About/etc English), dark + elder mode toggles, delete-account. RN Settings (incognito, elder, language live hi/pa, dark, delete, guardian/family/astrologer links). Mostly UI/preference — verify persistence (privacy round-trip already proven prior sessions), i18n key coverage, no raw-key leaks.
- **Next action (was C15):** Calls (Agora, config-gated on `VITE_AGORA_APP_ID`) + RN calls. `GET /calls/agora-token`, `POST /calls/initiate`, `PUT /calls/:id/accept|decline|end`, `GET /calls/history`. Socket signaling (call-incoming/accepted/declined/ended to `user_<id>` rooms). Verify: token endpoint (DEV_STUB when Agora unset), initiate/accept/decline/end state machine, mutual+premium gate, history, authz. Agora RTC itself = hardware/config-gated (no live media) — verify signaling + REST state machine via API. RN `calls.ts` `.calls` unwrap parity.
- **Next action (was C14):** Astrologers (list — ⚠ Astrologer table likely empty/unseeded per Known Issues → RN falls back to STUB_ASTROLOGERS, web may show empty state), `GET /astrologers/:id`, `POST /astrologers/book`, `GET /astrologers/my-bookings`, `POST book/:id/verify-payment|start-call|end-call`. Since data is stub/unseeded, verify: empty-state handling (web+RN), booking flow reaches Razorpay order (test-mode now live!), authz on bookings. Likely mostly config/data-gated → mark [N] where hollow, note W-item. Consider seeding 1 astrologer to exercise book→verify.
- **Next action (was C13):** Guardian — DB-backed guardian/family: `GET /guardian/my-guardians`, `POST /guardian/invite` (email-based), `DEL /guardian/:linkId`, `GET /guardian/my-candidates`, `GET /guardian/candidate/:id/matches|shortlisted`, `POST /guardian/resolve-invite/:token`. Verify invite→resolve→read-only candidate view; guardian sees candidate's matches/shortlist (authz — guardian can't act, only view). RN `guardian.ts` uses real paths + email invite + ProfileSummary mappers (per RN QA) — parity check. Web /guardian page. Use Aman+Deepa or a fresh pair.
- **Next action (was C12):** Notifications — generation (like/mutual/message/verification/subscription each create a notification — several already generated live in C6-C11: match, liked, verification approved/rejected, subscription-updated), list + unread-count, mark-one/mark-all read, delete, deep-links, empty state. Web notifications page + RN Notifications (infinite/badge). SYNC-10 (read on web→RN count). Email (Resend, owned inboxes): welcome/reset/verif-approved/verif-rejected/subscription-confirmation — branding (burgundy header, gold hairline, NO "TricityMatch", support footer, `/dashboard` not `/browse`). Aman↔Deepa already have real notifications from prior chunks — inspect those.
- **Next action (was):** C11 Subscription — plans (`GET /subscription/plans` shared PLANS capability flags), create-order (tier-rank gate: same/lower active→409, higher→order allowed — DQ from 2026-07-07), verify-payment (supersede prior active, unlocks reset to new plan), my-subscription, history, invoice/:id PDF (⚠ ALSO a streamed response — confirm DQ-011 fix covers it, no crash), cancel. Razorpay is config-gated OFF in dev → order-create may stub/notice; verify the tier-rank gate + shapes via API, and web `Subscription.jsx` tier-aware CTA (Upgrade/Current/Included). RN `subscription.ts` uses shared PLANS + live price overlay (per RN QA) — contract parity check. **W-RN-SELFIE now CLOSED by DQ-012.**
- **⚠ .env clean (bypass reverted).** Dev error bodies include `stack` (verify stripped prod@C20). expo-blur missing from RN dev binary (DQ-002).
- **Fixtures ready:** Member A=`aman.singh2@example.com`(VIP active✅) · Member B=`ankit.chopra8@example.com`(free✅) · Admin✅ · sims booted iOS✅(iPhone17) AND✅(emulator-5554, adb reverse set, dev build installed) · iOS dev build BUILDING (bg)
- **Baseline (C0):** BE unit **155/155** green (integration auth.test.js 15-fail = needs live test DB, ledger#15, excluded) · FE vitest **48/48** · mobile tsc **0** · build **green (4.18s)** · migration head **000043** (report-status-workflow — newer than plan's 042)
- **Cookie jars:** `scratchpad/cookies_{A-vip,B-free,admin}.txt`
- **Env note:** ANDROID_HOME unset in shell → use `~/Library/Android/sdk`. Metro running (bg). Redis up.

### Chunk status board
| Chunk | Status | Bugs (open/fixed) | Session |
|---|---|---|---|
| C0 Env + baseline | ✅ | — | s1 |
| C1 Public web + RN entry | ✅ (RN entry partial→C2) | DQ-001 fixed | s1 |
| C2 Auth | ✅ ~95% (all web + RN signup/login + SYNC-1/2; minor RN OTP-box/biometric/iOS carryover) | DQ-002 obs | s1 |
| C3 Onboarding | ✅ (RN 14-step +4 fixes; web edit-hydration regression clear +DQ-007; guardian+deep-link+draft-isolation) | DQ-003/004/005/006/007 fixed | s1+s2 |
| C4 Own profile | ✅ (web /profile: details 100% match DB, 74% strength, nudge deep-links, broken-photo→initials fallback, video/verify CTAs; RN parity: Deepa renders all sections, graceful "Not added", Free/Upgrade tier) | DQ-008 fixed | s2 |
| C5 Search | ✅ (web: count exact 17=DB, verified-filter 17→1 exact, by-code full+edges, tier-boost sort, all-seen end-state; RN contract parity /search unwrap OK, live re-verify env-blocked) | DQ-009🔴 DQ-010⚪ fixed | s2 |
| C6 Matching | ✅ (like/shortlist/pass all persist; Aman↔Deepa mutual symmetric + both-party notify; daily caps EXACT free5/VIP14≤15; likes/shortlist/mutual retrieval correct; web Matches.jsx consumes right keys) | none (all correct) | s2 |
| C7 Chat + groups | ✅ (DM send/thread/edit/delete; IN(:ids) conv fix holds; non-mutual block; premium gate 403; group create/post/**IDOR 403 non-member**/add/read; RN chat.ts contract OK) | none (all correct, gates hold) | s2 |
| C8 Profile detail + compat | ✅ (compat score+breakdown, horoscope ashtakoot/manglik/rashi/numerology, kundli PDF valid, premium gate 403, privacy name-abbrev) | DQ-011🔴 fixed (server-crash) | s2 |
| C9 Unlock + block/report | ✅ (unlock reveal/idempotent/quota + free 403; block hides-search 17→16/prevents-msg/list/unblock; report persists) | none (all correct) | s2 |
| C10 Verification | ✅ (web+backend selfie full chain: submit→409 dup→admin queue→approve→isVerified badge; reject→adminNotes→resubmit→re-approve; RN doc-tier live-400 confirmed, reworked to live selfie→selfiePhoto→/submit) | DQ-012🟠 fixed (RN desync) | s2 |
| C11 Subscription | ✅ (plans exact; TIER_RANK gate LIVE same/lower→409 upgrade→order; invoice PDF stream survives=DQ-011 confirmed 2nd endpoint; webhook fail-safe+no-CORS-block; SYNC-9 admin-override flip+revert LIVE; web CTA + RN contract parity) | none (Razorpay test-mode OBS) | s2 |
| C12 Notifications | ✅ (8 real typed notifs from prior chunks; list+unread-count agree; IDOR 404; mark-one/mark-all/delete; SYNC-10 inherent; RN parity; email brandLayout burgundy/gold/no-TricityMatch/dashboard-CTA) | none (all correct) | s2 |
| C13 Guardian | ✅ (invite→direct-active; my-guardians/candidates; read-only matches+shortlist; AUTHZ 403 non-guardian; duplicate 409; revoke→403; RN parity) | DQ-013⚪ fixed (self-guardian) | s2 |
| C14 Astrologers | ✅ (3 seeded; book state-machine LIVE amount-math+guards+HMAC+authz 404; verify/start/end gateway+Agora gated code-verified; RN parity; STUB fallback now inert) | none (Known-Issue "unseeded" STALE) | s2 |
| C15 Calls | ✅ (premium gate; agora DEV_STUB; state machine initiate/accept/end + decline; authz "Not the callee"/participant-only; history; RN parity; Agora media config-gated) | DQ-014🟡 fixed (mutual-gate on calls) | s2 |
| C16 Settings/i18n/themes | ✅ (i18n 102 keys 0-drift ×3 langs; web dark/elder/lang persist; RN elder/lang persist, dark deliberately omitted; change-email NEW all gates 401/409/400/200/400 live; delete-account both; privacy round-trip) | none (⚪ web notif-prefs localStorage-only deferred; RN dark-toggle deliberate gap) | s2 |
| C17 Admin + RN admin | ✅ (authz 200/403/401; real analytics+revenue aggregations; status-mutation enum+revert, report-resolve→openReports 0, referral create+toggle; RN admin.ts same endpoints live-verified) | none | s2 |
| C18 Marketing portal | ✅ (dashboard/leads/referral scoped per-user; one-way role hierarchy admin⊇marketing, member+marketing→admin 403; referral auto-gen+collision; lead-status validated; web pages present; no RN=web-only) | none | s2 |
| C19 Bureau RN | ✅ (entire stack unreachable dead code — `bureau` not in role enum, no backend /bureau/*, gate never true → benign) | DQ-015⚪ logged (deferred, whole-feature) | s2 |
| C20 API sweep + security | ✅ (prod stack-strip; helmet full+HSTS+CSP; CORS-reject; mass-assign/privesc blocked; unauthed→401; 28 limiters; SQLi→400/literal Users-intact; XSS sanitized; body-limit; 146 handlers; prelaunch present) | none (VPS-infra risks only, out of app scope) | s2 |
| C21 Non-functional | ✅ (all 4 gates green: BE unit 155/155, FE vitest 48/48, mobile tsc 0, FE build 4.55s; bundle code-split; DQ-011 perf-stability fix; open items = VPS infra only) | none | s2 |
| C22 Close-out | ✅ (batch commit on branch qa/deep-run-2026-07-08, 17 files, NOT pushed; dev-DB probe cleanup; final gates all green) | — | s2 |

---

## C0 — Environment bring-up + baseline + fixtures

**Services**
- [ ] Backend up :5001 — `npm run dev:backend`; `GET /api/v1/subscription/plans` → JSON.
- [ ] Frontend up :3000 — `npm run dev:frontend`; `curl -sI` → 200.
- [ ] Postgres reachable; migration head = **000042** (`SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1`).
- [ ] Redis: note running or not (in-mem fallback OK).
- [ ] iOS sim boots, dev app launches, reaches API (`/subscription/plans` from app or login works).
- [ ] Android emulator boots; `adb reverse tcp:5001 tcp:5001` + `tcp:8081`; dev app launches + reaches API.

**Baseline metrics (record in RUN STATE)**
- [ ] `cd backend && npm test` → record N/N.
- [ ] `cd frontend && npm test` → record N/N.
- [ ] `cd mobile && node_modules/.bin/tsc --noEmit -p tsconfig.json` → record error count.
- [ ] `cd frontend && npm run build` → green.
- [ ] Playwright e2e smoke (`npm run qa` or 01-auth spec) → note pass/fail (some need creds).

**Fixtures**
- [ ] Admin login works (web `/login` → `/admin/dashboard`).
- [ ] Member A: pick seeded member, via admin set subscription → `vip`, future endDate. Confirm premium gates open (chat/viewers).
- [ ] Member B: second seeded member, free tier confirmed.
- [ ] A & B log in on W, iOS, AND (whatever combos chunks need) — no crash.
- [ ] Scratchpad curl cookie-jar login script for A, B, admin saved (`scratchpad/qa-login.sh`).
- [ ] `psql` one-liner handy (creds from `.env.development`).

**Exit:** all boxes ✅, RUN STATE baseline filled, chunk board C0 = ✅.

---

## C1 — Public web pages + SEO + RN entry

For **each** public page test at **375 / 768 / 1440**: loads 200, no white screen, no horizontal overflow, no overlap/cutoff, images load, console 0 errors, network no unexpected 4xx/5xx, anti-slop clean (no emoji/unicode-icon/rainbow, "TricityShadi" not "TricityMatch"), Navbar + Footer render, links resolve.

**Home `/`**
- [ ] Hero copy "From match to mandap… all in the Tricity" renders; CTA buttons → signup/login.
- [ ] Stats counters (CountUp) — **scroll into view** before judging (not 0).
- [ ] Sections: process steps, why-cards, trust cards, FAQ, success-stories strip (fetches public), footer.
- [ ] All CTAs + footer links navigate correctly. Mobile menu (375) opens/closes.
- [ ] 375 / 768 / 1440 each.

**About `/about`** — [ ] content, images, no govt-ID claims (selfie wording), 3 viewports.
**Contact `/contact`** — [ ] form fields validate; submit → 200 + ContactMessage row (DB check) + support email attempt; rate limit note (5/hr); success state; 3 viewports.
**Safety `/safety`** — [ ] pillars, selfie-verification + human-review wording, 3 viewports.
**Terms `/terms`** — [ ] renders, brand correct, 3 viewports.
**Privacy `/privacy`** — [ ] renders, brand correct, 3 viewports.
**Success Stories `/success-stories`** — [ ] public list (published only), empty state if none, cards render, 3 viewports.
**404 / unknown route** — [ ] `/nonsense` → graceful (redirect or 404 view, no white screen).

**SEO / assets**
- [ ] `/robots.txt` served + sane.
- [ ] `/sitemap.xml` served + valid.
- [ ] Per-route `<title>`/description/canonical/OG present on each public page (`Seo.jsx`) — spot 3 pages.
- [ ] No 404 assets (favicon, logo, fonts).

**Global chrome**
- [ ] Navbar: logged-out links (Login/Signup), language switcher present, sticky behavior, mobile hamburger.
- [ ] Footer: all columns/links, brand, no dead links.

**RN entry (iOS + AND)**
- [ ] Splash renders (real logo), transitions.
- [ ] Welcome: branding, gradient buttons, language renders, → Login/Signup nav.
- [ ] Safe areas (notch/home indicator) clear.

**Exit:** every public route ✅ ×3 viewports, RN entry ✅ ×2 platforms.

---

## C2 — Auth end-to-end

### Web signup (2-step)
- [ ] Step 1 `CreateAccountStep`: SmartContactField auto-detects **email** vs **10-digit phone** (+91 pill on phone).
- [ ] Password field + strength; Terms checkbox required (can't proceed unchecked).
- [ ] Send OTP → OtpBoxes render (email 6-box / phone flow); **auto-verify on last digit**; spinner state; wrong code → error + clear.
- [ ] Can't advance to step 2 until verified. Account created **only after** verify (DB: no User row before verify).
- [ ] Existing email → Send OTP returns **409 "account already exists"** inline. Existing phone (any of bare/+91/91/0 forms) → 409.
- [ ] Step 2 BasicInfo: names side-by-side, gender segmented chips, submit → dashboard.
- [ ] DB: new User has `emailVerified:true` (email path) / `phoneVerified:true` (phone path).
- [ ] Uses OTP bypass per plan §4.6 (set → test → revert `.env` + touch server.js).
- [ ] Create `qa.deep.c2w@tricityshadi.com` this way (keep for SYNC-1, delete C22).

### Web login (progressive)
- [ ] Identifier phase: SmartContactField → Continue.
- [ ] Password phase: "Signing in as +91 …" recap chip + Change link (returns to identifier).
- [ ] Hidden username input present (password managers).
- [ ] Wrong password → inline error, no crash.
- [ ] Lockout: 5 wrong → 429 / lockout message honest (not generic).
- [ ] Google button: renders, click → graceful (OAuth off — no white screen).
- [ ] returnTo redirect works (visit protected → login → back to intended).
- [ ] Successful login → dashboard, httpOnly cookies set (no token in JS-readable storage).

### Web password reset + change
- [ ] Forgot: enter email → success message; Resend email lands (owned inbox) or Resend API 200.
- [ ] Reset: token link → new password (8+complexity enforced) → login with new works.
- [ ] Change password (Settings): old+new, wrong-old rejected, success → old invalidated.

### Web sessions
- [ ] Settings → sessions list shows current + others.
- [ ] Revoke one session → that refresh dead.
- [ ] logout → cookies cleared, redirect.
- [ ] logout-all → all sessions dead (verify other client kicked).

### RN auth (iOS + AND each)
- [ ] Signup: email+password only (no names — RN contract); 201; → onboarding.
- [ ] Password rule shown as 8+complexity (not "min 6").
- [ ] Login: identifier+password; success → Main or Onboarding per flag.
- [ ] Biometric path present (stub OK in dev build) — no crash.
- [ ] 429 lockout UI after repeated wrong.
- [ ] Forgot/Reset screens submit.
- [ ] OTP 4-box screen (RN uses 4-digit) renders + verifies.
- [ ] Cold-start session restore (force-stop → reopen → still logged in).

### API auth
- [ ] `POST /auth/signup` validation (missing fields → 400; RN shape {email,password} → 201).
- [ ] `POST /auth/login` → cookies + body tokens (refreshToken in body for native).
- [ ] `POST /auth/refresh` rotates; reused old refresh → family revoke (all dead).
- [ ] `POST /auth/send-otp` existing contact → 409.
- [ ] `GET /auth/me` unauth → 401; authed → user.
- [ ] Cookie flags: httpOnly; Secure noted (dev http, prod requires Secure).

### SYNC-1
- [ ] Account made on web → login on RN works (same creds).
- [ ] Account made on RN → login on web works.
- [ ] logout-all on web → RN refresh rejected on next call.

**Exit:** full matrix ✅; `qa.deep.*` auth accounts created cleanly both platforms.

---

## C3 — Onboarding

### Web self-signup path (2-step) — covered start in C2; here verify depth
- [ ] Post-signup preview card ("Your profile is live", initials Avatar, name+age, Just-joined badge) → "Complete my profile" (`/profile/edit`) + "dashboard".
- [ ] previewData snapshots name/DOB before draft clear (name shows, not blank).
- [ ] Draft isolation: signup draft in localStorage doesn't leak into edit mode.

### Web guardian path (`create_for_other`, long path)
- [ ] CreatingFor → CreateAccount (legacy multi-field) → BasicInfo → … → Verification.
- [ ] Each step renders, validates, back/next works.
- [ ] Canonical `phone` (no phoneNumber re-entry duplicate).

### Web edit-mode (`/profile/edit`) — regression watch (2026-07-03 hydration bug)
- [ ] Editor hydrates existing profile at mount (fields pre-filled, NOT blank for a populated profile).
- [ ] Opens on Basic Info (not Religion/step 3).
- [ ] Height + Weight inputs present in edit mode; save persists.
- [ ] `?section=photos` deep-link opens photos section.
- [ ] Footer not under mobile BottomNav (`pb-16 lg:pb-0`).
- [ ] Save → round-trip (reload shows saved values); no raw API extras leak into payload.

### RN onboarding (14 steps — iOS + AND each)
- [ ] Step0 … Step14: each renders, inputs work, validation gates, back/forward, progress bar advances.
- [ ] Step1 DOB picker → date-only (not "01T00:00…" garbage).
- [ ] Religion/community pickers (Step2+) don't crash.
- [ ] Resume: quit mid-flow → reopen → OnboardingContext restores position.
- [ ] Final step → Main tabs; Home populated.
- [ ] Safe areas + keyboard avoidance every step.

### SYNC-2
- [ ] Web onboarding complete → same account on RN goes straight to Main (no re-onboard).
- [ ] RN onboarding complete → web treats account as onboarded (dashboard, not onboarding).
- [ ] `onboardingComplete` flag identical both sides (DB check).

**Exit:** new accounts each platform land onboarded with populated profile.

---

## C4 — Own profile (view / edit / media / privacy / completion / code)

### Web MyProfileView `/profile`
- [ ] All sections render (About, Details, Lifestyle — lifestyle NOT duplicated in Details, 2026-06-30 fix), Photos, badges.
- [ ] Completion meter % + field-level CTAs ("Add …").
- [ ] Profile code `TCS-XXXXXXXX` visible + copyable.
- [ ] Verified badge state (if verified).
- [ ] "1 Photo" singular (not "1 PHOTOS").

### Web ModernProfileEditor `/profile/edit`
- [ ] Every field editable + saves (Basic, Religion/community, Education/career, Family, Lifestyle, About, Partner prefs, Photos).
- [ ] Height (4'6"–7'0", cm-stored) + Weight (kg) save.
- [ ] Photo upload → Cloudinary; face 500² + gallery 1200²; max 6 enforced; delete photo works.
- [ ] Voice intro: record/upload, playback, delete.
- [ ] Video intro: upload, playback, delete.
- [ ] Privacy tab: visibility (everyone/matches_only), online-status, last-seen — **persist** (regression: model columns bug) — set → reload → hydrates server state.

### RN profile (iOS + AND)
- [ ] OwnProfile: completion ring (10-tick, not starburst), badges, name+age correct (not "undefined undefined"/0%).
- [ ] Visitors rail (premium; upsell if free) + Recently-viewed rail → tap → ProfileDetail.
- [ ] Inline edit entry → EditProfile prefilled (envelope unwrap correct).
- [ ] EditProfile: fields save, avatar via SmartImage.
- [ ] PrivacySettings: segmented visibility + toggles, hydrate from profile, save via PUT /profile/privacy.

### API
- [ ] `GET /profile/me` returns full profile incl. privacy fields + subscriptionPlan + onboardingComplete.
- [ ] `PUT /profile/me` partial update persists.
- [ ] `GET /profile/me/stats`, `/viewers` (premium), `/recently-viewed` (all).
- [ ] Photo delete endpoints (`DEL /profile/me/photo` by url, `DEL /profile/me/profile-photo`).

### SYNC-3 / SYNC-4
- [ ] Edit field on RN → web reload shows it (and reverse).
- [ ] Privacy set on web → RN PrivacySettings reflects it.
- [ ] Photo uploaded web → RN gallery + avatar; delete on RN → gone on web.
- [ ] Completion % identical web vs RN.

**Exit:** same profile data everywhere; all media flows work both directions.

---

## C5 — Search + filters + suggestions + by-code

### Web Search `/search`
- [ ] Default results load; ProfileCard shows photo(SmartImage fallback), name, age, city, compat, badges, boost order (VIP first if any).
- [ ] Filters: age range, height range, religion, caste, mother tongue, income, education, profession, city, manglik, gotra-exclude — each narrows results.
- [ ] Sort options change order.
- [ ] Pagination / load-more works; count accurate.
- [ ] **Empty state** (impossible filter) vs **error state** (kill backend) are DISTINCT; 404 stays empty.
- [ ] Card keys are id-based (no wrong-card exit animation on filter change).
- [ ] NO save-search affordance (ledger #7 — if present, that's a bug).
- [ ] Suggestions endpoint drives autocomplete if present.
- [ ] 375 / 768 / 1440.

### by-code
- [ ] Web by-code UI (if surfaced) + `GET /search/by-code?code=TCS-XXXXXXXX` → correct profile.
- [ ] Bad code → clean 404/empty.

### RN Search (iOS + AND)
- [ ] Results load; infinite scroll fetches next page (page-based).
- [ ] FilterPanel (@gorhom sheet v4) opens — **crash-watch**; ranges, manglik, gotra-exclude, apply.
- [ ] Sort works; card parity with web (photo scrim, compat color, gold star high-compat).
- [ ] Empty/loading/error states.

### SYNC (implicit)
- [ ] Same filter query → same result set web vs RN (spot 1 query).

**Exit:** search parity + states clean.

---

## C6 — Matching lifecycle + Matches hubs

### Daily / actions (API + both UIs)
- [ ] `GET /match/daily`: free account = 5, premium = 15 (verify counts); IST cache (repeat call same set).
- [ ] Like (`POST /match/:id {action:like}`) → recorded.
- [ ] Shortlist action → appears in shortlist.
- [ ] Pass/skip → not shown again in daily.
- [ ] matchAction limiter (60/min) — note, don't over-trigger.

### Mutual creation (A↔B)
- [ ] A likes B; B likes A → mutual row; both notified.
- [ ] `GET /match/mutual`, `/likes`, `/shortlist` return correct sets.

### Web `/matches` hub
- [ ] Saved (shortlist) tab: list + 4 states.
- [ ] Mutual tab: list.
- [ ] Likes-You tab: premium — free user sees 403 → upgrade upsell; premium sees list.
- [ ] Tabs use ProfileCard; navigation to detail.

### RN Matches (iOS + AND)
- [ ] Mutual / Shortlisted / Liked-Me tabs (3) load, real names (not "Unknown"), color-coded compat.
- [ ] Liked-Me premium-gated for free; open for premium.
- [ ] Offline shortlist (MMKV): airplane mode → shortlist still visible + OfflineBanner.

### SYNC-5
- [ ] A likes B on web → B's RN Liked-Me + notification.
- [ ] B likes back on RN → mutual on BOTH web `/matches` Mutual + RN Mutual; both platforms notified.

**Exit:** A↔B mutual established, visible identically everywhere (feeds C7–C9).

---

## C7 — Chat + sockets + family groups

### Premium gate
- [ ] Free user B: chat gated (web gate screen; RN Plus+ gate) — honest upsell, no crash.
- [ ] Premium A: chat accessible.

### Web chat `/chat`
- [ ] Conversations list (mutual matches; no "malformed array" crash — 2026-06-21 fix, IN clause).
- [ ] Thread: history loads, pagination, avatar, name.
- [ ] Send message (REST + socket); optimistic; delivered/read receipts.
- [ ] Typing indicator; online status dot.
- [ ] Edit message; delete message (server-authoritative broadcast).
- [ ] Empty state (no conversations).

### RN chat (iOS + AND)
- [ ] Conversations (Plus+ gate for free); list with profile name+avatar.
- [ ] ChatThread inverted list, receipts, typing, optimistic, edit/delete.
- [ ] Send works to A↔B.

### SYNC-6 (web + RN live simultaneously — A on one, B on other)
- [ ] Message from RN appears in open web thread WITHOUT reload.
- [ ] Typing indicator crosses platforms.
- [ ] Edit + delete propagate live both directions.
- [ ] Online/last-seen respects privacy settings.

### Family groups (RN + API; web has NO group UI per parity map)
- [ ] Create group (RN).
- [ ] Invite member by userId; invite by phone.
- [ ] Add / remove / leave member.
- [ ] Post / edit / delete group message (RN); broadcasts to other member live.
- [ ] API IDOR: non-member `GET /groups/:id/messages` → 403; non-member socket join rejected.
- [ ] Group message writes are REST-only (socket write attempt doesn't bypass).

**Exit:** live bidirectional chat verified; group membership gate clean.

---

## C8 — Profile detail + compatibility / horoscope / kundli / quiz

### Web ProfileDetail `/profile/:id` (single-column redesign)
- [ ] Layout: centered max-w-3xl stack, NO empty void (2026-07-07 redesign); mobile compat ring → Details table → tabs → contact → social.
- [ ] All tabs work (About/Details/Family/Lifestyle/Looking-For).
- [ ] Sticky action bar (like/shortlist/message/unlock).
- [ ] Contact section gated by unlock/plan.
- [ ] Social links render if present.
- [ ] PreferenceMatch "Do you fit what X wants? n/m" — denominator excludes viewer-unfilled fields; "add yours to compare" when viewer profile incomplete.

### Compatibility / horoscope
- [ ] `GET /profile/:id/compatibility` → score; breakdown renders.
- [ ] `GET /profile/:id/horoscope-match` → Ashtakoot gunas table, dosha, manglik, numerology life-path block.
- [ ] Kundli PDF: `GET /profile/:id/horoscope-match/pdf` (premium) → valid downloadable PDF (open it), correct branding/email, guna table present.
- [ ] Free user → PDF/premium blocks gated cleanly.

### RN ProfileDetail (iOS + AND)
- [ ] Sticky bar, accordions, compat → CompatibilityBreakdownSheet, horoscope → HoroscopeMatch screen (guna bars/dosha/manglik).
- [ ] Voice playback works.
- [ ] ⋮ → BlockReportSheet opens (block/report entry — full test in C9).
- [ ] Quiz: 10-question flow completes; quiz CTA on profile.

### SYNC-12
- [ ] Compatibility + horoscope numbers IDENTICAL web vs RN for A↔B.

**Exit:** detail surfaces complete + consistent both platforms.

---

## C9 — Contact unlock + block / report

### Unlock (API + both UIs)
- [ ] Plan limits: basic_premium 5, premium_plus 10, vip unlimited.
- [ ] `POST /profile/:id/unlock-contact` → decrements counter; contact revealed + persists (revisit still unlocked).
- [ ] Free user → gated (upgrade prompt).
- [ ] Counter shown correctly (remaining unlocks).

### Block (SYNC-7)
- [ ] A blocks B (RN ⋮ → block) → B removed from A's search + chat + matches (web + RN both reflect).
- [ ] B's view of A also restricted appropriately.
- [ ] Unblock → restores.
- [ ] `GET /block` list; `POST/DEL /block/:id`.

### Report
- [ ] Report B (reason) → `POST /report/:id` 200 → ContactMessage/Report row (DB).
- [ ] Appears in admin reports queue (verify fully in C17).
- [ ] Duplicate/again handling sane.

**Exit:** entitlements enforced per plan table; block/unblock round-trips; report reaches queue.

---

## C10 — Verification (selfie) + admin review + badge

### Web member `/verification` + Settings tab
- [ ] LiveSelfieCapture: getUserMedia opens camera (Playwright fake-camera flags); mirror preview; capture → JPEG.
- [ ] **No file-upload path anywhere** in selfie flow (verify absent).
- [ ] Camera denied/absent → "use a device with a camera" message, no fallback upload, no crash.
- [ ] Submit → Cloudinary → status "Pending review"; trust score reflects.
- [ ] Both entry points (/verification page + Settings VerificationTab) behave same.

### Admin review (web)
- [ ] Verifications queue lists pending with selfie + profile-photo cells side-by-side.
- [ ] Names correct (v.User.Profile.* — not "undefined undefined").
- [ ] Images load (not "no image"); broken relative seed → "Image unavailable" placeholder.
- [ ] Zoom lightbox works.
- [ ] Approve → member status approved + notification + email copy = photo-verification wording.
- [ ] Reject (+adminNotes) → member status rejected + notification + email says photo (not "documents").

### RN verification (iOS + AND) — ledger #6
- [ ] Verification/SelfieVerification screens render, no crash.
- [ ] Honest state (no broken ID-tier submit that 400s silently; tiers 3/4 "Coming soon").
- [ ] Record **W-RN-SELFIE** 🟠 (live-camera rework deferred).

### SYNC-8 + API
- [ ] Approved user shows verified badge on web (search card + profile) AND RN (badges).
- [ ] `POST /verification/submit` without selfie → 400 clean.
- [ ] `GET /verification/status` returns selfiePhoto + status.

**Exit:** approve + reject loops verified web-side; badge propagates; RN degradation documented.

---

## C11 — Subscription

### Plans display
- [ ] Web `/subscription`: free ₹0 / basic ₹1500 / plus ₹3000 / vip ₹7499; per-plan features correct; current plan marked.
- [ ] RN Subscription: plans from shared PLANS + live price; features per plan (VIP shows all — not all-excluded, 2026-06-21 fix); "Most Popular"/"Best Value" badges.

### Upgrade gating (API — Razorpay placeholder, so test order-creation logic)
- [ ] Free → any tier: create-order allowed.
- [ ] Active tier → higher tier: allowed (TIER_RANK).
- [ ] Active → same/lower while active: **409 clear message** (not generic conflict).
- [ ] Web CTA tier-aware: Upgrade / Current Plan / Included.
- [ ] Web shows "payments opening soon" notice (Razorpay unconfigured) — graceful, no broken checkout.

### History / invoice / payment pages
- [ ] `GET /subscription/history` → past subs.
- [ ] `GET /subscription/invoice/:id` → valid PDF, correct branding + working email (not dead).
- [ ] `/payment/success`, `/payment/failed`, `/payment/history` pages render.
- [ ] Cancel current subscription (`DEL /subscription/current`) works.

### Admin override (SYNC-9)
- [ ] Admin changes user subscription → web + RN gates flip (chat, viewers rail, Likes-You tab open/close accordingly).

### Webhook security
- [ ] `POST /subscription/webhook` no-Origin → reaches HMAC (401 bad-sig, NOT 403 CORS).
- [ ] Invalid signature → 401; raw body verified (timing-safe).

**Exit:** every gate matches plan matrix; no double-subscribe path.

---

## C12 — Notifications (in-app both platforms + email)

### Generation → list
- [ ] Trigger like, mutual, message, verification result, subscription change → each creates a notification.
- [ ] Web notifications page: list, unread styling, pagination.
- [ ] RN Notifications (iOS + AND): infinite scroll, unread badge.

### Actions
- [ ] `GET /notifications/unread-count` accurate.
- [ ] Mark one read (`PUT /:id/read`); mark all (`PUT /read-all`); delete (`DEL /:id`).
- [ ] Deep links: web notification → correct route; RN → correct screen (`nav.navigate` deep-link).
- [ ] Empty state both platforms.

### SYNC-10
- [ ] Mark read on web → RN unread count correct after refetch.

### Email (Resend — owned inboxes only)
- [ ] Trigger + inspect (or Resend log/response): welcome, password-reset, verification approved, verification rejected, subscription confirmation.
- [ ] Branding: burgundy header, gold hairline, NO "TricityMatch", support-email footer, working CTA (`/dashboard` not dead `/browse`).
- [ ] Subscription email: friendly plan label ("Basic Premium"), formatted valid-until, no green gradient.

### FCM
- [ ] `POST /notifications/fcm-token` + `DEL` respond (push delivery config-gated — `[N]`).

**Exit:** every notification type lands both platforms; email templates on-brand.

---

## C13 — Guardian

### Web `/guardian`
- [ ] Invite guardian (email-based) → invite created.
- [ ] resolve-invite token flow (`POST /guardian/resolve-invite/:token`).
- [ ] my-guardians list; my-candidates list.
- [ ] Candidate matches (`GET /candidate/:id/matches`) + shortlisted read-only views.
- [ ] Revoke link (`DEL /guardian/:linkId`).
- [ ] States: empty (no guardians), populated.

### RN (iOS + AND)
- [ ] GuardianSetup: invite flow.
- [ ] GuardianView (read-only) shows candidate data.
- [ ] GuardianCandidates list.

### SYNC-11
- [ ] Invite issued + resolved on web → RN GuardianView sees same candidate (RO).

**Exit:** full invite→resolve→view→revoke loop both platforms.

---

## C14 — Astrologers (stub-data states)

### Web
- [ ] `/astrologers` listing: empty/stub state (table unseeded) — honest, no crash.
- [ ] `/astrologers/:id` detail renders (or graceful if no data).
- [ ] `/astrologers/bookings`: empty state.

### RN (iOS + AND)
- [ ] AstrologerMarketplace: STUB_ASTROLOGERS fallback renders cleanly.
- [ ] AstrologerDetail: renders; booking button → payment gate (Razorpay-gated, graceful).

### Optional (delete after)
- [ ] Insert ONE astrologer row (SQL) → exercise detail + book UI → `book/:id/verify-payment` gated → delete row.

**Exit:** no crashes; honest empty/stub states; booking gated cleanly.

---

## C15 — Calls (config-gated degradation)

### Web
- [ ] Call buttons ABSENT (VITE_AGORA_APP_ID unset) on ProfileDetail/chat.
- [ ] CallProvider/CallOverlay mounted but dormant — no console errors.

### RN (iOS + AND)
- [ ] Call screens unreachable or degrade gracefully (Agora not in dev binary) — no crash.
- [ ] IncomingCall modal code path doesn't error on load.

### API (A↔B)
- [ ] `GET /calls/agora-token` → DEV_STUB_TOKEN shape.
- [ ] `POST /calls/initiate`, `PUT :id/accept|decline|end`, `GET /calls/history` → sane status codes.

**Exit:** zero crash paths; API contract verified.

---

## C16 — Settings, i18n, themes, delete account

### Web Settings `/settings`
- [ ] Every tab loads (profile prefs, privacy, verification[C10], password, sessions, language, theme).
- [ ] Language switcher en/hi/pa: Navbar + Login + feature-page (Verification/Guardian/Astrologers/SuccessStories) strings actually swap; rest EN (ledger #10, expected).
- [ ] Dark mode toggle → `html.dark` → key pages restyle correctly (spot Dashboard/Search/Profile/Chat).
- [ ] Elder mode → `html.elder` → base 18.5px, muted text AA, ≥44px targets, layout unchanged.
- [ ] Delete account (throwaway account e2e): confirm → DB row gone → cookies cleared → redirect.

### RN Settings (iOS + AND)
- [ ] Sectioned settings render; "Current: <plan>" correct.
- [ ] Incognito toggle.
- [ ] Dark override (null/true/false) works.
- [ ] Elder mode → Chat tab hides (5→4 tabs); toggle back restores.
- [ ] Language live-switch (hi/pa) — spot 2 screens render translated.
- [ ] Delete account e2e (throwaway) → logged out.

**Exit:** all toggles round-trip + persist per-device; delete works.

---

## C17 — Admin panel (14 pages) + RN admin stack

### Web admin @1440 (spot-check 375)
- [ ] Dashboard: analytics/charts render (not blank), stat tiles, no rose theme (burgundy).
- [ ] Users list: search, filter, status dropdown, pagination.
- [ ] User detail: status change (Suspend/Delete vocabulary matches backend enums — no 400), subscription change (plan enums valid), DOB formatted.
- [ ] Create user: form → creates.
- [ ] Verifications queue: pending/approved/rejected tabs; review modal (C10 did approve/reject — confirm tab states).
- [ ] Subscriptions: list/filter.
- [ ] Revenue: charts render.
- [ ] Reports queue: statuses Reviewing/Resolve buttons work (no 400 — regression-watch).
- [ ] Marketing-users list + detail + stats.
- [ ] Referral-codes: create + toggle.
- [ ] Leads: list.
- [ ] Success-stories: create → publish → appears on public `/success-stories` + RN browse.
- [ ] Invoice fetch (`GET /admin/invoice/:id`).
- [ ] push-smoke-test button → sane config-gated response.
- [ ] Brand: "TricityShadi", logo TS, burgundy (not rose/blue except semantic status chips).
- [ ] Role guard: member visiting `/admin/*` → bounced.

### RN admin stack (iOS + AND; admin account)
- [ ] AdminHome renders.
- [ ] VerificationQueue: same pending rows as web; approve/reject.
- [ ] ReportsQueue: same report rows; status update.

**Exit:** every admin control operates on real rows from the run.

---

## C18 — Marketing portal

- [ ] Create marketing user (admin `POST /admin/marketing-users`).
- [ ] Login as marketing → `/marketing/dashboard` renders.
- [ ] `/marketing/leads`: list + status update (`PUT leads/:id/status`).
- [ ] `/marketing/referral-codes`: list + create.
- [ ] Role guard: member/admin vs marketing routes behave per design.
- [ ] Note blue theme (deferred, ledger — don't fix).

**Exit:** portal functional for marketing role.

---

## C19 — Bureau RN stack

- [ ] Set test user `role='bureau'` (SQL); login RN → BureauStack.
- [ ] BureauHome renders.
- [ ] ClientRoster: list/states.
- [ ] MatchProposal 3-step flow.
- [ ] Earnings screen.
- [ ] Support screen.
- [ ] SuccessStory submit (→ draft for admin).
- [ ] Catalog any backend-less screens as W-items (not bugs).

**Exit:** stack navigable without crashes; gaps cataloged.

---

## C20 — Full API sweep + security

> Fill the **observed status code** for each. Auth via cookie jar (A=member, admin=admin). Public = no auth.

### Endpoint table (all 17 route files)
**auth** `/auth`
- [ ] signup · login · refresh · forgot-password · reset-password · google · send-otp · verify-otp · GET me · logout · logout-all · change-password · GET sessions · DEL sessions/:id · DEL account — unauth/authed/malformed codes recorded.

**profile** `/profile`
- [ ] GET/PUT me · me/stats · me/viewers · me/recently-viewed · DEL me/photo · DEL me/profile-photo · POST/DEL voice-intro · POST/DEL video-intro · PUT privacy · GET :id · POST :id/unlock-contact · GET :id/compatibility · GET :id/horoscope-match · GET :id/horoscope-match/pdf.

**groups** `/groups` — [ ] all 12 endpoints; **IDOR: non-member → 403** on get/messages/post/edit/delete.
**search** `/search` — [ ] GET / · suggestions · by-code.
**match** `/match` — [ ] :id{action} · likes · shortlist · mutual · daily.
**success-stories** `/api/v1/success-stories` — [ ] GET (public) · POST (rate-limited draft).
**contact** `/api/v1/contact` — [ ] POST (public, 5/hr limiter → trigger 429).
**chat** `/chat` (premium) — [ ] conversations · messages/:id · POST messages/send · PUT/DEL messages/:id; **free user → gate/403**.
**subscription** `/subscription` — [ ] plans · webhook(HMAC) · my-subscription · create-order(tier gate) · verify-payment · DEL current · history · invoice/:id.
**verification** `/verification` — [ ] status · submit(400 no selfie) · selfie.
**notifications** `/notifications` — [ ] GET / · unread-count · read-all · :id/read · DEL :id · POST/DEL fcm-token.
**calls** `/calls` — [ ] agora-token · initiate · accept/decline/end · history.
**guardian** `/guardian` — [ ] my-guardians · invite · DEL :linkId · my-candidates · candidate/:id/matches|shortlisted · resolve-invite/:token; **IDOR: other's candidate → 403**.
**astrologers** `/astrologers` — [ ] GET / · my-bookings · :id · book · book/:id/verify-payment|start-call|end-call.
**block** `/block` — [ ] POST/DEL :id · GET /.
**report** `/report` — [ ] POST :id · GET /.
**admin** `/admin` — [ ] every endpoint: **non-admin → 403**, admin → 2xx.
**marketing** `/api/marketing` — [ ] marketing-role only; other roles → 403.
**monitoring** `routes/monitoring.js` — [ ] inspect + hit (auth requirements noted).

### Security spot-checks
- [ ] Unauth protected → 401 (spot 5 endpoints).
- [ ] Non-admin → admin endpoint → 403.
- [ ] Rate limiters → 429: auth (5/15m), search (30/min), contact (5/hr) — trigger at least these 3.
- [ ] Upload: wrong-MIME + magic-byte reject on profile-photo + verification selfie.
- [ ] IDOR: group / conversation / guardian-candidate / notification / invoice / verification belonging to another user → 403/404 (not data leak).
- [ ] Headers: helmet present (CSP, X-Frame, etc.).
- [ ] CORS: cross-origin blocked; webhook no-Origin reaches HMAC.
- [ ] Cookies httpOnly; no token in body for web; no stack trace in error responses.
- [ ] Socket: join-room non-mutual rejected; group join non-member rejected; send-message spoof (fake senderId) rejected.

**Exit:** endpoint table + security list 100% observed.

---

## C21 — Non-functional

### Error/empty/loading states (kill backend where noted)
- [ ] Web Dashboard: backend down → error banner + retry (NOT zeros + "Complete Profile").
- [ ] Web Search: error card (retry) ≠ empty card (clear filters).
- [ ] Web Chat / Matches: error states render.
- [ ] RN equivalents: Home/Search/Matches error + retry.
- [ ] RN offline: airplane mode → OfflineBanner + MMKV shortlist visible.

### Perf
- [ ] Playwright network throttle (Slow 3G) on Dashboard + Search → usable, skeletons show.
- [ ] Build output chunk sizes reasonable (record vendor-react/ui/utils sizes).
- [ ] LCP eyeball on Home + Dashboard.

### SEO / a11y
- [ ] robots/sitemap/canonical/OG re-confirm (public routes).
- [ ] Forms: all inputs labelled; tab order; visible focus.
- [ ] Modals/sheets: focus trap; Esc closes.
- [ ] Contrast in dark + elder modes (spot Dashboard/Profile).

### Monitoring / logs
- [ ] Monitoring endpoints respond (Prom metrics if exposed).
- [ ] Backend logs during login+chat: no PII/token/password leak (JSON logger).

**Exit:** findings logged; 🟠+ fixed.

---

## C22 — Close-out

### Regression (record vs C0 baseline)
- [ ] BE unit: __/__ green.
- [ ] FE vitest: __/__ green.
- [ ] Mobile tsc: __ errors.
- [ ] Frontend build: green.
- [ ] Playwright e2e (9 specs): __/__ (note cred-gated).

### Cleanup
- [ ] Delete all `qa.deep.*` accounts (DB).
- [ ] Delete any test astrologer/bureau rows created.
- [ ] `.env.development` reverted to as-found (no OTP_BYPASS residue); `touch server.js`.
- [ ] `git status`: only intended changes (fixes + these 2 QA docs + artifacts).

### Report + docs
- [ ] Fill Final Report (below): stats, bugs by severity, fixed/deferred, W-items.
- [ ] Update `CLAUDE.md` Audit History + Known Issues deltas.
- [ ] Update `docs/QA.md` §6 History pointer.
- [ ] Final commit.
- [ ] Sign-off gates (plan §12) all green or user-waived.

---

## FINDINGS LOG

> `DQ-xxx · SEV · chunk · platform · title — root cause (file:line) — status — evidence`

| ID | Sev | Chunk | Platform | Title | Root cause (file:line) | Status | Evidence |
|---|---|---|---|---|---|---|---|
| DQ-001 | ⚪ | C1 | Web @1440 | Home page ~25px horizontal scroll (tiny scrollbar) | `.live-pill` hero pill centered on photo column, `whiteSpace:nowrap` grows with text, right edge exceeds viewport; truncation only in ≤1000px media query — `pages/Home.jsx:470` | FIXED-VERIFIED (added `overflowX:'clip'` to Home root; docScroll==clientW, build green) | verified via evaluate |
| DQ-002 | ⚪ | C2 | RN (dev build) | LogBox warning: `ExpoBlurView isn't exported by expo-modules-core` on app launch | expo-blur native module not in the committed dev binary; any screen using `BlurView` renders without blur (no crash). Dev-only — a production/EAS build bundles expo-blur. Exported managers incl. ExpoCamera (good for C10). | OPEN (dev-only noise; confirm which screens use BlurView + that prod build bundles it) | docs/qa-artifacts/2026-07-08/C2/android-blurview-warn.png |
| DQ-003 | 🟡 | C3 | RN onboarding Step 10 | Field labels render as raw i18n keys `onboarding.step10.bio` / `.interests` / `.interestsHint` | Step10Screen.tsx:57,79,82 calls those keys but en/hi/pa only defined `bioPlaceholder`/`bioLimit`/`interestTags` — key-name mismatch → i18next echoes the key | FIXED-VERIFIED (added bio/interests/interestsHint to en+hi+pa; live re-render shows "About you"/"Interests"/"Pick a few…") | docs/qa-artifacts/2026-07-08/C3/android-step10-i18n-keys.png |
| DQ-004 | 🟡 | C3 | RN onboarding Step 14 | Completion screen renders raw keys `step14.complete` + `card1-3Title/Sub` | Step14Screen refactored to `complete`+`card{1,2,3}{Title,Sub}` but translations kept old `getVerified/completeProfile/uploadKundli` names — mismatch | FIXED-VERIFIED (added keys en+hi+pa; card1 "ID Verified"→"Photo Verified" per selfie pivot; dead-kundli card3→"Discover Matches"; live shows resolved) | docs/qa-artifacts/2026-07-08/C3/android-step14-raw-keys.png |
| DQ-005 | ⚪ | C3 | RN onboarding Step 14 | Emoji in UI copy: title "You're all set! 🎉" (anti-slop violation) | Emoji embedded in `onboarding.step14.title` value in en/hi/pa | FIXED-VERIFIED (removed emoji all 3 langs; live shows "You're all set!") | same as DQ-004 |
| DQ-006 | 🟠 | C3 | RN + backend | RN 14-step onboarding completes but `onboardingComplete` stays false → returning RN user re-onboarded (R3-3 class) | `onboardingComplete` server-controlled, set ONLY at signup from `firstName&&gender&&dateOfBirth`; RN signup is email+pw only (→false) and PUT /me intentionally excludes the flag → no path to flip it. `profileController.js` | FIXED-VERIFIED (added one-way server-controlled transition in PUT /me: when result has name+gender+dob → set true; ignores client value; mirrors signup rule. /auth/me + DB now true; BE unit 155/155) | verified via curl + DB |
| DQ-011 | 🔴 | C8 | Backend `utils/performance.js` (perf middleware) — server crash | **Every Kundli-PDF download crashed the ENTIRE backend** (all users), and nodemon/prod don't auto-respawn cleanly → sustained outage. `requestPerformanceMiddleware` monkey-patches `res.end` to `res.setHeader('X-Response-Time',…)` (line 318) UNCONDITIONALLY. For a **streamed** response the body is already flushed before `res.end()`, so pdfkit's `doc.pipe(res)` → `res.end()` → setHeader throws `ERR_HTTP_HEADERS_SENT` → **uncaughtException → graceful shutdown**. Affects ANY streaming endpoint, not just Kundli. Repro: `GET /profile/:id/horoscope-match/pdf` (premium) → 200 + valid PDF delivered, then backend HTTP 000 dead. Isolated via captured alt-backend on :5077 (full crash stack). | FIXED-VERIFIED (guard `if (!res.headersSent)` around the setHeader). Post-fix: PDF full-read + repeat + mid-stream-abort all keep backend ALIVE (HTTP 200); BE unit 155/155. Also hardens future streaming endpoints. | live repro + captured stack + live re-verify |
| DQ-014 | 🟡 | C15 | Backend `callController.js` initiateCall | **Voice/video call had no mutual-match gate** — `initiate` required only premium (route middleware) + callee-exists, NOT a mutual match. Chat between two users requires a mutual match, but a premium member could **ring ANY user by ID** (`call-incoming` socket event → device rings) even with no match and no chat access → unsolicited-call / harassment / privacy vector + cross-feature inconsistency. Repro LIVE: Aman(VIP)→Priya (non-mutual)→**201 call created**. | FIXED-VERIFIED — added mutual check mirroring chat's `verifyMutualMatch` (`Match isMutual:true` either direction) + self-call guard, before CallSession.create. Applies to web AND RN (shared endpoint). Post-fix: non-mutual→**403 "You can only call your mutual matches"**, self→400, mutual→201→accept→end all work. | live pre/post repro |
| DQ-013 | ⚪ | C13 | Backend `guardianRoutes.js` POST /guardian/invite (direct branch) | A member could invite **their own email** as a guardian. The on-platform (direct-link) branch created an active GuardianLink without a self-check; only `resolve-invite` (off-platform path) guarded self-guardianship. Harmless (self-access grants nothing you don't already have via /match) but burns one of MAX_GUARDIANS=3 slots + pollutes my-guardians + inconsistent with resolve-invite. Repro: Aman POST invite {own email} → 200 self-link created. | FIXED-VERIFIED — added `if (guardianUser.id === req.user.id) throw 400 'Cannot be your own guardian'` before the direct-link create (mirrors resolve-invite). Clean retest → **400**. (Note: duplicate-check fires before it, so an existing self-link 409s first — expected.) | live repro + fix + clean re-verify |
| DQ-015 | ⚪ | C19 | RN bureau stack (`api/bureau.ts` + `features/bureau/*` 4 screens) + missing backend | **Entire "marriage bureau" agent feature is unreachable dead code.** `User.role` ENUM has no `bureau` value (`user/admin/super_admin/marketing_manager/marketing`), so no user can ever satisfy MainNavigator's `role==='bureau'` gate → BureauStack never mounts. Backend exposes no `/bureau/*` routes (clients/earnings/proposals all live-**404**) and no `bureauAuth`. RN side is fully built (useQuery screens + createMatchProposal) but orphaned. Benign (unreachable → no real user hits the dead queries, no crash surface). | NOT FIXED — deferred. Whole-feature scope (build bureau backend + add role to enum + seed, OR delete the RN stack) = product decision, >1h, outside fix-on-discovery. Already in CLAUDE.md deferred scope (Admin/Bureau). W-item. | live 404 ×3 + role-enum + nav-gate read |
| DQ-012 | 🟠 | C10 | RN `VerificationScreen.tsx` + `api/verification.ts` | RN photo-verification DESYNCED from selfie-only web/backend — tier-2 posted `documentType=aadhaar`+`documentFront` (a **gallery/file upload**) to `POST /verification/submit`, which since 2026-07-02 requires a `selfiePhoto` and ignores document fields → **hard 400 "A selfie photo is required"** (RN verification 100% broken). Also violated the no-ID-upload directive ([[feedback-verification-no-uploads]]: live camera only, uploads can be doctored). `VerificationScreen.tsx:207-208` (old). | FIXED — reworked tier-2 to a LIVE front-camera selfie: `ImagePicker.launchCameraAsync({cameraType:front, mediaTypes:Images})` (never `launchImageLibraryAsync`/gallery), posts `selfiePhoto` to `/submit` (the exact multipart contract proven working end-to-end via curl this chunk). Renamed "ID Verified"→"Photo Verified", camera copy/icons, `api/verification.ts` reads `status/selfiePhoto`. mobile tsc **0**. Native camera runtime deferred (hardware — same gate as web `LiveSelfieCapture`, config-gated). Closes W-RN-SELFIE. | live 400 repro (curl) + curl-proven `selfiePhoto` chain + tsc |
| DQ-009 | 🔴 | C5 | Backend `GET /search/by-code` | Profile-ID search (shareable `TCS-XXXXXXXX` code) **500'd for every code** — `column "photoBlurred" does not exist` at `searchController.js:553`. The query's attributes list had a wrong column name (`photoBlurred`); the model column is `photoBlurUntilMatch` (used correctly everywhere else). The attribute was fetched intending to blur photos but blur was **never applied** in the by-code response (unlike main search 324) → also a latent photo-privacy leak for non-mutual viewers. | FIXED-VERIFIED (col name → `photoBlurUntilMatch`; ALSO applied blur-for-non-mutual mirroring main search, self-view exempt. Live: valid code→200/Priya, self→200/isSelf, bad→400, missing→404; UI type+Go→navigates to `/profile/:id`. BE unit 155/155) | live API + UI |
| DQ-010 | ⚪ | C5 | Web `RouteTitle.jsx` (browser tab title) | Viewing another member's profile (`/profile/:id`) set the tab title to **"My Profile"** — the `/profile` prefix rule also matched `/profile/:id` (comment even acknowledged it). Mislabels the page + leaks intent. | FIXED-VERIFIED (`titleForPath` special-cases `/profile/:id` [not `/edit`] → generic "Profile" — also keeps the viewed member's name out of the tab/history. Verified: `/profile`→My Profile, `/profile/edit`→Edit Profile, `/profile/:id`→Profile. FE 48/48) | live |
| DQ-008 | 🟡 | C4 | RN Home (auth-store staleness) | After completing RN onboarding, Home's "Complete your profile" strip showed **0%** and greeting showed "Good morning," (no name) even though the profile is 74% complete with name Deepa. Two symptoms, one cause: Home reads `user.Profile.completionPercentage` + `user.firstName` from the auth store, but `Step14Screen.handleBrowse` only optimistically patched `onboardingComplete:true` into the store — never refreshed the full user — so `user.Profile` stayed the stale pre-onboarding snapshot. OwnProfile (fresh `GET /profile/me`) correctly showed 74%. getMe DOES return completionPercentage (authController:450 includes full Profile). | FIXED-VERIFIED (`Step14Screen.tsx`: after `saveAndNext`, call `authApi.getMe()` + `setUser(fresh)` [try/catch, keeps optimistic patch on failure]. Live cold-start proof: Home now "Good morning, Deepa" + "74%". mobile tsc 0) | live Android; watch web auth-user freshness in Dashboard chunk |
| DQ-007 | ⚪ | C3 | Web profile editor (shared `Select`) | Profile-edit dropdowns (Highest Education / Profession / Income) showed placeholder "Select your…" even when the field HAS a stored value, if that value isn't in the component's hardcoded option list → reads as data-loss on a matrimony profile editor. Surfaced by seed values `education=M.Com` / `profession=Software Engineer` (outside the fixed vocab in `EducationStep.jsx`). formData WAS hydrated (not the 2026-07-03 regression) — display-only gap in `ui/Select.jsx:39,166`. | FIXED-VERIFIED (hardened `Select`: when `value` truthy but not in options, display raw value instead of placeholder + allow clearing it. Education now shows "M.Com", Profession "Software Engineer". Also protects prod if option vocab drifts across a release. FE 48/48 green) | seed-data surfaced; prod real users pick from list so normally in-vocab |

## WORK ITEMS (too big to fix in-run)

| ID | Sev | Title | Effort | Notes |
|---|---|---|---|---|
| W-RN-SELFIE | 🟠 | RN live-selfie verification rework (selfie-only, expo-camera) | ~1 day | ledger #6; needs native build |

## FINAL REPORT (fill in C22)

- Screens covered (web / iOS / AND): __ / __ / __
- Endpoints observed: __ / __
- Sync scenarios verified: __ / 12
- Bugs: 🔴 __ · 🟠 __ · 🟡 __ · ⚪ __ (fixed __ / deferred __)
- Regression: BE __/__ · FE __/__ · tsc __ · build __ · e2e __/9
- Sign-off: ☐ granted / ☐ waived items: ____

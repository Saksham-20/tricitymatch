# Audit F — Phase 13 (legal/compliance) + Phase 14 (testing)

Repo: /Users/sakshampanjla/Desktop/REACT/tricitymatch · branch `main` @ 7b170f1 · date 2026-09-29
Mode: READ-ONLY. No repo file modified (coverage output was redirected to the scratchpad). No DB/network/prod/OTP/email/payment touched.

**I am not declaring legal compliance.** Phase 13 separates (A) code/page deficiencies (fixable by engineering), (B) questions for Indian counsel, (C) provider confirmations, (D) operational/business documents. Claims from CLAUDE.md and the three prior docs were treated as leads and re-checked against code at HEAD.

Status of prior `docs/LEGAL_REVIEW_2026-09-17.md` findings at HEAD (re-verified): A-1 refund hole FIXED (auto-refund removed, `subscriptionCancellation.test.js`, manual audited admin refund exists); A-2 "100% privacy guaranteed / Cancel anytime" FIXED on checkout (footer now says one-time, no auto-renewal, 7-day refund + link) — but the same "100% Privacy" phrase survives elsewhere (P13-19); A-3 "thousands of families" removed; A-4 deletion wording now consistent (Help/Privacy/Delete page say immediate erasure) but see P13-05/06; A-5 unsubscribe now exists (`emailController`, `emailUnsubscribe.test.js`); C-1 refund link on checkout FIXED; B-1 itemised consent notice added (CreateAccountStep.jsx:337); AI-imagery `AiTag` present. STILL OPEN from that review: B-3 (entity/officer), B-5 (re-consent trigger), B-6 (annual re-notification), B-7 (age gate), B-8 (guardian notice), A-6 (25/day cap undisclosed), A-13 (response-time claims), A-14 (40+ signals), C-2 (refund formula can exceed price paid).

---

## 1. Legal / operational gaps

Legend: **CODE** = engineering can fix · **COUNSEL** = needs an Indian lawyer · **PROVIDER** = needs written confirmation from a vendor · **OPS** = business/operational procedure or document.

### P13-01 Statutory disclosures cannot render in production even if the owner supplies them — CODE + OPS (HIGH, new)
- Evidence: `frontend/src/config/index.js:86-104` reads `VITE_LEGAL_ENTITY/ADDRESS/GSTIN/GRIEVANCE_OFFICER/GRIEVANCE_EMAIL/PRIVACY_EMAIL/DPO_NAME` at **build time**. `frontend/Dockerfile:10-20` declares ARGs only for API/WS/Razorpay/Cloudinary/Google/`VITE_SUPPORT_*`; `docker-compose.yml:235-244` passes only those build args; `frontend/.dockerignore` excludes `.env*`. So the legal vars are never baked into the Docker build the VPS uses. Terms.jsx:70, Privacy.jsx:68 gate the operator/address block on `legal.address`, and the officer name renders only if `legal.grievanceOfficer` is set.
- Consequence: even after the owner fills `.env.production` (as the checklist tells them to), the site would still show no entity name, address, GSTIN, or named Grievance Officer. A one-line Dockerfile ARG + compose args fix is needed (CODE), then owner supplies the values (OPS).
- Counsel: whether operator identity, named officer (IT Rules r.3(2)(a)), E-Commerce Rules r.4(3)/5(3) details are mandatory for this business form.

### P13-02 Grievance Officer / mailboxes — OPS (HIGH, still open)
- `legal.grievanceOfficer` empty by default (Terms.jsx:271, Privacy.jsx:216 render only role text). `.env.production.example:174-178` blank. `support@/privacy@/grievance@tricitymatch.com` are published in Terms, Privacy, Delete-account page, store listings; docs/LAUNCH_CHECKLIST_2026-08-18.md:§3 and CLAUDE.md say inbound routing was not set up. I cannot verify mailbox existence from the repo. Need: named natural person resident in India, monitored inbox, acknowledgement/response log.

### P13-03 Consent capture — CODE (MED, partially fixed)
- Web: single required checkbox + an itemised plain-text notice above it (CreateAccountStep.jsx:337-360). Mobile: single "I agree" checkbox (`mobile/src/features/auth/CreateAccountScreen.tsx:411-432`).
- **Server does not enforce consent.** No `agree`/`terms` field in `validators/index.js` signup validation; `authController.js:266-267` and `:1094-1095` stamp `termsAcceptedAt/termsVersion` unconditionally at account creation, including Google sign-in. A direct API call therefore yields an account with a "consent record" that the user never gave. The DPDP consent log (migration 000062) is only as truthful as the client.
- No separate, unticked optional consent for marketing/lifecycle mail (opt-out via signed unsubscribe link exists — `emailController`, `utils/emailUnsubscribe.js` — i.e. opt-out, not opt-in). COUNSEL: whether opt-out is acceptable for non-service mail under DPDP s.6/s.7 and whether matching rests on consent or "legitimate uses".
- No consent record per sensitive-data purpose (religion, caste, horoscope, photos, selfie) — one bundled tick. COUNSEL.

### P13-04 No re-consent / annual re-notification mechanism — CODE (MED, open)
- `TERMS_VERSION='2026-08-26'` (`backend/constants/legal.js`) is only written at creation; nothing compares it to stored `termsVersion` (grep for `needsReconsent`/version comparison: none). Terms cl.21/Privacy promise notice of changes; Terms:165/253 & Privacy:229 promise annual reminders (IT Rules r.3(1)(c)/(f)) — no job exists (`utils/queue.js`, `utils/lifecycleMail.js` have none). No test asserting the three version constants (backend/frontend/mobile) match.

### P13-05 Account erasure does not delete media at Cloudinary — CODE + PROVIDER (HIGH, new)
- `utils/accountErasure.js` deletes DB rows and tombstones messages but never calls Cloudinary. `deleteFromCloudinary` (`middlewares/upload.js:379`) is used only by profile photo/voice/video removal in `profileController.js`. `grep uploader\. backend` shows no call in erasure or admin hard-delete (`utils/hardDeleteUsers.js`).
- Privacy §13 says photographs, voice/video intros, the verification selfie are "erased", Help/Delete page say "erased immediately". After erasure the Profile row (which holds the URLs) is destroyed, so the Cloudinary assets become **orphaned but still hosted and reachable by URL** (Verification selfie/liveness URLs and chat voice messages likewise). PROVIDER: Cloudinary retention/backup behaviour and DPA.
- `deleteAccount` requires the current password (`authController.js:853-861`); `comparePassword` on a Google-only account (`password: null`, `authController.js:1088`) calls `bcrypt.compare(x, null)`, which throws → 500. Google-only members likely cannot self-serve delete (CLAUDE.md already lists this as an open owner item). Not exercised at runtime.

### P13-06 Retention promises vs implementation — CODE + COUNSEL (MED)
- Privacy §13 and Terms cl.9/20 promise: removed content + associated records preserved 180 days; server logs retained "as CERT-In requires". Implementation: nothing preserves removed content for 180 days (admin `removePhoto` — adminSafetyController — deletes/logs only; no evidence-preservation store). Registration data is erased immediately at self-deletion (`accountErasure.js:125-152`), whereas IT Rules r.3(1)(h) (as cited in Privacy.jsx header comment) is read to require 180-day retention of registration information after cancellation — COUNSEL must decide which position is right; text and code now agree with each other but may be non-compliant.
- Chat message retention: `MESSAGE_RETENTION_MONTHS` is opt-in and disabled (`utils/queue.js:198-206`, also reads `process.env` directly against the env.js-only rule). Privacy states no window. No inactive-account purge; `Reports` retained indefinitely.

### P13-07 CERT-In 180-day log retention is not met by the shipped config — OPS + CODE (HIGH)
- `docker-compose.yml` uses `json-file` `max-size 10m, max-file 3` for every service (lines 38-42, 72-76, 223-227, 259-263, 298-302) ⇒ ~30 MB per container, i.e. hours-to-days of backend logs, not 180 days. No log shipper/remote store found (only Prometheus/Grafana profile, not running in prod per checklist). CERT-In 2022 Directions expect logs of ICT systems retained 180 days **within Indian jurisdiction**; VPS location/host-nginx logrotate not verifiable from the repo. AuditLog table (`AuditLog` model, migration 000060) holds admin actions only and has no retention policy.
- Privacy.jsx §12 publicly promises the 6-hour CERT-In report and log retention. No incident-response runbook / breach-notification procedure exists in `docs/` (`ls docs | grep -i incident` empty; only pentest/audit docs). OPS: incident runbook, on-call/POC name registered with CERT-In, NTP time-sync statement. COUNSEL: applicability as intermediary/body corporate.

### P13-08 Age gate vs marriageable age — CODE + COUNSEL (MED, still open)
- `validators/index.js:88-100` (signup): `age<18` for all genders (uses `/(365.25 d)` arithmetic, ±1 day boundary error). Terms.jsx:93 and Privacy.jsx:227 publish 21 (men) / 18 (women). A 19-year-old male can register, contrary to published rule.
- **`updateProfileValidation` (validators/index.js:214-217) has no age check at all** — `PUT /profile/me` accepts any ISO date; a user can change DOB to under-18 or 1900 after signup. `profileController.js` has no age check either (only completion maths).
- **Google sign-in creates a Profile with fabricated DOB `2000-01-01` and gender `'other'`** (`authController.js:1097-1104`) — an unverified 26-year-old until edited; the age gate is bypassed on that path. Mobile gate is client-side only (`CompleteBasicsScreen.tsx:158`, `BasicsScreen.tsx:146`) but the server's signup validator covers signup.
- `underage` is a report reason (`blockReportController.js:87`) but no admin workflow/SLA for minors. COUNSEL: whether the platform must *enforce* PCMA ages vs. state them, and children's-data (DPDP s.9) treatment; no age-assurance beyond self-declared DOB.

### P13-09 Guardian / third-party profiles — CODE + COUNSEL (MED, open)
- Terms cl.5 requires candidate consent; nothing verifies it and no notice is sent to the candidate (`routes/guardianRoutes.js` notifies via in-app `notify` to invited guardian only; no candidate notification code located). DPDP rights of the subject cannot be exercised over a profile they don't know exists. Not runtime-tested.

### P13-10 Data-principal rights tooling — CODE + OPS (MED)
- Erasure: self-serve (web + mobile). Correction: profile edit. **Access/portability: no export endpoint** (grep `export|my-data|download` in member routes: none; `/admin/users/export` is an admin CSV). Nomination: email-only, no record mechanism. Grievance: email only. Privacy §14 promises 30-day handling — needs an owner-run register (OPS). No DSAR verification procedure documented.

### P13-11 Processors and cross-border transfers — PROVIDER + COUNSEL
- Privacy §5-6 names Razorpay, Google Play, Cloudinary, generic "email provider" (Resend), generic "SMS provider" (MSG91), FCM, Agora, "hosting and monitoring providers" (mobile has `crashReporting.ts`; Sentry DSN unset per checklist). Need signed DPAs/confirmation for: data location and sub-processors (Cloudinary, Resend, Agora, Firebase), SMS DLT template registration and content approval (MSG91), Razorpay PA licence/PCI-DSS AoC, Google Play. Privacy says transfers are "under contract" — repo contains no contracts (OPS). Naming vs generic wording (email/SMS providers unnamed) is a COUNSEL call.
- Note dev `.env` shares the prod Resend key (history in CLAUDE.md 2026-08-25) — processor credential hygiene.

### P13-12 Intermediary duties (IT Act s.79 / IT Rules 2021) — CODE + OPS + COUNSEL
- Present: prohibited-content list (Terms cl.8), report + block, admin report queue, 24h/15-day/36h timelines published (Terms:175-178, Privacy §15).
- Not implemented in code: any SLA/due-date tracking on `Reports` (no `dueAt`, no aging alert, no acknowledgement email/notification to the reporter — `reportUser` at `blockReportController.js:75-105` only inserts a row + JSON audit log); no report categories for intimate imagery/morphed impersonation (r.3(2)(b) 24-hour class — reasons list is fake_profile/harassment/spam/inappropriate_content/underage/other); no duplicate-report handling; reports target a *user*, not a specific photo/message; no reporter outcome notice / appeal path; no monthly compliance report process (applies only to significant social media intermediaries — COUNSEL whether it applies at all); no takedown-on-order workflow or evidence preservation (P13-06); no 36-hour government-order handling doc.
- Safety.jsx:44 / Help.jsx:94 claim "Reports are reviewed … within 24 hours"; the code cannot evidence that (P13-19).

### P13-13 Blocking does not block chat/calls — CODE (HIGH safety, new; static read only)
- `blockUser` (`blockReportController.js:11-37`) only inserts a `Block` row. It does not touch the `Match` row. Chat send (`chatController.js:331` `verifyMutualMatch`), socket `send-message`, `entitlements.isMutualMatch`, and call initiate (`callController.js:88-99`) all authorise on `Match.isMutual` only. grep -i "block" in `chatController.js`, `socketHandler.js`, `callController.js`, `middlewares/auth.js`, `utils/entitlements.js` finds no Block check (callController's comment "chat between them is blocked" is inaccurate). Block IS honoured in search, suggestions, match action and `getProfile`.
- Effect (from code, not run): a member who blocks a mutual match can still receive messages and calls from them. Safety.jsx:44 says "Blocked users cannot view your profile or contact you". No test covers it (P14 gap). Needs a runtime repro before treating as confirmed.

### P13-14 Consumer Protection / E-Commerce disclosures — CODE + COUNSEL
- Good (verified): no auto-renew (model has an `autoRenew` column but no mandate/recurring code — `grep mandate|recurring|subscription_id` none), checkout footer links Refund Policy, refund policy page, price includes GST statement (Terms.jsx:199).
- **Invoice is not a GST tax invoice**: `utils/invoice.js:41-48,113-119` titles it "Payment Receipt", `Invoice #INV-<uuid8>`, no seller legal name/address/GSTIN, no SAC, no tax split, no place of supply, no sequential invoice numbering; Terms.jsx:207 ("A tax invoice is available for every completed payment") is therefore inaccurate as written. COUNSEL/CA + OPS: GST registration status, invoice format. `legal.gstin` never used outside Terms.
- Fair-use cap on "unlimited" (`UNLIMITED_DAILY_UNLOCK_CAP`, default 25 rolling 24h, `middlewares/auth.js`, `config/env.js`) still undisclosed in Terms/plan cards (grep of Terms/Subscription: no mention).
- Refund policy (RefundPolicy.jsx:63-66) deducts used unlocks at ₹199/3 with no stated cap at amount paid; on the ₹1,099 unlimited plan 17+ unlocks in 7 days would exceed the price (manual admin refund path `adminController.refundSubscription` — cap behaviour not checked).
- "Last updated" dates disagree (RefundPolicy 25 Aug 2026, Terms/Privacy 26 Aug) while Terms cl.12 incorporates the refund policy. Launch-offer end date is auto-seeded (18 Nov 2026) yet Terms.jsx:200 promises "that date is real" — OPS to set a real date or remove.
- Price-in-Terms vs Play Store product prices — PROVIDER/OPS (Play Console prices set separately).
- RBI/PA: no card data touched (Razorpay-hosted checkout — code evidence: only order create/verify + HMAC; `razorpaySignature` not leaked in API — `profileSubscriptionLeak.test.js`). PROVIDER: Razorpay PA-licence/KYC of merchant; live-key activation. `verifyPayment` is HMAC-only (does not fetch payment status) — noted in CLAUDE.md, acceptable but worth counsel/PSP sign-off.

### P13-15 Imagery, AI disclosure and photo permissions — CODE + COUNSEL
- `AiTag` + `data/editorialImages.js` present on Home only (`grep AiTag` → Home.jsx). Illustrative "Verified" badge/percentages were removed from cards per comments at Home.jsx:911-917. Community/city landing pages (`CityMatrimony.jsx`, `CommunityMatrimony.jsx`) not checked for imagery disclosure.
- Uploaded-photo permission: Terms cl.10 licence + cl.5 guardian permission; no upload-time attestation (no checkbox at `PhotosStep`), no copyright-complaint/takedown notice procedure (DMCA-like) in Terms; no perceptual-hash/dup-image or celebrity/stock check. COUNSEL: whether a copyright-complaint procedure is required; OPS: process.
- Success-story publication consent: Privacy §11 says only with agreement; admin can publish/edit/delete stories with **no audit-log entry** (see P13-17) and no consent artefact stored (not verified in model).

### P13-16 Law-enforcement request & evidence retention — OPS + COUNSEL (open)
- No documented process anywhere (grep "law enforcement|court order|legal request" in docs/backend: only the Terms/Privacy sentences). No admin tooling for data-preservation holds, no request register, no authenticated-requester checklist, no way to freeze erasure of a reported account (self-erase can destroy the subject's data even while reported; Reports are retained but the reported user's content is erased). Needs an owner-run SOP, designated nodal contact, counsel review of s.69/79 obligations.

### P13-17 Admin access & audit logging — CODE (MED)
- Audit coverage (39 `logAudit` call sites) is good for writes (status, refunds, roles, pricing, exports, photo removal). NOT audited: viewing a member's full record (`getUser`, `getUsers` — PII reads), `deleteSuccessStory`/create/update success stories, contact-message reply body (only "replied" recorded), admin refund amounts recorded but not viewed. Audit table has no retention policy or tamper control (append-only by convention, DB user can update). Relevant to DPDP accountability and CERT-In forensics.

### P13-18 Payments / auto-renew / mandates — evidence
- No auto-renew or e-mandate code (`grep` mandate/recurring/subscription_id: none). Terms.jsx:197 correct. No RBI e-mandate exposure. Google Play purchases: Play handles renewals (only one-time products per checklist) — PROVIDER.

### P13-19 Unsupported claims still live in copy — CODE (LOW-MED)
- "100% Privacy" trust chip: `Login.jsx:261,536`, `ForgotPassword.jsx:71,148`, `ResetPassword.jsx:36`, `ModernOnboarding.jsx:504` — an absolute warranty that Privacy.jsx:179 disclaims ("No system is perfectly secure").
- "Verified in hours" ×3 (`Home.jsx:343,624,1544`) vs Help "24-48 hours"; ticker labels "Verified profiles / Expertly matched" (`Home.jsx:817`) and "connecting families through verified profiles" (Home.jsx:1566) though verification is optional (Terms.jsx:132-133 says so).
- "40+ signals" (`Home.jsx:467,493`) — no basis (prior review A-14).
- "Every profile is from Chandigarh, Mohali, or Panchkula, or has direct family ties" (`Home.jsx:479`, `Help.jsx:44`) — no code enforces city/tie; NRI plan also exists.
- "Reports reviewed within 24 hours", "We respond within 24 hours" (Safety.jsx:44,112; Help.jsx:94; Home.jsx:1444) vs Contact.jsx "24-48 hours" vs RefundPolicy/Terms "two working days" — three different commitments, none measured in code.
- "most carefully verified matchmaking community" (Home.jsx:735).
- `frontend/src/i18n/locales/en.json:73,76` still contain "Background check" strings for the removed feature; `e2e/tests/09` still tests the removed bg-check endpoints (stale, would fail).
- Positive: Terms.jsx:133 explicitly disclaims background/income/marital checks.

### P13-20 Items I could not assess from the repo — OPS/PROVIDER
Registered entity and GST status; Play/App Store data-safety forms vs actual collection; mailbox provisioning; DPA/contract set; hosting jurisdiction of VPS 178.16.138.82 (Hostinger) and Cloudinary/Resend regions; DLT registration; existence of an incident response plan; Sentry/FCM setup; whether Razorpay live activation is complete.

---

## 2. Test inventory

Runner-reported (executed), not grep estimates:

| Suite | Location | Files | Tests |
|---|---|---|---|
| Backend unit (Jest 30) | `backend/tests/unit/*.test.js` | 60 | 629 |
| Backend "integration" (mocked models — needs NO DB despite the name) | `backend/tests/integration/auth.test.js` | 1 | 15 (10 pass / 5 FAIL) |
| Frontend (Vitest 4 + RTL) | `frontend/src/tests/{components,utils}` | 16 | 127 |
| Mobile (Jest 29 / jest-expo) | `mobile/src/**/*.test.ts(x)` | 9 | 70 |
| E2E Playwright (projects: desktop-chrome, mobile-chrome, tablet) | `e2e/tests/01…09*.spec.js` | 9 | ≈77 test() declarations (10+1+7+21+3+8+4+5+18) × 3 projects — NOT RUN (needs live stack) |
| Load/perf scripts (k6) | `scripts/load-test.js`, `load-test-1k.js` | 2 | login, `/auth/me`, `/search?page=1&limit=10`, `/health`; thresholds p95<500ms, err<1% |
| Probes | `scripts/a11y-probe.mjs`, `tap-target-probe.mjs`, `lcp-probe.mjs`, `slop-lint.mjs`, `scan-secrets.mjs` | — | not run |

CI (`.github/workflows/ci.yml`): backend job (lint, migrate:test, `jest --ci --coverage`), frontend job (tsc, `vitest run --coverage`, build), security-scan (secret scan, npm audit), docker build. **CI does not run mobile jest, e2e, k6 or a11y probes.**

Backend unit suites by topic (tests): sanitize 38, lifecycleMail 32, validators 25, launchOffer 24, productionEnvGuard 19, errorHandler 16, planTiers 15, entitlements 14, socialLinks 14, freeReplyWindow 13, flexibleAuth 12, emailUnsubscribe 12, subscriptionWebhook 11, profileVisibilityGate 11, paymentReplay 11, foundingGrant 11, adminScopes 11, logRedaction 10, plus 40 smaller suites (accountErasure 8, adminManualRefund 8, socketRevocation 7, requireAdminScope 7, lockoutIdentifier 7, callChannelAuthz 7, uploadMagicBytes 5, groupAuth 3, limiterCoverage 3, routeManifest 3, …).

Frontend: chatRich, dashboardStates, searchStates, dobField, smartContactField, verificationStepEmail, foundingWindow, planFeatureCopy, planLadder, routeGuards (7), unsubscribePage, retryImage, inviteSurfaces, notificationLinks, profileSubmit, validators.
Mobile: passwordRule, entitlements, profileCode, apiConformance (checks RN api paths vs server route manifest), matchAction, planMaps, SheetModal, useReduceMotion, motion.
Coverage measurement (backend unit only, real run): **statements 32.78%, branches 21%, functions 26.03%, lines 34.05%** vs the configured global threshold of 60% in `backend/jest.config.js` — `npm run test:ci` (which CI runs) exits non-zero on threshold alone, independent of the 5 failing integration tests.

---

## 3. Coverage map (Phase 14 checklist → existing coverage)

Rating: COVERED (real logic exercised) · PARTIAL (mocked/pure-function only, or one facet) · GAP (nothing).

| ID | Checklist item | Existing tests | Rating / note |
|---|---|---|---|
| P14-01 | Registration success/failure | `integration/auth.test.js` (signup, mocked), `validators.test.js` (signup rules, underage), `flexibleAuth`, `smsNormalizePhone`, `authDerivedFields` | PARTIAL — integration signup test currently **fails** (400; signup now requires a verified mobile, commit 7b170f1) |
| P14-02 | OTP send/verify/expiry/lockout | `smsNormalizePhone`, `lockoutIdentifier`, `limiterCoverage`; frontend `smartContactField`, `verificationStepEmail` | PARTIAL — no test of OTP TTL/expiry, wrong-code attempts limit, bypass-code guard (guard covered by `productionEnvGuard`), verify→signup consumption, `send-otp` 409 existence gate |
| P14-03 | Invalid inputs / validators | `validators.test.js` (25), `sanitize.test.js` (38), `profileFieldsAllowlist` | COVERED for validators; no DOB/age test on **profile update** (and the validator has none — P13-08) |
| P14-04 | Unauthorised profile modification (mass-assignment/IDOR) | `profileFieldsAllowlist`, `credentialSerialization`, `profileSubscriptionLeak` | PARTIAL — allowlist yes; no test that user A cannot PUT/DELETE user B's photo/profile (routes derive id from token, untested) |
| P14-05 | Search eligibility / privacy / blocking | `profileVisibilityGate` (assertProfileVisible unit, mocked models) | **GAP** for `searchController` (0 tests): visibility filter, banned/deleted exclusion, blocked exclusion, boost ordering, photoless demotion, pagination clamps |
| P14-06 | Interest/match state transitions & duplicates | none direct (`deriveReasons`, `freeReplyWindow` incidental) | **GAP** — `matchController` untested: like→mutual, reject/undo, duplicate action, block interaction, daily-set cache |
| P14-07 | Paid entitlements & expired memberships | `entitlements` (14; expiry filtered in-query, fail-closed), `planTiers`, `freeReplyWindow`, `foundingGrant`, `withdrawnTier`, `plansFoundingWindow`, `contactNumber`; FE `planFeatureCopy/planLadder`; mobile `entitlements` | COVERED at unit level (mocked models); unlimited daily cap & unlock quota accounting not tested end-to-end |
| P14-08 | Forged payment callbacks / duplicate webhooks | `razorpay.test.js` (HMAC verifyPayment: bad/short/undefined sig), `subscriptionWebhook` (idempotent re-delivery, unknown order, revive/supersede, payment.failed), `cancelOrder`, `googlePlayProducts` | PARTIAL — **the webhook signature middleware (`routes/subscriptionRoutes.js:45-81`, missing/invalid `x-razorpay-signature` → 401) has no test**; `verifyPayment` controller (order↔user binding, amount check) untested; `paymentReplay.test.js` asserts *local copies* of formulas/predicates (see §5 quality note) |
| P14-09 | Unauthorised profile/contact/photo access | `profileVisibilityGate`, `contactNumber`, `profileSubscriptionLeak`, `socialLinks` | PARTIAL — unlock-contact quota/cross-user, photo-blur-until-match serialisation untested |
| P14-10 | Messaging & Socket.io authz | `groupAuth` (3), `socketRevocation` (7: banned-mid-session, join rate limit), `socketEventContract` (4), `freeReplyWindow`, `callChannelAuthz` (7) | PARTIAL — no test of `send-message` anti-spoof, mutual gate on 1:1 rooms, typing gate, REST `chatController` send/edit/delete ownership; **no test that blocked users cannot message/call (P13-13)** |
| P14-11 | Report / moderation / account-deletion | `accountErasure` (8, mocked models — pins which tables are touched), `adminManualRefund`, `supportReply` | PARTIAL/GAP — `reportUser`/`blockUser`/`adminSafetyController` untested; deletion test never checks Cloudinary, Google-only accounts, or against a real schema |
| P14-12 | Admin RBAC & audit logs | `adminScopes` (11), `requireAdminScope` (7), `routeManifest` (3) | PARTIAL — the scope helpers are tested, but **nothing asserts every admin route carries `requireAdminScope`** (adminRoutes.js is hand-wired) and no test asserts `logAudit` is called/persisted per action, or that AuditLog write failure is non-fatal |
| P14-13 | DB concurrency / transaction rollback / queue retries | `lifecycleLedger` (real models, claim-before-send), `lifecycleMail` (32), `inviteRewardAbuse`, `foundingGrant`, `cacheScan` | PARTIAL — row-lock behaviour (`freeReplyWindow` grant race, reaction toggle, payment activation) is mocked; CLAUDE.md says a Postgres race probe passed once but no committed test; Bull retry/backoff untested |
| P14-14 | Mobile responsiveness & critical journeys | e2e project `mobile-chrome`/`tablet` (03-visual, 04-ux); mobile jest = api/util/motion only | GAP for native critical journeys (no Detox/Maestro; e2e 09 has `test.skip` for offline). Device passes are manual (docs/QA_FINAL_2026-08-20.md, plan docs) |
| P14-15 | Accessibility / loading / error / empty / offline | `06-accessibility.spec.js` (axe, e2e), FE `dashboardStates`, `searchStates`, `unsubscribePage`, mobile `useReduceMotion`, `SheetModal` | PARTIAL — e2e/axe not in CI; no VoiceOver/TalkBack; offline states untested |
| P14-16 | Performance (search/profile/messaging) | `scripts/load-test.js` (login, me, search p95<500ms) + `load-test-1k.js`; e2e `07-performance` | PARTIAL — **no profile-detail, chat/messages, or socket load**; not in CI; results 2026-08-17 (1000 VU, p95 413 ms local) quoted in docs, not re-run here |
| P14-17 | Security headers / CORS / limiter coverage | `frameAncestors`, `limiterCoverage`, `productionEnvGuard`, `logRedaction`, `uploadMagicBytes`, `emailTemplateEscaping` | COVERED (unit) |
| P14-18 | Legal/compliance behaviours (consent, unsub, erasure, age) | `emailUnsubscribe`, `promotionalMailOptOut`, `accountErasure`, `validators` (signup 18+) | GAP: no test of consent stamping/`termsVersion`, age-by-gender, DOB update guard, version-constant lockstep, deletion for Google accounts |
| P14-19 | Client↔server contract | `routeManifest` + mobile `apiConformance` | COVERED for paths (not response shapes — history of envelope bugs) |

## 4. Tests actually run

All run locally, no DB/network to real services; Node from workspace.

| # | Command (cwd) | Result |
|---|---|---|
| 1 | `npx jest tests/unit` (backend) | **PASS** — 60 suites, 629 tests, 0 failures, Jest-reported 6.3s (wall 6.9s). Noisy console output from intentionally-logged errors; `emailDryRun` "actually sends" test uses a `fetch` spy (no real send). |
| 2 | `npx vitest run` (frontend) | **PASS** — 16 files, 127 tests, 1.64s |
| 3 | `npx jest` (mobile) | **PASS** — 9 suites, 70 tests, 1.17s |
| 4 | `node_modules/.bin/tsc --noEmit -p tsconfig.json` (mobile) | **exit 0**, no output |
| 5 | `NODE_ENV=test npx jest tests/integration` (backend) — mocked models/DB/email, so safe | **FAIL — 5 failed, 10 passed (15), 0.55s.** Failing: signup "should create a new user with valid data" (expected 201, got 400 — consistent with signup now requiring a verified mobile, commit 7b170f1); login ×4 (valid creds, wrong password, non-existent email, inactive user — expected 200/401/401/403, got 500; root cause not isolated: the test posts `{email,…}` which the controller still accepts, so this is most likely stale mock surface vs current `login`). Pre-existing stale tests: CLAUDE.md claims 116/… green and never mentions this suite. |
| 6 | `NODE_ENV=test npx jest tests/unit --coverage --coverageReporters=text-summary --coverageDirectory=<scratchpad>` | 60/60 suites pass; coverage 32.78% stmts / 21% branches / 26.03% funcs / 34.05% lines; **Jest exits with threshold failures (60% global)** |

Not run (by rule or need): e2e Playwright (live stack), k6 load scripts (need a running server; never against prod), a11y/lcp probes, lint/slop-lint, frontend build.

Numbers differ from CLAUDE.md's last-recorded figures (BE 507, FE 121, mobile 61/70): current real counts are BE 629 unit, FE 127, mobile 70.

## 5. Untested areas and test-quality problems

**Untested controllers/modules (0 tests):** `searchController`, `matchController`, `chatController` (REST), `socketHandler` (1:1 send/typing/edit/delete; only group join + revocation), `blockReportController`, `adminSafetyController`, `notificationController`, `verificationController`, `contactController`, `callController.initiate` mutual gate (only token authz tested), `inviteController` (reward logic tested), `statsController`, `analyticsController`, most of `authController` (login lockout wiring, refresh rotation/family revoke, google, send-otp/verify-otp, change-password, sessions), `subscriptionController.createOrder/verifyPayment/getPlans`, `utils/kundli|biodata|invoice|compatibility`, routes middleware wiring generally (only manifest + limiter coverage).

**Test-quality problems (mocks hiding real-model bugs):**
1. 21 unit suites `jest.mock('../../models')` wholesale; only 5 suites touch real model definitions (`clientAnalytics`, `credentialSerialization`, `emailUnsubscribe`, `lifecycleLedger`, `profileFieldsAllowlist`). This is exactly how `lifecycleMail` JSONB was never declared on the models yet every mocked test passed (the 2026-09-19 mail flood; `lifecycleLedger.test.js` exists only because of that) and how the `usageCount` unquoted-literal referral bug and the missing `profileVisibility` model columns shipped. There is no test that loads models against a real (even in-memory/pg-mem/CI Postgres) schema and compares model attributes to migrations.
2. `paymentReplay.test.js` re-implements the refund formula and idempotency/binding predicates **inline** ("Mirrors the formula in …", "old predicate"/"new predicate") and asserts on those copies — it does not import the controller, so it passes even if the controller regresses; its refund half also documents a code path that was deleted (auto-refund removed 2026-09-17). Same shape risk in H-6/H-7 astrologer binding (feature-flagged).
3. `accountErasure.test.js` mocks every table's `destroy` and pins "touches these tables" — it cannot detect FK failures, missing tables added later, or the Cloudinary orphan gap.
4. `integration/auth.test.js` is called "integration" but mocks models/DB, so it exercises nothing real, is excluded from the `test:unit` script, and has been silently failing (5/15) — if CI runs it, the backend job is red; if CI is ignored, red is normalised.
5. Coverage threshold (60%) is unreachable at 33% measured — CI `test:ci` cannot be green; the gate is either being bypassed or ignored.
6. `e2e/tests/09-sessions-13-16-features.spec.js` still asserts removed bg-check endpoints; e2e is not in CI and was last run per docs on a prior release; auth-flow login helpers were rewritten for the progressive login only once (2026-07-03/04).
7. Load scripts hit only 4 endpoints and are not run in CI; no baseline result committed with the current single-plan/founding-window code.

**Suggested top-priority additions (for whoever fixes):** (a) a schema-real test tier (Postgres in CI, sync from migrations) for auth/subscription/match/chat; (b) webhook-signature middleware test; (c) block-vs-chat/call/socket test (P13-13); (d) route→scope completeness test for `adminRoutes`; (e) DOB/age tests for profile update + Google sign-up; (f) erasure test that stubs Cloudinary and asserts deletion of every media URL; (g) version-lockstep test for TERMS_VERSION/legal.termsUpdated/mobile LEGAL_UPDATED; (h) Dockerfile/compose test (or CI grep) that every `import.meta.env.VITE_*` read in `config/index.js` has a matching build ARG.

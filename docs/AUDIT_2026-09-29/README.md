# TricityMatch — Full-Platform Audit and Gap Analysis (2026-09-29)

Status: **AUDIT ONLY. No fixes applied.** Implementation is waiting on owner review of this report.
Repo state audited: `main` @ `7b170f1`.
Method: six parallel read-only auditors, one per phase group, each writing a detailed file (linked below). This file is the merged summary, the cross-cutting findings, the roadmap and the launch checklist. The per-phase checklist tables (roughly 250 requirement IDs with status, severity and evidence) live in the detail files.

## 0. How to read this, and what "verified" means here

| Label | Meaning |
|---|---|
| **[CODE]** | Read in source with file:line evidence. Not executed against a live system. |
| **[RAN]** | Reproduced with a local, in-process probe (validator lib, Express router, bcryptjs, a copy of a function). No DB, no prod. |
| **[LEAD-CHECKED]** | Reported by an auditor, then re-read in source by the lead. |
| **NOT VERIFIED** | Needs prod host, third-party dashboards, hardware, or a live DB. Not claimed. |

Limits of this audit:
- **Static.** No finding was reproduced against a running server with a database. "Exploitable" is stated only where the code path is unambiguous and its prerequisites are named.
- **No production access.** Host nginx, SSH hardening, off-box backups, provider dashboards (Razorpay, Resend, MSG91, Cloudinary), Play/Apple consoles are NOT VERIFIED.
- **Not legal advice.** Section 7 separates code gaps from matters for Indian counsel.
- The auditors were told to treat `CLAUDE.md` claims as leads. Several claims there are now shown wrong (see 9).

Detail files (each has a checklist table, ranked findings, workflow maps where relevant):

| File | Phases |
|---|---|
| [A_architecture_security_P1_P12.md](A_architecture_security_P1_P12.md) | 1 architecture inventory, 12 security and infrastructure (37 findings) |
| [B_onboarding_profile_privacy_P2_P3_P8.md](B_onboarding_profile_privacy_P2_P3_P8.md) | 2 registration, 3 profile data, 8 privacy and account |
| [C_photos_search_P4_P5.md](C_photos_search_P4_P5.md) | 4 photos and verification, 5 search and matching (has a per-endpoint exclusion matrix) |
| [D_messaging_notifications_P6_P11.md](D_messaging_notifications_P6_P11.md) | 6 interests, sockets, messaging, 11 notifications and jobs |
| [E_payments_moderation_admin_P7_P9_P10.md](E_payments_moderation_admin_P7_P9_P10.md) | 7 payments, 9 moderation, 10 admin and support |
| [F_legal_tests_P13_P14.md](F_legal_tests_P13_P14.md) | 13 legal and operational gaps, 14 test inventory and the tests actually run |

---

## 1. Executive summary

**Maturity.** The platform is a real, broad product: 198 route handlers, 29 models, 64 migrations, web plus RN, admin with scoped sub-admins, a single-plan pricing layer, lifecycle mail, consent records. The perimeter is strong. The gaps are in **authorization between members**, **privacy enforcement across listing endpoints**, **safety tooling** (block, report, appeals) and **compliance plumbing** (erasure, export, disclosures, retention). Prior security audits (Aug 2026) fixed the classic problems and this audit confirms them.

**Verified working** (evidence in the detail files):
- No SQL injection found. All raw SQL is parameterised or escaped.
- Mass-assignment blocked by the `PROFILE_EDITABLE_FIELDS` allow-list.
- Razorpay webhook: HMAC over raw body, timing-safe compare, idempotent activation, unique payment-id indexes.
- REST object-level access: profile, compat, horoscope, PDF, invoices, sessions, notifications, guardians, Agora tokens.
- Every admin route carries a scope check; `/admin/team` escalation guards hold.
- CORS, CSRF (SameSite=Strict + Origin rules), CSP on the SPA, secure cookies, refresh rotation with reuse detection.
- Prod boot guard rejects weak or reused secrets, master OTP codes and insecure-mode flags.
- No card data stored. No committed secrets (one scanner false positive).
- Pricing computed server-side. Entitlements checked in the chat, unlock and premium gates.

**Highest-risk findings** (all detailed in section 2):
1. **Private chat rooms readable by a third member** via socket `join-room` [LEAD-CHECKED].
2. **Block does not stop contact.** Chat, voice, calls, sockets and family groups ignore it, and the mutual match survives. Reported independently by five of six auditors.
3. **Any logged-in socket can crash the API** with a payload-less `typing` event [LEAD-CHECKED].
4. **Profile privacy is enforced in some listings and not others.** `matches_only`, incognito, banned status, photo blur and voice/video URLs are bypassed by daily matches, suggestions, by-code, likes and search.
5. **Erasure is incomplete and Google-only accounts cannot delete.** Cloudinary media is never destroyed. The Privacy page says it is erased.
6. **Age gate contradicts the published Terms** (flat 18 enforced, 21 male / 18 female published), and DOB and gender can be edited without limit.
7. **Signup identity proof is bypassable** with a client-set header [LEAD-CHECKED], and Google sign-in can inherit an attacker's unverified-email account.
8. **No Report or Block button exists on web** [LEAD-CHECKED], while Terms, Safety and Help promise both. No appeals process, no legal-request workflow.
9. **Money handling gaps:** no refund, dispute or chargeback handling; invoices issued for unpaid and comped rows with no GST breakup or sequential number; bundle purchases have no webhook fallback.
10. **Statutory disclosures cannot render in production** because the `VITE_LEGAL_*` values are not Docker build args.

**Launch verdict.** Not ready for a public marketing launch until the P0 list (section 8) is closed. The site can keep serving its current small member base, but items 1 to 4 are member-safety and privacy defects that scale with membership.

Two suspicions from earlier audit notes were checked and are **not** problems: multer 1.x has no advisory in the current `npm audit` database, and the "ungated prod `console.log`" calls are all dev-gated.

---

## 2. Consolidated findings (deduplicated, ranked)

Severity is the auditors' rating, adjusted where two auditors disagreed (noted). "Src" points to the detail-file finding IDs.

### 2.1 Critical / High

| # | Finding | Sev | Status | Src |
|---|---|---|---|---|
| H1 | **Socket `join-room` joins the client-supplied room string.** It verifies mutual match with the first id that is not the caller, then joins the whole string. A member who is a mutual match of X, with chat access, can join `X_room_Y` and receive live messages, edits, deletes, reactions and typing for X and Y. Prerequisites: chat access, one mutual match, knowing a victim id. Rated Critical by D, High by A. | High (Critical by impact) | [LEAD-CHECKED] `backend/socket/socketHandler.js:241-267` | A F-01, D P6-20 |
| H2 | **Block is cosmetic.** `blockUser` inserts a row only. It is absent from chat send/read/voice/reactions, calls, group add, socket `verifyMutualMatch`, and the mutual / likes / shortlist / viewers / conversation lists. The mutual `Match` stays. Only new likes, search and profile view honour it. | High | [CODE] (5 auditors) | A F-02, C F-01, D P6-10..16, E P9-12, F P13-13 |
| H3 | **Unauthenticated-payload crash.** `typing` handler destructures `{receiverId,isTyping}` with no try/catch; `get-online-status` with a malformed UUID also rejects. `server.js:476-488` treats any unhandled rejection as fatal. Any logged-in socket takes the API down (single container, so it is an outage until restart). | High | [LEAD-CHECKED] `socketHandler.js:299`, `server.js:486` | D P6-22 |
| H4 | **Family groups bypass every gate.** Any user, including a free one, can add any other user by id or phone with no accept step, no Block check and no mutual-match or premium check. A hit returns 201 with the member row and a miss 400, so it is also a phone-to-user-id oracle at 60 req/min. | High | [CODE] | E P9-13, A F-23, D P6-29 |
| H5 | **Listing endpoints skip privacy gates.** `/match/daily` returns the raw Profile row (exact DOB, birth time and place, exact income, `savedSearches`, `quizAnswers`, social links, voice/video URLs), ignores `matches_only`, incognito, blur and banned status, and caches per viewer per day with no invalidation. `/search/by-code` and `POST /match/:id` ignore `matches_only` and target status. Suggestions, likes, saved, sent and recently-viewed return real photos regardless of blur. Search leaks voice/video URLs to free viewers. `GET /profile/:id` has no serializer either (Medium there). | High | [CODE] | B P8-01/P8-11/P3-09/P3-11, C F-02/F-03/F-07, A F-10 |
| H6 | **Erasure incomplete.** No Cloudinary destroy (photos, gallery, selfie, voice/video, voice messages) on erasure, admin photo removal or selfie resubmission; voice/video destroy uses the wrong `resource_type` and silently no-ops. Other members' cached daily sets keep the erased profile. `MarketingLeads` PII is untouched. Sockets stay connected. Privacy s.13 says "erased immediately". | High | [CODE] | B P8-07, C F-06, A F-13, F P13-05 |
| H7 | **Google-only accounts cannot delete or reset.** `comparePassword` and the reset fingerprint throw on a null password: delete returns 500, `forgot-password` returns 500 for exactly those emails (account-type oracle). Latent while Google sign-in is off in prod. | High for erasure right / Medium otherwise | [RAN] | A F-08, B P8-05/P2-04 |
| H8 | **Age gate contradicts Terms.** Terms and Privacy publish 21 (men) and 18 (women). Every validator, model hook and client enforces a flat 18. Gender selects the threshold and is freely editable. Profile update has no upper bound. Google signup fabricates DOB 2000-01-01. DOB and gender can be changed repeatedly with no lock or audit. Owner and counsel must decide which side is right. | High | [CODE] | B P2-08/P2-09/P2-10, F P13-08 |
| H9 | **Login canonicalisation mismatch.** Signup runs `normalizeEmail` (strips Gmail dots and `+tag`), login does not, so those members cannot log in and each failure counts toward lockout. OTP send/verify use different key casing, so `emailVerified` never becomes true for them. | High | [RAN] | A F-03, B P2-03 |
| H10 | **Global sanitiser deletes any string starting with `$`.** A password such as `$Secret123` cannot register or log in; `$500...` chat messages and bios vanish. No NoSQL layer exists so the rule buys nothing. | Medium (functional) but breaks auth | [RAN] (two auditors) | A F-09, B P2-05 |
| H11 | **Signup identity proof bypass.** `X-App-Client: mobile` skips the verified-mobile requirement, and on that path no OTP at all is needed for email or phone. Enables squatting on others' contacts and cheap fake accounts (invite-reward farming about 60 unlocks per inviter). Also Google sign-in links to an existing unverified-email account and keeps the attacker's password and live refresh tokens. | Medium (High if squatting matters) | [LEAD-CHECKED] `authController.js:244-251`; Google link [CODE] | A F-04/F-05, B P2-02 |
| H12 | **No Report or Block UI on web.** No component calls a report or block endpoint. Terms, Safety and Help promise both. RN has a sheet. | High | [LEAD-CHECKED] | E P9-02 |
| H13 | **No appeals, no legal-request or evidence-preservation workflow, no escalation path for threats or underage reports.** Erasure and hard delete destroy evidence. Report categories are incomplete. Reports have no assignment or priority. | High (legal) | [CODE] | E P9-06/P9-11/P9-14/P9-03 |
| H14 | **Refund, dispute, chargeback handling missing.** Admin refunds do not revoke the plan. Invoices are issued for cancelled-unpaid and admin-comped rows, and carry no GST breakup, GSTIN or sequential number (titled "Payment Receipt"). Revenue report correctness and stale-order revival issues in E. | High | [CODE] | E P7-10/P7-11/P7-15/P7-17/P7-18 |
| H15 | **Bundle purchases have no webhook fallback** and verify sits behind `requirePremium`; a closed browser or lapsed plan means money taken, no credit, no reconciler. Astrologer bookings same shape (flag-dark). | Medium | [CODE] | A F-17, E P7-16 |
| H16 | **Statutory disclosures cannot render in prod.** `VITE_LEGAL_*` and grievance-officer values are not Dockerfile ARGs or compose build args, so entity, address, GSTIN and officer name can never appear. Grievance Officer is still unnamed. | High (legal, ops) | [CODE] | F P13-01/P13-02 |
| H17 | **CERT-In retention not met.** Docker json-file rotation keeps about 30 MB per container against a 180-day expectation. | High (ops) | [CODE] | F P13-07 |
| H18 | **No data export**, though the signup consent copy says "export". | High (compliance honesty) | [CODE] | B P8-09 |
| H19 | **Sub-admin with `users` scope can ban any user including full admins**; the last-admin guard is bypassed on this route. No MFA for admin, sub-admin or marketing roles; admin-created passwords skip the policy. | Medium-High | [LEAD-CHECKED] `adminController.js:225-255` | A F-11/F-12, E P10-09/P10-10 |
| H20 | **"Compatibility" sort is not a ranking.** It reorders only within a `createdAt DESC` page, so the default discovery order is newest-first. Ranking factors are not configurable or explainable. | High for a matchmaking product | [CODE] | C F-04 |
| H21 | **No image moderation of any kind**, and no policy path for stolen photos beyond manual report review. | High | [CODE] | C F-05 |

### 2.2 Medium

| # | Finding | Src |
|---|---|---|
| M1 | OTP: 4-digit phone code from `Math.random`, non-atomic attempt counter, resend resets attempts, verified-marker not bound to the requester, email OTP has no per-target send cap. | A F-06, B P2-01, D P11-03/04 |
| M2 | SMS pumping: any 10-15 digit number accepted; foreign numbers can never complete signup so they are pure cost. No global budget. | A F-07 |
| M3 | Redis `allkeys-lru` holds OTP, lockout, rate-limit keys and Bull queues (Bull needs `noeviction`). OTP codes plaintext in AOF. | A F-14 |
| M4 | Dependencies: backend 21 vulns (4 high, nodemailer direct), frontend 8. Backend image on unpinned `node:20-alpine` (Node 20 EOL to be confirmed) built without a lockfile. CI security job would fail on `nodemailer` and on a scanner false positive. | A F-15/F-16 |
| M5 | Cloudinary delivery is public and unsigned, including verification selfies and voice notes. Blur and visibility control URL disclosure only. | A F-18, C F-12 |
| M6 | Verified badge is never re-evaluated after photo, name, DOB or gender change. Verification can be self-approved (check C F-08). Selfie "live only" not enforced server-side. | B P3-13, C F-08 |
| M7 | Verification and safety copy overstates: "no uploads", "selfie records only the result", "we verify every member by hand" versus code. | C F-09, F P13-19 |
| M8 | Consent is stamped by the server at account creation, not asserted by the client. No re-consent on Terms version bump. No separate consent for sensitive data or marketing. Guardian-created profiles have no subject consent record. | B P2-07/P2-11, F P13-03/04/09 |
| M9 | No interest state machine: no withdraw, `isMutual` is sticky after a pass, a re-like on a mutual pair re-sends match emails. Simultaneous likes can lose the mutual. | D P6-03/04/06/07, C F-11 |
| M10 | Notification preferences exist only in web localStorage. Queue and cron alerts are dead. Weekly digest reaches only the first 500 users. Message retention job is off unless `MESSAGE_RETENTION_MONTHS` is set. | D P11-11/13/15, A §1.7 |
| M11 | Backups: prod was plaintext local-only `pg_dump` per the Aug live-test doc; encrypted script and restore rehearsal not evidenced. DB app user is the superuser by default. | A F-14b/F-20 |
| M12 | Service worker caches authenticated API GETs (profiles, chat pages, unlocked contacts); cleared on logout but not on all paths. | A F-37 |
| M13 | Partner preferences: about half the requested dimensions absent, no must-have vs preferred, height range unvalidated. Several profile fields missing (nationality, relocation, institution, industry, employer, living arrangement). | B P3-01..05 |
| M14 | `getProfile` computes premium access without an `endDate` predicate; `requireChatAccess` at router level cannot see route params (free-reply window logic may not apply as intended on `/chat/messages/:userId`). Confirm before fixing. | A F-25/F-26 |
| M15 | Guardian flow: auto-active link for existing users with no acceptance; pending invites for unknown emails are never delivered and no code resolves them; expired pendings block the 3-guardian cap. | B P2-12 |
| M16 | No phone or URL policy in like notes and chat; malicious-link and financial-request handling absent. | D P6-25, E P9-10 |
| M17 | Audit log coverage incomplete for admin mutations and sensitive reads; admin CSV export has formula-injection gap; no per-member moderation history view. | E P10-11/P10-14 |
| M18 | Phone-only accounts have no self-serve password recovery. | A F-22, B P2-04 |

### 2.3 Low / Informational
See the detail files: timing oracle on login, token-rotation race, stored double-encoded output, missing inline validation on several admin and group routes, DB FK drift vs migrations, logs carrying phone and email in message strings, `showPhone`/`showEmail`/`showLastSeen` toggles that do nothing, RN release signed with the committed debug keystore.

---

## 3. Architecture map (summary)

Full map in [A_architecture_security_P1_P12.md](A_architecture_security_P1_P12.md) section 1. Short form:
- **API:** Node 20, Express 4.22, Sequelize 6 / PostgreSQL 15, ioredis, Bull, Socket.io 4.8, umzug auto-migrate on prod boot. 198 handlers, every `/api/v1` path also mounted at `/api`.
- **Web:** React 18 + Vite, service worker, i18n en/hi/pa. **Mobile:** Expo SDK 52 / RN 0.76.
- **Edge:** prod uses the **host nginx** (not in the repo, NOT VERIFIED). The compose nginx service is not what prod runs.
- **Redis:** limiters, lockout, OTP, caches, Bull, all in one instance. Presence is in-memory Socket.io rooms (single process, no adapter).
- **Media:** Cloudinary, public unsigned URLs. **Providers:** MSG91 (SMS), Resend (email), Razorpay + Google Play, Agora, FCM.
- **Roles:** user, marketing, marketing_manager, sub_admin, admin, super_admin; 10 admin scopes.
- **Cron:** token cleanup, subscription expiry, message retention (off by default), session cleanup, weekly digest, saved-search alerts, lifecycle mail, photo nudge.

## 4. Phase roll-up

| Phase | Verdict | Biggest gaps | Detail |
|---|---|---|---|
| 1 Inventory | Done | none | A |
| 2 Registration | PARTIAL | age gate, header bypass, consent assertion, DOB/gender edits, guardian invites | B |
| 3 Profile data | PARTIAL | partner-preference model, missing fields, over-exposed row, badge integrity | B |
| 4 Photos and verification | PARTIAL | no moderation, public media, badge never revoked, copy overstates | C |
| 5 Search and matching | PARTIAL | visibility filters inconsistent, sort is not ranking, by-code | C |
| 6 Interests and messaging | **FAIL** | room join, block, no state machine, group bypass, crash | D |
| 7 Memberships and payments | PARTIAL | refund/dispute/chargeback, invoices and GST, bundle webhook | E |
| 8 Privacy and account | **FAIL** | erasure, export, Google-only delete, listing leaks | B |
| 9 Moderation and abuse | **FAIL** | no web report/block UI, no appeals, no escalation, no legal workflow | E |
| 10 Admin and support | PARTIAL | no MFA, status route rank guard, audit coverage, grievance tracking | E |
| 11 Notifications and jobs | PARTIAL | preferences, dead alerts, OTP hardening, digest cap | D |
| 12 Security and infra | PARTIAL | dependencies, image, backups, Redis policy, host items not verifiable | A |
| 13 Legal and compliance | Needs counsel | see section 7 | F |
| 14 Testing | PARTIAL | see section 6 | F |

## 5. Workflow maps

Maps showing implemented steps and **missing transitions** are in the detail files:
- Registration, profile completion, deletion, data-subject rights: [B section 3](B_onboarding_profile_privacy_P2_P3_P8.md)
- Search to profile view, with per-endpoint exclusion matrix: [C sections 3 and 4](C_photos_search_P4_P5.md)
- Interest to mutual to contact reveal, blocking, notification pipeline: [D section 3](D_messaging_notifications_P6_P11.md)
- Payment and entitlement, reporting, moderation, blocking, admin privilege model: [E section 3](E_payments_moderation_admin_P7_P9_P10.md)

The one-line versions of the missing transitions:
- **Registration:** no email-link verification, no server-side terms assertion, no re-consent, no gender-aware age rule, OTP proof not bound to the signup.
- **Interest:** no withdraw, no decline distinct from pass, `isMutual` never cleared.
- **Contact reveal:** works and is quota-guarded, but reveals email regardless of `showEmail` and ignores `showPhone`.
- **Payment:** no refund or dispute event handling, no bundle webhook path.
- **Reporting:** no web entry point, no assignment, no escalation, no appeal, no evidence preservation.
- **Blocking:** no severing of chat, calls, groups, sockets or match.
- **Deletion:** no media destroy, no cache purge, no lead scrub, no grace period, no processor propagation.

## 6. Test report

Executed by the Phase 13/14 auditor. Full commands and output in [F section 4](F_legal_tests_P13_P14.md).

| Suite | Result |
|---|---|
| Backend unit (`npx jest tests/unit`) | 629 passed |
| Frontend (`npx vitest run`) | 127 passed |
| Mobile jest | 70 passed |
| Mobile `tsc --noEmit` | exit 0 |
| Backend `tests/integration/auth.test.js` | **5 of 15 fail** (stale, needs a live DB and is out of date) |
| Backend unit coverage | 33% against a 60% Jest threshold |

Not run: e2e (needs live stack), load test, anything against production. Results above are what the auditor reported; the lead did not re-run them.

Gaps (from F section 3): no test for the socket room-join parse, block enforcement across channels, the webhook signature middleware, erasure propagation, listing-endpoint privacy filters, or signup-to-login canonicalisation. Mocked models hid the earlier `lifecycleMail` column bug; the same risk applies to any test that mocks a model.

Three proof-of-concept scripts by Agent D (`poc_room.js`, `poc_crash.js`, `poc_crash2.js`) run the real socket handler against a stubbed DB and are in the session scratchpad, not the repo.

## 7. Legal and operational gaps (not legal advice)

Full breakdown by owner in [F section 1](F_legal_tests_P13_P14.md).

**Code deficiencies** (fixable by engineering): legal disclosure env vars not reaching the build; erasure and export; age gate; consent assertion and re-consent; block enforcement; invoice content (GST, sequence); unsupported copy claims; log retention config; report and appeal tooling.

**Needs Indian counsel:** which age rule is intended (21/18 versus 18 flat), DPDP notice and consent design (including special categories such as caste and religion), guardian-created profiles and subject consent, intermediary due-diligence duties and timelines, consumer-law refund and cancellation terms, AI-generated imagery disclosure, cross-border processor list, law-enforcement request handling.

**Needs provider confirmation:** Razorpay `payment.failed`, refund and dispute webhook events enabled; MSG91 DLT template for a longer OTP; Cloudinary delivery type and retention; Resend log retention; processor deletion paths.

**Needs owner or operations:** name of the Grievance Officer and mailbox; support mailbox somebody reads; entity name, address and GSTIN for the footer; incident-response and CERT-In reporting runbook; encrypted off-box backups with a restore rehearsal; host hardening (SSH, fail2ban), which the owner declined on 2026-08-18.

## 8. Prioritised roadmap

Complexity: S under a day, M one to three days, L a week or more. Every P0 item should ship with the listed test.

### P0 — member safety, privacy, legal blockers, broken core

| # | Item | Files / modules | Depends on | Cx | Acceptance criteria | Tests |
|---|---|---|---|---|---|---|
| P0-1 | Fix socket `join-room`: server derives the room from `getRoomId(userId, otherUserId)`; reject any string that is not exactly two parts including the caller | `backend/socket/socketHandler.js` | none | S | A third member cannot receive a pair's events | 3-account socket test (attacker mutual with X joins `X_room_Y`, receives nothing) |
| P0-2 | Wrap every socket handler in try/catch; validate payload shape and UUIDs; stop treating a handler rejection as process-fatal | `socketHandler.js`, `server.js:476` | none | S | Payload-less `typing` and bad-UUID status calls return an error event, process stays up | Unit test emitting malformed payloads |
| P0-3 | One shared `assertNotBlocked(a,b)` used by chat (send, read, voice, reactions, list), calls, groups, socket, mutual/likes/shortlist/viewers lists; on block, clear `isMutual` and revoke ChatGrants | `blockReportController`, `chatController`, `callController`, `groupController`, `matchController`, `socketHandler`, `auth.js` | none | M | After A blocks B, B cannot message, call, group-add or appear anywhere for A, and vice versa | Cross-channel integration test |
| P0-4 | Group invites: require accept step, Block and mutual/premium checks, identical hit/miss response, do not echo ids | `groupController.js`, group model | P0-3 | M | Free user cannot add a stranger; hit and miss look identical | Group authz tests |
| P0-5 | Single `toPublicProfile(viewer)` serializer and one `visibleTo(viewer)` query scope for getProfile, search, daily, suggestions, by-code, likes, shortlist, saved, sent, recently-viewed, matchAction. Cache candidate ids only, re-gate on read | `profileController`, `searchController`, `matchController`, `models/Profile.js` | none | L | `matches_only`, incognito, banned, blur, voice/video URLs and birth/income fields obey the same rules in every listing | Matrix test over every endpoint (C section 3 is the checklist) |
| P0-6 | Web Report and Block UI on profile and chat, plus report categories to cover fake identity, scam, harassment, threats, underage, stolen photos, spam | `frontend/src/pages/ProfileDetail.jsx`, `Chat.jsx`, `Report` model and enum, admin reports | none | M | A member can report or block from a profile and a conversation on web | Component tests plus API test |
| P0-7 | Erasure completeness: destroy Cloudinary assets (resource-type aware), purge caches, scrub MarketingLeads/ContactMessages by contact, disconnect sockets; Google-only deletion by re-auth; correct the video/voice destroy bug and admin photo removal | `utils/accountErasure.js`, `hardDeleteUsers.js`, `middlewares/upload.js`, `authController.js` | P0-5 for cache design | L | After deletion no asset URL resolves and no cache serves the profile; Google-only member can delete | Erasure integration test with a Cloudinary stub |
| P0-8 | Auth fixes: one canonical email form at signup, login, OTP send/verify and lockout; remove `$`-prefix value stripping; null-password guards in delete, reset, change | `validators/index.js`, `authController.js`, `middlewares/security.js` | none | S | `first.last@gmail.com` round-trips; password `$Secret123` works; Google-only paths return 4xx not 500 | Regression tests crossing signup to login |
| P0-9 | Close signup proof bypass: require verified phone for every client (or a time-boxed, attested exemption); bind OTP proof to a signup token; on Google link to an unverified-email account, null the password and revoke sessions; leave DOB/gender null for Google signups | `authController.js`, `smsService.js` | product decision on old store builds | M | No account exists without proven contact; Google link cannot inherit attacker credentials | Auth tests |
| P0-10 | Age policy. **Owner decision 2026-09-29: 21 for men, 18 for women** (matches the published Terms; counsel confirmation still advised). Open sub-decisions: threshold for gender `other`, handling of existing male accounts under 21, whether DOB/gender lock is support-only. Then one shared `assertMarriageableAge(gender, dob)` at signup, profile update and model; lock DOB and gender after onboarding (support-only change, audited) | `constants/`, `validators`, `models/Profile.js`, FE/RN copy and validators | counsel decision | M | Published rule equals enforced rule; repeated DOB edits impossible | Boundary tests |
| P0-11 | Legal disclosures reach the prod build (Dockerfile ARGs, compose build args), name the Grievance Officer, GSTIN and entity in the footer and policies | `frontend/Dockerfile`, `docker-compose.yml`, `.env.production` | owner supplies values | S | Footer and Terms show real values in the prod bundle | Build-time check script |
| P0-12 | Refund, dispute and chargeback handling: consume `refund.*` and dispute events, revoke or adjust entitlement on refund, stop invoicing unpaid and comped rows, GST-compliant sequential invoice (GSTIN, tax split, invoice number), bundle and astrologer webhook fallback plus a stale-order reconciler | `subscriptionController.js`, `routes/subscriptionRoutes.js`, `utils/invoice*`, `adminController` | Razorpay dashboard events, accountant input for GST | L | Every paid order ends in a known state; invoice is issued only for real payments | Webhook replay and forgery tests |
| P0-13 | Admin hardening: rank check on the single-user status route, forbid self-ban, last-admin guard on status; TOTP for admin, sub-admin and marketing roles; password policy on admin-created users | `adminController.js`, auth | none | M | A sub-admin cannot touch admins; privileged login needs a second factor | RBAC tests |
| P0-14 | Data export endpoint (`GET /auth/me/export`, re-auth, rate-limited) or reword the consent copy | `authController` or new controller, FE/RN copy | none | M | A member can download their data or the promise is removed | API test |
| P0-15 | Appeals and evidence workflow: appeal on suspension and removal, evidence preserved on erasure, legal-request intake, escalation path for threats and underage reports | admin controllers, `Report` model | counsel input | L | A suspended member can appeal; reports have owner, priority and status | Workflow tests |

### P1 — essential completeness and reliability

| # | Item | Files | Cx | Acceptance | Tests |
|---|---|---|---|---|---|
| P1-1 | OTP hardening: `crypto.randomInt`, Redis `INCR` attempts, per-target budgets (email too), Indian-number-only validation, global SMS budget and alert, hash stored codes | `smsService.js`, `authController.js` | M | Parallel guesses cannot exceed the budget; foreign numbers rejected before send | Concurrency test |
| P1-2 | Redis split: queues on `noeviction`, cache on `volatile-lru`, alert on evictions | `docker-compose.yml`, `utils/queue.js` | S | Queued jobs and OTPs survive memory pressure | Ops check |
| P1-3 | Dependencies and image: nodemailer and express patches, multer 2 with an error wrapper, Node LTS pinned by digest, lockfile in the build context, fix the CI scanner false positive | `backend/Dockerfile`, package files, `.github/workflows/ci.yml` | M | `npm audit --omit=dev --audit-level=high` clean; reproducible build | CI |
| P1-4 | Private media: authenticated Cloudinary delivery with short-lived signed URLs for selfies, voice notes and blurred photos | `middlewares/upload.js`, serializers | L | A leaked URL expires; blur is media-level | Integration test |
| P1-5 | Ranking that ranks: sort by score across the whole result set, expose explainable factors, admin-tunable weights | `searchController.js`, `utils/compatibility.js` | L | Sort order is global, not per page | Search tests |
| P1-6 | Image moderation: automated screen (provider) plus review queue and stolen-photo report flow | upload pipeline, admin | L | Flagged images held for review | Stub-provider test |
| P1-7 | Verification integrity: invalidate the badge on photo, name, DOB, gender change; reviewers cannot self-approve; live-only enforcement server-side; correct all "verify every member" copy | `verificationController`, `profileController`, copy | M | Badge reflects the current profile | Unit tests |
| P1-8 | Consent: client-asserted `termsAccepted` field, `requiresReconsent` on version bump, separate optional consents, subject-attestation for guardian profiles | `authController`, `constants/legal.js`, FE/RN | M | Version bump forces re-acceptance | Auth tests |
| P1-9 | Interest state machine: withdraw, decline, idempotent mutual, no duplicate match emails | `matchController`, `Match` model | M | Valid transitions only | State-transition tests |
| P1-10 | Notification preferences stored server-side; fix dead alerts and the 500-user digest cap; enable message-retention job with a stated period | `notifyUser.js`, `queue.js`, `alerts.js`, settings | M | Preferences honoured across email, push, in-app | Job tests |
| P1-11 | Backups and DR: install the encrypted backup script, off-box copy, monthly restore rehearsal, least-privilege DB role, documented RPO/RTO | `scripts/backup-db.sh`, VPS ops | M | A restore was performed and timed | Ops evidence |
| P1-12 | Log retention to the stated policy, PII-free log messages | compose logging, `logger.js`, `smsService.js` | M | 180-day store exists; no phone or email in message strings | Log scan |
| P1-13 | Fix the stale integration tests, run them in CI against a service container, raise coverage on the security paths above | `backend/tests/integration`, CI | M | Integration suite green in CI | CI |
| P1-14 | Guardian flow: deliver invites, resolve tokens, expire pendings, require acceptance for existing users, add a hand-over flow | `guardianRoutes.js`, signup | M | Pending invites are usable | Guardian tests |
| P1-15 | Service-worker cache scope: never cache authenticated API responses | `frontend/public/sw.js` | S | Cache holds no member data | Manual and unit |
| P1-16 | Confirm and fix A F-25/F-26: entitlement predicate in `getProfile`, route-param visibility in `requireChatAccess` | `profileController.js`, `middlewares/auth.js` | S | Free-reply and expiry behave as specified | Entitlement tests |

### P2 — improvements and future

Partner-preference schema with must-have versus preferred; missing profile fields; per-field visibility for income and birth details; account pause and a deletion grace period; new-device login alerts and login history; phone-OTP password reset for phone-only accounts; malicious-link and off-platform-payment detection in chat; duplicate-person detection; controlled vocabularies for caste, education and profession; audit-log completeness and per-member moderation history; CSV formula-injection guard; Redis socket adapter for horizontal scale; ranking experiments; Unicode names at signup.

### Implementation status (branch `fix/audit-p0-2026-09`, not merged or deployed)

**P1: all sixteen items are implemented.** P1-11 is the repo half only (runbook `docs/BACKUP_DR.md`); installing the backup job on the VPS, the off-box copy and the restore rehearsal are owner/ops actions. Log retention of 180 days (P1-12) also needs the host logrotate setting.

**P2: all fourteen items are implemented**, each with tests that fail on the old behaviour:

| Item | Where | Note |
|---|---|---|
| Partner-preference must-haves | `utils/preferenceFit.js`, migration 000078, search, web + app | A must-have with no value does nothing; blank candidate fields are never excluded; only the searcher's own must-haves apply |
| Missing profile fields | migration 000079, validators, web steps and views | Nationality, relocation, living arrangement, family values, institution, industry, brothers/sisters. App screens read them, only the website edits them |
| Per-field visibility | `constants/fieldVisibility.js`, migration 000076 | Income and birth details: everyone / matches / only me. Search will not match a hidden income |
| Pause and deletion grace | `utils/accountLifecycle.js`, migration 000074 | 30-day grace, `ACCOUNT_DELETION_GRACE_DAYS` |
| New-device alerts, login history | `utils/deviceRecognition.js` | History reaches back as far as refresh-token rows survive (30 days after revocation) |
| Phone-OTP reset | `authController` | Only for active phone-only accounts with a password; uniform answers |
| Chat scam and link signals | `utils/chatSafety.js`, migration 000075 | Signals beside messages and a staff alert for repeat senders; nothing is blocked; phone numbers and emails are not flagged |
| Duplicate-person detection | `adminSafetyController.getSuspicious` | New `duplicateIdentity` signal: same name, birth date and gender (weak weight) |
| Controlled vocabularies | `constants/vocabularies.js`, migration 000077 | `educationLevel` and `professionGroup` derived by a model hook and used by search; caste canonicalised only on an exact or alias match |
| Audit completeness, moderation history | `GET /admin/users/:id/moderation-history`, `utils/moderationHistory.js` | Story create/update/delete and opening a member record are now audited; the audit log filters by actor and target |
| CSV formula guard | `utils/csv.js` | Both exports and the client-side revenue export |
| Redis socket adapter | `utils/socketAdapter.js` | Off unless `SOCKET_REDIS_ADAPTER=true`; a second instance also needs sticky sessions and the presence map moved to Redis |
| Ranking experiments | `utils/rankingExperiment.js` | One at a time, stable hash buckets, per-arm interests and mutual matches since the start; admin Search ranking page |
| Unicode names | `constants/names.js` | Devanagari and Gurmukhi accepted; PDFs print only the Latin part (pdfkit fonts) |

Migrations added by P0-P2: **000065-000079**, applied to the dev and test databases only.

## 9. Corrections to what `CLAUDE.md` currently says

- Says 60 migrations. Auditor A counted **64** (through `000064`).
- Describes socket authorization as closed (SOCK-1 / MF-1, "membership-gated"). `join-group` is gated, but pair-room `join-room` is not (H1) and group **adding** needs no consent (H4).
- Describes a verified mobile number as compulsory. The `X-App-Client` header exemption makes it optional for any caller (H11).

Not from `CLAUDE.md`, but the same kind of drift in product copy: the Privacy page says photographs and selfies are erased (H6), and the signup consent notice says members can export their data (H18).

`CLAUDE.md` was not edited. Correct it when the fixes land so it describes the code.

## 10. Final launch-readiness checklist

**Remediation status (branch `fix/audit-p0-2026-09`, not yet merged or deployed):**
P0-1..P0-11 and P0-13..P0-15 are implemented with tests. **P0-12 is partly done**: refund/dispute/chargeback
handling, receipts only for real payments and a missed-capture reconciler are in; the GST-compliant sequential
invoice (accountant), the bundle/astrologer webhook fallback and Google Play RTDN are not. P0-11 ships the build
plumbing and a check script; the values (entity, address, GSTIN, Grievance Officer) are the owner's. P0-15 ships
priority/ownership, evidence preservation and appeals; the legal-request intake workflow needs counsel.
Migrations 000065-000069 must be applied on deploy. Staff two-step verification ships OFF (`STAFF_MFA_REQUIRED=false`)
so a deploy cannot lock admins out: enrol first, then turn it on.

**Must pass before a public launch (engineering):**
- [x] P0-1, P0-2, P0-3, P0-4 (member safety and stability)
- [x] P0-5 (privacy across listings)
- [x] P0-6 (web report and block)
- [x] P0-7 (erasure) and P0-14 (export or copy fix)
- [x] P0-8, P0-9 (auth correctness and signup integrity)
- [x] P0-10 (age rule matches Terms)
- [ ] P0-12 (payments, refunds, invoices) — partly done, see above
- [x] P0-13 (admin rank guard and MFA; MFA enforcement is opt-in by flag)
- [ ] P1-3 (dependency and image currency) and P1-2 (Redis policy)
- [ ] Integration suite green and the new regression tests in CI

**Must be confirmed externally (counsel, provider, owner):**
- [ ] Age rule and DPDP notice and consent design (counsel)
- [ ] Grievance Officer named and reachable; statutory disclosures supplied (owner)
- [ ] Razorpay refund, dispute and `payment.failed` webhook events enabled (provider)
- [ ] GST invoice format approved (accountant)
- [ ] Intermediary duties, takedown timelines, law-enforcement process, incident-response runbook (counsel and owner)
- [ ] CERT-In log retention arrangement (ops)
- [ ] Encrypted off-box backups with a completed restore rehearsal (ops)
- [ ] Support mailbox that a person reads (owner)

**Can reasonably be deferred past launch:** P1-5 (true ranking) if discovery volume stays small, P1-6 (automated image moderation) if manual review holds at current volume, everything in P2. Deferral is a business decision. Each of these is a product-quality gap, not a safety or legal one.

## 11. What I did not do

- Modified no application code, ran no migrations, sent no messages, touched no production or VPS.
- Ran no e2e, load, or DB-backed tests.
- Did not reproduce any finding against a live server. Five findings were re-read in source by the lead (H1, H3, H11, H12, H19); the rest are as the auditors reported them.
- Did not re-run the test suites the Phase 13/14 auditor reported.

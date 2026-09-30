# Audit C: Photos, Verification (Phase 4) and Search and Matchmaking (Phase 5)

Read-only static audit at commit 7b170f1 (main). No repo file modified, no packages installed, no network calls, no prod contact.
All evidence is `file:line` in the repo. "NOT VERIFIED" = needs a live Cloudinary/DB/prod probe that was out of bounds.
Severity: Critical / High / Medium / Low / Info. Paths abbreviated: `sc` = backend/controllers/searchController.js, `mc` = backend/controllers/matchController.js, `pc` = backend/controllers/profileController.js, `up` = backend/middlewares/upload.js.

---------------------------------------------------------------------------------------------------

## 1. Checklist

### Phase 4: photos and verification

| ID | Requirement | Status | Sev | One-line |
|---|---|---|---|---|
| P4-01 | Upload format/size validation | PARTIAL | Low | MIME + extension + Cloudinary `allowed_formats` + 5 MB cap OK; magic-byte check only runs on the local-disk fallback; verification route also accepts PDFs and ID-doc fields |
| P4-02 | Safe image processing (transform, resource_type pin) | PARTIAL | Low | resource_type pinned, incoming transform applied; gallery photos are cropped by the 500x500 face-fill transform meant for avatars; EXIF strip NOT VERIFIED |
| P4-03 | Image moderation / inappropriate-content handling | FAIL | High | No automated moderation at all (no Cloudinary `moderation`, no NSFW/face check). Only a manual, unstateful admin queue |
| P4-04 | Admin can remove a bad photo | PARTIAL | Medium | `DELETE /admin/photos` exists but only edits the DB row; the file stays publicly fetchable on Cloudinary and there is no "reviewed" state |
| P4-05 | Private photo albums / access requests | NOT APPLICABLE | Info | Not offered. Only `photoBlurUntilMatch` (hide-until-mutual) exists |
| P4-06 | Blur/hide enforced server-side | PARTIAL | High | Enforced in search, by-code, getProfile. NOT enforced in daily, suggestions, likes, shortlist, sent, recently-viewed, viewers (all return the real photo URL) |
| P4-07 | Authorised media access / URL guessability | FAIL | Medium | All media is Cloudinary public `upload` delivery; access control = "URL not shown". No signed/authenticated delivery. Once a URL is seen it works forever |
| P4-08 | Selfie evidence not publicly readable | FAIL | Medium | Selfie stored in the same public-delivery Cloudinary space (`verification-docs/`); URL returned to owner and admins; no restricted delivery |
| P4-09 | No identity docs collected/stored | PARTIAL | Medium | Controller ignores `documentFront/Back`, but multer-cloudinary uploads them BEFORE the controller runs, so they ARE stored (orphaned) on Cloudinary. "Never stored" claim is false |
| P4-10 | Distinct statuses for mobile / email / selfie verification | PARTIAL | Low | Separate DB fields (`phoneVerified`, `emailVerified`, `Verification.status`), but every other member sees one unlabelled "Verified" = selfie only |
| P4-11 | Verification claims match what is checked (copy audit) | PARTIAL | Medium | Terms cl.6 is accurate; Privacy s.9/Help/About/Safety overstate: "no upload option", "records only the result", "deleted when account deleted", Search empty-state "we verify every member by hand", Home "groundwork on verification" |
| P4-12 | Selfie is genuinely live-only | FAIL | Medium | Web `LiveSelfieCapture`/RN camera are client-side only; server accepts any JPEG/PNG/WebP/PDF via `POST /verification/submit` |
| P4-13 | Failed-check correction / appeal | PARTIAL | Low | Rejected -> admin note shown -> unlimited resubmit (20/hr limiter). No appeal-to-human path, no history of prior evidence |
| P4-14 | Evidence access restriction | PARTIAL | Low | Only `verifications` scope reads the queue, but `users` scope `GET /admin/users/:id` returns full Verification row incl. selfie URL |
| P4-15 | Evidence retention / deletion | FAIL | High | No retention job; superseded selfies never deleted; account erasure deletes DB rows but never calls Cloudinary; admin hard-delete same; voice/video delete calls `destroy` with the wrong resource_type |
| P4-16 | Status changes audited | PARTIAL | Low | `verification_status_changed` audited (prev/new/actor) but no notes/reason, no submission event, self-approval not blocked, `verifiedAt` stamped on rejection |
| P4-17 | Verification stays valid only while it describes the profile | FAIL | Medium | Approved badge never revoked when profile photos change afterwards (verify with genuine selfie + photo A, swap in photo B, keep badge) |
| P4-18 | No guarantee claims a verified profile is genuine/safe | PARTIAL | Low | Terms cl.6/14 explicit; but Safety "always prefer them", Home "Verified meet", email "builds trust" nudge toward reliance |

### Phase 5: search and matchmaking

| ID | Requirement | Status | Sev | One-line |
|---|---|---|---|---|
| P5-01 | Filters age/location/marital/education/profession | PARTIAL | Low | All work server-side; single city + single marital value only; education exact-match on free text; `.escape()` mangles `&`/`'` |
| P5-02 | Community/religion/lifestyle filters | PASS | Info | religion, caste, motherTongue, diet, smoking, drinking, manglik, interestTags. No gotra/subcaste/NRI/family filters (mobile `excludeGotra` is dropped client-side) |
| P5-03 | Photo and verification filters | PARTIAL | Low | `verifiedOnly` via correlated EXISTS (good); no "has photo" filter (only a -40 rank penalty) |
| P5-04 | Sorts (relevance / recent / activity) | FAIL | High | Default "compatibility" sort only re-orders inside a `createdAt DESC` page (not global). `lastLogin` accepted but silently = createdAt. No activity sort. Age sort has no ascending option |
| P5-05 | Pagination + DB indexes | PARTIAL | Medium | Indexes in migrations 12/34/38 cover filters. Page has no max and limit up to 100 -> full-directory paging by any account. ILIKE '%x%' unindexed |
| P5-06 | Saved searches + editable partner prefs | PARTIAL | Low | Saved searches cap 5, sanitised; alerts only for 6 whitelisted keys, ignore blocks/visibility, batch `limit` with no paging. Partner prefs editable but only a score bonus |
| P5-07 | Recommended / mutual-preference / reverse matches | PARTIAL | Medium | Daily + suggestions exist; partner prefs are a one-directional +bonus (never filter, never reciprocal). Reverse check is client-side display only (`PreferenceMatch`) |
| P5-08 | Recently-active and new-profile discovery | PARTIAL | Low | "Most Recent" sort + community stats counter; no recently-active anything though `User.lastLogin` exists |
| P5-09 | Hidden/blocked/suspended/deleted/incognito excluded in EVERY listing | FAIL | High | Search is good; daily, suggestions, by-code, likes, shortlist, sent, mutual, viewers, recently-viewed each miss one or more gates (matrix in section 3) |
| P5-10 | Mutual eligibility and visibility enforced server-side | FAIL | High | `matches_only` bypassed by daily/suggestions/by-code; `pass` on a mutual match never un-matches; Block does not touch Match rows or chat/call/socket at all |
| P5-11 | No private-field leakage / enumeration resistance | FAIL | Medium | Search/daily/suggestions/getProfile return whole `Profile.toJSON()` (exact DOB, lastName, exact income, birthTime, placeOfBirth, familyOccupation, voice/video URLs, raw socialMediaLinks, saved-search prefs) ; bulk-scrapable |
| P5-12 | Ranking factors configurable/explainable | PARTIAL | Low | `getCompatibilityBreakdown` + `deriveReasons` chips explain the score; boost weights (plan/verified/photo) are hardcoded and not disclosed |
| P5-13 | Seen-profile / interaction-history handling | PARTIAL | Low | Daily/suggestions exclude any prior Match row; search does not exclude passed profiles (web ignores `pass`); views recorded once per pair |
| P5-14 | Empty-result / broadening suggestions | PARTIAL | Low | Two honest empty states; but copy claims "We verify every member by hand" (false, verification is opt-in) |
| P5-15 | Match scores not represented as guaranteed compatibility | PARTIAL | Low | Terms cl.14 disclaims; cards show a bare "82% match" with no inline qualifier; Home claims "40+ signals" (scorer uses ~13) |

---------------------------------------------------------------------------------------------------

## 2. Detailed findings (ordered by severity)

### F-01  Block does not remove the relationship: blocked users stay in lists, and can still chat and call  [P5-09 / P5-10, HIGH]
- **Evidence:** `blockReportController.js:14-38` creates only a `Block` row. It never touches `Matches`. `grep -rn "Block"` shows the model is imported only by search, match, profile and blockReport controllers; `chatController.js`, `callController.js`, `groupController.js`, `inviteController.js` and `socket/socketHandler.js` have zero references (grep count 0 each). Chat gate is `verifyMutualMatch` only (`chatController.js:76-108, 258, 331, 608`). Lists `mc:387-621` (`getLikes/getShortlist/getSentInterests/getMutualMatches`) and `pc:985-1078` (`getProfileViewers`) never consult `Block`.
- **Actual:** After A blocks B: B is still `isMutual=true` with A, so B can still send messages/place calls to A (chat/socket/call gates are mutual-only), B still appears in A's Mutual/Shortlist/Likes/Viewers lists and A in B's. Only profile view, search, and new match actions respect the block.
- **Expected:** Block severs contact everywhere (messages, calls, sockets, every list) and clears Match/ChatGrant rows or filters them at read time. Safety.jsx:44 promises "Blocked users cannot view your profile or contact you."
- **Repro (safe, dev DB only):** two seeded mutual accounts; A `POST /block/:B`; B `POST /chat/messages` to A -> expect 403, will 201; `GET /match/mutual` for A still lists B.
- **Impact:** harassment continues after a member blocks; false safety promise on a matrimony app.
- **Fix:** In `blockUser`, in one transaction delete both `Match` rows and any `ChatGrant`; add a shared `assertNotBlocked(a,b)` to chat REST, socket `join-room`/`send-message`, call initiate/token, group invite; add `NOT EXISTS Block` to every list query.

### F-02  Photo blur (`photoBlurUntilMatch`) and photo URLs leak through 7 listing endpoints  [P4-06, HIGH]
- **Evidence:** blur is applied only at `sc:333-334` (search), `sc:605` (by-code) and `pc:655-658` (getProfile). Not applied in `mc:331` (daily, cached raw `toJSON`), `sc:522-538` (suggestions), `mc:434` (getLikes), `mc:491` (shortlist), `mc:543` (sent), `pc:1067-1071` (recently-viewed returns `profilePhoto` for any viewed id), `pc:1006` (viewers).
- **Actual:** A member who enabled "hide photos until match" is shown in full to any viewer via Matches of the Day / Curated for You / Saved / Sent / Recently viewed. Daily and suggestions also return the whole `photos[]` gallery.
- **Repro:** account X sets `photoBlurUntilMatch=true`; as a non-mutual opposite-gender viewer call `GET /match/daily` or `/search/suggestions` and compare `profilePhoto/photos` with `GET /search` for the same user (search returns null/[]).
- **Impact:** privacy setting is decorative on the most-used discovery surfaces; women's photo-privacy expectations broken.
- **Fix:** one `serializePublicProfile(profile, {viewerId, isMutual})` used by every endpoint (allowlist + blur + voice/video redaction + social-link visibility); unit test that every listing route returns null photos for a blurred non-mutual target.

### F-03  `matches_only`, incognito, suspended/banned status not enforced in Daily, Suggestions, By-code, and all Match lists  [P5-09 / P5-10, HIGH]
- **Evidence:**
  - Search does it right: `sc:70-96` (isActive, incognito, block, matches_only) + `sc:254-260` User `status:'active'`.
  - Suggestions `sc:441-455`: `isActive` + gender + block only; no incognito, no `profileVisibility`.
  - Daily `mc:279-287`: same gap; result cached in Redis until IST midnight (`mc:370-372`), so blocks/bans/erasure after computation still show all day.
  - By-code `sc:572-582`: `isActive` only. No `User.status`, no visibility, no incognito -> returns full name, exact DOB, city, profession for a banned/`matches_only`/incognito member given their code.
  - Likes/shortlist/sent/mutual `mc:399-410, 470-480, 522-532, 577-588` and viewers/recently-viewed `pc:985-1078`: filter `Profile.isActive` only. Admin ban (`adminController.js:225-255`) sets `User.status` and never flips `Profile.isActive`; nothing in the codebase ever sets `isActive=false` (grep), so this flag is effectively always true.
- **Actual:** a member who is `matches_only` (or admin-banned/inactive) is 403/404 on `GET /profile/:id` but visible in Daily, Suggestions, by-code and every list. Incognito has three different meanings (viewer browses privately / hidden from search only / still in daily and direct view).
- **Impact:** privacy toggles and moderation bans do not bind; banned scammers stay visible in the surfaces members act from.
- **Fix:** one `visibleProfileWhere(viewerId)` scope (Profile.isActive, incognito rule, matches_only-or-mutual, `User.status='active'`, no Block either direction) reused by search/daily/suggestions/by-code/all lists; drop the daily cache or re-filter after the cache read; set `Profile.isActive=false` (or filter on User.status) on ban.

### F-04  Default "compatibility" sort is not a real ranking (order is per page)  [P5-04, HIGH for a matchmaking product]
- **Evidence:** `sc:232-235` DB `ORDER BY createdAt DESC` (default), `sc:238-264` LIMIT/OFFSET, then `sc:367-384` JS `sort(rank)` on just those <=100 rows; total via `sc:390`.
- **Actual:** page 1 = the newest 20 profiles re-ordered among themselves; page 2 = next 20 newest. A 95% match created 3 months ago is on page N, whatever the boosts. The plan/verified/photo (-40) adjustments only re-order inside a page, so a photoless profile can sit at the top of page 1 and a photo profile at the bottom of page 1. `sortBy=lastLogin` (valid at `validators/index.js:508-511`) silently becomes createdAt DESC.
- **Repro:** seed 60 opposite-gender profiles with rising createdAt and inverse compat; `GET /search?page=1` vs `page=3`, observe non-monotonic scores.
- **Fix:** compute ranking in SQL (score expression or a materialised per-viewer rank) or fetch candidates (bounded, e.g. 500), rank in JS, then slice; implement `lastLogin` (User.lastLogin exists, `models/User.js:82`) or remove it from the validator.

### F-05  No image or content moderation of any kind  [P4-03, HIGH]
- **Evidence:** `up:129-137` storage params contain folder/allowed_formats/transformation/resource_type only; grep for moderation|nsfw|safesearch|rekognition|face-detect in `up`, env.js and controllers finds nothing. Photos are live the instant `PUT /profile/me` returns (`pc:299-329`). Bio/prompt text has no profanity or contact-detail filter (`validators/index.js:266` length only; also lets members paste phone numbers to bypass the paid unlock).
- **Actual:** explicit, stolen or non-face images (or a cartoon as the only photo) go live unreviewed. Remedy is reactive: `GET /admin/photos` (`adminSafetyController.js:195-220`, most-recently-updated profiles, 24/page, no reviewed flag) and `DELETE /admin/photos` (`:222-247`).
- **Fix:** Cloudinary `moderation: 'aws_rek'` (or webpurify) in `createCloudinaryStorage` with `pending` handling; require a face on the primary photo (Cloudinary `detection`); add a "reviewed" marker to the photo queue; text contact-detail scrub on bio/prompts.

### F-06  Erasure/retention: Cloudinary assets are never deleted (selfies, photos, videos), voice/video deletes silently no-op, admin "remove photo" leaves the file live  [P4-15 / P4-04, HIGH]
- **Evidence:**
  - `utils/accountErasure.js:61-100` destroys Profile and Verification rows in the DB; there is no Cloudinary call in that file or `utils/hardDeleteUsers.js`. `deleteFromCloudinary` is referenced only in `pc` (grep). Result: after "Delete account", every photo, the selfie, voice/video intro URL still resolves on Cloudinary.
  - Privacy.jsx:164/187/190 says the selfie is "deleted when your account is deleted" and photographs/voice/video/selfie are "erased immediately, in the same action". Code disagrees.
  - `up:390` `cloudinary.uploader.destroy(publicId)` with no `resource_type`, default `image`. Voice/video intros are stored as `resource_type:'video'` (`up:203, 271`), so `pc:1134-1201` deletion returns "not found" and leaves the media online (errors swallowed by try/catch).
  - `verificationController.js:44-51` resubmission overwrites `selfiePhoto` without deleting the previous asset; no retention/cleanup job exists (`utils/queue.js` cleanup covers tokens, sessions, messages only).
  - `adminSafetyController.js:222-247` `removePhoto` edits the array only; no `deleteFromCloudinary`.
  - Multer runs before controllers (`verificationRoutes.js:28-36`, `profileRoutes.js:66-76`), so uploads whose request later fails validation/409 are orphaned too.
- **Impact:** DPDP erasure claim not met for media; moderated-away images remain fetchable; permanent selfie corpus.
- **Fix:** in `eraseAccount`/`hardDeleteUsers`/`removePhoto`, collect and destroy assets (pass `{resource_type}` per asset type); delete prior selfie on resubmit and set a retention TTL (e.g. delete selfie N days after decision); orphan sweeper by folder listing.

### F-07  Bulk scraping and over-exposure via search/daily/suggestions/getProfile  [P5-05 / P5-11, MEDIUM]
- **Evidence:** `sc:238-264` returns `profile.toJSON()` minus 7 JSONB columns (`sc:243-252`); daily `mc:331` and suggestions `sc:522` exclude nothing; `pc:649` is the whole row. Includes exact `dateOfBirth`, `lastName`, exact `income`, `birthTime`, `placeOfBirth`, `fatherOccupation/motherOccupation`, `weight`, `voiceIntroUrl`, `videoIntroUrl`, and in daily/suggestions/getProfile also `quizAnswers`, raw `socialMediaLinks` (owner's hidden/matches-only links bypass `visibleSocialLinks`, which only runs in getProfile `pc:693`), and `lifestylePreferences` (holds the target's private saved-search filters).
  - The voice/video redaction at `pc:665-668` ("a gate that exists only in the client is not a gate") is bypassed: search never redacts (`voiceIntroUrl`/`videoIntroUrl` are not in the exclude list).
  - Volume: `searchLimiter` 30/min per account (`security.js:203-208`), `limit<=100`, `page` has no upper bound (`validators/index.js:26-37`), no free-tier cap -> ~3,000 full profiles/minute per free account; the whole ~5k dev corpus in ~2 minutes. Total count returned in every response.
- **Fix:** response allowlist DTO for cards (id, first name, age, city, education, profession, photo, badges, score, reasons); `page` max + total-results cap for non-premium; redact voice/video/social in every path; add per-account daily row budget.

### F-08  Verification badge is never invalidated; verification can be self-approved; selfie "live-only" not enforced  [P4-17 / P4-12 / P4-16, MEDIUM]
- **Evidence:** badge is `Verification.status==='approved'` (`sc:288-296, 315`; `pc:701-705`). `updateProfile` (`pc:175-396`) contains no reference to Verification, so replacing every photo keeps the badge. `adminController.js:294-330` has no `verification.userId !== req.user.id` check (a sub-admin with `verifications` scope can approve their own selfie) and stamps `verifiedAt=new Date()` for rejected/flagged/pending too (`:319`). `POST /verification/submit` (`verificationRoutes.js:28-36`) does not require a profile photo and accepts JPEG/PNG/WebP/PDF via `documentFileFilter` (`up:97-105, 289-297`); "live" is enforced solely by web `LiveSelfieCapture`/RN camera.
- **Fix:** on any profile-photo change after approval set status to `pending` (or `stale`) and drop the badge until re-review; block self-review; require >=1 profile photo to submit; server-side: restrict `selfiePhoto` to images, capture provenance metadata (client attestation is weak; state honestly in copy that live capture is a client behaviour).

### F-09  Verification/legal copy overstates what is done  [P4-11 / P4-18 / P5-14, MEDIUM]
| Location | Claim | Reality |
|---|---|---|
| Privacy.jsx:164 | "there is no upload option"; reviewer "records only the result"; selfie "deleted when your account is deleted" | API accepts any image; `selfiePhoto` URL is stored indefinitely; Cloudinary copy survives erasure (F-06) |
| Help.jsx:32 | "we never accept an uploaded file" | same; server cannot distinguish |
| About.jsx:22, Safety.jsx:14 | "A person reviews every verification selfie ... by hand" | plausible (admin queue) but no SLA/monitoring; Help.jsx:32 "usually within 24-48 hours" and Safety.jsx:44 "reports reviewed within 24 hours" are unenforced (`getModerationStats` only reports) |
| Search.jsx:420 | "We verify every member by hand, one Tricity family at a time." | verification is optional; Terms cl.6 says "We do not screen members, and we cannot." |
| Matches.jsx:28 | "We're verifying new Tricity members by hand every week" | same |
| Home.jsx:469 | "We've done the groundwork on verification and compatibility", chip "Verified meet" | implies safety of an in-person meeting |
| Home.jsx:467 | "40+ signals" | `calculateCompatibility` (`utils/compatibility.js:333-458`) scores ~13 signals |
| Safety.jsx:44 | "Blocked users cannot ... contact you" | false today (F-01) |
| ProfileCard.jsx:431/523, ProfileDetail.jsx:575, RN cards | bare "Verified" | means selfie-photo match only; mobile/email verification exist but are not shown to others |
Terms cl.6 and cl.14 are accurate and strong; the product surfaces contradict them. Fix by aligning copy to Terms ("Photo verified"), and remove/soften the sentences above.

### F-10  Multer stores ID-document uploads that the product says it never stores  [P4-09, MEDIUM]
`verificationRoutes.js:28-36` mounts `uploadDocuments` (`up:289-297`: fields `documentFront`, `documentBack`, `selfiePhoto`) into Cloudinary storage `verification-docs` before the controller runs. `verificationController.js:37-39` reads only `selfiePhoto`, so a stale/hostile client that posts `documentFront` leaves an unreferenced identity document publicly hosted and never deleted. Fix: multer `.fields([{name:'selfiePhoto',maxCount:1}])` only and reject other fields (`LIMIT_UNEXPECTED_FILE`); restrict `selfiePhoto` to images.

### F-11  `pass` (or any non-like action) on a mutual match does not withdraw it  [P5-10, MEDIUM]
`mc:92-106` overwrites `match.action` but leaves `isMutual=true` on both rows (only place isMutual is written is `mc:164-170`; grep confirms nothing sets it false). Chat gating and Mutual list read `isMutual` only. A member has no way to un-match except Block (which is itself incomplete, F-01). Fix: on pass/unlike of a mutual pair set `isMutual=false` on both rows (and revoke ChatGrant).

### F-12  Cloudinary delivery is public; blur/visibility protects only URL disclosure  [P4-07 / P4-08, MEDIUM, dashboard-level items NOT VERIFIED]
`up:129-137` no `type:'authenticated'`/`private`, no signed URLs; all clients hot-link `res.cloudinary.com` (frontend/index.html:62). Public IDs are random so URLs are not guessable, but any URL seen (cache, chat, screenshot, a blurred-then-unblurred profile, the daily Redis cache) works forever. Selfies and voice/video are in the same policy. Whether Cloudinary "strict transformations"/"restricted media types" are on is NOT VERIFIED (dashboard). Also: EXIF/GPS stripping on the stored derived asset NOT VERIFIED. If Cloudinary is unconfigured in production the code silently falls back to local disk served publicly from `/uploads` (`up:116-127`, `server.js:210-218`) and no prod guard requires Cloudinary. Fix: `type:'authenticated'` + short-lived signed URLs for selfies (minimum) and for blur-protected photos; prod env guard for Cloudinary.

### F-13  Other lower-severity items
- **F-13a (Low, P5-06)** Digest/alert batches: `queue.js` weekly digest `limit: 500`, alerts `limit: 1000` with no ordering/offset -> beyond that many users the same head of the table is served forever. Alert/digest counts ignore blocks, `matches_only`, banned users (`queue.js` ~L263-290, ~L395-410) and cities use exact `IN` while search uses ILIKE.
- **F-13b (Low, P5-05)** `sc:132,142,168` `ILIKE '%term%'` on city/profession/caste with no trigram index (migrations 12/34/38 are btree/GIN on tags only); fine at current scale.
- **F-13c (Low, P5-01)** `validators/index.js:484-498` uses `.escape()` on city/education/profession, so "B.Sc & Eng" is stored/compared as `&amp;`; education is `WHERE education = :x` exact match on free text so option-list drift returns empty.
- **F-13d (Low, P5-13)** Search returns `matchStatus` but web `Search.jsx:232` only tracks like/shortlist; passed profiles reappear in search.
- **F-13e (Low, P5-11)** Search/daily expose `isPremium/premiumPlan` of other members (what they paid for).
- **F-13f (Low, P5-10)** `matchAction` (`mc:23-239`, route `matchRoutes.js:29-35`) uses `verifyTargetUser` (exists + `User.status==='active'`) but not the visibility gates, so a member can "like" a `matches_only`/incognito user whose UUID they have; the liked user then gets a notification naming the liker (`mc:227`) even if the liker is incognito.
- **F-13g (Low, P4-02)** `uploadPhotos` (`up:175-182`, used by `PUT /profile/me`) puts BOTH `profilePhoto` and gallery `photos` through the 500x500 `crop:'fill', gravity:'face'` storage; the 1200px `galleryPhotoStorage` (`up:146`) is never used on that route. Full-length gallery shots get face-cropped.
- **F-13h (Low, P4-14)** `GET /admin/users/:id` (`adminController.js:~645` `include: Verification`) is under `users` scope and returns selfie and legacy doc URLs to anyone with `users` even without `verifications`.
- **F-13i (Info)** Incognito is advertised as a Premium feature (Home.jsx:483) but `updateProfile` sets `incognitoMode` for any tier (`pc:203`), no server gate.
- **F-13j (Info, P5-12)** Compat is asymmetric (`calculateCompatibility(viewer, candidate)`); partner-pref bonus only ever adds to numerator and denominator when satisfied (`utils/compatibility.js:447-458`), so violating a stated preference costs nothing.

---------------------------------------------------------------------------------------------------

## 3. Exclusion matrix: who filters what (P5-09)

Legend: Y = enforced, N = missing, n/a = not relevant. "status" = `User.status='active'`; "vis" = matches_only; "inc" = incognito; "blur" = photoBlurUntilMatch; "voice" = voice/video URL redaction.

| Endpoint | isActive | status | Block | vis | inc | blur | voice/video | field allowlist |
|---|---|---|---|---|---|---|---|---|
| GET /search | Y | Y | Y | Y | Y | Y | N | partial (7 JSONB excluded) |
| GET /search/suggestions | Y | Y | Y | N | N | N | N | N (whole row) |
| GET /search/by-code | Y | N | Y | N | N | Y | (not selected) | Y (8 attrs) |
| GET /match/daily (cached 24h) | Y | Y (at compute) | Y (at compute) | N | N | N | N | N (whole row) |
| GET /match/likes (premium) | Y | N | N | n/a | n/a | N | (not selected) | Y (8 attrs) |
| GET /match/shortlist | Y | N | N | N | N | N | n/a | Y |
| GET /match/sent | Y | N | N | N | N | N | n/a | Y |
| GET /match/mutual | Y | N | N | n/a | n/a | n/a (mutual) | n/a | Y |
| GET /profile/me/viewers | Y | N | N | n/a | n/a | N | n/a | Y |
| GET /profile/me/recently-viewed | Y | N | Y | N | N | N | n/a | Y |
| GET /profile/:id | Y | Y | Y | Y | (allowed) | Y | Y | N (whole row, JSONB incl.) |
| GET /profile/:id/compatibility, /horoscope-match(/pdf) | Y | Y | Y | Y | n/a | n/a | n/a | n/a (`assertProfileVisible`) |
| GET /stats/community | Y | Y | n/a | Y | N | n/a | n/a | aggregate only |
| POST /match/:id (action) | N | Y | Y | N | N | n/a | n/a | n/a |
| queue: weekly digest / saved-search alerts | Y | Y | N | N | Y | n/a | n/a | count only |

Chat/call/socket/group/invite: no Block check (F-01).

---------------------------------------------------------------------------------------------------

## 4. Workflow map: search -> profile view (traced end to end)

1. **Client** `frontend/src/pages/Search.jsx:148-156` builds `GET /search?...&page&limit=18&sortBy=` (mobile `SearchScreen.tsx:77-90` `toServerParams` remaps sort/manglik/verified; drops `excludeGotra`, takes only 1 city / 1 marital status).
2. **Route** `routes/searchRoutes.js:23-31`: `auth` (JWT cookie, status check) -> `searchLimiter` 30/min keyed by userId (`security.js:203-208`) -> `searchValidation` (`validators/index.js:447-546`; ints coerced, enums pinned, `page` unbounded, `limit<=100`).
3. **Controller** `sc:24-407`: requires viewer Profile (`:55`); loads Blocks both directions (`:61-67`) and viewer's mutual ids (`:82-86`); WHERE = isActive, not incognito, not self/blocked, visibility (`:70-96`), opposite gender, age via DOB range (`:106-121`), height, city/profession/caste ILIKE (escaped `:16-19`), education exact, diet/smoking/drinking, tags overlap, religion/motherTongue LOWER() indexed, marital, income, manglik, `verifiedOnly` EXISTS (`:212-228`); join `User.status='active'` (`:254-260`); ORDER BY column sort only (`:232-235`); LIMIT/OFFSET.
4. **Enrichment** batch queries (no N+1): viewer's Match rows, candidates' active paid subscriptions, approved Verifications (`:266-297`); per profile: `calculateCompatibility(viewer, candidate)`, blur applied (`:333-334`), badges; JS re-rank inside the page for `compatibility` (`:367-384`); count via same joins (`:390-395`).
5. **Response**: `{profiles[], pagination}` with the near-full Profile row (F-07).
6. **Card** `ProfileCard.jsx` renders photo/initials fallback, "Verified" (selfie only), "NN% match", plan chip; like/shortlist call `POST /match/:userId` (`matchRoutes.js:29-35`: limiter 60/min, validation, `verifyTargetUser`, `matchAction`; upsert + mutual detection in a transaction, notifications after commit `mc:186-232`).
7. **Open profile** `GET /profile/:userId` (`profileRoutes.js:~112`) -> `assertProfileVisible` (`pc:508-572`: active user + profile, block both ways, matches_only unless mutual/admin) -> viewer plan, ContactUnlock, ProfileView row (skipped if viewer incognito `pc:619-630`), compat, Match state; blur (`pc:655`), voice/video redaction for non-mutual non-premium (`pc:665`), contact only when unlocked AND `phoneVerified` (`pc:672-682`), social links per owner visibility (`pc:693`), `isVerified` (`pc:701`); returns whole row + subscription plan of target.
8. **Side channels not sharing that gate:** Daily/Suggestions/Saved/Sent/Likes/Recently-viewed/By-code (matrix, section 3) all render the same profile card without steps 3/7's checks, so a target refused at step 7 can still appear in the list that led there.

---------------------------------------------------------------------------------------------------

## 5. What passed (evidence-backed)

- Search SQL safety: LIKE escape (`sc:16-19`), `LOWER(col)` indexed comparisons, enum allow-lists, `interestTags` shape validator (`validators/index.js:534-546`), correlated EXISTS for verifiedOnly (`sc:212-228`), count uses same joins (`sc:390-395`) so pagination is exact. No injection path found.
- `assertProfileVisible` (`pc:508-572`) is a sound single gate for getProfile/compat/horoscope/PDF/unlock; regression tests exist (`tests/unit/profileVisibilityGate.test.js`, `profileSubscriptionLeak.test.js`).
- Mass-assignment: photos cannot be set by URL from body; `profilePhoto` must already be in own gallery (`pc:331-337`); `PROFILE_EDITABLE_FIELDS` allowlist; saved-search sanitiser applied on both write paths (`pc:265-279`).
- Contact reveal only for `phoneVerified` numbers behind paid unlock (`pc:672-682`).
- Indexes for the hot filters exist: migration 12 (gender, city/state, matches, subscriptions), 34 (gender+isActive+createdAt, dob, marital, education, diet, LOWER(religion), LOWER(motherTongue)), 38 (income, height, manglik, GIN interestTags), Matches unique/(matchedUserId,action).
- Terms cl.6 and cl.14 are accurate and specific ("not a background check", "we do not screen members", scores are informational aids); kundli PDF carries a "for guidance only" footer (`utils/kundli.js:187-189`).
- Verification status is `Verification.status` (pending/approved/rejected/flagged), admin transitions audited with prev/new (`adminController.js:324-329`), members notified on real transitions only.
- ID-document collection genuinely removed from the flow; identity docs are not read or shown anywhere.

## 6. Not verified / out of reach

- Cloudinary account settings (strict transformations, restricted delivery, EXIF stripping on stored asset, moderation add-ons): dashboard only.
- Real Redis TTL/eviction behaviour of the daily cache and whether Redis is populated in prod.
- Actual reviewer SLAs (24h/48h claims) and prod data volume.
- Live reproduction of F-01/F-02/F-03/F-04 (all traced statically; each has a dev-DB repro above; none executed).

## 7. Suggested fix order

1. F-01 + F-11 (block/unmatch actually sever contact) 2. F-03 + F-02 + F-07 via one shared visibility scope + one public-profile DTO 3. F-06 Cloudinary deletion on erasure/replace/admin-remove (+ resource_type fix) 4. F-04 real ranking 5. F-05 moderation 6. F-08/F-10 verification hardening 7. F-09 copy alignment.

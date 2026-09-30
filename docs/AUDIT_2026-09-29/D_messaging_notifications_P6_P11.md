# Audit D — Interests, Messaging, Sockets, Notifications & Jobs (Phase 6 + Phase 11)

Scope: `backend/` only for enforcement (server-side is the only thing counted). Read-only. No repo file modified, nothing sent, no prod contact.
Evidence tags: **[CODE]** read in source · **[POC-STUB]** real handler file executed in a scratch harness with stubbed DB/entitlements (scripts: `scratchpad/poc_room.js`, `poc_crash.js`, `poc_crash2.js` — outside the repo) · **[NOT VERIFIED]** not exercised live.
All paths relative to `/Users/sakshampanjla/Desktop/REACT/tricitymatch/backend/`.

---
## 0. Headline findings (ranked)

| # | ID | Sev | One-line |
|---|----|-----|----------|
| 1 | P6-20 | **Critical** | `join-room` never checks the caller is a party to the room — any entitled member who is mutual with the lexicographically-smaller user of *any* pair can join that pair's private room and receive `message:new / edited / deleted / reaction / typing` for a chat they are not in. [POC-STUB proved] |
| 2 | P6-10..16 | **High** | **Block is not enforced on ANY messaging/calling/group path.** Only `matchAction`, profile view, unlock, search, daily, recently-viewed check `Block`. Chat REST, voice, reactions, socket, calls, group add, mutual/likes/shortlist lists, and message e-mails all keep working after a block; `blockUser` neither clears `Match.isMutual` nor anything else. |
| 3 | P6-22 | **High** | Any authenticated socket (free tier) can crash the API process: `socket.on('typing', async ({..}) =>` (no payload → TypeError) and un-try/caught `get-online-status` (malformed uuid → DB error) become unhandled rejections; `server.js:476` treats *every* unhandled rejection as fatal (`gracefulShutdown`). [POC-STUB proved rejection; shutdown path CODE] |
| 4 | P6-03/04 | **Medium** | No interest state machine: "withdraw"/"decline" = overwrite `action` with `pass`; **`isMutual` is never cleared** so a pass/withdraw/shortlist after a mutual match leaves chat, calls, mutual lists, presence fully open for both sides. |
| 5 | P11-13/15 | **Medium** | Notification preferences are `localStorage`-only (web) and enforced nowhere server-side; queue/cron failure alerting is dead (Prometheus metrics never exported, Alertmanager receivers all commented out, `alert` mail job has no processor). Weekly digest `limit:500` with no order/offset ⇒ only a fixed first-500 users ever receive it. |

Other Mediums: re-like of an already-mutual pair re-sends "It's a Match!" in-app + e-mail to both (P6-06/P11-09); OTP counter races + 4-digit `Math.random` code (P11-03); email OTP has no per-target limiter (P11-04); family groups add strangers with no consent, phone-membership oracle, removed members keep receiving live messages (P6-29); no phone/URL filtering in like-notes/messages (paywall bypass + scam vector, P6-25); web has no block/report UI at all (P6-30); mutual-like race can lose a match (P6-07).

---
## 1. Checklist table

Status legend: PASS / PARTIAL / FAIL / NOT VERIFIED / N/A.

### Phase 6 — interests, connections, messaging

| ID | Requirement | Status | Sev | Where |
|----|-------------|--------|-----|-------|
| P6-01 | Send interest | PARTIAL | Low | `matchController.js:23-239` (like = interest; no distinct request entity; target `profile.isActive`/visibility/`matches_only` not checked — only `verifyTargetUser` = user exists & active, `auth.js:341-369`) |
| P6-02 | Accept / decline | PARTIAL | Low | accept = "like back" (implicit, `:147-172`); decline = `pass`, silent — no state, no notification to sender |
| P6-03 | Withdraw interest | **FAIL** | Med | no such transition; `like→pass` overwrites row (`:92-106`); original notification not retracted; mutual persists |
| P6-04 | Distinct request state machine / invalid transitions | **FAIL** | Med | `Match.action ENUM(like,shortlist,pass)` (`models/Match.js:26`) + boolean `isMutual`; any→any allowed; `isMutual` never reset (grep: only set `true` at `matchController.js:164,168`) |
| P6-05 | Duplicate prevention | PASS | — | DB unique `unique_user_match` (`migrations/…000004:55`), upsert `ON CONFLICT` (`matchController.js:114-140`) |
| P6-06 | Idempotent re-submit | **FAIL** | Med | re-POST `like` on a mutual pair re-runs the mutual branch → duplicate notifications + duplicate e-mails (`:149-172`, `:202-214`) |
| P6-07 | Mutual-detection concurrency | PARTIAL | Low-Med | default READ COMMITTED, no lock: simultaneous A→B / B→A each fail to see the other's uncommitted row → both committed, `isMutual` false forever (no reconciliation) |
| P6-08 | Stored sender/recipient/status/timestamps | PARTIAL | Low | `userId, matchedUserId, action, isMutual, mutualMatchDate, createdAt/updatedAt` only — no respondedAt/withdrawnAt/decline reason/expiry/history |
| P6-09 | Shortlist / favourite / hide / ignore | PARTIAL | Low | one action slot per pair: **shortlist overwrites a sent like** (`:97`) and (with `isMutual` stuck) silently keeps the mutual; "hide/ignore" = `pass`; no list/undo of passes |
| P6-10 | Block overrides connections — REST chat/voice/reactions | **FAIL** | High | `chatController.js:73-87,249,315,579,641` no `Block` reference (grep: only match/search/profile/blockReport import `Block`) |
| P6-11 | Block — socket join/typing/presence/broadcast | **FAIL** | High | `socketHandler.js:141-157,226-318,381-439` no block check; REST broadcasts `emitToConversation` `chatController.js:62-70` |
| P6-12 | Block — calls | **FAIL** | High | `callController.js:78-136` (mutual only; callee status not even checked) ; accept/decline/end no state check `:141-215` |
| P6-13 | Block — family groups | **FAIL** | High | `groupController.js:142-197` add member: no block check, no target-status check, no consent |
| P6-14 | Block — lists (mutual/likes/shortlist/sent/conversations/viewers/guardian) | **FAIL** | Med | `matchController.js:387-621`, `chatController.js:103-121`, `profileController.js:985-1014`, `guardianRoutes.js:154-215` — none filter `Block` |
| P6-15 | Block — search / profile / unlock / daily / recently-viewed | PASS | — | `searchController.js:61,433,558`; `profileController.js:538-549` (`assertProfileVisible`), `matchController.js:29-39,269-277`, `profileController.js:1043` |
| P6-16 | Block — notifications/e-mail after block | **FAIL** | Med | `chatController.js:446-463` e-mails on every message regardless; group-add notify `groupController.js:182-192` |
| P6-17 | Membership-aware comms (requireChatAccess / free-reply window) | PARTIAL | Low-Med | REST+socket use same `hasChatAccess` (`entitlements.js:152`); send re-checked under row lock (`chatController.js:362-400`) PASS. Gaps: voice never creates a `ChatGrant` (`:579-636`) so a free recipient of a voice-first message can't read/reply; `requireChatAccess` runs before validators → non-uuid `receiverId` with flag on = 500 (`auth.js:246`) |
| P6-18 | Contact-detail disclosure rules (unlock-contact) | PASS w/ notes | Med (design) | quota atomic (`profileController.js:905-928`), idempotent `ON CONFLICT` (`:839-850`), transactional, requires `phoneVerified` (`:820-825`), validates target/blocks before spending (`:803`). Notes: no owner consent/preference, no notification to owner, e-mail revealed unverified, `getProfile` uses `hasPremiumAccess` w/o `endDate` (`:603-608`) |
| P6-19 | Private-message participant authz (REST) | PASS | — | pair query + mutual check; edit/delete `senderId===user` (`chatController.js:500,551`); reaction participant check `:661` |
| P6-20 | Socket per-event membership — **join-room** | **FAIL** | **Critical** | `socketHandler.js:241-267` |
| P6-20b | Socket auth on connect + mid-session revocation | PASS | — | `authenticateSocket :98-139` (JWT type + status), `ensureStillActive :180-204`; cookie SameSite=strict in prod (`authController.js:33`) so CSWSH not viable |
| P6-21 | Message spoofing / client relays | PASS | — | `send-message`, `message-edited`, `message-deleted`, `group-send-message` are no-ops (`:296,325,332,378`); sender = `req.user.id` |
| P6-22 | Socket handler robustness (payload validation) | **FAIL** | High | `:299` (`async ({receiverId,isTyping})`), `:381-439` (no try/catch, no uuid check) |
| P6-23 | Attachment validation (voice) | PARTIAL | Med-Low | mime+ext+5MB+Cloudinary `allowed_formats` (`middlewares/upload.js:185-249`); no magic-byte (documented choice); upload streams to Cloudinary **before** mutual/receiver checks (`chatRoutes.js:72-77`, `chatController.js:579-`) → orphan assets on 403; `durationMs` client-supplied; asset never deleted on message delete / erasure (`accountErasure.js:100-108` nulls URL only) |
| P6-24 | Message length | PASS | — | validator 2000 + controller + entity-escape (`validators/index.js:397-412`, `chatController.js:41-54,322-328`) |
| P6-25 | URL / phone handling in messages & notes | **FAIL** | Med | no link/number policy: `matchController.js:70-73` note (≤280) and chat text only tag-stripped → phone numbers/URLs travel freely (free-tier like-notes bypass the ₹ unlock paywall; phishing links). HTML-escape-on-store (`&amp;`, `&#x27;`) — client decode not confirmed **[NOT VERIFIED]** |
| P6-26 | Rate limits | PARTIAL | Low | REST: `messageLimiter`/`matchActionLimiter` 60/min keyed by user id (after `auth`) PASS; socket limits keyed by `socket.id` (`:33-40`) → N connections multiply; no per-user connection cap |
| P6-27 | Notification / unread-count consistency | PARTIAL | Low | `Notification` enum has `new_message/profile_view/subscription_expiring` never emitted (grep) → messages produce e-mail only, no in-app/push; conversation unread only for mutual list; `getConversations` paginates `Match.findAll` with **no ORDER BY** then sorts page-locally (`chatController.js:103-227`) → inconsistent across pages; `getMessages` marks read as a GET side effect and emits no read receipt |
| P6-28 | Retention & deletion | PARTIAL | Med-Low | `cleanup-old-messages` disabled unless `MESSAGE_RETENTION_MONTHS` (`queue.js:203-209`) = indefinite; sender may hard-delete own messages at any time with no age limit (`chatController.js:558`) → evidence destruction after a report; recipient cannot delete/hide a thread; erasure tombstones bodies (PASS) but not Cloudinary assets |
| P6-29 | Family (group/guardian) access explicitly authorised | PARTIAL | Med | membership gate solid (`requireMembership :36-40`, `join-group :357`). Gaps below §3 |
| P6-30 | Report from profile AND conversation | PARTIAL | Med | mobile: `ProfileDetailScreen` + `ChatThreadScreen` → `POST /report/:id`. **Web: no block/report UI anywhere** (grep of `frontend/src`: only admin API). Backend `Report` has no message/conversation ref or evidence snapshot (`models/Report.js`), no dedupe, admin filter omits `reviewing/resolved` (`adminController.js:506`) |

### Phase 11 — notifications & jobs

| ID | Requirement | Status | Sev | Where |
|----|-------------|--------|-----|-------|
| P11-01 | OTP delivery | PARTIAL | Low | MSG91/Fast2SMS (`smsService.js:60-151`); provider failure → 503 + OTP deleted PASS, but the hourly counter was already consumed (`:157-166,196-202`); dev-mode returns `success:true` (`:187-190`) |
| P11-02 | OTP expiry | PASS | — | 600 s TTL + `expiresAt` (`smsService.js:15,229-232`) |
| P11-03 | OTP attempt limits | PARTIAL | Med | 5 attempts but read-modify-write (`:240-246`) → parallel guesses share one counter; 4-digit `Math.random` (`:20`), plaintext in Redis, `!==` compare; only guard in front is `otpLimiter` 10 req/10 min **per IP** shared by send+verify (`security.js:170-176`) → distributed guessing viable; target of impact = `verifyContactNumber` (claims arbitrary phone as *verified*, `authController.js:1024-1036`) and signup markers |
| P11-04 | OTP resend/retry controls | **FAIL** | Med | phone: 3/h check-then-set, non-atomic, sliding (`:157-166`), no min interval; **email OTP: no per-target limiter at all** (`authController.js:880-925`) → third-party mail-bomb + Resend-quota burn from rotating IPs; send stores `otp:${target}` un-normalised but verify reads lower-cased key (`:906-908` vs `:942`) → mixed-case email never verifies (web lowercases, other clients may not) |
| P11-05 | E-mail templates | PARTIAL | Low | branded transactional set in `utils/email.js`; match/message mails still legacy `emailService.js:14-41` (old pink brand, raw string HTML — safe today only because names are `[a-zA-Z\s'-]` validated), match e-mail copy says "has liked your profile" even for mutual, **no unsubscribe/List-Unsubscribe** on these |
| P11-06 | SMS template | PASS | — | single DLT OTP template, no personal data |
| P11-07 | Push | PARTIAL | Low-Med | FCM multicast, dead-token pruning (`fcm.js`); payload = liker's full name + like-note text (≤280) on lock screen (`matchController.js:218-227`); `registerFcmToken` doesn't detach a token from another account (shared device) `notificationController.js:113-125`; weekly-digest push never fires (`queue.js:259` selects no `fcmTokens`) |
| P11-08 | In-app | PARTIAL | Low | `notify()` `notifyUser.js`; unused enum values; `Notification` rows never purged (no cleanup job) |
| P11-09 | Interest & response notifications | PARTIAL | Med | like → in-app+push, mutual → in-app+e-mail both. **Spam vectors:** re-like on mutual pair (dup + e-mail), and like→pass→like flip-flop each fire a fresh notification/push (60/min via `matchActionLimiter`); decline/withdraw send nothing |
| P11-10 | Membership expiry / payment notifications | PASS (needs Redis) | Low | `runSubscriptionLifecycle` with ledger claim-before-send, 10:00-22:00 IST window, payment-failed/renewal/expiry/win-back; confirmation e-mail after commit (`subscriptionController.js:326-346`); no in-app/push; **without Redis no cron ever runs** (`queue.js:31-36,587-`; memory fallback schedules nothing) |
| P11-11 | Bull retries / backoff / DLQ / idempotency | PARTIAL | Med | attempts 3, exp 2 s (`queue.js:44-51`); failed jobs kept (500) but no DLQ consumer/alert; lifecycle jobs idempotent (ledger) PASS; **weekly digest**: `findAll({limit:500})` no order/offset (`:252-261`) ⇒ same first 500 forever; saved-search alerts `limit:1000` same (`:364-374`); digest not idempotent on retry; `email` queue has no `alert` processor (`utils/alerts.js:485` vs `queue.js:114-142`); memory fallback drops push/in-app/alert types (`queue.js:525-549`) |
| P11-12 | No private details in previews | PARTIAL | Low | no phone/e-mail/message body in push/e-mail (PASS; explicit comment `chatController.js:445`); but names + user-typed like-note + group name (attacker-controlled free text, `groupController.js:182-191`) pushed to arbitrary users; `[OTP] Sent via … to 91XXXXXXXXXX` info log keeps full phone in message string (`smsService.js:194`) |
| P11-13 | Unsubscribe & preferences | PARTIAL/FAIL | Med | Lifecycle mail: signed one-click (`emailUnsubscribe.js`, POST-only action, RFC 8058) PASS, digest honours `emailOptOut` PASS. **In-app preferences: FAIL** — `pages/Settings.jsx:698-718` writes `tm_notif_prefs` to `localStorage`, no API, no DB column; toggles ("Messages", "Interests", "Promotions") change nothing server-side; RN has none; match/message e-mails ignore `emailOptOut` |
| P11-14 | Expiry handling | PARTIAL | Low | sessions 30d inactivity + 7d refresh PASS; subs hourly + in-query `endDate` PASS; pending orders swept PASS; OTP TTL PASS; guardian invites 7d lazy; **interests never expire**; stale `CallSession initiated` never expires and still authorises `agora-token` (`callController.js:31-38`); `Notification` unbounded |
| P11-15 | Scheduled-job monitoring & failure alerts | **FAIL** | Med | `queue.on('failed')` only logs (`queue.js:56-69`); `monitoring/alert_rules.yml:156-181` alerts on `tricitymatch_queue_waiting_total` / `_failed_total` which **nothing in `backend/` exports** (grep empty); `alerts.js` `queueBacklog` never fed; `monitoring/alertmanager.yml:77-114` every receiver commented out; no dead-man/heartbeat for crons (a silently-not-running digest is invisible) |
| P11-16 | Notifications only after DB commit | PASS | — | `matchAction` notifies in `setImmediate` after `sequelize.transaction` (`:185-232`); no `notify()` call site sits inside a transaction (grepped all 20); payment mail after commit |

---
## 2. Detailed findings

### P6-20 — `join-room` lets a non-participant subscribe to any pair's private room  · Critical
* **Evidence:** `socket/socketHandler.js:241-267`
  ```js
  const userIds = roomId.split('_room_');
  const otherUserId = userIds.find(id => id !== userId);   // first id that isn't me
  ... verifyMutualMatch(userId, otherUserId) ... hasChatAccess(userId, otherUserId) ...
  socket.join(roomId);                                     // roomId is the raw client string
  ```
  Nothing asserts `userId ∈ userIds` or `roomId === getRoomId(userId, otherUserId)`. The canonical pair room `sorted(X,Y).join('_room_')` is exactly where the server broadcasts (`chatController.js:62-70` `io.to(roomId).emit('message:new'|'message:edited'|'message:deleted'|'message:reaction')`, legacy names too, plus `user_typing` `socketHandler.js:313-317`).
* **Actual:** attacker P (entitled: paid plan, or free with any grant under `FREE_REPLY_WINDOW`) who is mutual with X emits `join-room` with `"<X>_room_<Y>"` (X < Y lexicographically, Y = any user). `otherUserId` resolves to X → mutual+entitlement pass → P is in the private X↔Y room and receives every message body (full `content`, `mediaUrl` of voice notes), edits, deletions, reactions, typing.
* **[POC-STUB]** `scratchpad/poc_room.js` loads the real handler; with stubs saying only P↔X is mutual, `join-room("X_room_Y")` → `socket.join` called with the victim room, zero errors emitted.
* **Expected:** join only if `roomId === [userId, otherUserId].sort().join('_room_')` with both parts UUID and the caller one of them.
* **Repro (safe):** two throw-away test accounts + a third pair in a staging DB; or run `poc_room.js`. Do not test on prod data.
* **Impact:** confidentiality break of private conversations (harassment/blackmail material in a matrimonial context); attacker gets mutuals cheaply (like-back) and enumerates Y from public search UUIDs; only needs mutual with the smaller UUID of the pair (any pair where the smaller id is one of the attacker's mutuals).
* **Fix:** canonical-room equality check (above); additionally validate `UUID_RE` on both parts; on REST-driven broadcast prefer `io.to('user_'+id)` only (already emitted) and drop pair-room broadcasts; add a test: foreign room ⇒ `NOT_MATCHED`. Existing test file `tests/unit/socketRevocation.test.js:151` covers only malformed-object input.

### P6-10 … P6-16 — Block is a soft filter, not a communication barrier · High
* **Evidence:** the only `Block` consumers are `matchController.js:29,271`, `searchController.js:61,433,558`, `profileController.js:538,1043`, `accountErasure.js`, `blockReportController.js` (grep across `controllers middlewares socket utils routes`). `chatController.verifyMutualMatch :73-87`, `socketHandler.verifyMutualMatch :142-157`, `entitlements.isMutualMatch :60-77`, `callController.initiateCall :90-98`, `groupController.addMember :142-197` contain **no** block predicate. `blockController.blockUser :13-38` only `findOrCreate`s the `Block` row — it does not touch `Matches`.
* **Actual (after A blocks B who was a mutual match):** B can still `POST /chat/messages` (A gets an e-mail "You have a new message" each time, `chatController.js:446-463`), send voice/reactions, ring A (`POST /calls/initiate`, `call-incoming` to `user_A`), keep typing indicators/presence, and add A to a family group (A is pushed/notified with B-controlled group name; can then read/receive B's group posts until A leaves). Both users' `/match/mutual`, `/chat/conversations`, shortlist/likes/sent lists still show each other (name, photo, city, education, profession); `GET /profile/me/viewers` still lists blocked viewers. Guardian candidate lists don't filter either.
* **Expected:** a block terminates: no send/receive/call/join/typing/presence/notification in either direction; existing rows hidden or `isMutual` cleared; blocker's lists drop the blocked user.
* **Repro (safe, staging):** A,B mutual → A `POST /block/:B` → B `POST /chat/messages` returns 200 and A receives `message:new`.
* **Fix:** single `assertNotBlocked(a,b)` (bidirectional, cached per request) called from `verifyMutualMatch` (REST+socket), `initiateCall`, `addMember`, voice/reaction paths; `blockUser` transaction: set `isMutual=false`/record `blockedAt`, delete `ChatGrant`, `io.in(pair room).socketsLeave`; filter lists by block set; suppress message e-mail if blocked.

### P6-22 — Authenticated socket can crash the API · High
* **Evidence:** `socketHandler.js:299` `socket.on('typing', async ({ receiverId, isTyping }) => {` — `socket.emit('typing')` (or `null`) throws in parameter destructuring, before any try/catch → rejected promise. `:381-439` `get-online-status` awaits `Match.findAll({ … Op.in: requested })` with raw client strings and no try/catch → Postgres `invalid input syntax for type uuid` rejects. `server.js:476-488` unhandled rejection ⇒ `gracefulShutdown(...)`, `server.close()` waits on live sockets (30 s force). Repeatable outage from one free account; reconnection loops re-crash after container restart.
* **[POC-STUB]** `poc_crash.js` / `poc_crash2.js`: real handlers → `UNHANDLED_REJECTION` (DB error is simulated as Postgres would raise; **not run against a live DB**).
* **Fix:** wrap every `socket.on` handler in a `safe()` that try/catches and validates payload shape (`isObject`, `UUID_RE` for every id); consider making `unhandledRejection` log + continue for socket paths rather than shutdown.

### P6-03 / P6-04 / P6-06 / P6-09 — no interest state machine; mutual is sticky and non-idempotent · Medium
* **Evidence:** `matchController.js:92-106` (`match.action = action` unconditionally), `:147-172` (mutual set when reverse row `action:'like'`; nothing ever unsets), `models/Match.js:26-41`.
* **Actual:** A likes B, B likes A ⇒ both rows `isMutual=true`. A later passes B ⇒ A's row `action:'pass'`, **both rows still `isMutual:true`** ⇒ chat/calls/presence/lists unchanged, and B is never told. A shortlisting a previously-liked profile has the same effect (silently un-likes but keeps mutual). Re-POSTing `like` on a mutual pair re-fires `notify()` ×2 and `sendMatchNotification` ×2 (e-mail flood, 60/min until block — which itself doesn't stop chat). No `declined/withdrawn` status, timestamps, or expiry.
* **Fix:** explicit `status` (`pending|accepted|declined|withdrawn|expired`) or at minimum: on any non-like action clear `isMutual`/`mutualMatchDate` on **both** rows; fire mutual notification only when `isMutual` flips false→true; add per-pair notification dedupe (e.g. 1 like-notification per pair per 24 h).

### P6-07 — lost mutual on simultaneous likes · Low-Medium
`matchController.js:42-172` runs in default isolation with no `SELECT … FOR UPDATE`; two concurrent transactions can each miss the other's uncommitted like. Fix: lock the pair (advisory lock on sorted ids) or post-commit re-check, or set mutual via one SQL `UPDATE … WHERE EXISTS(reverse like)`.

### P6-25 — no phone/URL policy in like-notes and chat · Medium
Like-notes (≤280) go to the recipient's in-app + push body (`matchController.js:218-227`) even for free senders and free recipients (recipient's `Likes You` list is premium but the push/in-app carries the name + note). Free members can therefore exchange numbers/links without unlock. Fix: strip/mask digit runs ≥7 and URLs in notes and chat for non-mutual/free tier (or flag to moderation), rate-limit notes.

### P6-29 — family groups / guardians · Medium
* No consent to be added: `addMember :142-197` adds any user id/phone with an in-app notification only; the notification body embeds the owner-chosen group name (≤100 chars) — arbitrary text pushed to any user id. No block check, no `status==='active'` check on the target, no per-user group-creation limit or body validation (`createGroup :60-85`; `candidateUserId` only existence-checked, so a group can be attached to any stranger).
* Membership oracle survives despite the comment: hit → `201` (+ victim notified), miss → `400 "Could not add that member"`, already-member → `409` (`:159-181`). Rate limit 60/min (`matchActionLimiter`).
* Removal/leave/delete don't evict sockets: `removeMember :199-222`, `leaveGroup :224-237`, `deleteGroup :239-251` never call `socketsLeave`, and `group-message-received` is emitted to room `group_<id>` (`:298-300`) ⇒ ex-members keep receiving live messages/edits/deletions until they disconnect.
* Guardian: `POST /guardian/invite` links an existing user as **active** immediately with no accept step (`guardianRoutes.js:98-110`) and returns `method:'direct'|'pending'` = registered-email oracle; for unregistered emails **no e-mail is sent and the token is never returned** (`:112-127`) and no signup hook resolves pending links (grep `GuardianLink` → only `accountErasure`) ⇒ "invite a guardian by e-mail" cannot complete for non-members.
* Fix: pending-invite state with accept; uniform response + timing; evict sockets on removal; block/status checks; group-name sanitiser and no user text in push.

### P6-23 / P6-28 — voice + deletion/retention · Medium-Low
Voice route (`chatRoutes.js:72-77`): multer→Cloudinary happens before pair validation; orphaned objects on rejection; no cleanup on `deleteMessage :540-571` or erasure; free recipient of a voice-first thread has no grant. Retention off by default; sender can unsend any message forever (no age bound) which defeats report evidence (report holds no snapshot).

### P11-03 / P11-04 — OTP hardening · Medium
`smsService.js:20` `Math.floor(1000+Math.random()*9000)` (non-CSPRNG, 9000 space); attempts counter non-atomic (`:240-246`, same in email `authController.js:952-960`); `checkRateLimit :157-166` get→set (race), window slides on every send. Route-level only `otpLimiter` 10/10 min/IP for send+verify. Consequence chain: distributed guess → `verifyContactNumber` marks an attacker's account `phoneVerified` for **someone else's** number (then revealed on unlock as "verified"); SMS-pumping to many numbers (3/h/number only). Fix: `crypto.randomInt`, Redis `INCR`/Lua for attempts and send counters, per-target + per-account limiters (email too), 60 s resend cooldown, lower-case/trim the email key at send.

### P11-13 — preferences not real · Medium
`frontend/src/pages/Settings.jsx:698-718` → `localStorage.setItem('tm_notif_prefs')`; no endpoint (`notificationRoutes.js` has none), no column. Users are shown a control that does nothing; match/message e-mails and push ignore both prefs and `emailOptOut`. Fix: persist prefs (`Users.notificationPrefs` JSONB), consult in `notify()`/email senders; add unsubscribe footer + `List-Unsubscribe` to match/message mails or stop them being "transactional" when uncapped (currently 1 e-mail per message, up to 60/min).

### P11-11 / P11-15 — jobs & monitoring · Medium
Digest cap (`queue.js:252-261`), dead queue metrics (`alert_rules.yml:159-181` vs no exporter), commented receivers, no cron heartbeat, `alert` job without processor, no Redis ⇒ no crons at all (in-memory mode logs "using in-memory job processing" and silently omits digest, expiry, lifecycle, token cleanup). Fix: export `bull` counts to `/metrics`, add a "last successful run" gauge per repeatable job + Alertmanager rule, wire at least one receiver, page through users with keyset pagination.

### Lower items
* `acceptCall/declineCall/endCall` don't check current status (`callController.js:141-215`) — an ended/declined call can be re-accepted (token re-minted `:176-198`, `call-accepted` spoofed to caller); ringing sessions never expire.
* `getProfile` `hasPremiumAccess` (`profileController.js:603-608`) queries `status:'active'` without `endDate` and unordered `findOne`.
* `send-otp` 409 vs 200 remains an account-existence oracle (known design decision; still IP-limited only).
* `otp-verified:*` markers are bound to the contact, not the client/session (30 min) — theoretical squat window.
* Notification `unread` vs conversation `unread` computed independently; no combined badge count.

---
## 3. Workflow maps (as implemented)

### 3.1 Interest → mutual → contact reveal
```
A  POST /match/:B {action:like[,note,likedItem]}   [auth, matchActionLimiter 60/min, verifyTargetUser(active)]
   ├─ Block(A,B) either way? → 403                 (only here + search/profile)
   ├─ txn: upsert Matches(A→B, action=like)        unique(userId,matchedUserId)
   ├─ reverse row B→A action='like'?  yes → isMutual=true on BOTH rows, mutualMatchDate=now   (no lock; race → missed)
   ├─ post-commit setImmediate: notify() in-app(+socket +FCM) ; mutual → also e-mail both
   └─ B sees: notification (name + note) ; GET /match/likes = PREMIUM only ; free sees only push/in-app text
B  POST /match/:A {like} → mutual.
Transitions that EXIST: like, shortlist, pass (overwrite, any→any).
Transitions MISSING: withdraw, decline-with-status, accept-with-status, expire, un-mutual, block→cascade.
      pass/shortlist after mutual → isMutual stays TRUE on both rows  ⇒ chat/calls/presence unchanged
Chat:   /chat/*  auth → requireChatAccess(paid | flag | ChatGrant) → verifyMutualMatch(isMutual) [NO block, NO active-status on read]
        free-reply: premium→free first msg creates ChatGrant(freeUser reads forever, 5 sends/48h from first reply, text only)
        voice: paid only, no grant created
Socket: connect(JWT+status) → join-room(roomId)  ⚠ no participant check → server REST broadcasts to pair room + user_<id>
Reveal: POST /profile/:id/unlock-contact  [auth, requirePremium, checkContactUnlockLimit]
        assertProfileVisible (active user, block both ways, matches_only unless already unlocked)
        target.phoneVerified? else 409 (no quota spent)
        txn: INSERT ContactUnlocks ON CONFLICT DO NOTHING RETURNING → win? → atomic quota UPDATE (or 24h cap w/ sub row lock)
        → { phone (only if verified), email }      NOT tied to interest/mutual/consent; owner not notified
        GET /profile/:id also returns phone/email when premium ∧ previously unlocked (no endDate check)
```

### 3.2 Blocking
```
A POST /block/:B → Block(A,B) findOrCreate ── nothing else changes ──►
 ENFORCED      : matchAction, getProfile/compat/horoscope/kundli/unlock (assertProfileVisible), search list/by-code, daily, recently-viewed
 NOT ENFORCED  : chat send/read/edit/delete/voice/reaction, socket join/typing/presence/broadcast, calls initiate/accept,
                 group add + existing group rooms, mutual/likes/shortlist/sent/viewers/conversations lists, guardian lists,
                 message e-mail + group-add notification, ChatGrant, existing notifications
 MISSING side-effects: clear isMutual, evict sockets, cancel ringing calls, notify (silent by design OK), audit is logged only
Unblock → DELETE Block row (no state to restore, since none was changed)
```

### 3.3 Notification pipeline
```
event → notify(): Notification.create → io.to(user_<id>).emit('notification') → setImmediate FCM (tokens on User row)
e-mail: emailService (legacy, per event, no prefs/unsub) | email.js templates (Resend/SMTP, dry-run outside prod)
Bull(cleanup queue, Redis only): tokens 0 * * * * · expire-subs 0 * * * * · sessions 0 4 · msgs 0 3 (disabled) · digest Mon 10:00 (limit 500) ·
   saved-search 09:00 (limit 1000) · lifecycle+photo-nudge 15,45 * * * * (10-22 IST window, ledger claim-before-send)
failure path: log only → (no metric, no alert, no DLQ consumer)
```

---
## 4. Verified-OK controls (so they aren't re-audited)
Match unique constraint + upsert; self-like blocked; REST chat participant scoping; server-authoritative broadcasts (client relays no-op); socket JWT/status on connect and every gated event (60 s cache); cookie SameSite=strict (CSWSH); free-reply window row-locked transaction; unlock-contact atomicity/idempotency/verified-phone/target validation; group REST endpoints membership-gated with uuid params; erasure tombstones message bodies, matches, blocks, grants, notifications; lifecycle mail ledger (claim before send), IST window, RFC 8058 unsubscribe; no notify() inside transactions; no message content in e-mail/push.

## 5. Not verified / limits
No live DB, Redis, browser, or prod contact. PoCs use the real handler files with stubbed models/entitlements (DB error text for malformed uuid is simulated; Sequelize `typeValidation` default assumed off — test comment `socketRevocation.test.js:14-15` corroborates). Client-side decoding of HTML-escaped message text, mobile block/report sheet behaviour end-to-end, and Alertmanager runtime state on the VPS were not checked.

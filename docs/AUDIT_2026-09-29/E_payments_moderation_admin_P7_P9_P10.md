# Audit E — Payments (P7), Trust & Safety (P9), Admin/Support (P10)

Repo: `/Users/sakshampanjla/Desktop/REACT/tricitymatch` (branch main, HEAD 7b170f1). READ-ONLY static audit: no files modified, nothing run against prod, no payments, no email/SMS. All paths relative to repo root. "Live-repro" methods are described but NOT executed (no live DB / sandbox keys used) — every FAIL below is proven by code reading; anything needing runtime confirmation is marked **NOT VERIFIED (runtime)**.

Severity scale: Critical / High / Medium / Low / Info. Status: PASS / PARTIAL / FAIL / NOT VERIFIED / N/A.

---------------------------------------------------------------------------
## 0. Executive summary (top findings)

| # | ID | Sev | One-liner |
|---|----|-----|-----------|
| 1 | P9-02 | **High** | The **web app has no Report or Block UI at all** (zero calls to `/report` or `/block` in `frontend/src`), while Terms/Safety/Help/city pages promise "Report and Block are on every profile and conversation… reviewed within 24 hours". Only RN has it. |
| 2 | P9-12 / P9-13 | **High** | **Block is bypassable**: blocking never removes the mutual `Match`, and chat (REST), calls, socket typing/rooms and **family groups** perform no Block check. Groups additionally bypass premium chat, mutual-match and consent (any user can add any user, no accept step). |
| 3 | P7-15 | **High/Med** | **Invoices/"Payment Receipt — Total Paid ₹X" are issued for money never received**: `getInvoice`/`adminGetInvoice` only refuse `status='pending'`; a popup-closed `cancelled` order and any **admin-comped grant** (amount = list price, no payment id) pass. No GST breakup / GSTIN / sequential invoice no. despite Terms saying prices "include GST". |
| 4 | P7-10 | **High** | No refund/dispute/chargeback handling: webhook handles only `payment.captured` + `payment.failed`; no `refund.*`, no `payment.dispute.*`; admin refund does not revoke entitlement or write any ledger row; Play refunds/RTDN not handled. |
| 5 | P10-09 | **Med/High** | `PUT /admin/users/:id/status` has no role guard: any admin-family account with the coarse `users` scope (default sub-admin scope!) can **ban/deactivate an `admin`/`super_admin`**. (Bulk variant is correctly limited to `role='user'`.) No MFA anywhere (P10-10). |

Other notable: P9-06 no appeal workflow; P9-14 erasure + admin hard-delete **destroy evidence** (Reports cascade-deleted, messages tombstoned, Verification/Profile deleted) contradicting Terms' 180-day preservation promise; P9-10 no link/financial-scam filtering in chat; P7-16 bundle/astrologer captured payments have no webhook fallback (paid, no credit); P7-17 revenue report drops superseded/cancelled paid rows and ignores bundles/bookings/refunds; P9-03 admin report tabs `reviewing`/`resolved` are unfiltered (backend allowlist mismatch).

What is genuinely good (verified): server-computed prices everywhere; HMAC webhook with raw body + timing-safe compare + prod-fatal missing secret; `verifyPayment` binds order→user→row under row lock; payment-id unique indexes (mig 000052); entitlement predicates put `endDate` in the query; unlock quota consumed with conditional UPDATE + ON CONFLICT (race-safe); every `/admin/*` route carries `requireAdminScope`; `/admin/team` blocks self-edit, rank escalation, scope escalation, last-admin demotion; no auto-ban on report count; erasure/report retention of Report rows; admin refund is manual, capped, audited.

---------------------------------------------------------------------------
## 1. Checklist table

### Phase 7 — Memberships & payments
| ID | Requirement | Status | Sev |
|----|-------------|--------|-----|
| P7-01 | Server-defined entitlements/prices; frontend cannot set amount | PASS | — |
| P7-02 | Price/duration/features/limits/**taxes** clearly displayed | PARTIAL | Med |
| P7-03 | Secure checkout, no card handling | PASS | — |
| P7-04 | Signed webhook, raw body | PASS (notes) | Low |
| P7-05 | Idempotent processing; duplicate callbacks can't double-activate | PARTIAL | Low-Med |
| P7-06 | Activation only on verified payment (HMAC-only assessment) | PARTIAL | Low |
| P7-07 | Start/expiry/upgrade/downgrade/renewal rules | PARTIAL | Med |
| P7-08 | Entitlements checked on every protected API | PARTIAL | Low-Med |
| P7-09 | Payment failure / cancellation workflows | PARTIAL | Low |
| P7-10 | Refund / dispute / chargeback workflows | **FAIL** | High |
| P7-11 | Ledger / invoices / reconciliation / GST numbering | **FAIL** | High |
| P7-12 | No raw card storage | PASS | — |
| P7-13 | Sandbox-only in tests | PASS | — |
| P7-14 | Contact reveal / premium chat / boost cannot be bypassed | PARTIAL (groups bypass = P9-13) | High |
| P7-15 | Invoice only for real paid transactions | **FAIL** | High/Med |
| P7-16 | Every captured payment type reconciled by webhook | **FAIL** | Med |
| P7-17 | Revenue report correctness | **FAIL** | Med |
| P7-18 | Stale/revived order cannot downgrade a higher active plan | **FAIL** | Med-Low |
| P7-19 | Google Play rail parity (RTDN, tier rank, withdrawn, renewal) | PARTIAL (flag-gated) | Med |
| P7-20 | `getProfile` viewer premium check honours endDate | **FAIL** | Low-Med |
| P7-21 | Astrologer payment path | PARTIAL (flag-off by default) | Low |

### Phase 9 — Moderation / fraud / abuse
| ID | Requirement | Status | Sev |
|----|-------------|--------|-----|
| P9-01 | Report categories | PARTIAL | Med |
| P9-02 | Reporting/blocking reachable by every member on every platform | **FAIL (web)** | High |
| P9-03 | Case creation/assignment/evidence/status tracking | PARTIAL | Med |
| P9-04 | Moderator actions (dismiss/warn/restrict/suspend/remove/escalate) | PARTIAL | Med |
| P9-05 | Human review | PASS (no SLA enforcement) | Low |
| P9-06 | Appeal & restoration workflow | **FAIL** | High (legal) |
| P9-07 | Moderator audit trail | PARTIAL | Med |
| P9-08 | Rate limits OTP/login/interest/message/search | PASS/PARTIAL | Low |
| P9-09 | Bot/scraping/enumeration/mass-messaging protection | PARTIAL | Med |
| P9-10 | Malicious-link & financial-request handling in chat | **FAIL** | Med |
| P9-11 | High-risk report escalation | **FAIL** | Med |
| P9-12 | Block cannot be bypassed via alternate APIs/sockets | **FAIL** | High |
| P9-13 | Family-group channel respects premium/mutual/block/consent | **FAIL** | High |
| P9-14 | Legal-request & evidence-preservation workflow | **FAIL** | High (legal) |
| P9-15 | No automatic permanent ban from unverified accusation | PASS | — |

### Phase 10 — Admin / support
| ID | Requirement | Status | Sev |
|----|-------------|--------|-----|
| P10-01 | User lookup & moderation history | PARTIAL | Low |
| P10-02 | Profile approval / correction requests / suspension | PARTIAL | Med |
| P10-03 | Restricted verification-evidence access | PARTIAL | Med |
| P10-04 | Report queues / priority / assignment / resolution | PARTIAL (see P9-03) | Med |
| P10-05 | Plans/transactions/refunds/invoices admin | PARTIAL | Med |
| P10-06 | Support tickets & grievance tracking | PARTIAL/FAIL | Med |
| P10-07 | RBAC: every admin route scope-gated | PASS | — |
| P10-08 | Privilege escalation on `/admin/team` | PASS (notes) | Low |
| P10-09 | Staff protection on single-user status change | **FAIL** | Med-High |
| P10-10 | MFA for privileged users | **FAIL** | Med-High |
| P10-11 | Audit logs for sensitive reads & changes | PARTIAL | Med |
| P10-12 | Insecure admin APIs (push, create-user password, hard delete) | PARTIAL | Med |
| P10-13 | Analytics coverage | PARTIAL | Low |
| P10-14 | Private-data exposure in dashboards/CSV | PARTIAL | Med |
| P10-15 | Marketing-role portal authz | PASS (notes) | Low |
| P10-16 | Admin scope granularity (least privilege) | PARTIAL | Med |

---------------------------------------------------------------------------
## 2. Detailed findings

### PHASE 7

#### P7-01 — Server-defined pricing: PASS
- Evidence: `backend/controllers/subscriptionController.js:41-138` — client sends only `planType`; amount = `getPlanDetails()` → `razorpay.js:165-186` (`amount: plan.amount`). Bundles `subscriptionController.js:1012-1036` + `razorpay.js:276-289` from `UNLOCK_BUNDLES`/`overlayBundle`. Astrologer `astrologerRoutes.js:117` `ast.pricePerMin * dur * 100` from DB row, `dur` integer 5–120 validated. Google rail maps `productId → planType` via `constants/plans.js:70-76` and never reads a client amount. Withdrawn tiers refused at create-order (`:62`, `razorpay.js:169`).
- Notes: launch overlay is applied at verify time too (`:250`), so a price/tenure edit between order creation and verify changes the granted term (Info).
- Repro (safe): sandbox keys + `POST /subscription/create-order {planType:"premium_plus", amount:1}` → amount ignored.

#### P7-02 — Taxes/price display: PARTIAL (Medium)
- Evidence: Terms `frontend/src/pages/Terms.jsx:199` promises "prices … include all applicable taxes, including GST". `grep GST` in `frontend/src/pages/Subscription.jsx`, `backend/utils/invoice.js`, `getPlans` → none. Invoice `utils/invoice.js:99-119` shows a single "Subtotal/Total Paid" with no tax line. `Terms.jsx:74` prints a GSTIN only `legal.gstin ? …` (config-dependent; NOT VERIFIED whether set).
- Expected: tax-inclusive label at checkout; tax invoice with GSTIN, SAC, taxable value/CGST/SGST/IGST split, place of supply (if GST-registered).
- Fix: add "incl. GST" caption next to every price; extend invoice (see P7-11).

#### P7-03 — Secure checkout: PASS
- Razorpay Checkout hosted; CSP allows only checkout.razorpay.com/api.razorpay.com (`middlewares/security.js:302-312`); `Subscription` stores only ids + signature (`razorpaySignature`). Payment limiter 10/h/user on create/verify/bundle/cancel/google (`subscriptionRoutes.js:96-146`, per-user key at `security.js:289`... note the route file also defines a local `paymentLimiter` at `subscriptionRoutes.js:29` keyed by default keyGenerator = `req.user?.id || ip`; fine).

#### P7-04 — Webhook signature: PASS (Low notes)
- `subscriptionRoutes.js:39-72`: raw body via `express.raw` (`server.js:129-143`), HMAC-SHA256, length guard then `timingSafeEqual`, prod boot fatal if secret unset (`config/env.js:523`).
- Notes: (a) when secret unset in non-prod it 200-acks and discards silently (`:44-47`) — OK by design. (b) No `x-razorpay-event-id` dedupe table and no timestamp/replay window — replay safety rests entirely on state-based idempotency (P7-05). (c) Handler body reads `payload.payment.entity` inside branches only; a malformed-but-signed payload for a handled event would 500 → Razorpay retries (Info). (d) No dedicated limiter on the public webhook path beyond `apiLimiter` (IP-keyed); Razorpay egress IPs could share NAT — Info.

#### P7-05 — Idempotency / duplicate activation: PARTIAL (Low-Med)
- Good: `verifyPayment` idempotency (`:209-226`), row lock (`:234-243`), `razorpayPaymentId` unique index (mig 000052), webhook `existingActive` early-out (`:738-749`) then locked re-read (`:751-756`) so verify+webhook race cannot double-activate; upgrade supersedes other pending/active rows in the same txn (`:278-288`, webhook `:794-804`).
- Gaps: (1) `verifyBundlePayment` and astrologer verify are state-checked but have no DB uniqueness on `UnlockPurchases.razorpayPaymentId` (mig 000052 covers Subscriptions + AstrologerBookings only, `migrations/20240101000052-payment-id-uniqueness.js:52-53`). Risk is low because the HMAC binds order|payment and a Razorpay order can be paid once (Info). (2) P7-18 revival path.
- Repro (sandbox): fire `verify-payment` twice concurrently with the same triple → one activation, one `existingPayment` return.

#### P7-06 — Activation only on verified payment / HMAC-only assessment: PARTIAL (Low)
- `razorpay.js:201-221` verifies `HMAC(order|payment)` only; never calls `payments.fetch` to confirm `status=captured`/amount/currency. Risk assessment: the signature is issued by Razorpay Checkout only after a successful (authorized) payment and only the merchant secret can forge it, so client forgery is not possible. Residual: if the Razorpay account is on **manual capture**, an *authorized-not-captured* payment (auto-refunded after ~5 days) still yields a valid signature → free membership. Also no amount/currency assertion against the order.
- Expected: server-side `payments.fetch(paymentId)` (or rely on `payment.captured` webhook) and assert `status==='captured' && order_id===order && amount===sub.amount*100`.
- NOT VERIFIED (runtime): prod Razorpay capture mode.
- Fix: fetch+assert in verifyPayment/verifyBundlePayment/astrologer verify; or activate only from webhook and let verify poll.

#### P7-07 — Lifecycle rules: PARTIAL (Medium)
- Start/expiry: `startDate=now`, `endDate=now+duration` (`:255-258`); hourly `expire-subscriptions` (`utils/queue.js:446-462`), but reads are query-level `endDate` (P7-08).
- Upgrade: `TIER_RANK` gate (`:66-94`); old row cancelled; **remaining paid days forfeited, bundle-purchased unlocks lost** (new row resets `contactUnlocksAllowed/Used`, `:267-268`) — accepted product decision but undisclosed for bundles.
- Downgrade: refused ("Contact support") — admin only.
- Renewal: **same-tier renewal while active is 409 `You are already on this plan`** (`:84-91`) so a member cannot renew early; must wait for expiry → churn/gap risk. Renewal reminders exist (lifecycleMail) but the CTA cannot be honoured until expiry.
- Google Play renewal: `verifyGooglePlay` keys idempotency on token; after first term the row is `expired` → `409 This purchase has already been used` (`:454-455`) although Play reuses the same token for auto-renewals (P7-19).
- Fix: allow same-tier "extend" (add duration to `endDate`) when within N days of expiry; disclose upgrade forfeits.

#### P7-08 — Entitlements on every protected API: PARTIAL (Low-Med)
Enumerated gated routes (all server-side):
| Feature | Gate | Notes |
|---|---|---|
| chat REST | `chatRoutes.js:34 requireChatAccess` → `utils/entitlements.hasChatAccess` (endDate in query) | free-reply window flag (live in prod) grants read-forever + 5 sends/48h by grant row |
| chat voice / reactions | `requirePremium` (`chatRoutes.js:68-83`) | ok |
| calls token/initiate | `requirePremium` + mutual (`callRoutes.js:21-22`, `callController.js:83-104`) | accept/decline/end ungated (callee may be free — by design) |
| likes-you | `requirePremium` (`matchRoutes.js:38`) | |
| viewers | `requirePremium` (`profileRoutes.js:84`) | |
| unlock-contact | `requirePremium` + `checkContactUnlockLimit` (`profileRoutes.js:140-148`) | quota race-safe (`profileController.js:836-946`) |
| kundli PDF | `requirePremium` (`profileRoutes.js:176`) | |
| bundles | `requirePremium` | |
| socket join-room | `hasChatAccess` at join (`socketHandler.js:261`) | **not re-checked after join** — a socket that joined while premium keeps *receiving* room messages after expiry (send is REST-gated) — Low |
| search/match ranking, `isPremium` badge | query-level endDate | ok |
- FAIL point: `controllers/profileController.js:603-609` — `viewerSubscription = Subscription.findOne({userId, status:'active'})` with **no `endDate` filter, no plan filter in SQL, no ORDER BY**; `hasPremiumAccess` then gates (a) voice/video intro URLs (`:667-670`), (b) **reveal of previously-unlocked phone/email** (`:672-687`), (c) `contactUnlocksRemaining`. Between `endDate` and the hourly sweep (or indefinitely if Bull/Redis is down) an expired member still gets these. Multiple active rows → arbitrary row picked.
- No route trusts `user.subscriptionPlan` (only serialised for clients, `authController.js:39-51`) or client-supplied plan. `endDate:null` rows are treated as perpetual by every gate (`entitlements.js:46`, `auth.js:197`) — only possible via admin grant where `endDate` is always set, but there is no DB constraint.
- Repro (safe, dev DB): set an active row's `endDate` to yesterday, don't run the sweep, `GET /profile/:id` for a previously unlocked target → contact still returned.
- Fix: reuse `getActiveSubscription()` in `getProfile`.

#### P7-09 — Failure / cancellation: PARTIAL (Low)
- `cancel-order` (`:153-184`) conditional update; `payment.failed` keeps order pending and stamps `paymentFailedAt` (`:826-854`); sweeper/mail in `utils/lifecycleMail.js`. Good design.
- Gaps: (1) No `payment.authorized`/`order.paid` handling. (2) Member self-cancel (`DELETE /subscription/current`) ends access **immediately** with no refund and no prorated tail (`:940-983`) — matches published policy but harsh; consistent with Refund Policy (NOT re-audited legally). (3) Bundle pending orders never swept (noted in CLAUDE.md).

#### P7-10 — Refund / dispute / chargeback: **FAIL (High)**
- Evidence: webhook handles exactly two events (`subscriptionController.js:733`, `:826`). `grep -rn "refund\.\|dispute" backend/controllers` → only the admin *initiator* (`adminController.js:1273-1359`) and comments. No `refund.processed|failed`, `payment.dispute.created|won|lost|closed`.
- Admin refund `adminController.js:1273-1359`: calls `payments.refund`, then only `logAudit` + notify. It does **not** (a) mark the Subscription refunded / store refund id / amount, (b) revoke entitlement, boost, unlocks, (c) reverse marketing commission on `MarketingLead.amountPaid`, (d) prevent a second refund (relies on Razorpay's remaining-amount check). Refund + entitlement removal are two separate manual admin actions (`DELETE /admin/users/:id/subscription`). Refund of bundle purchases and astrologer bookings is not supported at all (only `Subscription` ids).
- Chargebacks: a disputed/charged-back payment keeps the member premium and the row counts as revenue and as commission-bearing for the marketing rep (`marketingReport`/`amountPaid`).
- Google Play: no RTDN/voided-purchases handling; refunded/cancelled Play purchases retain entitlement to `endDate` (≤400 d clamp, `:463-464`).
- Impact: financial leakage + inconsistent ledger; compliance exposure (RBI/Razorpay dispute deadlines).
- Repro (sandbox): create+pay test order, issue refund from Razorpay dashboard → member stays active; revenue unchanged.
- Fix: add `refund.processed`, `payment.dispute.created/lost` handlers → set `status='refunded'|'disputed'`, revoke entitlement/boost, reverse commission, notify admin; add `refundedAmount`/`refundId` columns or a `Payments` ledger table; make refund endpoint atomically cancel the plan (optional flag); RTDN Pub/Sub endpoint for Play.

#### P7-11 — Ledger / invoices / reconciliation / GST numbering: **FAIL (High)**
- Single table `Subscriptions` is both order and entitlement; no `Payments`/`Refunds` ledger; refunds only in `AuditLogs` (`adminController.js:1340`; comment at `:1335-1339` admits it).
- Invoice number = `INV-` + first 8 chars of the subscription **UUID** (`utils/invoice.js:43`) → not sequential, not gap-free, not unique-guaranteed; no seller legal name/address/GSTIN, no SAC, no tax split, no buyer GSTIN/state; "Status: CANCELLED" can be printed on a "Receipt". No credit note on refund. Bundle purchases and astrologer bookings have no invoice route at all.
- No reconciliation job against Razorpay settlements/payments API; no daily mismatch report.
- Fix: `Invoices` table with FY-scoped sequential number, immutable snapshot (amount, tax breakup, GSTIN), credit notes on refund; nightly Razorpay `payments.all` reconciliation.

#### P7-12 — No raw card storage: PASS
- No card/PAN/CVV fields in any model or log path (`models/Subscription.js` ids only; checkout hosted). NOT VERIFIED: Razorpay dashboard PCI scope (out of repo).

#### P7-13 — Sandbox-only in tests: PASS
- `backend/tests/unit/{razorpay,subscriptionWebhook,paymentReplay,cancelOrder,adminManualRefund,withdrawnTier}.test.js` use mocks; no `rzp_live` literals outside `.env.production.example` placeholder and the secret scanner regex.

#### P7-14 — Bypass tracing for contact reveal / chat / boost: PARTIAL
- Contact reveal: only `getProfile` (P7-08 stale caveat) and `unlockContact` reveal phone/email; phone withheld unless `phoneVerified`; quota via `UPDATE … WHERE used < allowed` and unlimited-tier 24 h cap re-checked under subscription row lock (`profileController.js:867-903`). Bulk/parallel unlock race closed. Existing-unlock path (`:790-816`) is behind `requirePremium` at route level. PASS.
- Chat: REST + socket consistent via `hasChatAccess`. **Bypass: family groups (P9-13)** — no premium/mutual/block gate. Calls: `initiateCall` requires premium+mutual but not Block (P9-12).
- Boost: only set in payment/webhook/admin/invite paths for `UNLIMITED_PLANS` (static list — note `premium_plus` is *unlimited-unlock* under the launch offer but not boosted via `isBoosted`; its +10 rank comes from `premiumBoost()` in `searchController.js:359-365`). Client cannot write `isBoosted` (profile field allowlist). PASS.
- Kundli PDF/biodata: premium/expensive-read limited (`profileRoutes.js:154-176`).

#### P7-15 — Invoices for unpaid / comped rows: **FAIL (High/Med)**
- Evidence: `subscriptionController.js:901-908` and `adminController.js:1244-1250`: rejects only `amount==0` and `status==='pending' && !razorpayPaymentId`. Not rejected: (a) `status='cancelled'` with `razorpayPaymentId IS NULL` — exactly what `cancel-order` and the sweeper produce for an abandoned popup (`:171-174`); (b) **admin-granted plans**: `updateSubscription` writes `amount: planDetails.amount/100` with no payment reference (`adminController.js:723-733`) → member `GET /subscription/invoice/:id` returns a PDF titled "Payment Receipt … Total Paid ₹1,099" for a comped plan. `utils/invoice.js:118` hard-codes "Total Paid".
- CLAUDE.md (2026-08-25) claims both endpoints "refuse unpaid" — true only for `pending`.
- Impact: fake receipts usable for expense/tax claims or dispute fraud; misrepresents revenue.
- Repro (safe/dev): create order, call `cancel-order`, `GET /subscription/invoice/<id>` → 200 PDF; or admin-grant then member downloads.
- Fix: require `razorpayPaymentId IS NOT NULL` (and `status in active|expired|cancelled-with-payment`) in both handlers; label refunded/cancelled rows; never issue for grants.

#### P7-16 — Webhook reconciliation for bundles/astrologer: **FAIL (Medium)**
- Webhook looks up only `Subscription.findOne({razorpayOrderId})` (`:738-756`); `UnlockPurchase` and `AstrologerBooking` orders never match, so a captured payment whose browser never returned (tab closed, network drop) is silently ignored (200). Bundle verify additionally requires `requirePremium` at route (`subscriptionRoutes.js:143-149`) and an active finite plan in-txn (`:1084-1090`): if the plan expired while the popup was open the member **paid and gets 400/403 with no retry path**.
- Impact: money taken, nothing delivered, no automatic detection.
- Fix: extend webhook to resolve by `notes.type` (`unlock_bundle`, `astrologer_booking`) and credit/confirm idempotently; drop `requirePremium` from bundle *verify*; queue refund if the plan is gone.

#### P7-17 — Revenue report correctness: **FAIL (Medium)**
- `adminController.js:1164-1190`: `WHERE status IN ('active','expired') AND amount>0 AND razorpayPaymentId IS NOT NULL` on `Subscriptions` only.
  - Real paid rows later flipped to `cancelled` (member cancel, admin cancel, **superseded by an upgrade** `:278-288`) vanish from revenue although cash was received.
  - Refunds are never netted.
  - `UnlockPurchases` (bundles) and `AstrologerBookings` revenue omitted.
  - Google Play rows counted at Razorpay list price, not net-of-store-fee/actual price (`:477`).
- Fix: ledger table (P7-11) with `status in captured/refunded`; report gross, refunds, net, by rail.

#### P7-18 — Stale-order revival can downgrade: **FAIL (Medium-Low)**
- `createOrder` cancels earlier pending rows (`:97-106`) but does not close the Razorpay order; that order stays payable. `verifyPayment` (`:234-243`) and webhook (`:760-763`) deliberately revive `cancelled`+no-payment rows and then **cancel every other active row** (`:278-288`, `:794-804`) with **no TIER_RANK check**. Sequence: order A (premium_plus, tab left open) → member buys VIP (order B, paid, active) → pays A late → A activates and VIP is cancelled; member paid twice, holds the lower plan.
- Repro (sandbox): create A; create B; pay B; pay A via the still-open checkout.
- Fix: in revive paths, if an active row of ≥ rank exists, do not supersede—auto-refund/queue for admin; also `orders.edit`/close stale Razorpay orders (expire).

#### P7-19 — Google Play rail: PARTIAL (Medium, gated by `GOOGLE_PLAY_*` config)
- Verified token server-side with Play API, ack, cross-account replay rejected (`:441-456`), bound-account check (`:412-420`), end clamp.
- Gaps: (a) no RTDN/voided-purchase handling (P7-10); (b) no `TIER_RANK` check → a lower product token supersedes a higher active plan (`:484-491`); (c) no `isPlanPurchasable` check → withdrawn tiers purchasable if a Play product exists; (d) test purchases (`purchaseType===0`) not rejected; (e) renewal token reuse → 409 (P7-07); (f) `amount` = launch list price, not Play price.
- NOT VERIFIED (runtime): whether Play products are live.

#### P7-20 — see P7-08 evidence (`profileController.js:603-609`): FAIL Low-Med. Fix as above.

#### P7-21 — Astrologer payments: PARTIAL (Low; feature flag `ASTROLOGER_MARKETPLACE` default off → routes 404, `routes/index.js:60-66`)
- Good: order bound to booking, payment-id replay guard, prod refuses unpaid booking (`astrologerRoutes.js:111-138,167-199`).
- Gaps: no webhook fallback (P7-16); `ensureSeeded()` inserts the three fake astrologers with invented ratings/reviews on first request when the table is empty (`:60-64`, incl. "Certified by Bharatiya Vidya Bhavan") — in prod this would be a fabricated-claims risk once the flag is flipped; `start-call` ignores `scheduledAt` and `durationMin` (channel token valid any time after confirmation) (`:214-240`); no GST/invoice; no refund path.

---

### PHASE 9

#### P9-01 — Report categories: PARTIAL (Medium)
- Enum/validator: `fake_profile, harassment, spam, inappropriate_content, underage, other` (`models/Report.js:20-28`, `routes/blockReportRoutes.js:18-21`, `blockReportController.js:84`). RN sheet maps 6 labels (`mobile/src/features/profile/BlockReportSheet.tsx:30-46`).
- Missing vs requirement: financial scam/money request (folded into "Spam or scam"), threats/violence, stolen photos/impersonation-of-real-person (fake_profile covers partly), misleading info, NCII/sexual content (Terms cl.9 promises 24 h action — no distinct category to prioritise), hate, sextortion.
- Fix: extend enum (+ migration) with `financial_scam`, `threat`, `stolen_photos`, `impersonation`, `misleading_info`, `nonconsensual_imagery`; map high-risk set to priority (P9-11).

#### P9-02 — Web has no Report/Block UI: **FAIL (High)**
- Evidence: no reference to `/report` or `/block` endpoints anywhere in `frontend/src` (`grep -rnE "['\"\`]/?(v1/)?(block|report)['\"\`/]"` → 0 relevant hits; `frontend/src/api/` has no block/report client). Marketing copy claims otherwise: `pages/Safety.jsx:44`, `pages/Help.jsx:94` ("Use Report on their profile or in the chat"), `data/cityMatrimony.js:125`, Terms cl.9 (`Terms.jsx:173` "Every profile and every conversation carries a report option"). RN does have it (`BlockReportSheet` used in `ProfileDetailScreen.tsx:970`, `ChatThreadScreen.tsx:1643`).
- Impact: web members (the majority acquisition channel) cannot report or block; misrepresentation risk under IT Rules 2021 r.3(2) and consumer law; blocked-users list unmanageable on web.
- Repro: open any web profile/chat, inspect for Report/Block controls; network tab shows no call.
- Fix: build `BlockReportMenu` for `ProfileDetail` + `Chat` (message-level report), Settings → Blocked users list; until then remove the claims.

#### P9-03 — Case creation/assignment/evidence/status: PARTIAL (Medium)
- Creation: `reportUser` (`blockReportController.js:75-105`) stores reporter, reported, reason, ≤1000 char description, status pending. **No** unique index/dedupe on `(reporterId,reportedUserId)` (`models/Report.js:54-58` indexes only) → same reporter can file up to 60/min (`matchActionLimiter`) → queue flooding / retaliatory mass reports (Low).
- Missing: assignee, priority/severity, SLA timestamps, evidence (screenshots, message ids/quotes — reports cannot reference a chat message or group message), reported-user snapshot, duplicate/case grouping, per-case timeline (only latest `adminNotes` overwritten, `updateReport:553-556`), reopen guard (any status → any status).
- **Bug**: admin UI tabs are `['pending','reviewing','resolved','dismissed','all']` (`frontend/src/pages/admin/AdminReports.jsx:6`) but the API only honours `['pending','reviewed','dismissed']` (`adminController.js:504`) — for `reviewing`/`resolved` the `status` param is dropped, so those tabs list **all reports** (and `search` param is ignored, `AdminReports.jsx:36`). A "resolved" tab that shows pending items is misleading; reports moved to `resolved` are only findable in "all".
- Reporter feedback: `notify()` text for `resolved` says "action has been taken" regardless of whether any action occurred (`adminController.js:570-578`) — unverifiable claim.
- Fix: `Reports` → add `assignedTo`, `priority`, `category`, `evidence JSONB`, `reportedMessageId`; ReportEvents table (append-only) for timeline; fix VALID statuses; outcome copy tied to an `actionTaken` field.

#### P9-04 — Moderator actions: PARTIAL (Medium)
Exists: dismiss/reviewing/resolved on a report (no side effect); user status `active|inactive|banned|pending` (`adminController.js:225-257`, bulk `adminSafetyController.js:171-193`); photo removal with member notification (`adminSafetyController.js:224-247`); verification approve/reject/flag; hard delete. Missing: **warn** (member-visible warning), **restrict** (mute messaging/likes, hide profile from search while keeping login), **time-boxed suspension** with auto-restore, **escalate** (no owner/escalation state), content-level removal for bio/prompts/voice/video (only photos), banning does not notify the member or give a reason/appeal route (`updateUserStatus` sends no notification; login just says "Account is not active", `middlewares/auth.js:69-71`), no report→action link (a report can be "resolved" while the user remains active).
- Fix: `ModerationActions` table (type, reason, reportId, expiresAt, actorId), member notification with reason + appeal link, `restricted` status enforced by a `requireNotRestricted` middleware.

#### P9-05 — Human review: PASS (Low)
- All decisions are manual; nothing automated changes status (see P9-15). `getSuspicious` (`adminSafetyController.js:30-101`) is advisory scoring (duplicate photo/phone, mass likes, message blast, ≥2 reporters). SLA promises (Terms: ack 24 h, decide 15 d; RN sheet "within 24 hours", `BlockReportSheet.tsx:64`; Help/Safety "within 24 hours") have **no timers, no breach alerts, no auto-acknowledgement** — only average metrics in `getModerationStats` (`:105-167`).

#### P9-06 — Appeals & restoration: **FAIL (High, legal)**
- No appeal model/route/UI anywhere (`grep -rniE appeal backend frontend/src mobile/src` → none). A banned/inactive member sees "Account is not active" (`auth.js:69-71`) with no reason and no appeal channel; only a manual email to support. Restoration = admin flips status back (`updateUserStatus`), unlogged reason.
- Expected: notice of action with reason + appeal path; appeal ticket with second-reviewer; restore action logged; IT Rules 2021 r.3(1)(b)/(2) grievance handling.
- Fix: `Appeals` table (userId, moderationActionId, message, status, reviewer≠original actor); public endpoint usable by banned users (token from emailed notice); admin queue.

#### P9-07 — Moderator audit trail: PARTIAL (Medium)
- `logAudit` persists to `AuditLogs` best-effort (`middlewares/logger.js:279-300`, `models/AuditLog.js`) with action, actor, target, JSON details. Report updates (`:565` previous→status only, **notes not recorded**), verification changes, status changes, bulk status (ids), photo removal (url+reason), subscription overrides/cancels/refunds, role changes, exports (row count only), launch offer, marketing payouts are logged.
- Gaps: no IP / user-agent / request-id in rows; fire-and-forget (failure only warns); table not tamper-evident (app DB user can UPDATE/DELETE); no retention policy; **sensitive reads unlogged** (P10-11); success-story CRUD unlogged; push smoke-test unlogged.

#### P9-08 — Rate limits (OTP/login/interest/message/search): PASS / PARTIAL (Low)
- OTP send/verify `otpLimiter` 10/10 min/IP (`security.js:170-176`) + per-target attempt cap 5 (`authController.js:954`, `smsService.js:237`) + SMS 3/h; login: failed-only 20/10 min/IP + Redis identifier lockout (H-2 fixed); interest `matchActionLimiter` 60/min/user; message `messageLimiter` 60/min + socket 30/min; search 30/min. Attempt counters are read-modify-write (non-atomic) → parallel guesses can exceed 5 within the per-IP budget; 4-digit SMS OTP space is 10⁴ (Low).
- No **daily** cap on likes/interests or new conversations (only per-minute) → 86k likes/day/account possible; no per-recipient message cap for paid senders beyond 60/min (mutual match required, which bounds it).

#### P9-09 — Bot/scraping/enumeration/mass-message: PARTIAL (Medium)
- Present: signup 5/h/IP counting only created accounts, OTP-gated registration, unlock daily cap 25 for unlimited plans, `apiLimiter` 900 req/15 min/user (≈3,600 profile views/h/account), 30 searches/min, existence gates hardened earlier, group phone-probe generic response.
- Gaps: no bot detection/CAPTCHA/device fingerprint; `GET /profile/:id` scraping is bounded only by 900/15min; search returns 100s of profiles per page from a fresh free account; `getSuspicious` heuristics are report-only (no auto-throttle); free-tier likes unmetered (P9-08); like-notes (280 chars, `matchController.js:57-62`) and group messages are unsanitised for links (P9-10).
- Repro (safe): script 60 `POST /match/:id` per minute from one account against a dev DB — no daily brake.

#### P9-10 — Malicious links / financial requests in chat: **FAIL (Medium)**
- `utils/sanitize.js:40-58 sanitizeMessage` escapes HTML and strips `javascript:`/`data:`/`vbscript:` only. No URL allow/deny, no shortener/phishing check, no detection of payment requests (UPI IDs, "send money", crypto, gift cards), no phone/email-sharing nudge for free-window senders (`chatController.js:325-358`), no scam-warning interstitial, no first-message link block. Group messages use a different sanitiser (`groupController.js:17-29`, strips tags) with the same gap.
- Impact: primary romance/financial scam vector (matrimonial scams) is unmitigated in-product.
- Fix: server-side heuristics on send (links from unverified/new accounts held or defanged, UPI/IBAN regex flag → warning banner + auto-report), safety tips at first message, `messageFlagged` counters feeding `getSuspicious`.

#### P9-11 — High-risk escalation: **FAIL (Medium)**
- No priority field; `underage`, harassment and any threat land in the same FIFO queue as `spam` (`getReports` orders `createdAt DESC`, `adminController.js:519-528`). No paging/notification to on-duty admin, no auto-hide pending review, no NCII 24 h workflow. `getModerationStats` exposes `oldestOpenHours` (info only).
- Fix: priority by reason; auto-restrict profile visibility on `underage`/`nonconsensual_imagery` pending review (human confirm within N h), admin alert email/Slack.

#### P9-12 — Block bypass via other APIs/sockets: **FAIL (High)**
- `Block` is consulted only in: match action (`matchController.js:28-38`), daily/search/suggestions exclusion (`matchController.js:271`, `searchController.js:60-75,429-439,558-577`), `assertProfileVisible`/`getProfile` (`profileController.js:538-545`), recently-viewed (`:1041-1054`). `blockUser` (`blockReportController.js:13-36`) only inserts a `Block` row — it does **not** delete the mutual `Match`, close the conversation, revoke `ChatGrant`s, end calls or leave shared groups.
- Not consulted by: `chatController` (send/get/edit/react/voice, `grep Block controllers/chatController.js` → none), `callController.initiateCall` (its own comment at `:88-92` says chat is blocked but no Block lookup exists), `socketHandler` `join-room`/`typing`/`get-online-status` (uses only mutual Match), `groupController.addMember/sendMessage`, guardian invites (NOT VERIFIED), notifications (like/match emails), `emitToConversation`.
- Impact: a blocked stalker who already has a mutual match keeps messaging, calling and seeing online status; contradicts Safety copy "Blocked users cannot view your profile or contact you" (`Safety.jsx:44`) and Help "Blocking… immediately stops all contact" (`Help.jsx:94`).
- Repro (safe, dev): A↔B mutual; A blocks B; B `POST /chat/messages {receiverId:A}` → 200 (no Block check); `POST /calls/initiate {calleeId:A}` → 200.
- Fix: central `assertNotBlocked(a,b)` used by chat/call/socket/group/notify; on block, delete/flag the mutual Match, purge grants, emit `conversation-closed`; unit tests mirroring `groupAuth.test.js`.

#### P9-13 — Family-group channel bypasses gates: **FAIL (High)**
- `routes/groupRoutes.js:24` only `auth`; no `requirePremium`, no mutual check, no Block check, no account-status check on the added user. `groupController.addMember` (`:140-183`): any authenticated user (incl. **free**) can create unlimited groups (`createGroup` has no limiter), add **any** user by `userId` (UUIDs are exposed on profiles) or phone, **no accept step** (comment `:159-166` acknowledges this), and messages are readable/writable immediately (`sendMessage` gated by membership only). Re-adding after `leave` is possible; owner can also add banned/blocked users.
- Impact: (1) free members get unrestricted chat with strangers → premium-chat and mutual-match gates are void; (2) harassment/unsolicited-contact channel that Block cannot stop; (3) scam funnel; (4) target's only defence is to leave.
- Repro (safe/dev): free user X: `POST /groups {name:"a"}` → `POST /groups/:id/members {userId:<victim>}` → `POST /groups/:id/messages`; victim's `GET /groups/:id/messages` shows it.
- Fix: invite/accept state machine (`pending`→`accepted`), only allow adding people the owner is mutually matched with or who are guardian-linked; enforce Block both ways; per-user group creation cap + limiter; premium gate consistent with product decision; report path for group messages.

#### P9-14 — Legal-request & evidence-preservation: **FAIL (High, legal)**
- Terms promise (`Terms.jsx:175-178`): ack 24 h, decide 15 d, NCII 24 h, court-order takedown 36 h, **removed information + associated records preserved 180 days**. Implementation:
  - No legal-hold flag or case object; no admin tool for a court/agency request; no takedown log with statutory clock.
  - Self-erasure (`utils/accountErasure.js:70-140`) destroys Profile, Verification (selfie), Matches, Blocks, ProfileViews, GroupMemberships and **tombstones every message body** — with **no check for open Reports or legal hold**. A reported scammer can delete their account and erase the evidence (Reports rows kept, but they contain only ≤1000-char reporter text).
  - Admin hard delete (`utils/hardDeleteUsers.js`): `Reports.reportedUserId/reporterId` are `ON DELETE CASCADE` (`migrations/20240101000017-create-reports.js:14-21`) → deleting a reported user **deletes the reports against them**; no open-report guard.
  - `removePhoto` (`adminSafetyController.js:224-247`) drops the URL from the profile; Cloudinary asset stays (only the audit row keeps the URL) — no preserved copy/hash.
  - Message evidence snapshot on report: none.
- Fix: `LegalHolds`/`Cases` table; block erasure/hard-delete while a report is open or hold set (defer erasure ≥180 d, retain message copies encrypted); snapshot reported messages/profile at report time; admin "preserve" action.

#### P9-15 — No automatic ban from accusation: PASS
- `reportUser` only inserts a row; no threshold logic anywhere (`grep` for report counts: only `getSuspicious` "reported by 2+" advisory signal, `adminSafetyController.js:60-63`).

---

### PHASE 10

#### P10-01 — User lookup & history: PARTIAL (Low)
- `GET /admin/users` filters (status, plan, verified, photo, city, dates…) with escaped literals (`adminController.js:98-160`, injection-safe); `GET /admin/users/:id` shows profile, verifications, last 10 subs, last 10 reports **received** (`:638-671`). Missing: reports **filed by** the user, prior admin actions on the user (AuditLogs not surfaced per user), blocks, message/complaint history, login history/IP, notes. `getUser` uses `attributes: {exclude:['password']}` → also returns `fcmTokens`, `inviteToken`, `googleId` etc. (Low; data minimisation).

#### P10-02 — Profile approval/correction/suspension: PARTIAL (Medium)
- No pre-publication profile approval (profiles are live on creation; only photo/selfie verification). No "request correction" flow (member-facing message asking to fix a field); only photo removal notifies (`removePhoto`). Suspension = status flip (P9-04). `createUser` (admin) makes profiles with dummy DOB 1990-01-01/gender `other` (`:600-612`).

#### P10-03 — Verification-evidence access: PARTIAL (Medium)
- Scope `verifications` gates `GET /admin/verifications` (`adminRoutes.js:133`), which returns selfie URL + profile photos + user email/phone (`adminController.js:260-292`). Selfies are stored as **public Cloudinary `upload`-type URLs** (`middlewares/upload.js:153-156`, no `type:'authenticated'`/signed delivery) → anyone with the URL (leaked via logs, admin browser history, the member's own `getVerificationStatus`, Referer) can fetch a face image forever. No audit row for evidence views. Erased on account deletion only in DB, not Cloudinary (`accountErasure.js:74` destroys the row; NOT VERIFIED whether Cloudinary asset is deleted — no Cloudinary call in the file).
- Fix: Cloudinary `type: authenticated` + short-lived signed URLs issued per admin request + audit; delete assets on erasure/approval retention window.

#### P10-04 — Report queues: PARTIAL — see P9-03/P9-11 (no assignment, priority, evidence; tab/status bug). Support inbox has assignment (`adminSafetyController.js:263-278`).

#### P10-05 — Plans/transactions/refunds/invoices admin: PARTIAL (Medium)
- Present: grant/override (`updateSubscription`), cancel plan, refund (sub-admin ≤₹1000, `adminController.js:1287-1289`), admin invoice, revenue CSV.
- Gaps: **grant has no reason field and body-controlled `endDate`/`status`** (`:675-681`, only `planType` validated in route `adminRoutes.js:102-106`): a sub-admin holding `subscriptions` can grant `vip`/`nri` (unlimited unlocks + boost) to any account for any `endDate` (even year 2099) with a generic audit row `{userId,planType,status}` (`:750`) — insider fraud / friend-grant vector; `status` accepts arbitrary strings → Sequelize enum error 500; no maker-checker for grants or refunds; the ₹1000 sub-admin refund cap is **per call** (repeatable up to the paid amount, and across payments; no daily limit); refund not linked to entitlement (P7-10); no transaction list screen with payment ids/refund states; bundle & booking transactions invisible.
- Fix: require `reason`, cap `endDate` ≤ plan duration ×N unless super_admin, dual approval for grants of unlimited tiers, daily refund cap per actor, audit full before/after.

#### P10-06 — Support tickets & grievance tracking: PARTIAL/FAIL (Medium)
- Public form → `ContactMessages` (`contactController.js:11-56`), statuses `new|read|resolved`, assignment (mig 000064), reply via Resend (`adminController.js:1999-2027`), metrics avg reply hours. Missing: **ticket id / acknowledgement email to the enquirer** (Terms promise 24 h ack; the API returns only a generic message), category (support vs grievance vs legal vs DPDP-rights), priority/SLA timers and breach flags, threaded replies (single `replyBody`), reopen, link to a user/report, grievance-officer designation/workflow (name/entity/address are config-gated, `constants/legal.js`; NOT VERIFIED whether set in prod), separate DPDP request tracker (30-day clock). Public form is unauthenticated (banned users can use it — good for appeals but unstructured).

#### P10-07 — RBAC route coverage: PASS
- `adminRoutes.js:83` `router.use(auth, adminAuth, adminLimiter)`; I enumerated **all 60+ routes**: every one has `requireAdminScope(<scope>)` (users, subscriptions, verifications, pricing, revenue, reports, support, marketing, stories, team). `/funnel`→users, `/audit-log`→team, `/push-smoke-test`→users. `scopesFor` fails closed on malformed column (`constants/adminScopes.js:54-60`); `auth` loads `adminPermissions` every request so demotion is immediate (`middlewares/auth.js:61-63`); unit tests `requireAdminScope.test.js`, `adminScopes.test.js`, `routeManifest.test.js` exist (not executed here).

#### P10-08 — `/admin/team` escalation: PASS (Low notes)
- `updateUserRole` refuses self-edit (`:1108-1112`), rank-above-self grants and modifying higher-rank accounts (`:1126-1129`), sub-admin cannot grant scopes it lacks (`assertMayGrant:1046-1053`), last-full-admin protection (`:1058-1069`), notifies the target, audits. `createAdmin` same checks.
- Notes: (a) `admin` and `super_admin` are functionally identical (both `FULL_ACCESS_ROLES`); an `admin` may mint peer `admin`s (rank equal allowed) — a compromised admin can persist by creating backdoor admins; no maker-checker/notification to other admins on new admin creation. (b) `createAdmin`/`createUser` accept any `password` string with no strength/length validation in route or controller (`adminRoutes.js:121`; `adminController.js:1041-1062,587-625`) and set `emailVerified:true`, no forced change on first login. (c) `updateUserRole` can act on a `marketing` account only to promote it.

#### P10-09 — Staff protection on `PUT /admin/users/:id/status`: **FAIL (Med-High)**
- `adminController.js:225-257` fetches any user by id and sets status; no `role` check, no self-check, no rank check, no notification, no reason. Route requires only `users` scope (`adminRoutes.js:95`) which is in `DEFAULT_SUB_ADMIN_SCOPES` (`adminScopes.js:40`). So a default sub-admin can set an `admin`/`super_admin` to `banned`/`inactive` → `auth` then rejects every request from that admin (`middlewares/auth.js:69-71`) — DoS/takeover of the admin tier; the "last full admin" guard exists only in role change. The bulk endpoint deliberately restricts to `role:'user'` (`adminSafetyController.js:181-186`) — evidence the single path was overlooked.
- Repro (dev): sub-admin token (scopes [users]) `PUT /admin/users/<adminId>/status {status:"banned"}` → 200.
- Fix: refuse targets with `role != 'user'` unless actor outranks; block self; require reason; notify.

#### P10-10 — MFA for privileged users: **FAIL (Med-High)**
- `grep -rniE "totp|mfa|two.?factor|2fa|otplib|speakeasy" backend` → none. Admin/sub-admin/marketing use the same email+password login (`authController`) with 15-min access / 7-day refresh cookies; no IP allow-list, no step-up for refunds/grants/exports/role changes, no admin session timeout policy, no login alerts for admin roles NOT VERIFIED. Login is protected by lockout + limiter only.
- Fix: TOTP (or email/SMS OTP step-up) mandatory for `sub_admin/admin/super_admin`; step-up for `team`, `subscriptions`, `pricing`, export; shorter refresh TTL for staff.

#### P10-11 — Audit coverage: PARTIAL (Medium)
Enumerated admin mutations WITHOUT `logAudit`:
- `createSuccessStory`, `updateSuccessStory`, `deleteSuccessStory` (`adminController.js:1790-1820`)
- `POST /admin/push-smoke-test` (`adminRoutes.js:287-321`) — sends arbitrary title/body push to any member/5 random members
- `PUT /users/:id/status` logs prev/new but **not reason** (none captured); bulk logs ids but not reason.
- `updateSubscription` logs planType/status only — **not endDate, amount, reason, previous plan**.
- Report `adminNotes` changes not recorded (only status transition).
Sensitive READS with no audit: `GET /admin/users/:id` (full profile, DOB, income, verification selfie), `GET /admin/users` (email/phone), `GET /admin/verifications` (selfies), `GET /admin/contact-messages` (enquirer PII), `GET /admin/leads`, `GET /admin/photos`, `GET /admin/suspicious` (phones), invoices (`adminGetInvoice`), `GET /admin/users/export` audited only as row count (no filter, no field list, no destination).
Structural: no IP/UA (see P9-07), best-effort writes, editable table, `getAuditLog` restricted to `team` scope.
- Fix: audit middleware for all `/admin` non-GET plus a `sensitive_read` action on the listed GETs (target id, fields), IP/UA, append-only DB role/trigger.

#### P10-12 — Insecure admin APIs: PARTIAL (Medium)
- `push-smoke-test` under `users` scope: arbitrary notification text to arbitrary member (phishing-capable, unaudited). Limit to super_admin/ dev.
- Weak-password create endpoints (P10-08b).
- `deleteUsers` full-admin only, blocks staff/paid accounts (good) but cascades Reports (P9-14) and skips open-report check.
- `updateSubscription` body trust (P10-05).
- CSRF: cookie auth is `SameSite=strict` in prod + Origin allow-list (`authController.js:33`, `security.js:344-410`) — adequate; NOT re-audited here.

#### P10-13 — Analytics coverage: PARTIAL (Low)
- `getAnalytics`, `getFunnel` (client beacon via `POST /api/v1/events`, allowlisted stages), `getModerationStats`, revenue, marketing report exist. Missing: churn/retention cohorts, refund/dispute rate, payment failure rate & abandoned-checkout funnel in-panel (data exists in `lifecycleMail`), report volume by category/time, ban/appeal metrics, message/scam-flag metrics.

#### P10-14 — PII exposure in dashboards/CSV: PARTIAL (Medium)
- `GET /admin/users/export` (`adminController.js:815-861`): CSV of up to 5,000 members with **name, email, phone, city, gender, status, plan** (no DOB despite the include) under the broad `users` scope which default sub-admins hold; audit logs only the row count; no watermark, no per-actor daily cap, no step-up. `getSuspicious` returns email+phone for up to 100 accounts under `reports`. `getContactMessages` exposes enquirer email/phone/IP. Lead lists expose referred members' emails to reps (by design). CSV formula injection is guarded in the revenue CSV (`csvSafe`) but **not in the member export** (`esc()` at `:830-836` only quotes commas/quotes/newlines, no `=+-@` neutralisation) — a member who sets first name to `=HYPERLINK(...)` gets it executed when an admin opens the CSV in Excel/Sheets (Low-Med).
- Fix: split `users.read` vs `users.export` scopes; formula-guard `esc`; mask phone/email by default; cap + audit filters.

#### P10-15 — Marketing-role portal authz: PASS (Low notes)
- `routes/marketingRoutes.js:18` `auth, marketingAuth` (roles marketing, marketing_manager, admin, super_admin — `sub_admin` excluded); every query scoped by `assignedToMarketingUserId = req.user.id` / `marketingUserId` (`:23-95,109-134,139-163`); payouts read-only for reps (`:64-67`), report builder shared with admin (`marketingReport`). Reps can only change their own lead's `status` (not paymentStatus/amount).
- Notes: `marketing_manager` has no additional scoping (identical to `marketing`); rep may mint unlimited referral codes (no cap/limiter beyond API limiter); admin/super_admin passing `marketingAuth` see *their own* (empty) data — fine. Commission "earned" derives from Subscription rows (P7-10/P7-17 refunds/chargebacks not reversed).

#### P10-16 — Scope granularity / least privilege: PARTIAL (Medium)
- `users` scope bundles: view PII, create accounts, ban/reactivate, **bulk status**, **export CSV**, analytics, funnel, **push notifications**; `subscriptions` bundles grant/cancel/refund/invoice; `team` gives audit-log read. No separate `export`, `refund`, `delete`, `audit.read`, `evidence.read` scopes; `DEFAULT_SUB_ADMIN_SCOPES` = users, verifications, reports, support (moderation desk) already includes export+ban+push.

---------------------------------------------------------------------------
## 3. Workflow maps (actual implementation, with MISSING transitions)

### 3.1 Payment / entitlement workflow (Razorpay plan)
```
Client                    Server                                  Razorpay            DB (Subscriptions)
POST /create-order {planType} ──► auth, paymentLimiter(10/h), validation
                           ├─ PURCHASABLE + isPlanPurchasable (withdrawn ⇒ 400)
                           ├─ tx: active sub? TIER_RANK(target) > current else 409
                           │      cancel all user's PENDING rows
                           │      orders.create(amount=getPlanDetails().amount) ─► order_id
                           └─ insert row {status:pending, amount, razorpayOrderId}
Checkout popup ──────────────────────────────────────────────────►  pay
   ├ dismiss ─► POST /cancel-order (conditional UPDATE pending&no paymentId ⇒ cancelled)   [order stays payable at Razorpay]
   ├ success ─► POST /verify-payment {order,payment,sig}
   │            HMAC(order|payment) ─► [NO payments.fetch / capture / amount check]
   │            tx: existing (paymentId,userId,active)? return
   │                lock row {userId,order,status∈pending|cancelled, paymentId null}
   │                set active, start/end, unlocks; applyPendingCredits
   │                cancel every OTHER pending|active row [NO tier-rank check] ◄── P7-18
   │            marketing lead ⇒ converted/paid ; VIP/NRI ⇒ isBoosted ; confirmation email
   └ (browser lost) ──────────────────────────────── webhook payment.captured ─► same activation (order lookup in Subscriptions only)
        webhook payment.failed ─► stamp paymentFailedAt, row stays pending (help mail later, sweeper closes)
   MISSING: payment.authorized / order.paid, refund.processed|failed, payment.dispute.*, bundle+booking capture fallback (P7-16)
Expiry: hourly job pending→…; reads filter endDate in query (except getProfile P7-20)
Cancel: DELETE /subscription/current ⇒ status=cancelled immediately, no refund
Refund: POST /admin/subscriptions/:id/refund ⇒ Razorpay refund + audit + notify
        MISSING: mark row refunded, revoke entitlement/boost, reverse marketing commission, credit note, ledger, dispute → revoke (P7-10)
Invoice: GET /invoice/:id ⇒ PDF for anything except amount=0 or pending-unpaid (cancelled-unpaid & admin grants pass) ◄── P7-15
```
Bundle rail: create-order (requirePremium) → UnlockPurchase pending → verify (requirePremium + active finite plan) → `contactUnlocksAllowed += n`. No webhook path.
Google Play rail: `/google-verify` → Play API validate → row keyed by token; MISSING: RTDN/voided purchases, tier rank, withdrawn check, renewal.

### 3.2 Reporting workflow
```
RN app: profile ⋮ / chat ⋮ → BlockReportSheet → POST /report/:userId {reason(6 enums), description≤1000}
Web:    (no UI — P9-02)
Server: validate enum → Report{pending}, logAudit(user_reported), returns reportId
MISSING: dedupe per (reporter,target), evidence/message reference, category priority, auto-ack, assignment
Admin (scope reports): GET /admin/reports?status=(pending|reviewed|dismissed honoured; reviewing/resolved ignored ⇒ bug)
        PUT /admin/reports/:id {status∈reviewing|resolved|reviewed|dismissed, adminNotes}
             ⇒ overwrite notes, set reviewedBy/At, audit(prev→new), notify reporter (“action has been taken” for resolved)
MISSING: link to moderation action on the reported user, reopen rules, SLA timers, escalation, reporter dispute, retaliation handling
```

### 3.3 Moderation / enforcement workflow
```
Signals: /admin/suspicious (dup photo/phone, mass likes ≥25/24h, message blast ≥15/48h, ≥2 reporters) — advisory only
Actions available:  status active|inactive|banned|pending (single: no role guard ◄ P10-09; bulk: users only)
                    photo removal (+ notification), verification approve/reject/flag/pending (+ notification/email)
                    hard delete (blocks staff, paid; cascades Reports) / member self-erasure (destroys evidence)
Effect of ban: auth() rejects every request + socket revalidation ≤60 s; no member notice/reason/appeal
MISSING: warn, restrict (soft), time-boxed suspension, escalate, content removal beyond photos, restore/appeal, reason capture,
         legal hold, evidence snapshot, second-reviewer for bans
Auto-ban on reports: NONE (good).
```

### 3.4 Blocking workflow
```
POST /block/:id  ⇒ insert Block{blocker,blocked}  (only)
Honoured by: match action, daily/search/suggestions, getProfile/assertProfileVisible (+compat/kundli), recently-viewed
NOT honoured by: chat REST (send/read/react/voice), calls initiate/accept, socket rooms/typing/presence, family groups,
                 notifications, guardian invites; existing mutual Match/ChatGrant untouched
MISSING: match/conversation teardown, both-direction chat block, block on web UI, blocked-list UI on web, unblock cool-down
```

### 3.5 Admin privilege model
```
auth ─► adminAuth (role ∈ sub_admin|admin|super_admin) ─► adminLimiter 100/min ─► requireAdminScope(scope) per route  ✔ all routes
admin/super_admin ⇒ all scopes (identical); sub_admin ⇒ stored list (fails closed)
/admin/team: no self-edit, no rank/scope escalation, last-admin guard, notify target ✔ ; no MFA, no maker-checker, weak-password create ✘
Bypass found: PUT /users/:id/status ignores target role ✘
Audit: AuditLogs (best-effort, no IP/UA, writes only; sensitive reads unlogged) ✘
```

---------------------------------------------------------------------------
## 4. Suggested fix priority
1. P9-02 (web report/block UI or remove claims) + P9-12/P9-13 (block enforcement everywhere; group invite/accept + gates).
2. P7-15 (invoice guard) + P7-11 GST/tax invoice + numbering; P7-10 refund/dispute webhooks + ledger; P7-16 bundle/booking webhook fallback.
3. P10-09 staff-target guard, P10-10 MFA, P10-05 grant guard (reason, cap, dual approval).
4. P9-06/P9-14 appeals + legal-hold/evidence preservation before erasure/hard delete; P9-03 report model + status/tab bug.
5. P7-06 payment fetch/capture assertion, P7-18 tier-aware revival, P7-20 `getProfile` endDate, P7-17 revenue ledger.
6. P9-10 chat link/financial heuristics, P10-11 audit coverage, P10-14 CSV formula guard + export scope.

## 5. NOT VERIFIED (runtime / external)
- Prod Razorpay capture mode (auto vs manual) and webhook event subscriptions (only `payment.captured`/`payment.failed` are consumed by code regardless).
- Whether `legal.gstin`, grievance officer name/address are set in production config.
- Whether Cloudinary assets are deleted on erasure/photo removal; Cloudinary delivery type of verification selfies in prod.
- Google Play products/RTDN configuration; iOS payment redirect rail (mobile, not audited here).
- Guardian invite endpoints for Block handling (`routes/guardianRoutes.js`) — not traced.
- Unit tests were not executed (read-only audit); test names cited only as evidence that coverage exists.

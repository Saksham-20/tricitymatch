# Pricing Revamp Implementation Plan — 2026-07-08

Goal: new 4-tier ladder + MRP/discount anchoring + NRI card + à-la-carte unlock bundles.
Driven by Shaadi.com competitor benchmark (live screenshots) + India matrimonial pricing research.

---

## Target state

### Subscription tiers (enum key → new product)

| Enum key (UNCHANGED) | New label | Tenure | Price | ~~MRP~~ | Unlocks | Boost | Badge |
|----------------------|-----------|--------|-------|---------|---------|-------|-------|
| `free` | Free | — | ₹0 | — | 0 | no | — |
| `basic_premium` | **Basic** | 30d | ₹1,299 | ₹1,999 | 5 | no | — |
| `premium_plus` | **Premium** | 90d | ₹2,499 | ₹3,999 | 15 | no | ⭐ Most Popular |
| `elite` *(NEW)* | **Elite** | 180d | ₹3,999 | ₹6,999 | 30 | no | 💎 Best Value |
| `vip` | **VIP** | 360d | ₹5,999 | ₹11,999 | unlimited | yes | — |
| `nri` *(NEW)* | **NRI Connect** | 180d | ₹9,999 | — | unlimited | yes | 🌍 NRI |

**Why keep enum keys?** `basic_premium/premium_plus/vip` are hardcoded in 13 source files.
Renaming = enum migration + 13 edits + Postgres ENUM pain. Remapping price/label/duration
only touches the 2 config sources of truth. Zero-risk. Only add 2 NEW enum values.

### Unlock bundles (one-off top-up, not a plan)

| Bundle id | Unlocks | Price | /unlock |
|-----------|---------|-------|---------|
| `bundle_3` | 3 | ₹599 | ₹200 |
| `bundle_10` | 10 | ₹1,499 | ₹150 |
| `bundle_25` | 25 | ₹2,999 | ₹120 |

Priced ABOVE every plan's per-unlock rate (Basic ₹260, Premium ₹167, Elite ₹133) so upgrading
stays better value. **Visible + purchasable immediately after any paid subscription** (not gated at
the 0-unlock wall — decision 3). Not for VIP/NRI (unlimited). Also surfaced at the unlock wall when a
finite plan hits 0.

---

## Phase 0 — De-risk: centralize the paid-plan list (do FIRST)

The string `['basic_premium', 'premium_plus', 'vip']` is copy-pasted in 13 files. Adding
`elite`+`nri` means editing all 13. Instead, define ONCE and import.

**New file** `backend/constants/plans.js`:
```js
const PAID_PLANS = ['basic_premium', 'premium_plus', 'elite', 'vip', 'nri'];
const UNLIMITED_PLANS = ['vip', 'nri'];          // null unlocks + boost + verified
const ALL_PLANS = ['free', ...PAID_PLANS];
const TIER_RANK = { free: 0, basic_premium: 1, premium_plus: 2, elite: 3, vip: 4, nri: 4 };
module.exports = { PAID_PLANS, UNLIMITED_PLANS, ALL_PLANS, TIER_RANK };
```

Replace the hardcoded arrays in these files with `PAID_PLANS` (or `ALL_PLANS`):
- `middlewares/auth.js:164` (requirePremium `Op.in`), `:325` (requireVIP → use `UNLIMITED_PLANS`)
- `controllers/subscriptionController.js:30` (createOrder validPlans), `:37` (TIER_RANK), `:227` (VIP boost → `UNLIMITED_PLANS.includes`)
- `controllers/matchController.js:206,268`
- `controllers/searchController.js:273,439`
- `controllers/profileController.js:465,566`
- `controllers/adminController.js:245,490,515` (amount ternary → read from PLANS map)
- `routes/adminRoutes.js:58` (isIn → `ALL_PLANS`)
- `validators/index.js:495` (isIn → `PAID_PLANS`)
- `socket/socketHandler.js:125`

Verify: `grep -rn "'basic_premium', 'premium_plus', 'vip'" backend --include=*.js | grep -v coverage` returns 0.

---

## Phase 1 — Backend: tiers + prices

1. **Migration `000044-add-plan-tiers-and-unlocks.js`**
   - `ALTER TYPE` Subscription.planType ENUM: add `'elite'`, `'nri'`. (Postgres: `ALTER TYPE "enum_Subscriptions_planType" ADD VALUE 'elite'` — irreversible; down-migration is a no-op, matches prior enum-add precedent 000043.)
   - Create `UnlockPurchases` table: `id, userId, razorpayOrderId, razorpayPaymentId, bundleId, unlocks INT, amount DECIMAL, status ENUM(pending/active/cancelled), createdAt, updatedAt`. Indexes on `userId`, unique on `razorpayOrderId`.

2. **`utils/razorpay.js` PLANS** — remap the 3 existing + add `elite`, `nri`. Add fields: `mrp`, `perMonth`, `badge` (presentation), keep `amount` (paise), `duration` (days), `contactUnlocks`. Add `UNLOCK_BUNDLES = { bundle_3:{unlocks:3,amount:59900}, ... }` + `createBundleOrder()` wrapper over `createGenericOrder`.

3. **`models/Subscription.js:19`** — add `'elite','nri'` to ENUM (matches migration).

4. **`models/UnlockPurchase.js`** — new model (mirror migration).

5. **`controllers/subscriptionController.js`**
   - `getPlans` (:305) — rebuild all tiers with new price/label/duration/unlocks + `mrp`/`perMonth`/`badge`/`popular`. Add `nri`.
   - `verifyPayment` (:227) + `webhook` (:419) — boost activation: `UNLIMITED_PLANS.includes(planType)` (so `nri` also boosts), not `=== 'vip'`.
   - NEW `createBundleOrder` + `verifyBundlePayment` handlers: verify sig → find active subscription → `contactUnlocksAllowed += bundle.unlocks` (skip if null/unlimited) → mark UnlockPurchase active (idempotent on paymentId). Bundle unlocks ride the subscription row, so existing `checkContactUnlockLimit` enforcement needs NO change.

6. **`routes/subscriptionRoutes.js`** — add `POST /unlock-bundle/create-order`, `POST /unlock-bundle/verify-payment` (auth + requirePremium; free users can't buy top-ups, must subscribe first). Purchasable anytime an active finite paid plan exists (not only at 0 unlocks) — reject if plan is unlimited (VIP/NRI) or none.

7. **`validators/index.js:495`** — planType isIn → `PAID_PLANS`; add bundleId validator `isIn(Object.keys(UNLOCK_BUNDLES))`.

8. **`controllers/adminController.js:515`** — replace the `basic_premium?1500:...` amount ternary with `PLANS[planType].amount/100`; add elite/nri to admin create-user plan options.

---

## Phase 2 — Shared types

- `shared/src/types/subscription.ts` — `SubscriptionPlanType` add `'elite' | 'nri'`; add `mrp?`, `perMonth?`, `badge?` to `PlanFeatures`.
- `shared/src/constants/plans.ts` — add `elite`, `nri` entries + new prices/labels; extend `PLAN_ORDER` to `['free','basic_premium','premium_plus','elite','vip','nri']`. (`nri` sits outside the linear upgrade path — treat as parallel premium; `isPlanAtLeast` still works since nri has all caps.)

---

## Phase 3 — Web frontend

- `pages/Subscription.jsx`
  - `PLAN_CONFIG` (:46) — remap 3 + add `elite`, `nri`; per-card `icon`/`accent`/`cta`/`duration`.
  - Card: render ~~MRP~~ strike-through + `Flat X% off` chip + `₹X/month` line (data already in getPlans). Badge from `plan.badge`.
  - `isPopular` (:410) — drive from `plan.popular` (premium_plus) + add Best-Value (elite).
  - NRI card: separate styled block (gold ring, "~$149 / £119" static label, region-agnostic — everyone sees it).
  - Unlock-bundle purchase: a **persistent block in the subscription/manage area shown to every active finite-plan member** (Basic/Premium/Elite) right after they subscribe — decision 3, not wall-gated. ALSO surfaced at the contact-unlock wall when `contactUnlocksRemaining === 0`. Buy → `/unlock-bundle/create-order` → Razorpay → verify. Hidden for VIP/NRI (unlimited).
- `PLAN_ORDER`/`planDisplayName` helpers — pick up new keys.

---

## Phase 4 — Mobile (member app)

- `mobile/src/api/subscription.ts` — already reads shared `PLANS` + overlays live price → new tiers flow automatically. Add `createBundleOrder`/`verifyBundle` fns.
- `features/subscription/SubscriptionScreen` — render mrp/perMonth/badge + elite/nri cards (mirrors web).
- Bundle wall on ProfileDetail unlock (native).
- `node_modules/.bin/tsc --noEmit -p tsconfig.json` must stay 0.

---

## Phase 5 — NRI currency (DYNAMIC per-user display — decision 4)

Each user sees prices in THEIR OWN currency (display-only; Razorpay still charges INR).
- **Detect currency (no new user flag, client-side, ordered fallback):**
  1. `Intl.NumberFormat().resolvedOptions()` / `Intl.DateTimeFormat().resolvedOptions().timeZone` + browser `navigator.language` region → country → currency.
  2. Fallback: lightweight geo-IP (e.g. a country header from nginx `geoip` or a one-time `/api/v1/geo` lookup) if locale is ambiguous.
  3. Final fallback: INR (show ₹ as-is).
- **FX map** — a small constant table `{ USD:0.012, GBP:0.0095, CAD:0.0165, AUD:0.018, EUR:0.011, AED:0.044, SGD:0.016, ... }` (INR→X), refreshed manually/periodically (NOT live per-request in v1). Helper `formatLocalPrice(inrPaise, currency)` → `Intl.NumberFormat(locale,{style:'currency',currency})`.
- **Where:** NRI card headline shows the member's local currency prominently; other tier cards MAY show a subtle "≈ $X" secondary line under the ₹ price (primary stays ₹ since charge is INR). Keep ₹ authoritative + a "billed in INR" note to avoid confusion.
- **Scope guard:** display conversion only. Real multi-currency SETTLEMENT (Razorpay International + live FX + separate payout) = future work, out of scope. FX table is approximate + labelled "indicative".
- Shared helper in `shared/` so web + RN reuse the same detection + FX map.

---

## Phase 6 — Tests + verify

- Unit: extend razorpay/plan tests for `elite`/`nri` price+duration; new `bundleUnlock.test.js` (verify sig → increments allowance, idempotent, rejects free user).
- `checkContactUnlockLimit` unchanged → existing tests hold.
- Backend suite must stay green (currently 155/155).
- FE build + Vitest green.
- Can't live-drive payment (Razorpay unconfigured in dev) — verify via unit + build + type. Note in commit.

---

## Blast radius summary

| Area | Files | Risk |
|------|-------|------|
| Phase 0 centralize | ~13 edits, 1 new | low (mechanical, grep-verifiable) |
| Migration + models | 3 | med (irreversible enum add — precedent exists) |
| razorpay + subscription ctrl | 2 | med (payment path — sig verify unchanged) |
| Bundles | 3 new + 2 edits | med (new purchase flow) |
| Shared + FE + mobile | ~6 | low-med (presentation) |

**Order:** Phase 0 → 1 → 2 → 3 → 4 → 5 → 6. Phase 0 alone is safe to land first (pure refactor,
no behavior change) — de-risks everything after.

## Decisions — RESOLVED 2026-07-11 (user)
1. ✅ **VIP → 360d (12 months) / ₹5,999.** Existing VIP holders unaffected (row keeps old endDate).
2. ✅ **`nri` = VIP-equivalent** for boost/verified/premium gates.
3. ✅ **Bundles visible + purchasable IMMEDIATELY after any paid subscription** — NOT gated behind the 0-unlock wall. Any active paid plan (basic_premium/premium_plus/elite; VIP/NRI unlimited → no bundles) can buy top-ups anytime from the subscription area. Unlocks still ride the subscription row (increment `contactUnlocksAllowed`, expire with the plan — no separate wallet). **[SPEC CHANGE vs original "sold only at 0-unlock wall".]**
4. ✅ **NRI = DYNAMIC per-user currency display.** Detect each user's currency (locale/`Intl`/timezone → country → currency; geo-IP fallback) and show NRI (and optionally all) prices converted to their local currency via an FX map. Razorpay still CHARGES INR (international settlement out of scope); display-only conversion, but **per-user dynamic, not a fixed static label**. **[SPEC CHANGE vs original "static labels".]** See revised Phase 5.

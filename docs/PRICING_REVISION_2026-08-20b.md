# Pricing revision — three-tier ladder, ₹1,299 top

**Date:** 2026-08-20 (same day as, and superseding the ladder in,
`PRICING_LAUNCH_2026-08-20.md`)
**Status:** built + verified locally. NOT deployed.

Read `PRICING_LAUNCH_2026-08-20.md` first — the offer machinery, the fail-closed
contract and the bundle invariant are all described there and are unchanged.
This document only covers what moved and why.

---

## What the measurement said

Pulled from production on the day:

| | |
|---|---|
| Users | 14 |
| Profiles | 14 |
| Matches | 13 |
| Messages ever sent | **0** |
| Contact unlocks ever | **0** |
| Active subscriptions | 1 (the free founding grant) |

The `pending` and `cancelled` subscription rows from July are our own test
orders — three of them are ₹1.00. There is **no** real conversion signal in this
data. Nobody has used the paid surface, so the price was not what stopped them.

That matters for reading the rest of this document: the ladder below is chosen
from market evidence and published behavioural research, not from our own
funnel, and it should be revisited the moment there is a funnel to read.

## Market anchors

| Player | Pack | Price |
|---|---|---|
| Matrimony.com (BharatMatrimony) | average transaction value, Q2 FY26 | **₹4,914** |
| Matrimony.com | ARPU, FY25 (₹456 cr ÷ ~10 lakh paid subs) | ~₹4,560 |
| Jeevansathi | Pro, 3 months | ~₹1,804 |
| Shaadi | Gold, 3 months | ~₹4,650 |

Two things follow. Matrimony.com's paid subscriptions fell **7.5% YoY** in FY25
— the ₹4–5k pack is under pressure, not a target to grow into. And the coupon
ecosystem around all three ("from ₹450", "up to 70% off") means Indian
matrimony buyers are conditioned to expect a discount: a list price is an
anchor, and a 60–70% offer reads as normal rather than as desperation.

## What actually changed

### 1. Five paid cards → three (the biggest lever)

Three-tier pricing pages convert materially better than four-or-more, and
Price Intelligently's 512-company set found ~30% higher ARPU at three packages
than at five. We were shipping Basic / Premium / Elite / VIP / NRI plus Free —
six cards, each with a *different* tenure (30 / 60 / 120 / 180 / 90) and a
different unlock count. That is a three-variable comparison, and buyers abandon
those rather than solve them.

`elite` is now **withdrawn** for the launch window. It sat between the 90- and
180-day tiers and differentiated on nothing a buyer can feel. Nobody in
production holds it (verified before withdrawing).

Withdrawal is enforced, not cosmetic:

* `overlayPlan` returns the tier carrying `hidden: true`
* `getPlans` omits it — no card, and no compare-table column
* `createOrder` (both the controller gate and `razorpay.createOrder`) refuses it
* the mobile client iterates the server's list instead of `PLAN_ORDER`, so a
  stale build cannot re-materialise the card

It deliberately still **resolves** for anyone already holding it. Returning
`null` would have broken my-subscription, invoices, the webhook and admin
grants for existing members — see the comment on `overlayPlan`.

### 2. NRI Connect is a segment, not a rung

It is now marked `segment: 'nri'` and shown only to members who declared NRI
status (or who already hold it). Shown to everyone it was simply a fifth card
each buyer had to read and rule out.

### 3. The ladder

Top price held to the ₹1,000–1,500 band.

| | Price | Term | Unlocks | ₹/month | Anchor |
|---|---|---|---|---|---|
| Free | ₹0 | — | 0 | — | — |
| Basic | **₹399** | 1 month | 10 | ₹399 | ~~₹1,299~~ (69% off) |
| Premium · *Recommended* | **₹999** | 3 months | 30 | ₹333 | ~~₹2,499~~ (60% off) |
| VIP · *Best Value* | **₹1,299** | 6 months | Unlimited | ₹217 | ~~₹2,999~~ (57% off) |
| NRI Connect *(NRI only)* | ₹1,499 | 3 months | Unlimited | — | ~~₹4,999~~ (70% off) |

Why these numbers:

* **₹999 for 3 months is the load-bearing one.** Three months is the standard
  search cycle across the whole category, so it is the tenure buyers already
  understand. At ₹333/month it sits ~45% under Jeevansathi's ₹601/month and
  ~78% under Shaadi's — a credible discount inside the band the market already
  advertises, rather than a number so low it invites doubt.
* **₹/month falls monotonically** (399 → 333 → 217), so a longer commitment is
  always visibly cheaper.
* **VIP is only ₹300 above Premium** for double the term and uncapped unlocks.
  That is deliberate: the middle tier's job is to make the top tier the obvious
  buy, and a longer commitment genuinely should cost less per month.
* **Every discount lands in the 57–70% band** the category already runs.
* Basic keeps a 30-day tenure because the founding grant is 30 days, and a paid
  tier shorter than the free grant would be worse than free.

On the risk of pricing *too low*: Van Westendorp's "too cheap" point is real
and bites hardest on trust purchases, which matrimony is — families buy it, and
credibility is the product. That is the argument against going below this, and
the reason the entry moved up from ₹299 rather than down.

### 4. Badges are now claims we can defend

"Most Popular" was fabricated social proof — there is no purchase history behind
it. Premium is labelled **Recommended** (an editorial claim) and VIP **Best
Value** (checkably the lowest ₹/month on the ladder).

### 5. Unlock counts widened

5 → 10 on Basic, 15 → 30 on Premium. With a few hundred profiles a "6 contact
unlocks" cap reads as stingy rather than premium, and it costs nothing to widen
while supply is the binding constraint. The rolling-24h ceiling in
`middlewares/auth.js` is what actually stops harvesting, not the per-plan
number.

The **bundle invariant still holds**: the cheapest plan rate is now ₹33.3/unlock
(Premium ₹999 ÷ 30), and the bundles sit at ₹66.3 (₹199 ÷ 3) and ₹54.9
(₹549 ÷ 10) — both above the floor, so stacking top-ups never beats upgrading.

---

## Deals

### Founding offer, surfaced and claimable

The grant was minted at **signup only**, which meant every account created
before the window opened never received it — while the offer is advertised as
"the first 500 members". `POST /subscription/claim-founding` lets one of those
members take the place they were promised, gated on: window open → never
claimed (`Users.isFoundingMember`, which outlives the row, so an expired grant
cannot be re-claimed in a loop) → no active plan → cap not reached.

The pricing page now carries a band with exactly **two honest states** and never
a third: a member who holds the grant is told what they hold and when it lapses;
a member who can still claim is offered it; anyone else sees nothing.
`features.canClaimFounding` is decided server-side because the three conditions
live in three different places, and a client that assembled them itself would
render a Claim button the server 409s.

### Invite reward — contact unlocks, both sides

The invite mechanism already shipped (`Users.inviteToken`, `Users.invitedBy`,
`GET /invite/my-link`). It gave nobody a reason to use it. Both sides now
receive **3 contact unlocks** (`INVITE_REWARD_UNLOCKS`, 0 disables it) when an
invited signup completes, and the inviter is notified — an unlock that appears
silently is an unlock nobody knows to spend.

This is the only item in this document that attacks the constraint that
actually binds. Price changes the conversion rate on a number that is currently
near zero either way; **liquidity is the problem**, and 14 profiles is the
problem behind the problem.

**Where the entitlement lives** — the one thing not to break: every gate reads
`Subscription.contactUnlocksAllowed`. A credit lands there directly when the
member has an active finite plan, and otherwise parks on
`Users.pendingUnlockCredits` (migration **000055**) until one exists, at which
point it is *moved*. There is never a second balance a gate has to also consult.
The move is idempotent by construction: the balance is zeroed in the same
transaction that increments the subscription, under a row lock.

Pending credits are applied at every activation point — `verifyPayment`, the
Razorpay webhook (the fallback leg of the same activation), Google Play, and the
founding grant — because otherwise *which leg ran* would decide whether a member
got their reward.

---

## Verified locally

* Ladder resolves 399/1mo/10 · 999/3mo/30 · 1299/6mo/∞ · NRI 1499/3mo/∞;
  `elite` `buy=false` but still resolving at its regular price
* Bundles ₹199 and ₹549 served; `bundle_25` withdrawn
* Pricing page renders four cards, compare table has no Elite column, chips show
  69% / 60% / 57% off, NRI hidden for a non-NRI member
* Claim flow round-tripped: band → click → `founding_premium`, 3 unlocks, valid
  to 19 Sept
* Invite reward round-tripped end to end: a signup through an invite link took
  the inviter 3 → 6 unlocks, and the invitee's reward parked as pending then
  moved onto the founding grant created moments later (3 + 3 = 6). Test accounts
  removed afterwards.

Gates: backend **371** unit · frontend **118** · mobile **57** + tsc 0 ·
eslint 0 errors · frontend build ✓. (`npm run lint` still exits 1 on the four
pre-existing slop-lint hexes in `BiodataCard.jsx` / `toastConfig.tsx`, files
untouched here.)

## Deploying this

Prices live in the `AppSettings` row, not in code — a deploy alone will **not**
change production pricing, because the row already exists with the old ladder.
Either edit it at **Admin → Pricing & Offers**, or `PUT /admin/launch-offer`
with the new blob. Migration **000055** must run first (it does automatically on
boot via umzug).

Production has live `rzp_live` keys. These prices take real money.

## Watch after launch

* Whether anyone buys at all. At 14 profiles, expect not — and do not read that
  as a pricing failure.
* Mix between the three tiers. If ₹1,299 does not out-sell ₹999, the decoy is
  not working and the gap should widen.
* Invite acceptance rate — the only number here that moves supply.
* Refund/complaint rate on the 6-month tier: a long term against thin supply is
  the most likely source of unhappy buyers.

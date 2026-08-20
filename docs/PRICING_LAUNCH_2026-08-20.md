# Launch pricing — research, decisions, and what to do next
**Date:** 2026-08-20 · **Owner decision required at the end of the window**

---

## 1. The situation, measured (not assumed)

Production, queried directly on 2026-08-20:

| Metric | Value |
|---|---|
| Users | 12 |
| Profiles | 12 |
| **Active subscriptions** | **0** |
| Match rows | 8 |
| Founding-member window | **closed** (`FOUNDING_PERIOD_ENDS` was never set) |

The ladder being served was Basic ₹1,299/30d · Premium ₹2,499/90d · Elite ₹3,999/180d ·
VIP ₹5,999/360d · NRI ₹9,999/180d.

## 2. Why the old prices could not sell

**Matrimony is a liquidity market, not a content product.** What a member buys is access to a
pool of relevant people. With twelve profiles in the pool, the honest value of a contact unlock
is close to zero — no price makes that worth ₹5,999, and a discount on a pool that thin does not
fix the pool.

Indian national platforms (Shaadi, Jeevansathi, BharatMatrimony) sit in the region of
**₹2,500–6,000 per three months**, with premium/assisted tiers well above that. *Caveat on that
figure: their live plan pages are behind login, and the search engines blocked the headless
browser during this research, so treat those bands as market knowledge rather than numbers
scraped today.* What is not in doubt is the ratio: TricityMatch was priced within reach of a
national player while holding a rounding error of their supply.

Two structural conclusions:

1. **Price is not the bottleneck — supply is.** The correct first move is to fill the pool, and
   the cheapest way to fill it is to make the paid experience free for the first cohort.
2. **When you do charge, charge an impulse price on a short term.** A long term at a launch
   price sells your best year at a number you cannot raise for those members for a year.

## 3. What shipped

### 3.1 Launch ladder (live, admin-editable)

Every tenure is **shorter** than the regular plan's and every price is far lower. The
strike-through anchor is the regular price *prorated to the launch tenure*, so the comparison is
like-for-like rather than flattering.

| Plan | Launch | Term | Unlocks | Anchor | Per month | Regular (reverts to) |
|---|---|---|---|---|---|---|
| Basic | ₹299 | 30 days | 6 | ₹1,299 | ₹299 | ₹1,299 / 30d |
| Premium | ₹549 | 60 days | 15 | ₹1,699 | ₹275 | ₹2,499 / 90d |
| Elite | ₹949 | 120 days | 30 | ₹2,699 | ₹237 | ₹3,999 / 180d |
| **VIP** | **₹1,299** | **180 days** | Unlimited | ₹2,999 | ₹217 | ₹5,999 / 360d |
| NRI Connect | ₹2,299 | 90 days | Unlimited | ₹4,999 | — | ₹9,999 / 180d |

Notes on the shape:

- **Per-month rate falls as commitment rises** (299 → 275 → 237 → 217). Without that the ladder
  punishes the longer plan and everyone buys the cheapest rung.
- **Basic keeps a 30-day term** while every other tier shortens. The founding grant is 30 days;
  a paid tier shorter than the free grant would be worse than free.
- **Top tier lands at ₹1,299**, inside the ₹1,000–1,500 band asked for, on a 180-day term rather
  than a year — so the offer can be re-priced in six months instead of twelve.

### 3.2 Unlock top-ups, re-based

Top-ups must stay priced **above** the cheapest plan's per-unlock rate, or stacking bundles beats
subscribing. At launch rates that floor is ₹49.8/unlock (Basic ₹299 ÷ 6).

| Bundle | Launch | Per unlock | Was |
|---|---|---|---|
| 3 unlocks | ₹199 | ₹66 | ₹599 |
| 10 unlocks | ₹549 | ₹55 | ₹1,499 |
| 25 unlocks | **withdrawn** | — | ₹3,499 |

The 25-pack is withdrawn for the window: any price that clears the per-unlock floor lands at or
above the ₹1,299 VIP plan, which would make stacking beat upgrading. A withdrawn bundle is
**refused at checkout**, not merely hidden in the UI.

### 3.3 Founding-member grant (open)

Free premium-grade access, granted automatically at signup: **30 days, 3 contact unlocks, first
500 accounts.** Founding members sit at rank 0, so they can still upgrade to any paid tier while
the grant is active. Contact unlocks are written as an explicit finite number — `NULL` means
*unlimited* downstream, which on a free grant would be a scriptable phone-number harvest.

### 3.4 Everything is editable in the admin panel

**Admin → Pricing & Offers.** Prices, tenures, unlock caps, MRP anchors, the offer deadline, the
banner copy, which bundles are on sale, and the whole founding window are edited there and apply
to checkout immediately — no deploy. Every save is written to the admin audit log.

The layer **fails closed to regular pricing**: an unreachable settings row, a malformed value, a
disabled switch or a passed deadline all mean the member is charged the normal price. The failure
mode is never "free" and never "unlimited unlocks".

### 3.5 One safeguard shipped alongside

Unlimited tiers now carry a **rolling-24h ceiling of 25 contact unlocks**
(`UNLIMITED_DAILY_UNLOCK_CAP`). "Unlimited" is a product promise, not a licence to export the
directory — at a ₹1,299 VIP, one subscription was otherwise enough to script every phone number
in the database out of it. A real member never approaches the ceiling.

## 4. What to watch, and when to end the offer

The offer defaults to a **90-day window**. Do not extend it by reflex — extend it only if the
pool is still too thin to be worth paying for.

Watch, in order of importance:

1. **Mutual matches per active member per week.** This is the liquidity number. Below ~1, no
   price sells; the answer is acquisition, not discounting.
2. **Founding-grant conversions.** Of the members whose 30-day grant expires, how many buy? That
   is the cleanest read on whether the product is worth money yet.
3. **Which rung sells.** If everything lands on Basic, the ladder is too flat. If everything
   lands on VIP, the launch prices are too close together.
4. **Unlock exhaustion.** Members hitting their cap early are the signal that top-ups (and the
   next tier) are priced right.

**Ending the window:** untick *Launch pricing enabled* (or let the deadline pass) and every tier
reverts to the regular ladder on the next checkout. Existing subscriptions are untouched — they
run out their purchased term at the price paid.

## 5. Owner items

- Decide the real launch deadline (currently seeded 90 days out) in Admin → Pricing & Offers.
- **Live Razorpay keys** — none of this can take money until they are set; the pricing page shows
  a "payments opening soon" notice while they are absent.
- Google Play product prices are set **in Play Console**, not here — the Android in-app-purchase
  rail will not follow these numbers until they are changed there too. Play product IDs are
  permanent; the price is not.

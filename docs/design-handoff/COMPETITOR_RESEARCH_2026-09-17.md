# Competitor & Craft Research — 2026-09-17

> Outside-in research input for the web UI/UX rework. Live walkthroughs via Playwright at 1440×900
> (plus 390×844 for our own site), **public / pre-auth surfaces only** — no accounts created, nothing paid for,
> no logins to third-party accounts.
>
> **Read alongside, not instead of:**
> - `docs/07_Competitive_Benchmark.md` (2026-06-14) — feature matrix
> - `docs/10_Competitor_Visual_Benchmark_2026-07.md` (2026-07-02) — logged-in visual walkthrough of Shaadi/Jeevansathi
> - `docs/UI_UX_REVIEW_2026-08-17.md` — our own last UI/UX pass
> - `docs/design-handoff/DOCTRINE_2026-09.md` — the binding design law. **Where a pattern below violates the
>   doctrine I say so explicitly.** Nothing here overrides Section 2 conflict rulings.
>
> Every finding is tagged **[NEW]** (not in the three docs above), **[KNOWN]** (already recorded — cited),
> or **[CHANGED]** (previously recorded, but the competitor has since changed it).
>
> Screenshots: `competitor-research-2026-09/` at the repo root (untracked, as with the previous competitor
> shot sets — the 2026-08-18 repo clean removed `docs/competitor-research/`).

---

## 0. Headline: the landscape moved since July

Three things changed in ten weeks and all three matter to the rework.

1. **[CHANGED] Shaadi.com shipped a completely new acquisition site.** The July doc describes a long
   multi-field signup modal and a red-and-white product. What is live today is a full-bleed cinematic
   photograph hero, a **teal** primary action colour, a minimal 4-item nav, a mad-libs search strip, and a
   mobile-OTP-only register modal. The old design system survives only on deep legacy pages
   (`06-pricing.png`) — their redesign covered the funnel, not the whole site.
2. **[CHANGED] Jeevansathi has withdrawn free chat.** In July their landing hero was literally
   "Now, chat for free!" and the free tier could message. Today their own Free-vs-Paid comparison card lists
   **"Message & chat with unlimited users" as a ✗ on Free** (`04-home-mid.png`). The July doc's §2.3 strategic
   question — "is our full chat paywall costing us?" — has been answered by the market moving *towards* us.
   Our `FREE_REPLY_WINDOW` (read forever, 5 sends / 48h after a mutual match, live in prod since 2026-08-25)
   is now **more generous than Jeevansathi's free tier**, and nothing on our site says so.
3. **[NEW] Betterhalf.ai has abandoned the web.** `betterhalf.ai`, `www.betterhalf.ai` and every sub-path
   301/410 to a Google Play search result. Their Play listing was last updated **18 Sept 2025** — a year
   stale. The "modern Indian challenger" whose onboarding we wanted to study is app-only and visibly
   deprioritised. There is no web onboarding to benchmark. (This is a redirect, not a sandbox block — the
   responses carried real Play Store HTML.)

**Consequence for the plan:** the only live, current, well-made *matrimonial* web design in this market is
Shaadi's new acquisition funnel. Everything else worth stealing has to come from outside the category.

---

## 1. Per-site notes

### 1.1 Shaadi.com — the one that got redesigned

**Visual language** (`02-home-hero.png`)
- **Hero is one full-bleed photograph**, edge to edge, ~830px tall, no gradient overlay, no illustration, no
  card collage. Real couple, Indian wedding attire, golden-hour, shallow depth of field, genuine laughter —
  documentary rather than stock-posed.
- **Type: geometric grotesque only. No serif anywhere.** H1 "Choose Your Forever" is ~72px/1.0, white,
  centred, very tight tracking. Body/sub is the same family at 22px. The brand's only serif-adjacent element
  is the red `shaadi` logotype.
- **Accent colour is now teal** (`#2FA0AD`-ish) for all primary CTAs and links. The red survives *only* in the
  logo and the carousel progress rail. This is a deliberate de-saturation: red is heritage, teal is action.
  [NEW]
- Card system: 1px `#E6E6E6` border, ~16px radius, **no shadow**, generous padding; icon tiles are a rounded
  square in `#E0F7FA` holding a single-weight cyan line icon (`03-home-experience.png`). Extremely restrained
  — closer to a fintech site than a matrimonial one.

**Key screens**
- **Hero conversion device:** a translucent dark "glass" strip pinned to the bottom of the photo containing a
  **mad-libs sentence form** — "I'm looking for a `[Woman]` aged `[22]` to `[27]` of religion `[Select]` and
  mother tongue `[Select]`" + a teal `Let's Begin`. Five controls read as one English sentence. [NEW]
- **Proof band:** a solid near-black strip directly under the hero, three items separated by hairline rules:
  `#1 Matchmaking Service | ★★★★★ Ratings on Playstore by 2.4 lakh users | 80 Lakh Success Stories`.
- **"The Shaadi Experience":** 3 equal cards. Notably the **first pillar is now "30 Day Money Back
  Guarantee"** — the settlement/refund guarantee that `07_Competitive_Benchmark.md` filed as `GAP-policy` is
  now their lead trust claim, above verification and above AI. [CHANGED]
- **Founder section** (`04-home-stories.png`): real photograph of Anupam Mittal bleeding off the right edge,
  a 40px watermark quote glyph, the quote set at ~40px/1.25 in near-black, attribution in 16px grey. No card,
  no border.
- **Success stories** (`05-home-stories-carousel.png`): sticky left text column (title + paragraph + teal pill
  CTA with a `→`), right side a horizontal rail of cards — 4:3 real UGC couple photo on top, white body below
  with name in 20px bold and a 3-line testimonial. Below the rail: a **scroll-progress rail** (a red bar whose
  width is the visible fraction) and two 44px circular arrow buttons, the disabled one greyed rather than
  hidden.
- **FAQ:** numbered `01`…`05`, question at 20px, a circular `+`/`−` on the right, 1px-bordered cards.
  *(Our doctrine §8 bans section numbers — see §4 note.)*
- **Public community pages** (`07`, `08-seo-profile-cards.png`): the `/matrimony/punjabi-matrimony` SEO page
  carries a **live rail of real member cards** — heavy gaussian-blurred photo (1:1, 12px radius, no border),
  masked ID `SH47****` with a blue verified tick, one grey meta line `40 yrs, 5'2", Hindu, Mahajan, Delhi`,
  and a `Brides` / `Grooms` segmented pill toggle above. Privacy preserved, "real people are here" proved.
  [NEW — and directly applicable to our `/matrimony/:city/:community` pages]

**Genuinely well made:** the photograph-as-hero decision; the mad-libs search; the restraint of the card
system; the carousel progress rail instead of dots.

**Not well made:** a register modal **auto-opens over the homepage within ~2s of landing** and cannot be
dismissed with Escape (`01-home-signup-modal.png`) — you cannot read the hero they spent money on. And the
pricing page is a different, much older design system (`06-pricing.png`).

### 1.2 Jeevansathi.com — scroll-driven product demo

**Visual language** (`01-home.png`)
- Full-bleed evening/bokeh hero photograph, headline centred in a **serif** (≈44px), sub in sans, one rose
  `#E8365D` pill CTA. Rose is used generously — CTAs, links, the second word of every two-tone heading.
- **Two-tone headings everywhere:** `Bringing People` in near-black + `Together` in rose;
  `Impress them Over the` + `Distance`. Cheap to implement, gives every section a beat. [NEW]
- Small label + **short 24px accent underline rule** under each feature title — a consistent micro-motif.

**Key screens**
- **Overlap card:** a white card straddles the hero's bottom edge (~half in, half out), holding the
  "25 years" block. Cheap depth, no shadow theatre.
- **Sticky device showcase** (`03-sticky-phone-scroll.png`): a phone frame pins on the right while the left
  feature list scrolls past; the phone's **screen content swaps** between features (Match Hour poster → a
  vertical video profile with a Send Interest / chat / star / `00:13` / mute action bar), and floating white
  annotation chips ("Online Event", "Connect with same community members", "Present yourself better") attach
  to the frame. Well executed. [NEW]
- **Free-vs-Paid comparison** (`04-home-mid.png`): two overlapping cards over a navy band. Free is a white
  card, offset left and lower; **Paid is a solid rose panel, taller, raised, overlapping it**. Both list the
  *same seven rows in the same order* so the eye reads a diff; Free greys the rows it lacks and marks them
  with a ✗-in-circle rather than omitting them. Free's CTA is filled rose; Paid's is white-on-rose. This is
  the single best pricing composition I saw in the category. [NEW]
- **Success stories** (`05-home-lower.png`): real couple photo, a **script/handwriting face** for
  "Vempadapu & G" overlaid at the bottom over a dark scrim, a hairline rule under it, then `MARRIAGE DATE` in
  10px letter-spaced caps. Round arrow buttons overlap the rail's left/right edges.
- **Public browse grid** (`07-public-cards.png`): 3-up card grid, blurred 4:3 photo, username, then a single
  **pipe-delimited run-on meta line** — `47 Years, 5' 6" | Hindu / Punjabi | Brahmin| PhD| Rs. 15 - 20 Lakh|
  Education Professional| New Delhi`. Unscannable. Right rail of SEO facet chips, and a
  `Last updated on September 16, 2026` freshness line.

### 1.3 BharatMatrimony / PunjabiMatrimony — a generation behind, but two good habits

(`01-home.png`, `02-home-2.png`, `03-punjabimatrimony.png`)

- Mint-tinted gradient field, orange + green brand, a photo-mosaic "26" numeral, decorative mandala corners,
  celebrity endorsement (Anil Kapoor) on a maroon band. Visually the oldest of the four.
- **Two things they do better than us:**
  1. **The register form is inline in the hero, not behind a button** — three fields only (Profile created
     for / Name / Mobile) with the microcopy `OTP will be sent to this number` directly under the field and
     the T&C line under the CTA. No password, no separate page. [NEW]
  2. **The sticky header injects the primary CTA on scroll.** At the top the nav is `Login | Help`; once the
     hero form leaves the viewport an orange `Register Free` button appears in the nav. Cheap, effective,
     zero new surface. [NEW]
- `punjabimatrimony.com` is a **template skin** of `bharatmatrimony.com` — identical layout, swapped logo and
  the word "Punjabi". Their regional siblings carry no local specificity at all. Our
  `/matrimony/:city/:community` pages, which compose a real community block with a real locality block, are
  already better than the market leader's regional strategy — nothing on our site claims that.

### 1.4 Betterhalf.ai — no web product to study

`betterhalf.ai` and `www.betterhalf.ai` 301 every desktop request to
`play.google.com/store/search?q=betterhalf`; `/about-us` returns **410 Gone**. Play listing
(`01-play-listing.png`, `02-play-shots.png`): 4.0★ / 35.8K reviews / 50L+ downloads, **last updated 18 Sept
2025**. Brand is a magenta→purple gradient with a script-serif overlay; their two lead store creatives are
"20,000+ couples met on Betterhalf" over a photo mosaic and **"Selfie Verified PROFILES"** — the same
verification promise we ship, sold harder than we sell it. [NEW]

### 1.5 Craft references (motion / interaction only)

**Hinge — `hinge.co`** (`01`–`03-hinge-*.png`) — the closest thing to our brief that exists.
- **Modern Era** (geometric sans) + **Tiempos Headline** (serif). Structurally the same pairing as our
  Inter + Playfair, which is a useful validation.
- Hero: transparent nav over a full-bleed documentary photograph, centred wordmark, serif H1 at ~64px pinned
  **bottom-left**, and — notably — **no CTA in the hero at all**.
- Section rhythm: small muted sans eyebrow → very large serif headline → sans body → white pill button.
  Sections alternate cream and near-black at full bleed. Vertical whitespace is enormous (~200px between a
  heading and its content).
- **Measured feature use:** `text-wrap: balance` ✓, `scroll-snap-type` ✓, `backdrop-filter` ✓. **No GSAP, no
  Lenis, no scroll-jacking, no view transitions, no scroll-driven CSS animation.** The craft is photography,
  type, and whitespace. This is the strongest available argument that our doctrine's ban on scroll hijack
  costs us nothing competitively.

**Bumble — `bumble.com`** (`04`, `05-bumble-*.png`)
- Hero: the wordmark set at ~260px as the *graphic*, with three profile cards fanned through the letterforms
  in 3D perspective (rounded corners, name + age in the corner, soft shadows). Floating **capsule nav** with a
  sliding hover highlight, fixed and translucent.
- Sections are large soft-grey rounded panels containing a photo/text split, with a circular "sticker" badge
  overlapping the photo corner.
- Measured: `text-wrap: balance` ✓, `scroll-snap-type` ✓, `backdrop-filter` ✓, BumbleSans variable, **no
  motion library detected, no video, no view transitions.**

**Linear — `linear.app`** (`06-linear-home.png`) — included as the current craft ceiling for *interface*
rather than lifestyle sites.
- Near-black canvas, Inter Variable, H1 ~64px/1.05 tight, a product panel with a 1px hairline border and a
  faint inner glow.
- Measured: `@container` ✓, `color-mix()` ✓, `text-wrap: balance` ✓, `prefers-reduced-motion` ✓,
  motion library present. **No view transitions, no `animation-timeline`.**

**The measured conclusion across all three craft references:** in 2026, nobody at the top of the craft
distribution ships CSS scroll-driven animation or the View Transitions API on a marketing site. The actual
2026 signature is: variable fonts, `text-wrap: balance`, container queries, `color-mix()`, translucent
floating chrome, full-bleed alternating light/dark sections, very large type, and a motion library that
honours `prefers-reduced-motion`. **We already ship view transitions and `animation-timeline: scroll()` (the
2026-08-19 modernization pass) — we are ahead of Hinge and Bumble on platform features and behind them on
photography, type scale and whitespace.** That is the real gap, and it is not a technical one.

---

## 2. Workflow patterns — and where our flow is objectively worse

### 2.1 First visit → signup

| | Shaadi | Jeevansathi | BharatMatrimony | **TricityMatch** |
|---|---|---|---|---|
| Hero conversion device | Mad-libs search strip | `Register Now` pill | **Inline 3-field form** | `Create free profile` button |
| First gate asks for | Mobile **only** | Mobile **only** | For-whom + name + mobile | **Identifier + password + T&C + OTP** |
| Password at signup | **Never exists** | No | No | **Yes, with a 5-rule policy** |
| Social login | Google + Email | Google + Email + Mobile | — | **None** (Google unconfigured) |
| Funnel chrome | Modal, no site nav | Own page | Own page | **Site navbar still rendered** |

**Where we are worse — concrete, from `ours/03-signup-step1.png`:**

1. **The global `Navbar` renders on top of the onboarding page.** The result is two TricityMatch logos on one
   screen (nav + left rail) and a **"Create Profile" button in the nav of the create-profile page**. Every
   competitor strips site chrome inside the funnel. This is the single most visible defect in the funnel.
2. **Two competing primary buttons are on screen at once.** `Send OTP` (burgundy, inside a bordered panel)
   and `Next` (burgundy, full-width, sticky footer). The real next action is `Send OTP`; `Next` is inert
   until verification. Two identical-weight burgundy CTAs is a decision the user should not have to make.
3. **We ask for a password nobody else asks for.** Shaadi has no password field in the product at all — OTP
   is the identity. Ours adds a field plus an eight-word policy string at the very first gate, before any
   value has been shown.
4. **The idle identifier field paints with a burgundy ring** that reads as an error state at a glance.
5. **Our mobile fold is text-only** (`ours/04-home-mobile.png`). At 390×844 the first screen is: promo bar
   (2 lines) → eyebrow chip (2 lines) → headline (3 lines) → three stacked ✓ chips → paragraph → CTA. **No
   human face, no photograph, no proof number above the fold.** All four competitors lead with a photograph
   of a couple on mobile. For a product whose entire promise is "real, verified, local people", leading with
   prose is the wrong trade.
6. **Three different entry labels compete on the homepage** — nav `Create Profile`, promo bar `Claim now`,
   hero `Create free profile` — for one action.

**Where we are better:** our flow genuinely is two screens; Jeevansathi's manual path is still ~20 screens.
Keep that. The fix is to make the first screen *lighter*, not longer.

### 2.2 Search & filtering
Not observable pre-auth on any competitor this pass (July doc §4 has Shaadi's 18-category sidebar — still the
reference, [KNOWN]). The one new public artifact is Jeevansathi's **SEO facet chip rail** (`Punjabi IT
Software Brides`, `Punjabi Brahmin Brides`…) — pre-baked filter combinations as links rather than controls.
Cheap SEO + a shortcut for users who do not want to open a filter panel. [NEW]

### 2.3 Profile card grid
Both competitors' public grids use **blurred real photos + masked identifiers + verified tick**. Shaadi's card
is 1:1 with a single clean meta line; Jeevansathi's is 4:3 with an unreadable pipe-delimited blob. Our
`ProfileCard` (structured rows, compatibility colouring, gold high-compat star) is **better than both** — the
gap is that we never show it to a logged-out visitor. [NEW]

### 2.4 Profile detail
No competitor detail page was reachable pre-auth. The July doc's finding still stands: Jeevansathi's reverse
preference-match panel is the pattern to beat, and we have shipped it on web (`PreferenceMatch.jsx`) and RN.
[KNOWN — closed]

### 2.5 Paywall / upgrade moment
- **Jeevansathi's Free-vs-Paid overlap card** (§1.2) is the pattern to steal wholesale for `/subscription`.
  Our single-plan page currently shows Free + Premium as **two peer cards**; the overlap composition makes the
  paid card structurally dominant without any extra copy. It also solves a problem our single-plan page has:
  with only two cards, a symmetric grid reads as a choice between equals.
- Shaadi's plan matrix is **tenure-first** (columns `3 months | 6 months | 12 months`), plan second. With a
  single 90-day plan we cannot copy the axis, but "3 months of full access" belongs at card level, not buried
  in a bullet.
- **Nobody in this category shows a strike-through price on the marketing site any more** — Shaadi's public
  page shows no prices at all, Jeevansathi's shows features only. Discount anchoring has moved behind the
  login. [CHANGED from July doc §2.2]

### 2.6 Trust & verification signals
Ranked by prominence on each homepage:
- Shaadi: `30 Day Money Back Guarantee` → `Blue Tick` → `AI matchmaking`; plus a persistent proof band
  (`80 Lakh Success Stories`, `2.4 lakh Playstore ratings`).
- Jeevansathi: `100% Screened Profiles` → `Control over Privacy` → `Online Experiences`; on interior pages
  `lacs of Govt-ID verified profiles`.
- BharatMatrimony: `100% Mobile-verified profiles` / `4 Crore+ customers` / `26 Years`.
- **Ours:** `Live selfie verification`, `Chandigarh · Mohali · Panchkula`, `Family-first matchmaking` as three
  ✓ chips, plus a hairline strip lower down.

Two gaps. **(a)** Everyone else pairs a trust claim with a *number*; we deliberately publish none because our
numbers are small — correct, and consistent with the honest-numbers positioning, but it means we have no
quantified proof anywhere. The substitutable numbers we *do* have are process numbers, not size numbers:
"every profile seen by a person", "verified in hours", "founding members join free until 18 Nov". **(b)** Our
`/refund-policy` page exists but is a footer link; Shaadi has made the same idea their **first** homepage
pillar.

### 2.7 The "reach out" action
Not observable pre-auth. [KNOWN from July doc §3: Jeevansathi's card action row is
`Interest / Shortlist / Ignore / Chat`.] One new data point: Jeevansathi's video-profile mock shows a
**persistent bottom action bar over the media** (`Send Interest` as a labelled button, then icon-only chat,
star, duration, mute) — the primary action is worded, the rest are glyphs. Good hierarchy for our
ProfileDetail sticky bar.

---

## 3. Motion & interaction inventory

For each: what it is, where it was seen, and the verdict for **a matrimonial product used by Indian families
including 50-70-year-old parents**. "Doctrine" refers to `DOCTRINE_2026-09.md`.

| # | Pattern | Seen on | Verdict for us |
|---|---|---|---|
| M1 | **Full-bleed photographic hero, zero motion** | Shaadi, Jeevansathi, Hinge | **Adopt.** The most valuable thing in this whole report and it needs no motion at all. |
| M2 | **Sticky header injects the primary CTA on scroll** | BharatMatrimony | **Adopt.** 160ms fade + 8px rise; frequency-gated (fires once). Compatible with doctrine §4.3. |
| M3 | **Carousel scroll-progress rail** (bar width = visible fraction) instead of dots | Shaadi | **Adopt.** Honest, works at any item count, readable at elder type sizes. |
| M4 | **Sticky device + scroll-swapped screen content** | Jeevansathi | **Adopt only in the restrained form.** Doctrine §2.1 bans pinning and scrubbed scroll. A stationary phone frame whose screenshot cross-fades when the matching text block enters view (IntersectionObserver, 500ms) gets the same effect without taking the scrollbar. |
| M5 | **Overlap composition** (card straddling a section boundary; paid card overlapping free) | Jeevansathi ×2 | **Adopt.** Pure layout, no motion, no cost. |
| M6 | **Two-tone heading** (second phrase in brand colour) | Jeevansathi | **Partial.** We already do this with the Playfair italic burgundy line. Do not stack both devices in one heading. |
| M7 | **`text-wrap: balance` on all display headings** | Hinge, Bumble, Linear (all three) | **Adopt.** One line of CSS; fixes the ragged 2-word orphan lines in our Playfair headings. |
| M8 | **Alternating full-bleed cream / near-black sections** | Hinge, Shaadi | **Adopt.** We already have the dark burgundy founding band; the rhythm should repeat rather than appear once. |
| M9 | **Scroll-reveal, fires once, 500-600ms, ≤8px rise** | Hinge, Shaadi | **Keep as-is.** Already doctrine §4.3. |
| M10 | **Floating translucent capsule nav** | Bumble | **Reject on web.** We already ship the floating pill on RN; on desktop it costs elder-mode target clarity and duplicates our existing sticky bar. |
| M11 | **3D-perspective card fan through oversized wordmark type** | Bumble | **Reject.** Reads as a dating app. Our fanned photo stack is already the tamed version — and it is currently **broken** (see §6). |
| M12 | **Auto-opening signup modal over the hero** | Shaadi | **Reject — see anti-list A1.** |
| M13 | **Hover-only card affordances** (magnify, spotlight border, magnetic buttons) | Bumble-adjacent | **Reject.** Already doctrine §2.16; half our traffic is touch. |
| M14 | **Skeleton → content cross-fade** | Linear | **Already shipped** (2026-08-19 Skeleton/EmptyState/ErrorState primitives). Competitors show full-page spinners. We are ahead. [KNOWN] |
| M15 | **View Transitions on route change** | *Nobody in this set* | **Already shipped.** Keep, but stop treating it as a differentiator — no competitor or craft reference uses it, so it earns zero perceived-quality credit on its own. |
| M16 | **CSS `animation-timeline: scroll()` progress bar** | *Nobody in this set* | **Already shipped** (Home progress bar). Fine; invisible as a differentiator. |
| M17 | **Celebratory match moment** (confetti / seal) | Not observable pre-auth anywhere | No new evidence. Our toned MatchPopup (18 particles / 1.8s) stands; it is a rare-tier event, which is exactly where doctrine §4.1 puts the delight budget. |
| M18 | **Swipe/stack card interaction** | Only Shaadi's logged-in Today's Matches carousel [KNOWN, July doc §3] | **Reject for web.** Swipe-to-decide is the gesture families read as "dating app". |
| M19 | **Numbered section labels (`01`…) and uppercase letter-spaced eyebrows** | Shaadi FAQ; Hinge section labels | **Reject — doctrine §8 bans both**, and our live Home still uses them (`— THE PROCESS`, `01 / SECURITY`, `04`). The doctrine is right and the competitor precedent does not overturn it; noting it only so nobody re-imports the pattern citing Hinge. |
| M20 | **Script/handwriting face for couple names on success-story photos** | Jeevansathi | **Reject the script face** (a fourth typeface, poor Devanagari/Gurmukhi support). **Adopt the composition**: name over a bottom scrim, hairline rule, `MARRIAGE DATE` in small caps — set in Playfair. |

---

## 4. Steal list — ranked

Each item names the screen of ours it lands on.

| # | Steal | Our screen | Source |
|---|---|---|---|
| 1 | **Put a real photograph of real people above the fold on mobile.** Today the 390px fold is 100% text. Everyone else leads with a face. | Home | Shaadi, Jeevansathi, Hinge |
| 2 | **Strip the site navbar out of the onboarding funnel** — it currently renders a second logo and a "Create Profile" CTA on the create-profile page. | Signup | All three |
| 3 | **Collapse the first signup gate to one field.** Identifier → OTP. Move password to after verification (or make it optional and OTP-primary, as Shaadi did). | Signup | Shaadi, Jeevansathi, BharatMatrimony |
| 4 | **One primary button per screen in the funnel.** `Send OTP` is the action; `Next` should be a quiet disabled/secondary state until verified. | Signup | All three |
| 5 | **Rebuild `/subscription` as the Free/Paid overlap pair** — same seven rows in the same order on both cards, Free greying the rows it lacks with a ✗, Paid raised and overlapping in solid burgundy. Solves the "two peer cards" problem of a single-plan page. | Subscription | Jeevansathi |
| 6 | **Add a mad-libs search strip to the hero** — "I'm looking for a `[bride]` aged `[25]` to `[30]` in `[Chandigarh]`" → `Show me matches`. Gives the visitor a *product* action instead of a signup action, and it is genuinely our shape (we are a search product with 3 cities). | Home | Shaadi |
| 7 | **Put a rail of real (blurred, ID-masked, verified-ticked) member cards on the community × city landing pages.** We have 15 `/matrimony/:city/:community` pages with no proof that anyone is on the other side. | `/matrimony/:city/:community` | Shaadi |
| 8 | **Promote the refund/conduct guarantee from a footer link to a first-class homepage trust pillar.** Shaadi made it pillar #1. | Home, Subscription | Shaadi |
| 9 | **Say out loud that free members can read and reply.** `FREE_REPLY_WINDOW` is live and is now more generous than Jeevansathi's free tier. It is currently invisible to a logged-out visitor. | Home, Subscription, Chat paywall | Jeevansathi (by contrast) |
| 10 | **Sticky-header CTA injection on scroll** — nav shows `Sign In` at rest, adds `Create free profile` once the hero CTA leaves the viewport. | Home + all marketing | BharatMatrimony |
| 11 | **Carousel progress rail instead of dots** on success stories and any card rail. | Home, `/success-stories` | Shaadi |
| 12 | **`text-wrap: balance` on every display heading**, plus a wider type scale on marketing H1s (competitors sit at 64-72px; we are at ~52px). | All marketing | Hinge, Bumble, Linear |
| 13 | **Restrained sticky-device section** (stationary frame, screenshot cross-fades on IntersectionObserver) to show the product before signup — we currently show zero product UI to a logged-out visitor. | Home | Jeevansathi (de-scrubbed) |
| 14 | **Success-story card composition:** photo, name over a bottom scrim in Playfair, hairline rule, `MARRIAGE DATE` in small caps. | Home, `/success-stories` | Jeevansathi |
| 15 | **Process-number honesty instead of size-number vanity.** Replace absent proof with claims we can defend: "every profile seen by a person", "verified in hours", "founding members free until 18 Nov". | Home proof band | Everyone (inverted) |

---

## 5. Anti-list — do not copy

| # | Pattern | Seen on | Why not |
|---|---|---|---|
| A1 | **Auto-opening signup modal over the homepage** (≈2s, Escape does nothing) | Shaadi | It hides the hero they paid to shoot; on a 3-city product with a dozen members it would read as desperation before we have earned the ask. |
| A2 | **Inflated counts** — "New Matches (193) / My Matches (3,206)" on a same-day empty profile | Shaadi [KNOWN, July doc §3] | Our whole positioning is "no inflated numbers". Copying this would contradict live homepage copy. |
| A3 | **Permanent "45% OFF / 55% OFF" anchor banners** | Shaadi, Jeevansathi [KNOWN, July doc §2] | A discount that never ends is not a discount; both have now moved it behind login anyway. |
| A4 | **Persistent upgrade rail that never goes away** ("You are missing out on the premium benefits!") | Jeevansathi [KNOWN] | Permanent nagging on an operate surface violates doctrine §1 (Operate = scanability, speed) and burns trust with the parent audience. |
| A5 | **Pipe-delimited meta blobs** — `47 Years, 5' 6" \| Hindu / Punjabi \| Brahmin\| PhD\| Rs. 15-20 Lakh\| ...` | Jeevansathi | Unscannable at any size, catastrophic in elder mode. Our structured `ProfileCard` rows are already better. |
| A6 | **Blurring every photo pre-paywall** | Shaadi | Browsing stops being rewarding; with our small corpus, a blurred grid would look empty *and* punitive. |
| A7 | **Two different design systems on one site** (new funnel, 2015-era pricing/help pages) | Shaadi | We have eleven marketing + legal pages; the rework must cover `/help`, `/refund-policy` and `/delete-account` or we reproduce exactly this. |
| A8 | **Celebrity endorsement + mandala ornament as the trust device** | PunjabiMatrimony | Borrowed authority, not earned. Our verification process is the more defensible claim. |
| A9 | **Template-skinned regional pages** (one layout, swap the community word) | PunjabiMatrimony | Our city pages already compose genuinely different local content; do not regress to a token swap as we add more. |
| A10 | **Score/urgency pressure devices** ("X people viewed you", countdown timers) | Category-wide | Manufactured scarcity aimed at a family making a marriage decision is the worst possible trust trade. |
| A11 | **A 3D card fan through oversized wordmark type** | Bumble | Reads dating-app, and our tamed version of it is currently rendering broken (§6). |
| A12 | **Abandoning the web for the app** | Betterhalf | Stated for completeness: their web is 410/301-to-Play. Our web is where the parent audience actually is. |

---

## 6. Live defects observed on our own site while benchmarking

Not the point of this pass, but visible in the comparison screenshots and worth folding into the plan.

1. **Hero photo stack is rendering broken at 1440** (`ours/01-home-hero.png`). The `97%` badge is clipped by
   the card's top edge; the second card's caption reads `ANJALI, 29 · PANCHKULA` with `…CHANDIGARH` bleeding
   through from the card beneath it. The 2026-08-17 review filed this as "subjective / intentional fan" — at
   1440 it reads as a layout bug, not a fan. [KNOWN, escalated]
2. **Banned patterns from the doctrine are live on Home**: the eyebrow labels (`— THE PROCESS`,
   `— WHY TRICITYMATCH`, `— FOUNDING MEMBERS`) and the section numbers (`01 / SECURITY`, `04`) that §8
   explicitly lists for deletion.
3. **The Process section appears to resolve its whole 01→04 scroll narrative inside roughly one viewport**
   (`ours/02-home-scroll.png` shows step `04` active while the section heading is still on screen).
   *Hypothesis, not a confirmed bug* — per our own QA note, static screenshots lie about scroll-linked
   content. Worth driving live before designing around it.
4. **Promo bar copy may be drifting from the live offer**: it says "First month Premium free for Chandigarh
   residents" while the product sells a 90-day ₹1,099 Premium and a founding grant of 30 days / 3 unlocks
   open to all three cities. Worth a copy audit alongside the rework.

---

## 7. What consumer web in 2026 does that our 2024-era React/Tailwind site visibly lacks

Measured, not asserted — each was detected in the live CSS of at least two of the reference sites.

| Trend | Evidence | Our state |
|---|---|---|
| **Photography as the primary design material** | Shaadi, Jeevansathi, Hinge, Bumble all lead with full-bleed real photography | We lead with typography and CSS ornament; our only photography is a small clipped card fan, hidden entirely on mobile |
| **Display type at 64-72px with tight tracking** | Shaadi 72px, Hinge ~64px, Linear ~64px | Ours ~52px |
| **`text-wrap: balance`** | Hinge ✓, Bumble ✓, Linear ✓ | Not used |
| **Container queries + `color-mix()`** | Linear ✓ | Not used (Tailwind 3.4, held) |
| **Variable fonts** | Inter Variable (Linear), BumbleSans, Modern Era | Static Inter + static Playfair |
| **Alternating full-bleed light/dark sections** | Hinge, Shaadi | One dark band, used once |
| **Whitespace as the luxury signal** (~200px between heading and content) | Hinge | Our marketing sections are `py-16 md:py-24` — correct per doctrine §2.13 for dense trust content, but the *hero* can afford more |
| **Restraint over effects** — no GSAP, no scroll-jack, no parallax on any of the three craft references | Hinge, Bumble, Linear all measured clean | We are already aligned; the doctrine's ban costs nothing |
| **View Transitions / scroll-driven CSS** | **Nobody** | We ship both. Keep them, but they are table-stakes plumbing, not perceived quality |

**The one-line conclusion:** our stack is ahead of the category and level with the craft references. The
visible gap is not technical — it is **photography, type scale, and the absence of a human face above the
fold on mobile**, plus a signup first-gate that asks for more than anyone else in the market.

---

## Screenshot index

`competitor-research-2026-09/` (repo root, untracked)

- `shaadi/` — 01 auto-modal, 01b modal, 02 hero, 03 experience cards, 04 founder quote, 05 stories carousel +
  numbered FAQ, 06 legacy pricing page, 07 SEO community hero, 08 public member card rail
- `jeevansathi/` — 01 hero + overlap card, 02 sticky phone (state A), 03 sticky phone (state B),
  04 Free-vs-Paid overlap cards, 05 success stories + browse-by tabs, 06 public browse hero, 07 public card grid
- `bharatmatrimony/` — 01 hero + inline register form, 02 assisted service + scroll-injected nav CTA,
  03 punjabimatrimony skin
- `betterhalf/` — 01, 02 Play listing (web is 301/410)
- `craft/` — 01-03 Hinge, 04-05 Bumble, 06 Linear
- `ours/` — 00 baseline home, 01 hero @1440, 02 process section, 03 signup step 1, 04 home @390

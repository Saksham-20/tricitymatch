# TricityMatch Web UI/UX Rework — Plan (2026-09-17)

Planning lead: Opus. Implementation: Sonnet agents, one phase at a time.

**Inputs this plan is built on** (read them, do not re-derive):
- `DOCTRINE_2026-09.md` — the operating law. Binding.
- `CURRENT_STATE_AUDIT_2026-09-17.md` — what exists today, with `file:line` evidence.
- `COMPETITOR_RESEARCH_2026-09-17.md` — Shaadi / Jeevansathi / BharatMatrimony / craft references, Sept 2026.

**Owner decisions taken 2026-09-17:**
1. Imagery: **AI-generated for now**, real photography to follow. See "Imagery override" below.
2. Funnel: **one-field first gate**. Password and T&C move behind OTP verification. No auth-model change.
3. Scope: **member + public surfaces**. Admin and marketing portals are a follow-up campaign.
4. Rollout: **phased, deploy each slice** after its gates pass.

---

## The thesis

The design system is good, documented, and unused. `Card.jsx`, `Input.jsx`, `EmptyState.jsx` and `ErrorState.jsx`
have **zero importers** while eight inline card treatments compete across three radii and four shadows. The
motion standard lost 45 files to 5. The front door is genuinely premium; the 2024-AI-React look starts the
moment a user logs in.

So this is **not a re-skin and not a new palette.** It is adoption, hierarchy, and truth. Where we do add
something new it is because a measured competitor gap demands it, not because the page felt empty.

---

## Imagery override (owner decision 1)

The doctrine (ruling 15) bans fabricated couples on a matrimonial product. The owner has chosen AI imagery as
an interim. That decision stands, under these guardrails, which are **not optional** because they are what keeps
the interim honest rather than deceptive:

- AI imagery is **ambient art direction only.** A generated human may set mood in a hero or a section backdrop.
- **Never** captioned or framed as a member, a couple who met here, a testimonial, or a success story.
- **Never** carries a name, a quote, an age, a city, a "verified" tick, or a match percentage.
- **Never** placed inside or adjacent to a trust claim, a verification badge, a real-member proof rail, or the
  success-stories surface. Those surfaces show real consented people or they show nothing.
- Every generated asset lands under `frontend/public/images/editorial/` and is referenced only through a single
  manifest module, so the swap to licensed or consented photography is one commit.
- Faces are not the only option and often not the best one. Wedding detail, mehendi hands, phulkari texture,
  marigold, a Chandigarh streetscape all carry warmth without impersonating a person who does not exist.

`DOCTRINE_2026-09.md` ruling 15 is amended in Phase 0 to record this override, so implementers are never handed
two contradictory laws.

---

## Phase 0 — Truth and live bugs (ship first, same day)

These are not design. Two of them are running in production right now, one costs money and one is a
misrepresentation. Nothing else starts until these are deployed.

| # | Defect | Evidence | Fix |
| --- | --- | --- | --- |
| 0.1 | **Paywall shows prices we do not sell.** A hardcoded, never-fetched plan array: ₹1,500/15d, ₹3,000/1mo, ₹7,499/3mo. Live catalogue is one ₹1,100/90d plan; two of the three shown are withdrawn and `createOrder` would 400 them. This is the gate for all of Chat, 7 triggers on ProfileDetail, and Dashboard. | `components/common/UpgradeModal.jsx:8-33` | Fetch `GET /subscription/plans`, render the live offer. Reuse the `plansLoaded` pattern from `Subscription.jsx` — never fall back to a static catalogue, because that is exactly how this bug shipped. Loading and error states required. |
| 0.2 | **False offer claim.** "Limited time: First month Premium free for Chandigarh residents." No such offer exists. The founding grant is 30 days / 3 unlocks, open to all three cities; Premium is ₹1,099/90d. Wrong on the benefit and wrong on the geography, on a page taking real money through live Razorpay keys. | `pages/Home.jsx:436` | Drive the strip from the live launch-offer API, or delete it. No hardcoded commercial claim survives this phase. Also drops an off-token inline `var(--gold-lt)`. |
| 0.3 | Hero photo stack renders broken at 1440: `97%` badge clipped, card-2's caption bleeding card-3's text. The Aug review misfiled this as an intentional fan. | `pages/Home.jsx` hero | Fix or remove. It is replaced wholesale in Phase 3 either way, so the cheap correct move is to make it not look broken until then. |
| 0.4 | Global Navbar renders on top of `/onboarding`: two logos and a "Create Profile" CTA on the create-profile page. | route shell | Funnel routes render no site chrome. |
| 0.5 | Two hard horizontal overflows at 375px. | `pages/Settings.jsx:892` (129px), `pages/Matches.jsx:160` (51px) | Contain. |
| 0.6 | Doctrine amendment recording the imagery override. | `DOCTRINE_2026-09.md` ruling 15 | Text edit. |

**Gates:** FE tests green, `npm run build` green, `npm run lint` (slop-lint is currently **clean** at 349 files —
the CLAUDE.md note claiming a pre-existing failure is stale and `BiodataCard.jsx:123` is correctly allowlisted
WhatsApp green). Verify 0.1 and 0.2 live against prod after deploy, signed in as the free QA account.

---

## Phase 1 — Foundation: make the system real

The single highest-leverage phase. Nothing visual is invented here; existing law is enforced.

**1.1 Grow `utils/animations.js`** per doctrine §5: `EASE_OUT` corrected to `[0.23, 1, 0.32, 1]` (the current
`[0.25, 0.46, 0.45, 0.94]` is the weak quadratic), plus `EASE_IN_OUT`, `EASE_DRAWER`, the `DUR` table, `SPRING`,
and the new variants `popIn`, `tooltip`, `modal`, `backdrop`, `sheet`, `toast`, `listRow`, `revealOnce`.

**1.2 Fix `index.css`.** Rewrite the `prefers-reduced-motion` block: today it sets
`transition-duration: 0.01ms !important` globally and kills `.btn-primary`, `.card`, `.nav-link` outright.
Reduced motion means gentler, not zero — the user still needs to see the interface heard them. Add the three
easing custom properties. Replace `transition-all duration-300` on `.btn-*`, `.card`, `.nav-link` with named
property lists at doctrine §4.3 durations. Remove the gold button's infinite sweep pseudo-element.

**1.3 Retire dead keyframes** from `tailwind.config.js`: `glow`, `float`, `pulse-soft`, `bounce-in`,
`gradient-shift`, `sparkle`, `heart-pulse`, `spin-slow`. Keep `shimmer`, `accordion-*`, `fade-in`, `scale-in`,
`slide-in-*`, `typing-bounce`, `confetti`.

**1.4 Adopt the dead primitives.** `Card`, `Input`, `EmptyState`, `ErrorState` go from zero importers to being
the only way those things are built. Every hand-rolled empty and error state in the app is replaced. This is the
bulk of the phase and the reason the app currently looks like eight different products.

**1.5 One icon family.** Retire `lucide-react` from its 16 files to `react-icons/fi`, then drop the dependency.

**1.6 Banned-pattern sweep** (doctrine §8 census): `transition-all` ×104 → named properties; `whileHover` ×32 →
pointer-gated CSS or removed; `min-h-screen` ×50 → `min-h-[100dvh]`; ghost cards ×16 → border or shadow, not both;
5 scroll listeners → `IntersectionObserver`.

**1.7 Give gold its meaning back.** Gold currently marks a paid plan, a **0%** trust score
(`Verification.jsx:80`), a 62%-complete free profile (`ProfileCompletionMeter.jsx:208,322`), a shortlist toggle,
and an admin commission field. After this phase gold means premium and nothing else.

**Gates:** FE tests, build, lint, plus a visual regression walk at 375/768/1440 in light and dark.

---

## Phase 2 — Dark mode and elder mode, finished

15 member and public pages ship **zero** `dark:` classes, as do `FormField`, `Select`, `Badge` and
`ErrorBoundary`. Where dark mode does exist, `#1a1f2e` / `#0f1117` / `#14182a` are repeated 15+ times
un-tokenized. Tokenize those three, complete the 15 pages and the 4 primitives, then walk every screen in dark
and in elder mode against the doctrine §9 checklist. Admin's dark mode is explicitly out of scope this campaign.

---

## Phase 3 — Public surfaces (Persuade)

`/`, `/about`, `/safety`, `/success-stories`, `/help`, `/contact`, `/matrimony/:city/:community`, `/subscription`.

- **Home.** A human presence above the 390px fold (imagery per the override). Kill the doctrine-banned eyebrow
  labels and section numbers still live on the page (`— THE PROCESS`, `01 / SECURITY`, `04`). Centered hero is
  permitted here and only here; every other section goes asymmetric or split.
- **Say the thing our competitor stopped doing.** Jeevansathi has **withdrawn free chat**; our live
  `FREE_REPLY_WINDOW` lets a free member read forever and send 5 messages in 48h after a mutual match. We are
  more generous than the market leader on the exact feature they just took away, and we advertise it nowhere.
  This belongs on Home and on `/subscription`.
- **Refund guarantee becomes a first-class trust pillar.** Shaadi made it their pillar #1. We have the policy
  page and bury it. `07_Competitive_Benchmark.md` filed this as GAP-policy and it is still open.
- **`/subscription` rebuilt as the Free/Paid overlap pair** — same rows in both cards, Free greyed with ✗, Paid
  raised and overlapping. This is also the clean answer to the "two peer cards" problem a single-plan page has.
- **Member proof rail** on the city and community landing pages: blurred, ID-masked, verified-ticked real
  members, the way Shaadi does it publicly. Real members only, never AI imagery.
- Section padding `py-16 md:py-24`. `revealOnce` is the only scroll motion, fires once, 550ms. No pinning, no
  scrub, no GSAP.

---

## Phase 4 — The funnel (owner decision 2)

Measured gap: all three giants open with a mobile number and nothing else; we ask for identifier + password +
T&C + OTP at the first gate.

- First screen asks for **one field** and Send OTP. Password and T&C move to step 2, after verification.
  Frontend restructure of the existing 2-step flow. No auth-model change, no security review needed.
- **One primary button per screen.** Today `Send OTP` competes with an inert `Next`, both burgundy.
- **No site chrome in the funnel** (carries 0.4 forward).
- Login gets the same treatment, keeping the progressive two-phase shape that already works.

---

## Phase 5 — Logged-in core (Operate)

Where the premium feeling currently dies.

- **Dashboard.** Five stacked coloured bands (pink → pink-gradient → yellow → white → burgundy) before any
  content; at 375 the entire first screen is nag and the CTA wraps inside its own pill. Rebuild to one clear
  hierarchy: what is new, what needs me, what I was doing.
- **Search and Matches.** Photoless profiles render as 220px flat pink rectangles with monograms. A matrimonial
  browse grid made of empty voids is the worst possible first impression of supply. Redesign the photoless card
  to lead with what we *do* know (name, age, city, profession, compatibility) instead of a void, and push the
  photo prompt to the owner of that profile.
- **`/profile`.** Eight identical grey nag rows, same icon each, differing only by `+N%`. Becomes one prioritized
  next action plus a quiet progress summary.
- **ProfileDetail, Chat, Settings, Notifications, Verification.** Doctrine §9 pass each: four states, skeletons
  that match the layout, premium gates that never fake a count or a photo, 375px, dark, elder, keyboard.

---

## Phase 6 — Verification and close

Full doctrine §9 pre-flight per screen at 375/768/1440, light/dark/elder, reduced motion on, keyboard-only pass,
200% zoom. Update `PROGRESS.md` and the CLAUDE.md audit history. Then, and only then, the RN app follows this
same doctrine through its §10 translation.

---

## Standing rules for every implementing agent

1. **The doctrine outranks your taste.** Read §2, §4, §8, §9 before touching a file. If a change needs a rule
   broken, stop and say so; do not quietly break it.
2. **Adopt, do not invent.** `Card`, `Input`, `EmptyState`, `ErrorState`, `Skeleton`, `SectionHeader`,
   `StagedLoader`, `RetryImage` already exist. A new component needs a reason the existing one cannot serve.
3. **All motion comes from `utils/animations.js`.** No hand-rolled curve, no hand-typed delay. The 14 onboarding
   steps that hand-type incrementing delays are a defect, not a precedent.
4. **Every screen ships four states.** Default, loading skeleton, empty, error. Premium views add the locked state.
5. **No fabricated data, ever** — not a count, not a photo, not a person, not an offer. This is the product's
   entire value proposition.
6. **Gates before done:** BE unit, FE tests, `npm run build`, `npm run lint`, and the screen seen at 375 in both
   themes. Report what you actually ran.

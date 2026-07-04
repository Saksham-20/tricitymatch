# Competitor Visual/UX Benchmark — Shaadi.com & Jeevansathi.com vs TricityShadi

> Date: 2026-07-02. Live walkthroughs via Playwright, real accounts created on both competitors (real OTP verified), screenshots in `docs/competitor-research/shots/{shaadi,jeevansathi}/`.
> Companion doc: `docs/07_Competitive_Benchmark.md` (2026-06-14, feature-matrix pass, no screenshots/pricing detail). This doc is the deeper visual/UX/pricing pass; read together.
> TricityShadi facts below are pulled live from the codebase (onboarding steps, `backend/utils/razorpay.js` plans, gating middleware, `compatibility.js`/`kundli.js`), not from memory.

## Method
Created one live test account on each site (real mobile OTP), walked signup → onboarding → OTP verify → dashboard → search → profile detail → pricing wall. 36 full-page screenshots captured. Both competitors are Info Edge/People Group-scale products (25+ years, tens of millions of profiles) — this is a David-vs-Goliaths comparison; the point is to steal specific UX patterns, not match their scale.

---

## 1. Signup & Onboarding

### Shaadi.com
- Landing hero → single **modal** collects: relation-for-whom (Myself/My Son/.../My Relative), gender, first/last name, DOB, religion+community+country (auto-defaulted from IP: Hindu/Hindi/India), email, phone — all in one scrollable modal, submitted in one shot, **no password field at all** (`02-signup-modal-step1.png`, `03-signup-modal-complete.png`).
- Account created immediately on submit (no OTP gate at signup) → redirects into a **4-step wizard, one field-cluster per screen**: City+lives-with-family+sub-community (`04-onboarding-step1.png`), Marital status+Height+Diet (`06-onboarding-step2.png`), Highest qualification, Income+Work (`07-onboarding-step4.png`).
- Sub-community/caste field is a **500+ entry searchable taxonomy** (Agarwal, Arora, all 60+ Brahmin sub-castes, Rajput, Khatri, etc.) with a "Frequently Used" section pinned to top and a **"Not particular about my Partner's Community (caste no bar)" checkbox** surfaced the moment you pick a caste (`05-onboarding-step1-filled.png`).
- "Create Profile" → auto-generates a **template About-Me bio** ("Let me describe myself in a few words. My persona reflects firmness as well as sensitivity...") pre-filled, editable (`08-about-me-step.png`) — not AI-personalized, a canned template.
- **Then** phone OTP verify (4-digit, 4 separate boxes, auto-advance, "Verify with FREE missed Call" fallback) — `09-verify-phone-otp.png`.
- Photo upload step with visual DO/DON'T examples (Close up/Half/Full view = ✓, Side face/Group/Unclear = ✗) + a Do's/Don'ts bullet list (`10-photo-upload-step.png`) — **no skip button visible**, but navigating directly to `/my-shaadi` bypassed it fine.
- **Login has no password by default** either — "Login with OTP" is a first-class button next to password login (`11-login-page.png`).

### Jeevansathi.com
- Landing → dedicated auth-choice screen: **Mobile / Google / Email**, clean 3-button card, no clutter (`02-register-page.png`).
- Mobile → 4-digit OTP (auto-submits on 4th digit, no manual "verify" click) → `03-mobile-entry.png`, `04-otp-entry.png`.
- Post-OTP: "Who is this profile for?" + gender (`05-register-step1.png`), then a **fork screen**: "Enter details manually" **OR "Upload Biodata (AI Autofill)"** — upload an existing PDF/scanned biodata and AI extracts+fills the form (`06-registration-option-ai-biodata.png`). **We chose manual** to see the baseline wizard.
- Manual path is a **true one-field-per-screen wizard** (name → DOB via native-feeling iOS-style scroll picker → email → city → height → marital status → qualification → degree (searchable, 140+ entries) → job sector → occupation (searchable, categorized by industry) → income → religion → caste (searchable, sub-gotra depth: "Khatri - Chopra", "Khatri - Malhotra", "Khatri - Kapur/Kapoor" etc., 80+ Khatri sub-gotras alone) → mother tongue (grouped North/West/South/East) → manglik status → father's work status+occupation → mother's work status → brothers count+married? → sisters count → living-with-family).
- Runs a **persistent progress bar with %** the whole time, grouped into named sections (ACCOUNT DETAILS → PERSONAL DETAILS → PROFESSIONAL DETAILS → SOCIAL DETAILS → FAMILY DETAILS → PHOTOS → BIO), visible at top throughout (`08-income-with-progress.png` shows 43%→99% across steps).
- Photo step: same visual DO/DON'T grid as Shaadi but **has an explicit "Skip" link**, and skipping triggers a confirm-dialog ("Profiles with photos get up to 90% more responses") before letting you proceed (`09-photo-upload.png`).
- Bio step: textbox + **"Need help? Use AI to write bio" button** — click it and it **actually generates a real bio from the collected profile data** ("I am Aman Verma, a 30-year-old software professional from Chandigarh. With a B.Tech degree and a passion for technology, I work in the private sector...") in an editable modal (`10-bio-step-ai-writer.png`, `11-ai-bio-generator-modal.png`). This is genuinely personalized, not a template.
- Finish → a **profile-preview card** ("Aman Verma, 30 · 5'9" · Chandigarh · Khatri · Software Professional · Rs 7.5-10 Lakh p.a. · B.E/B.Tech", "Just Joined" badge) exactly as others will see it, with "Team Jeevansathi wishes you all the best!" (`12-profile-finish.png`) — strong close-the-loop moment.

### TricityShadi (from code)
- Self-signup is **2 screens total**: Step 1 = smart identifier (email/phone auto-detect) + password + inline OTP verify + Terms; Step 2 = First/Last name + gender + DOB. Everything else (location, religion/caste, marital status, education/career, family, lifestyle, about-me, preferences, photos, verification) is deferred to **post-signup profile editing** — not part of onboarding at all (`OnboardingContext.jsx`, `CreateAccountStep.jsx`, `BasicInfoStep.jsx`).
- Caste is a **free-text optional field**, not a taxonomy (`ReligionStep.jsx`) — religion is a fixed 7-option dropdown.
- Photo: single required upload with a text-tips list (lighting, avoid filters, smile) — no visual DO/DON'T example images, no skip (it's required).
- No AI bio generation, no AI biodata-autofill-from-upload.

**Gap/opportunity:** Our signup is *faster* (2 screens vs their 6-12) which is good for conversion, but it also means a brand-new profile has almost no data — no location, no religion, no photo — when it first appears in search/matches. Both competitors force enough of the profile (religion, caste, education, income, photo) to be usable *before* the account is considered "done." Worth checking: does a TricityShadi profile with only name+gender+DOB show up in search/matches looking broken/empty? If dashboard nudges ("Add career details", "Upload photo") aren't strong enough, that's a silent quality gap.

---

## 2. Pricing (live numbers, both walked past the signup paywall to see real prices)

### Shaadi.com — shown immediately post-login, before the actual dashboard (`12-post-login-plans-wall.png`)
| Plan | Duration | Price (discounted) | Was | Per-month |
|---|---|---|---|---|
| Gold | 3 mo | ₹3,404 | ₹4,540 (25% off) | ₹1,135 |
| Gold Plus | 3 mo | ₹3,614 | ₹5,560 (35% off) | ₹1,205 |
| Diamond | 6 mo | ₹4,238 | ₹6,520 (35% off) | ₹707 |
| **Diamond Plus** (Top Seller) | 6 mo | ₹4,509 | ₹8,199 (45% off) | ₹752 |
| **Platinum Plus** (Best Value) | 12 mo | ₹5,986 | ₹13,304 (55% off) | ₹499 |

Plus a separate "VIPShaadi" elite/RM-managed tier (₹-undisclosed, "Book a FREE Consultation"). All plans include unlimited messages, view contact numbers (capped 50-200), Shaadi Live passes (worth ₹2,500-7,500), "Standout from other Profiles", "Let Matches contact you directly" — differences are mostly contact-view caps and freebies, not feature gates.

### Jeevansathi.com — shown immediately post-onboarding, before dashboard (`13-post-signup-pricing.png`)
Self-Service vs **Assisted** (RM-managed) toggle at the top. Self-Service feature matrix:
| Plan | Contact Details | Super Interest | Spotlights | Gold Badge |
|---|---|---|---|---|
| Pro | 25 | 0 | 0 | ✓ |
| **Pro Max** (preselected) | 50 | 50 | 1 | ✓ |
| **Pro Supreme** (Top Seller) | 80 | 80 | 3 | ✓ |

Duration for Pro Max: 1 month ₹976 (was ₹1,525), 3 months ₹2,441 (was ₹3,814), **Till Marriage** ₹7,453 (was ₹11,644) — flat 36% off banner. Notably the landing page itself (before signup) advertises **"Message & chat with unlimited users" as a FREE-tier feature** — and this held true live: the dashboard action row on every match card includes a working **"Chat" button even unauthenticated for premium**, with only "Contact Details" (phone/video call) gated (`18-dashboard-mymatches.png`, `19-profile-detail.png`: "Go Premium to contact matches — Initiate a voice or video call... by upgrading").

### TricityShadi (from `backend/utils/razorpay.js`)
| Plan | Price | Duration | Contact unlocks | Per-month equiv |
|---|---|---|---|---|
| free | ₹0 | — | 0 | — |
| basic_premium | ₹1,500 | 15 days | 5 | ~₹3,000 |
| premium_plus | ₹3,000 | 30 days | 10 | ₹3,000 |
| vip | ₹7,499 | 90 days | unlimited | ~₹2,500 |

Chat is **fully gated behind premium** (`chatRoutes.js` — entire router requires `requirePremium`), unlike Jeevansathi's free-chat model.

**Gap/opportunity:**
1. **Our per-month price (₹2,500-3,000) is 2-6x Shaadi's discounted per-month price (₹499-1,205)** and roughly 3x Jeevansathi's Pro Max (₹813-976/mo). Even against their *undiscounted* anchors we're not cheaper. This may be fine for a hyperlocal premium play, but it's worth a deliberate pricing decision rather than an accidental one — right now there's no local-market rationale documented for the multiple.
2. Both competitors' "36-55% OFF" banners appear to be **permanent, always-on anchor pricing** (a classic dark-pattern-adjacent tactic) — not something to copy verbatim, but the psychological framing (strikethrough "was" price) measurably works and we have none of it.
3. Jeevansathi's **free-chat / gate-only-contact-and-calls** model is a meaningfully different monetization shape than ours (gate-everything). Their landing page literally leads with "Now, chat for free!" as the hero headline — it's their #1 differentiator message. Worth deciding deliberately whether TricityShadi's full chat paywall is costing engagement/virality (free users who can't even message a mutual match may just churn) vs. the revenue it protects.
4. Both show the pricing wall as a **mandatory-feeling interstitial immediately after signup completes**, before the user ever sees a match. We should check whether TricityShadi does the same or drops users straight into an empty/sparse dashboard — first-session monetization exposure matters even if not gating access.

---

## 3. Dashboard & Matches Feed

- **Shaadi**: "Today's Matches" feed shown as a **single full-screen profile card carousel** (Tinder-style, one profile at a time, Prev/Next), not a scrolling list — and for a brand-new empty profile, most cards said "Member has kept her Profile hidden" (privacy-defaulted-off for new/low-quality profiles) (`13-dashboard-daily-recommendations.png`, `14-daily-match-profile-locked.png`). Counts shown: "New Matches (193)", "My Matches (3,206)", "Near Me (471)" — suspiciously large numbers for a same-day empty test profile, likely counting the entire eligible pool rather than actual curated matches; worth being skeptical of vanity-metric inflation as a pattern, not copying it. Contact details in every card are **blurred/masked** ("+91-789••••••", "•••@gmail.com") with an "Upgrade Now" overlay.
- **Jeevansathi**: **Real scrolling list**, real (non-blurred) profile photos even on free tier, each card shows online/active-status, height/city/caste, occupation+income, education+marital-status, and a 4-action row (Interest / Shortlist / Ignore / **Chat**) all clickable without a paywall (`18-dashboard-mymatches.png`). Some cards carry "Pro"/"Pro Max"/"Top Profiles" badges (other users' paid-tier boosting, visible to everyone) — a visible social-proof/FOMO mechanic for the viewer to also upgrade.
- Both dashboards run a **persistent upgrade-nudge sidebar/banner** on every authenticated page (not just a one-time interstitial) — Jeevansathi's right rail literally never goes away ("You are missing out on the premium benefits!").

**Gap/opportunity:** the reachable-photo policy differs sharply (Shaadi blurs everything pre-paywall, Jeevansathi shows real photos and gates only contact/calls). Confirm which model TricityShadi follows and whether it's a deliberate choice — showing real photos (Jeevansathi's approach) usually drives more engagement/virality since browsing itself feels rewarding, at the cost of some "why pay" pressure.

---

## 4. Search & Profile Detail

- **Shaadi search** (`15-search-page.png`, `16-search-results.png`): sidebar has ~18 filter categories (Verification Status, Photo Settings, Recently Joined, Active Members, Annual Income, Religion, Community, Mother Tongue, Country/State Living In, Country Grew Up In, Working With, Profession Area, Profile Managed By, Eating Habits, Education Level, Education Area). Result list interleaves **VIP-managed profiles** (concierge-run, "Connect Now"/"Call Consultant" CTAs) among organic results, and a mid-feed banner nudge ("Members with Photos get twice as many responses — Add Photo").
- **Jeevansathi profile detail** (`19-profile-detail.png`) is the standout artifact of this whole pass: sectioned About Me / Family / Looking For tabs; a Kundli & Astro block (Rashi, Nakshatra, DOB+time+place of birth, "Horoscope match is Must" flag, Download Horoscope); and — most notably — a **"Who is she looking for..." reverse-preference-match panel**: it takes HER stated partner preferences (height/age/marital-status/religion/mother-tongue/caste/city/country/education/income) and checks each one against the viewer's own profile with a **"You match 10/10 of her preference"** badge and a green-checkmark line-item list. This is a genuinely different, very legible trust/relevance signal that neither Shaadi nor (per code) TricityShadi has.

**Gap/opportunity:** TricityShadi's compatibility score (Ashtakoot 8-guna + numerology, weighted 20/100 for horoscope) is more sophisticated astrologically than either competitor's UI exposes, but neither competitor UI explains a numeric score the way we imply one might — the closer analogue worth stealing is Jeevansathi's **reverse-preference checklist**, which is simple, explainable, and directly answers "why is this person shown to me / would they even want me?" We have `preferredAge/Height/Education/Profession/City` fields on the Profile model already (`profileController.js`) — the data exists, the reverse-match UI does not. This looks like a cheap, high-clarity feature to add.

---

## 5. Summary — steal-worthy patterns not in TricityShadi today

1. **AI-personalized bio generator** (Jeevansathi) — uses already-collected onboarding fields (name, age, city, education, job, values) to draft a real first-person bio, editable before save. We collect enough profile data post-onboarding to do the same; this is an LLM-prompt problem, not new data collection.
2. **Reverse partner-preference match checklist** ("You match 10/10 of their preference") on profile detail — cheap to build, data already exists (`preferredAge/Height/...` fields), high clarity for the viewer.
3. **Visual DO/DON'T photo guide with example images** (both competitors) vs. our text-only tips list — likely reduces bad photo uploads and support/moderation load.
4. **Profile-completion progress bar with %** visible throughout onboarding (Jeevansathi) — ours has no visible progress indicator across the 2-screen flow (less needed at 2 screens, but if any post-signup profile-completion flow exists, a % bar there would help completion rates).
5. **Login-with-OTP as a first-class option next to password** (Shaadi) — reduces "forgot password" friction; confirm TricityShadi mobile has this (web CLAUDE.md doesn't mention it for web login).
6. **Biodata-upload-to-AI-autofill** (Jeevansathi) — higher effort, but matches a real user behavior (many Indian families already have a Word/PDF biodata document prepared before ever visiting a matrimony site); could be a genuine differentiator if AI-vision/parsing is already in the stack elsewhere.
7. Deliberate (not accidental) decision needed on: **chat paywall (all-gate vs. free-chat/paid-contact)** and **per-month price positioning** relative to competitor discounted rates — both are strategy calls, not pure engineering, flagged here for the business side rather than auto-implemented.

## Non-findings (checked, not present in either competitor, so no action needed)
- Neither competitor's UI exposes a numeric Ashtakoot guna score or full birth-chart visualization the way our `compatibility.js`/`kundli.js` PDF does — our astro depth is already ahead on substance, just not on reverse-match UX (see §4).
- Neither showed voice/video intro on profile cards during this pass (may be gated deeper than we reached) — not a confirmed gap.

---

## Screenshot index
`docs/competitor-research/shots/shaadi/` — 01 landing, 02-03 signup modal, 04-07 onboarding wizard, 08 about-me template bio, 09 OTP verify, 10 photo upload guide, 11 login (password/OTP), 12 pricing wall, 13 daily matches carousel, 14 locked profile card, 15 search filters, 16 search results grid, 17 profile detail (partial load).

`docs/competitor-research/shots/jeevansathi/` — 01 landing, 02 auth choice, 03-04 mobile+OTP, 05 relation/gender, 06 manual-vs-AI-biodata fork, 07 location, 08 income+progress-bar, 09 photo DO/DONT+skip, 10-11 AI bio writer, 12 finish/preview card, 13 pricing wall, 14-17 partner-preference wizard, 18 dashboard/matches feed, 19 profile detail (reverse-preference-match panel, kundli block).

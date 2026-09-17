# Legal & claims review — TricityMatch web

**Date:** 17 September 2026
**Branch reviewed:** `design/rework-2026-09` @ `5706cac`
**Scope:** the public website and the commercial surfaces behind it. Read-only — no source file was
modified by this review.
**Predecessor:** `docs/LEGAL_REVIEW_2026-08-26.md`. Section F below says what is still open from it.

---

## Read this first

**I am not a lawyer and this is not legal advice.** This is an engineering review: I compared every
claim the site publishes against what the code and configuration actually do, and I compared the
published documents against each other. Where I cite law I am pointing at the obligation a qualified
Indian lawyer should confirm, not giving an opinion on it. Findings marked 🧑‍⚖️ genuinely need a
lawyer; the rest are factual mismatches you can fix by reading the code and changing the words.

I have tried hard **not** to inflate copy preferences into legal exposure. Section E is the
deliberate list of things that look like findings and are not. If a fix costs money or reputation,
I have said which.

**Method:** claim-by-claim trace from the rendered page to the function that implements it. Every
finding below was verified against the code, not inferred from comments or docs — in three cases the
in-code comment describes behaviour the code no longer has.

---

## A. Untrue or unsupportable claims (live, commercial, urgent)

These are first because they are on a revenue-taking site with live Razorpay keys, and because under
the Consumer Protection Act, 2019 a false or misleading description of a service is actionable
whether or not anyone relied on it.

### A-1 🔴 Cancellation issues an automatic pro-rata refund that both published policies say you will not get — and on the only plan on sale it refunds almost everything while the member keeps every phone number

`backend/controllers/subscriptionController.js:839-924` · `backend/routes/subscriptionRoutes.js:144`

`DELETE /subscription/current` cancels and then **refunds the unused fraction of the term via
Razorpay, automatically**. The published position is the opposite:

- `frontend/src/pages/RefundPolicy.jsx:70-73` — "A membership runs for its full term and we do not
  refund the unused part of it — the same way a gym membership works."
- `frontend/src/pages/Terms.jsx:208` — "after that a membership runs its term".

Worse, the safeguard in that function is now inert. The comment at lines 875-885 explains that a
purely time-based refund let a buyer "spend every unlock on day 0 and cancel, returning ~99.7% of
the price while keeping the phone numbers and emails", and fixes it by also charging for unlocks
consumed. But line 886-890 exempts unlimited plans:

```js
const unlocksUnusedFraction =
  allowed === null || allowed === undefined || allowed <= 0 ? 1 : ...
```

The **single plan currently on sale** (`premium_plus`, `contactUnlocks: null`,
`backend/utils/launchOffer.js:74`) is exactly that case. So today: buy Premium at ₹1,099, unlock 25
contacts a day for ten days (250 phone numbers and emails, the rolling cap at
`backend/middlewares/auth.js:309` permits it), cancel, receive roughly 89% back. The attack the
comment says it closed is live again, on the only product you sell, because the meter it depends on
does not exist for that product.

Mitigating: no client calls the endpoint — it is reachable by an authenticated member with `curl`,
not from the UI. The pricing page nonetheless advertises **"Cancel anytime"** (A-2), which invites
the request.

**Consequence.** Commercially, an unbounded refund hole on the only SKU. Legally, two published
documents that describe the refund position incorrectly in the consumer's disfavour — if a member
cancels, gets a refund, and another is told "we do not refund the unused part", you are applying
different terms to different consumers with nothing in writing to justify it.

**Fix (code, not wording):** decide the position, then make the code and both pages agree. If you
keep the endpoint, apply the seven-day window to it and value consumed unlocks for unlimited plans
at the top-up rate (₹199/3 ⇒ ~₹66 each) rather than treating them as free. 🧑‍⚖️ worth a lawyer's eye
on whether a stated no-refund-after-7-days position is enforceable against a consumer at all.

### A-2 🔴 "100% privacy guaranteed · Cancel anytime" on the payment screen

`frontend/src/pages/Subscription.jsx:1052`

> All plans include SSL-secured payments via Razorpay · **100% privacy guaranteed** · **Cancel anytime**

- "100% privacy guaranteed" is an absolute warranty, and your own Privacy Policy expressly disclaims
  it: "No system is perfectly secure and we do not claim otherwise"
  (`frontend/src/pages/Privacy.jsx:176`). One of the two is wrong, and the one on the payment screen
  is the one a buyer sees at the moment of payment. After a breach this line is the first thing a
  complainant quotes.
- "Cancel anytime" means, to a consumer, "I can stop this and stop paying." Memberships do not
  renew, so there is nothing to stop; and per A-1 cancelling does something quite different from
  what either policy describes.

**Draft replacement:**

> Secure payments via Razorpay · One-time payment, no auto-renewal · Full refund within 7 days —
> see our [Refund Policy](/refund-policy)

### A-3 🔴 "Join thousands of families who trusted TricityMatch"

`frontend/src/pages/Home.jsx:1328`

Production held 15 users at the last measurement (`docs/` audit history, 25 Aug). This is a
quantified social-proof claim with no basis, in the closing CTA. It is the same species as the
"First month Premium free for Chandigarh residents" line already removed today, and it is
straightforwardly a misleading representation under CPA s.2(28).

**Draft replacement:** *"Start where the families you'd actually meet are already looking. Free to
start."* — or any line that does not count members you do not have.

### A-4 🔴 Help Centre says deletion is permanent within 7 days; the Privacy Policy says 180 days; the code does it instantly

`frontend/src/pages/Help.jsx:101` · `frontend/src/pages/Privacy.jsx:187` ·
`frontend/src/pages/Terms.jsx:248` · `frontend/src/pages/DeleteAccount.jsx:69-74` ·
`backend/utils/accountErasure.js:125-152`

Four published statements, three different answers, none matching the code:

| Source | Says |
|---|---|
| Help.jsx:101 | "removed permanently **within 7 days**, as described in our Privacy Policy" |
| Privacy.jsx:187 | "Registration information is held for **180 days** after deletion, because rule 3(1)(h) of the IT Rules, 2021 requires it" |
| Terms.jsx:248 | same 180-day commitment |
| DeleteAccount.jsx:70 | "permanently purged **within a reasonable period**" |
| `eraseAccount()` | **immediate** — the email is overwritten with `deleted-<uuid>@deleted.invalid` and the phone is set to NULL inside the same transaction |

Two separate problems. (i) The Help answer attributes to the Privacy Policy something the Privacy
Policy does not say — that alone is a false statement about your own document. (ii) The 26 August
rewrite published an affirmative 180-day retention commitment that the code contradicts *in the
opposite direction*: you under-retain. Under-retention is a weak position to be in if you ever need
to argue s.79 safe harbour, but the sharper issue here is that you are publishing a retention
period you do not operate.

**Fix:** pick one. The cheapest honest version is to implement the 180-day registration tombstone
(prior review item #8, still open) and correct Help.jsx to match; the cheapest version full stop is
to change Privacy §13 and Terms cl.20 to describe immediate erasure and drop the rule 3(1)(h)
sentence. 🧑‍⚖️ which of those is right is a lawyer's call, because it turns on whether r.3(1)(h)
retention is a duty you are currently breaching.

**Draft for Help.jsx:101 (if you keep the 180-day model):**

> Settings → Account → Delete Account, or use the delete-account page. Your profile disappears from
> search immediately and your profile, photos, verification selfie, messages, matches and guardian
> links are erased at once. We keep your registration details (email or mobile number) for 180 days
> because the IT Rules require it, and payment records for as long as tax law requires. Section 13
> of our Privacy Policy sets out exactly what survives and why.

### A-5 🔴 "Every email of this kind carries an unsubscribe link" — no unsubscribe exists anywhere in the codebase

`frontend/src/pages/Privacy.jsx:149` (and the withdrawal claim at `:204`)

A full-tree search for `unsubscribe|optOut|emailPreferences|marketingOptIn` across `backend/`,
`frontend/src` and `mobile/src` returns **two hits, both of them the Privacy Policy claiming it
exists**. There is no unsubscribe link in `backend/utils/email.js`, no suppression list, no email
preference setting. Meanwhile the 25 August pass added abandoned-checkout, renewal, expiry, win-back
and no-photo-nudge mail.

This is both a false published statement and a live DPDP problem: s.6(4)/(6) require withdrawing
consent to be **as easy as giving it**, and giving it was one tick. Today withdrawal means deleting
your account. This was P-5 in the August review and was recorded as closed; the policy text changed,
the product did not.

**Fix:** either build a one-click unsubscribe (a signed token → a preference row → checked by
`utils/queue.js` before lifecycle sends) or delete the sentence and say plainly that non-service
mail can be stopped by writing to `privacy@`. The first is a day's work and is the only version that
actually satisfies s.6(4).

### A-6 🟠 "Unlimited contact unlocks" is capped at 25 per rolling 24 hours, disclosed nowhere

`backend/middlewares/auth.js:304-322` · `backend/config/env.js:377` · claimed at
`frontend/src/pages/Home.jsx:394` and on every Premium card

`UNLIMITED_DAILY_UNLOCK_CAP` (default 25) is a good anti-harvesting control and should stay. But it
is a material limitation on the single characteristic the product is sold on, it appears in no
policy, no plan card, no Terms clause and no Help answer, and a member meets it only as a 403.
Terms cl.12 (`Terms.jsx:198`) says "A membership grants the contact-unlock allowance stated at
checkout" — the stated allowance is "unlimited", and it is not.

**Draft, add to Terms cl.12 and to the Premium card's fine print:**

> Unlimited plans are subject to a fair-use ceiling of 25 contact unlocks in any rolling 24-hour
> period. It exists to stop bulk harvesting of members' phone numbers and no genuine member reaches
> it.

### A-7 🟠 "Founding members get full membership free until [window deadline]" overstates the free period, roughly two-fold

`frontend/src/pages/Home.jsx:668` with `foundingEndsLabel` from
`frontend/src/hooks/useFoundingWindow.js` ← `GET /subscription/plans` →
`backend/controllers/subscriptionController.js:658-663`

`founding.endsAt` is the date the **offer closes to new joiners** (auto-seeded 18 Nov 2026).
`founding.grantDays` (30) is the **length of each member's grant**, clamped to that deadline. The
sentence renders the former as the latter, so someone joining today reads "free until 18 November"
and receives 30 days. The band directly above it (`:444`) gets this right by using `grantDays` —
only the long-form paragraph is wrong.

**Draft:** *"Founding members get {grantDays} days of full membership free — including {n} contact
unlocks — if you join before {endsAt}."*

### A-8 🟠 "Prices return to normal on [date]" / "Where an offer has an end date, that date is real"

`frontend/src/pages/Subscription.jsx:581` · `frontend/src/pages/Terms.jsx:199`

The deadline being rendered is the auto-seeded default (`DEFAULT_WINDOW_DAYS = 90`,
`launchOffer.js:37`), not a date anyone chose — this is still an open owner item from the August
review and from `docs/PRICING_LAUNCH_2026-08-20.md`. Terms cl.199 then makes an affirmative promise
that the date is real. If prices do not in fact return to ₹2,499 on that day, this is **false
urgency**, which is one of the thirteen named practices in the CCPA Guidelines for Prevention and
Regulation of Dark Patterns, 2023 — and it is the one this product is most exposed to.

**Fix is not textual:** set a date in Admin → Pricing & Offers that you will honour, or clear the
deadline so neither line renders.

### A-9 🟠 "Every profile has been seen by a person" / "A real safety team reviews profiles"

`frontend/src/pages/Home.jsx:692` · `frontend/src/pages/About.jsx:27`

Nothing pre-reviews profiles. Human review happens for **verification selfies** (an opt-in minority)
and for **reported** profiles. On a matrimonial site this is a safety claim families act on, and
Terms cl.6 says the opposite in as many words: "**We do not screen members, and we cannot.**" A
published document contradicting a landing-page safety claim is the shape of dispute you least want.

**Draft:** Home:692 → *["Verified, not vast", "A smaller circle, where the verified badge is earned
in front of a person — not assumed."]*; About:27 → *"A person — not an algorithm — reviews every
verification selfie and every report."*

### A-10 🟠 "We never display you to non-mutual interests"

`frontend/src/pages/Home.jsx:395`

Untrue by default. A profile is visible to every logged-in member in search unless the member sets
`profileVisibility = matches_only`, exactly as the Privacy Policy correctly describes at
`Privacy.jsx:112-119`. This is a privacy claim on the landing page contradicting the privacy policy.

**Draft:** *"Yes. Conversations are encrypted in transit and readable only by you and your match. We
never share your phone number and never sell data, and you can set your profile to be visible only
to your matches."*

### A-11 🟠 "Photo blur stays on for members you have not matched with"

`frontend/src/pages/Help.jsx:39` vs `backend/models/Profile.js:333-335` —
`photoBlurUntilMatch` defaults to **false**.

Stated as a standing protection; it is an opt-in setting that is off unless the member finds it.
Members — in practice, women and their parents — will act on this belief. Of everything in section
A this is the one most likely to cause an actual complaint that matters.

**Draft:** *"…and you can turn on photo blur so members you have not matched with see a blurred
photo. It is off by default — switch it on under Settings → Privacy."*

### A-12 🟠 "Preview a small selection without an account"

`frontend/src/pages/Home.jsx:392`, and the "Browse profiles" CTA at `:1350`

`/search` is behind `ProtectedRoute` (`frontend/src/App.jsx:283-289`). There is no logged-out
browse of any kind; the CTA bounces to login. Minor as law, real as a broken promise at the top of
the funnel.

### A-13 🟡 Three different, all-unsupported response-time commitments

| Claim | Where |
|---|---|
| "Verified in hours" ×3 | `Home.jsx:270, 533, 1353` |
| "usually within 24–48 hours" (verification) | `Help.jsx:35` |
| "Reports are reviewed … within 24 hours" | `Safety.jsx:47`, `Help.jsx:97` |
| "Our team responds within 24 hours" | `Safety.jsx:117`, `Home.jsx:1254` |
| "We reply within two working days" | `Terms.jsx:266`, `RefundPolicy.jsx:98-99` |

A one-person review team cannot hold a 24-hour SLA across verification, reports and support, and the
Terms already publish the weaker, keepable commitment. Under the E-Commerce Rules a published
grievance timeline is a representation. Pick **one** number per channel and make Terms cl.23 the
source the others quote. Suggested: verification "usually within two working days", reports
"acknowledged within 24 hours, decided within 15 days" (which is what Terms cl.9 already says and
what the IT Rules require), support "within two working days".

### A-14 🟡 "40+ signals" (twice)

`frontend/src/pages/Home.jsx:378, 401`

`backend/utils/compatibility.js:340-440` scores roughly a dozen factors (age, city, state, height,
religion, education, diet, smoking, drinking, Ashtakoot, Manglik, rashi, interests) plus about five
preference checks. Counting every input generously gets nowhere near 40. Low legal risk — but it is
a quantified, checkable claim with no basis, which is precisely the class you asked me to hunt.
Say "a dozen signals families actually weigh" and it is both true and better copy.

### A-15 🟡 "Claim my free month" when the grant is `grantDays` days

`frontend/src/pages/Subscription.jsx:641`. The paragraph above it correctly renders `days`; only the
button hardcodes "month". Breaks the moment an admin sets 14 or 45 days.

### A-16 🟡 Founding band omits the cap

`frontend/src/pages/Home.jsx:444` — "open to all Tricity members" with no mention that it is the
first 500 (`launchOffer.js:110`). Add "for the first 500 members"; it is truthful *and* it is the
scarcity you actually have.

### A-17 🟡 Latent: a re-enabled VIP tier sells a "verified badge"

`backend/utils/razorpay.js:111, 130` — `vip` and `nri` list `verified_badge` as a plan feature.
Nothing consumes that flag today and both tiers are withdrawn, so nothing is wrong right now. But
the tiers are one admin toggle from visible, and the moment they are, the site sells the badge that
Terms cl.6, Safety, About and Home all describe as earned by human review. Delete the flag from
both plans rather than rely on the toggle staying off.

### A-18 🟡 Dead hardcoded price ladder still in the tree

`frontend/src/config/index.js:144-191` — `subscriptionPlans` with `premium ₹2,999` and
`elite ₹4,999`, neither sold, plus "10 likes per day" limits that are not the product. Currently
exported and referenced by nothing. This is the exact shape of the upgrade-modal bug fixed this
morning; it is one careless import from being live. Delete it.

### A-19 🟡 A real couple's success story can render with a stock photograph of a different couple

`frontend/src/pages/Home.jsx:1200` with the fallback at the story mapper —
`img: s.photoUrl || '/images/landing/story-meera-vikram.jpg'`.

Stories only render when the API returns published ones, so this is a real, named, consenting couple
being illustrated with a picture of someone else. Render no image instead.

---

## B. DPDP gaps

### B-1 🔴 Consent is one bundled tick covering everything, including sensitive categories

`frontend/src/components/onboarding/steps/CreateAccountStep.jsx:229-243, 378-380` →
`backend/controllers/authController.js:255-259`

A single checkbox — "I agree to the Terms & Conditions and Privacy Policy" — is the entire consent
event. It covers, indivisibly: acceptance of a contract, processing of caste, religion, horoscope,
income and photographs, and (per Privacy §7) lifecycle and digest mail.

DPDP s.6(1) requires consent that is "free, **specific**, informed, unconditional and unambiguous …
signifying agreement to the processing **for the specified purpose**", and s.5 requires an itemised
notice to accompany or precede the request. A link to a 17-section policy opening in a new tab is
not an itemised notice presented with the request, and one tick for many purposes is the definition
of un-specific.

**Fix that is proportionate for a platform this size:** keep the one contractual tick, and add a
short standalone notice block above it — not a link — naming the categories and purposes, plus a
**separate, unticked** optional consent for non-service mail. Draft:

> **What we will do with your information.** We use your profile details — including religion,
> caste, horoscope details and photographs where you choose to give them — to show your profile to
> other members and to suggest matches. We use your email and mobile number to sign you in, send
> one-time passcodes and security alerts, and to tell you about matches and messages. We never sell
> your data and never use it for advertising. You can see, correct, export or erase it at any time,
> and you can delete your account yourself. Full detail: [Privacy Policy](/privacy).
>
> ☐ I agree to the Terms & Conditions and Privacy Policy. *(required)*
> ☐ Send me match suggestions, weekly digests and occasional updates by email. *(optional — you can
> turn this off any time)*

🧑‍⚖️ A lawyer should confirm whether your matching purpose can rest on consent alone or whether the
"legitimate uses" limb in s.7 carries part of it — that choice changes what withdrawal has to do.

### B-2 🔴 The selfie is collected with no notice at the point of collection

`frontend/src/pages/Verification.jsx:107-170` · `frontend/src/components/verification/LiveSelfieCapture.jsx`

The verification screen explains the mechanics well and even says the selfie is never shown to other
members — but it does not say **who reviews it, how long it is kept, what it is not used for, or
that you can withdraw**, and it does not link the Privacy Policy. Privacy §9 says all the right
things; the member never sees §9 at the moment they point a camera at their own face. DPDP s.5
wants the notice with the request.

**Draft, as a panel directly above the capture control:**

> **Before you take this selfie.** One of our reviewers will compare it by hand against the photos
> on your profile, and record only the result. It is never shown to other members, never used for
> advertising or to train any model, and is deleted when your account is deleted. Verification is
> optional — you can keep using TricityMatch without a badge, and you can ask us to delete the
> selfie at any time at privacy@tricitymatch.com. [How we handle your data](/privacy)

### B-3 🟠 No Grievance Officer is named, no legal entity, no address — the statutory disclosures are configured but empty

`frontend/src/config/index.js:86-104` · `.env.production.example:174-178`

`VITE_LEGAL_ENTITY`, `VITE_LEGAL_ADDRESS`, `VITE_LEGAL_GSTIN` and `VITE_GRIEVANCE_OFFICER` are all
blank in the production example, and `VITE_PRIVACY_EMAIL` / `VITE_DPO_NAME` are not in the file at
all. Because `Terms.jsx:67` gates the whole operator block on `legal.address`, the live site
publishes **no registered name and no head-office address anywhere**, and names no Grievance Officer
— only a `grievance@` mailbox which (per the August review and the memory record) still has **no
inbound routing**, i.e. it bounces.

The omit-rather-than-fabricate doctrine is right and I would not change it. But this is three
distinct statutory disclosures absent — E-Commerce Rules r.4(3)/5(3) (legal name, address, grievance
officer name **and designation**), IT Rules r.3(2)(a) (officer by name), DPDP Rules r.14(3) (data
contact). Prior review items 1-3, unchanged.

**Owner action, not code:** these are facts only you hold. Until they exist the pages are legible
but non-compliant, and `grievance@`/`privacy@` are worse than absent because they are asserted in
two policies and on two app stores while bouncing.

### B-4 🟠 The 180-day registration retention is published and not implemented

See A-4. `eraseAccount()` destroys the email and phone immediately.

### B-5 🟠 `TERMS_VERSION` is genuinely in lockstep, but drives nothing

`backend/constants/legal.js:10` (`'2026-08-26'`) · `frontend/src/config/index.js:101-102`
(`'26 August 2026'`) · `mobile/src/constants/config.ts:58` (`'26 August 2026'`).

All three agree today — the lockstep claim in CLAUDE.md is accurate. But `termsVersion` is written
**only at account creation** (`authController.js:258` and `:1035`) and **nothing anywhere compares a
logged-in member's stored version against the current one**. Bumping the constant re-consents
nobody; it changes the string stamped on tomorrow's signups. So the consent *record* exists (good,
and it closes prior item #11) while the re-consent *mechanism* does not.

Nothing enforces the lockstep either — three hand-maintained constants in three languages, with no
test. Two cheap fixes: a unit test asserting the three strings match, and a check on `/auth/me` that
returns `needsReconsent` when `user.termsVersion !== TERMS_VERSION` so the client can show a short
"we've updated our Terms" acceptance. The second is what Terms cl.21 already promises.

### B-6 🟠 Annual re-notification is promised twice and does not exist

`Terms.jsx:165, 253` · `Privacy.jsx:229`. IT Rules r.3(1)(c)/(f). Prior item #7, unchanged. The
lifecycle-mail machinery added on 25 August can carry it in an afternoon.

### B-7 🟡 Age gate does not enforce the age the Terms publish

`backend/validators/index.js:91-99` rejects under-18 for everyone. `Terms.jsx:90` and
`Privacy.jsx:224` publish 21-for-men / 18-for-women per the Prohibition of Child Marriage Act, 2006.
A 19-year-old man can register today against a published rule saying he cannot. Prior item #6,
unchanged, and it is the one place where publishing a rule you do not enforce sits next to a
criminal statute. 🧑‍⚖️ — whether a matrimonial intermediary must enforce marriageable age or merely
state it is exactly the kind of question worth one hour of counsel's time.

### B-8 🟡 Guardian-created candidates are still never notified

Terms cl.5 requires the guardian to have the candidate's consent; nothing verifies it and the
candidate receives no notice. Prior item #12, unchanged. In a matrimonial context the person being
listed is often the last to know, and DPDP gives them rights they cannot exercise over a profile
they do not know exists. A single "a profile has been created for you — here is how to take control
of it" email at creation would close it.

---

## C. Missing or weak clauses

- **C-1 🟠 The checkout screen links neither the Refund Policy nor the Terms.** A search of
  `Subscription.jsx` returns no `/refund-policy`, `/terms` or `/privacy` link anywhere on the page,
  and no pre-purchase acknowledgment. The E-Commerce Rules expect the refund/cancellation policy to
  be displayed by the seller before purchase; right now the only route to it is the site footer.
  Add a line under the pay button: *"One-time payment, no auto-renewal. Full refund within 7 days —
  [Refund Policy](/refund-policy) · [Terms](/terms)."* Cheapest high-value fix in this document.
- **C-2 🟠 The refund formula produces a negative refund on the plan you sell.**
  `RefundPolicy.jsx:63-66` deducts consumed unlocks "at ₹199 for three". On the unlimited ₹1,099
  plan a member who unlocked 30 contacts inside the seven days owes ₹1,990 against ₹1,099 paid. The
  clause was written for finite tiers and was not re-termed when the ladder collapsed to one
  unlimited plan. Cap the deduction at the amount paid and say so.
- **C-3 🟡 The Safety page carries no "we do not screen members" line.** Terms cl.6 has it; the page
  a worried parent actually reads leads with "We do the groundwork on verification and privacy"
  (`Safety.jsx:70`). Add one sentence: *"A verified badge confirms a real person is behind the
  profile. It is not a background, income, employment or marital-status check — please make your own
  enquiries."*
- **C-4 🟡 No wind-down commitment.** Prior item #13, unchanged. Shaadi refunds 50% of the unused
  term pro-rata if it ceases operating. For a platform selling 90-day memberships to families who
  have never heard of you, one sentence here materially reduces perceived risk and costs nothing
  while you are trading.
- **C-5 🟡 Chat retention still undefined.** Prior item #10, unchanged. Messages are kept forever and
  Privacy §13 does not state a window.
- **C-6 🟡 `DeleteAccount.jsx` drifts from the Privacy Policy** and hardcodes
  `support@tricitymatch.com` (`:53`) rather than reading `config.support`. It also has no dark-mode
  classes, so it renders white-on-white for dark-theme users — cosmetic, but it is a Play Store
  compliance URL.

**Clauses that are genuinely present and competent** (do not pay anyone to re-draft these):
governing law with a consumer carve-out naming NCH 1915 and e-Daakhil (cl.22); liability cap at
twelve months' fees with a ₹1,000 floor and fraud/consumer carve-outs (cl.18); indemnity (cl.19);
severability, assignment, entire agreement, force majeure (cl.24); the r.3(1)(b) prohibited-content
list verbatim in substance (cl.8); the content licence, correctly narrowed to what you actually do
and explicitly non-perpetual and non-sublicensable (cl.10); the dowry clause (cl.7); the
matrimonial-purpose-only declaration (cl.3). That is a better Terms than most platforms this size
have, and the August pass deserves the credit.

---

## D. AI-generated imagery on the landing page

**Current state (as I read the tree):** `frontend/public/images/landing/` holds five
`profile-*.jpg`, three `story-*.jpg` and three `city-*.jpg`. No disclosure text exists anywhere in
`Home.jsx`, `Terms.jsx` or `Privacy.jsx`. A visible on-page disclosure is reportedly being added by
another agent right now; this section assesses what that disclosure needs to cover and whether the
legal documents should carry a line too.

**My assessment: the imagery is the smaller half of the problem.** The larger half is what surrounds
it. `Home.jsx:368-374` defines five people with full names, exact ages, cities, employers and
qualifications — "Priya Sharma, 28, Mohali, MBA · IIM", "Anjali Nair, 29, Panchkula, Doctor · AIIMS"
— each with a compatibility percentage (97%, 95%, 93%) and, at `:852`, a **"✦ Verified" badge**
rendered over the card. `:595` puts "97%" over the hero photograph. A reasonable visitor reads that
as five real, verified members with real match scores. On a matrimonial site, where "verified" is
the trust primitive you sell and the whole page argues that badges are earned by human review, a
fabricated verified badge over a synthetic face is the single sharpest honesty risk on the site — it
undermines the one claim everything else rests on.

Note also that the pages are honest elsewhere in exactly this way: the "just matched" ticker was
removed with the comment "it showed fabricated couples as real activity" (`Home.jsx:310`) and the
testimonial section stays hidden until real stories exist (`:1241`). The profile carousel is the
inconsistency.

**Recommendations, in priority order:**

1. **Drop the "✦ Verified" badge and the match percentages from the illustrative cards.** They are
   what converts "a picture" into "a claim". The cards still work as design.
2. **Use first names only, or clearly invented ones.** "Priya Sharma, 28, Mohali, MBA · IIM" is
   specific enough that a real person matching it is identifiable in a city of that size — a
   separate and avoidable exposure.
3. **Keep the visible on-page disclosure**, placed with the images and not in a footer. Draft:

   > Profiles and photographs shown here are illustrative and AI-generated. They are not members of
   > TricityMatch.

4. **Yes, add a line to the Terms**, because the on-page disclosure will be removed the day real
   photography replaces it and the Terms line is the durable record. Draft, as a new sentence in
   Terms cl.11 (Our intellectual property) or a short cl.25:

   > **Illustrative imagery.** Photographs, names and profile examples shown on our marketing pages
   > are illustrative and may be computer-generated. They do not depict members of TricityMatch and
   > no likeness to any real person is intended. Member profiles inside the Service are created by
   > members themselves, and the verified badge is only ever awarded on the basis of a live selfie
   > reviewed by a person.

   The Privacy Policy needs **nothing** — no personal data is processed by a synthetic image, and
   adding a line there would imply otherwise.

5. 🧑‍⚖️ **Worth asking counsel**, briefly: whether an AI-generated image on a marketing page needs a
   disclosure at all under Indian law today is unsettled, but the IT Rules' misinformation limb
   (r.3(1)(b)(v), "patently false or misleading in nature") and the CPA's misleading-advertisement
   provisions both plausibly reach a synthetic person carrying a trust badge on a commercial page.
   The disclosure above is cheap insurance either way; I would not spend more than an hour of
   counsel's time on it.

---

## E. Things that look like findings and are not — do not spend money here

- **"Higher ranking in search results" for verified members** (`Verification.jsx:120`) — **true**.
  `searchController.js:381` adds +8 to a verified profile's sort score, and the "Verified only"
  filter at `:212` exists. Good, checkable claim.
- **"Memberships do not auto-renew"** (`Terms.jsx:197`) and "no surprise renewals"
  (`About.jsx:26`) — true; the Razorpay flow creates one-time orders with no mandate. This is a
  genuine differentiator and the subscription-trap dark pattern does not apply to you.
- **"We never see or store your card, UPI or bank credentials"** — true; Razorpay-hosted checkout.
- **"Encrypted in transit"** — carefully worded and correct. Note it is *not* end-to-end, and the
  copy nowhere claims it is. Good discipline.
- **"We do not record calls"** (`Privacy.jsx:79`) — consistent with Agora usage and the CallSession
  model storing metadata only.
- **`badge: 'Recommended'` instead of "Most Popular"** (`razorpay.js:62-64`) — an editorial claim
  substituted for a social-proof claim you cannot support. Exactly right.
- **The omit-never-fabricate doctrine** for support and legal config — right, and it is what stops
  this being much worse. Keep it.
- **The launch-offer overlay being the single resolved price read** — charged price, displayed price
  and the tenure written to the Subscription row cannot drift. That is a real control and it is why
  there are no price-mismatch findings in this review.
- **Selfie-only verification, no Aadhaar, no government ID** — on the right side of *Puttaswamy* and
  of the 2016 MeitY advisory's tension with it. Do not "improve" it by adding ID collection.
- **Dark-mode gaps on About / Safety / Help / DeleteAccount** — a design defect, not a legal one. I
  mention it once and drop it.

---

## F. Status of the 26 August 2026 review

| Item | Then | Now |
|---|---|---|
| T-1 … T-15 (Terms) | open | **closed** — cl.1-24 address all fifteen; the drafting is sound |
| P-1 … P-14 (Privacy) | open | **closed in text**; P-1 and P-5 have since become *false* statements because the code did not follow (A-4, A-5) |
| Owner 1: legal entity + address | open | **still open** — blank in `.env.production.example`, so no address renders at all |
| Owner 2: name a Grievance Officer | open | **still open** |
| Owner 3: a mailbox behind grievance@/privacy@ | open | **still open** — both asserted in two policies and on two app stores, neither has inbound routing |
| Owner 4: GSTIN / tax-inclusive | open | **still open**, and Terms cl.12 now affirmatively states prices include GST and that a tax invoice is available |
| Owner 5: set a real offer deadline | open | **still open** — now with Terms cl.12 promising the date is real (A-8) |
| Code 6: gender-aware age gate | open | **still open** (B-7) |
| Code 7: annual re-notification | open | **still open** (B-6) |
| Code 8: 180-day registration retention | open | **still open**, and now published as fact (A-4) |
| Code 9: CERT-In log retention in India | open | not re-verified in this pass |
| Code 10: chat retention | open | **still open** (C-5) |
| Code 11: in-product consent record | open | **closed** — `Users.termsAcceptedAt` / `termsVersion`, migration 000062. The re-consent *trigger* it implies does not exist (B-5) |
| Code 12: guardian notice to candidate | open | **still open** (B-8) |
| Code 13: wind-down promise | open | **still open** (C-4) |

**Newly introduced since August:** A-1 (unlimited-plan refund hole, a consequence of the 22 August
single-plan collapse meeting a safeguard written for finite tiers), A-6 (same cause), A-7, C-2.

---

## G. What I would do first

1. **A-1** — the refund endpoint. It is the only finding here that can cost real money this week.
2. **A-2, A-3, A-9, A-10, A-11** — five sentences. An hour's work, and they are the claims a
   regulator or an angry member would quote back at you.
3. **A-4 and A-5** — decide the deletion story, build the unsubscribe. Both are published promises
   with no implementation.
4. **C-1** — put the refund policy on the checkout screen.
5. **B-3** — supply the entity name, address and a named Grievance Officer, and give
   `grievance@`/`privacy@` an inbox somebody reads. Nothing in code can substitute for these.
6. Then, and only then, buy an hour of an Indian lawyer's time for the four 🧑‍⚖️ questions: the age
   gate (B-7), the deletion/retention position (A-4), whether consent or legitimate use carries
   matching (B-1), and the AI-imagery disclosure (D-5). Everything else in this document you can fix
   by reading the code and changing the words.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the member, 25 to 32, in the Tricity.** Phone-first, bilingual (English with Hindi
or Punjabi at home), on a mid-range Android as often as an iPhone. They are looking for marriage,
not dating, and they are doing it partly because their family has started asking. They have seen
Shaadi and Jeevansathi and found them loud, inflated and aimed at their parents' generation.

**Secondary, and not the target of the landing page: the parent or guardian, 50 to 70.** Often
the one who pays and frequently the one who decides. Reached through Guardian access, the family
chat channel and elder mode. Landing-page decision, 2026-09-22: design member-first and sound
member-first, but the parent must never be repelled or locked out. Elder mode keeps working, hit
targets stay large, and no affordance may exist only in hover.

**Third: the NRI with Tricity roots.** Lives abroad, family is here, searching for an alliance in
the region. Declares NRI status at sign-up.

## Product Purpose

A matrimonial service for Chandigarh, Mohali and Panchkula only. Members create a profile, earn a
photo-verified badge from a live selfie reviewed by a person, get ranked matches across 40-plus
compatibility signals including Vedic Ashtakoot, talk privately, and bring family in when they
choose. Success is a member who meets someone in person, locally, with both families comfortable.

Commercially: a single paid plan (currently ₹1,099 for 90 days, unlimited contact unlocks) plus
contact-unlock bundles. Everything else, including browsing, matching and reading every message
received, is free.

## Positioning

**Hyperlocal and deliberately small.** Three cities, every match close enough for both families to
meet this week. The competition sells scale ("4 crore profiles"); we sell the opposite and cannot
be truthfully copied on it by a national player, because their business depends on the number they
publish.

**Verification is earned in front of a person, not uploaded.** The badge comes from a live selfie
captured in the moment through the camera, never a file, matched against the profile photos by a
human reviewer. Govt-ID collection was deliberately removed (2026-07-02) and background checks
were removed (2026-07-07): we are not a state authority and will not act like one.

**Free members can read and reply.** Every message is free to read, and when a premium match
writes first the free member gets five replies over 48 hours. Jeevansathi withdrew free chat in
2026; this is now more generous than theirs and is currently invisible to logged-out visitors.

## Operating Context

Decisions get made across two phones and a living room. A member browses privately, then shows a
shortlist to a parent, who wants to see the horoscope match and the family details before anyone
speaks. Guardian access and the separate family chat channel exist because that conversation was
happening anyway, off-platform, in WhatsApp.

Traffic is roughly half touch. Hindi and Punjabi copy runs 20 to 30 percent longer than English
and must not wrap a control onto a second line.

## Capabilities and Constraints

Shipped and real: live-selfie verification with a human review queue; Vedic Ashtakoot compatibility
with the 8-guna breakdown, Manglik and numerology, downloadable as a Kundli match PDF; 40-plus
signal ranking with daily refresh; incognito browsing; encrypted-in-transit chat with the free
reply window; family group chat; Guardian access; saved searches; a free biodata PDF; profile
boost and spotlight on the paid plan; a seven-day refund, less consumed unlocks.

Constraints: React 18.2 (React 19 blocked by the RN workspace), Tailwind 3.4.19, framer-motion 12,
`react-icons/fi` as the single icon family, no GSAP. Light, dark and elder modes all ship and all
three must hold. `docs/design-handoff/DOCTRINE_2026-09.md` is binding, confirmed 2026-09-22: no
scroll-hijack, no pinning, no scrubbed scroll, no idle loops, no hover-only affordances.

## Brand Commitments

Name TricityMatch. Wordmark is the red serif TM monogram (`#B30021`), which is the mark's own
colour and not the UI palette. UI accent is burgundy `#8B2346`, accent only, never a flat fill
across a large region. Gold `#C9A227` is premium-only. Playfair Display for h1 to h3, Inter for
everything else, and no third family. Radius 12px for controls, 16px for large containers.

Voice: plain, specific, unhurried, and never inflated. We publish no size numbers because ours
are small and saying so is the position.

## Evidence on Hand

**Real:** the product itself, every screen of it, including the guna table, the compatibility
breakdown, the live-selfie capture frame and the chat free-reply meter. Two published success
stories (`GET /success-stories`, real couples, consented, one without a photograph). Live pricing
and the founding-window state from `/subscription/plans`. A published refund policy.

**Not real, and must never be presented as real:** the five portrait images and three cityscapes
under `frontend/public/images/landing/`, which are AI-generated. They are ambient art direction
only, declared in `frontend/src/data/editorialImages.js`, and they carry a visible disclosure. No
name, age, city, quote, verified tick or match percentage is ever composited onto one.

**Absent, confirmed 2026-09-22:** we have no real member photographs with written consent and we
are not publishing member counts. Neither may be fabricated to fill a layout.

**Commissioned, not yet delivered:** real Chandigarh, Mohali and Panchkula photography. The AI
cityscapes stand in behind the existing manifest until it arrives, so the swap is one commit.

## Product Principles

1. **Never inflate.** No invented members, no fabricated counts, no permanent discount, no
   manufactured urgency. Where we lack a number, we state a process instead.
2. **Small is the product, not an apology.** Three cities and a short list is the offer.
3. **Show the mechanism.** Where a claim exists, the real interface that delivers it is better
   evidence than an adjective, and it is evidence nobody else in the category shows pre-auth.
4. **The member decides when family arrives.** Family features are opt-in, separate, and never
   surveil the member.
5. **Trust outranks cleverness.** An interface that looks clever at the expense of looking
   trustworthy has failed, on a decision this size.

## Accessibility & Inclusion

WCAG AA on real surfaces, measured, including text over photography. Elder mode (`html.elder`,
18.5px base, 48px targets) is a shipped product feature, not a preference. `prefers-reduced-motion`
means fewer and gentler, not zero, and scroll reveals settle immediately under it. Hit targets 44px,
48px in elder mode. Keyboard path complete, focus-visible never removed. Three languages, with
Devanagari and Gurmukhi coverage required of any type decision.

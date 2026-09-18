# Redesign Implementation Progress

Recreation of the `docs/design-handoff/` hifi mockups into `frontend/` React.
Source of truth: `Design System.html` + `README.md` (this folder).
**Status: COMPLETE (2026-06-23).** Build green · FE 35/35 · 0 off-system tokens in pages.

## Foundation
- [x] Handoff bundle moved into repo (`docs/design-handoff/`)
- [x] CLAUDE.md design-system section
- [x] Shared `SectionHeader` (`components/common/SectionHeader.jsx`)
- [x] Refined `Avatar` fallback (Playfair initials, primary-100, success verified badge)
- [x] Elder mode (`html.elder` in index.css + `hooks/useElderMode.js`, toggle wired in Settings)
- [x] `InfoPanel` (`components/common/InfoPanel.jsx`) — one muted info box

## Pages
- [x] Dashboard — light hero (#1 fix), unified stat tiles, SectionHeader, refined avatars
- [x] Onboarding — light brand rail (#1 fix) + progress ring + vertical 14-step stepper
- [x] Subscription — skeleton loading, VIP gold glow
- [x] Payments — PaymentHistory (system badges, skeleton, summary cards); Success/Failed dark
- [x] Search + ProfileCard — refined avatar fallbacks, dark, empty tile
- [x] Profile Detail — slate→neutral normalize, system compat ring, badges, dark
- [x] My Profile + Editor — slate→neutral normalize; editor light brand rail (#1 fix)
- [x] Chat — sidebar burgundy wash (was slab), gold read-receipt, dark surfaces
- [x] Auth — already on-system; dark brand panel intended per README §7
- [x] Verification — trust-score ring header, system status colors, dark
- [x] Settings — elder-mode toggle wired, amber→warning, dark
- [x] Notifications — TYPE_COLORS normalized to system palette, dark
- [x] Astrologers (list/detail/bookings) — gold stars, success/warning statuses
- [x] Guardian + Success Stories + CallOverlay — rose/amber/green → system

## Verify
- [x] `npm run build` green
- [x] FE tests 35/35 green
- [x] 0 off-system tokens remaining in `src/pages/*`

## Live QA pass (2026-06-23, Playwright @1440 + @375, light+dark)
Drove every member page logged-in as a VIP (rahul.sharma1; flipped the seeded
`elite`/expired sub → active VIP for premium-gated QA). Programmatic probes
(WCAG contrast, off-system colour, horizontal-overflow, broken-img) since the
sandboxed Playwright MCP can't persist screenshots. **Result after fixes: all 12
member pages = 0 contrast fails + 0 off-system colour (light); 0 h-overflow at
375 & 1440; dark+elder toggles verified (font 16→18.5px, persisted).**
Found + fixed (the redesign was scoped to `pages/`, leaving gaps):
- **Muted text failed WCAG AA both themes** — custom neutral ramp `text-neutral-500`
  #8B8B8B (3.4:1) / `-400` #A3A3A3 (2.5:1) are the standard label colours (174
  uses); `--muted-foreground` #8B8B8B (3.4:1); dark overrides inverted-too-dark
  (`-400`→#475569 = 2.6:1). Fix: `index.css` light `--muted-foreground` 55→43%,
  light-mode text-only overrides for neutral-400/500 (bg/border untouched),
  re-tuned dark neutral overrides.
- **Off-system colour in shared components leaked onto redesigned pages** —
  `ProfileCompletionMeter.jsx` (emerald/amber/rose + literal hexes → green "86%"
  on Dashboard/OwnProfile) and shared `Badge.jsx` recoloured to success/gold/
  primary/warning/destructive/info tokens.
- **Gold-as-text ~2.9:1 on white** (VIP price, trust score, eyebrows) → deep-gold
  light-mode text overrides (fills/gradients untouched).
- **Dark mode: light-tint surfaces never adapted** (`bg-primary-50`/`success-50`/
  `gold-50`/`bg-white/70`) + dark accent text (burgundy/success/gold) illegible →
  added dark tint-surface + colored-text overrides in `index.css`; chat date pill
  given a dark variant.
Remaining (accepted): dark inline-styled completion % numerals (3.2–3.7, large/
decorative); a few dark chat timestamps (~3.3, incidental). Broken seed avatars
on web are the known `/uploads/*` dev-seed quirk (prod = Cloudinary).

## Notes / deferred (not buildable or out of scope)
- Verification education/income tiers stay backend-gated (documentType enum is ID-only).
- Full dark-mode parity applied to primary surfaces per page; deep per-pill dark left as-is where low-visibility.
- Admin/* and marketing/* portals intentionally out of scope (separate portals).

---

## 2026-09 doctrine rework — web member + public surfaces (COMPLETE, `design/rework-2026-09`)

Second-generation pass. Where the 2026-06-23 redesign above established the token system, this pass wrote a
single binding law (`DOCTRINE_2026-09.md`, merged from 10 skills pulled in from the sibling HomeKrafted
project) and re-derived every page against it via fresh independent-agent audits — build the change, then a
different agent re-reads the doctrine and the file cold and reports pass/fail with evidence, fix only if it
fails. Scope: member + public web surfaces only (admin/marketing/mobile deferred by owner decision).

**Doctrine highlights:** banned GSAP/scroll-hijack/eyebrow-labels/ghost-cards (border+shadow together);
one icon family (`react-icons/fi`); exact token/easing/duration tables; `utils/animations.js` as the sole
motion-variant source; §9 four-part pre-flight checklist (states/motion/themes-and-scales/access/craft) run
before every screen ships.

**Phase 1** (`8799d20`) — system adoption on shared UI, chat, settings, payments.
**Phase 2** (`113fbe5`) — dark-mode completion + token consolidation. Found+fixed: `tailwind.config.js`
`destructive.DEFAULT` was a literal hex, so `index.css`'s `html.dark` `--destructive` override had nothing
to attach to and stayed the light-mode red in both themes (2.9:1 contrast) — wired to `hsl(var(--destructive))`
like every other themed token. New `--surface-dark-1/2/3` RGB-channel tokens replaced 3 repeated literal
hexes across 36+ files.
**Phase 3** (`cde1196`) — public surfaces, refund guarantee copy aligned to the actually-published Refund
Policy (owner decision: match the policy, not any other option), Subscription overlap-pair card.
**Phase 4** (`2d28c15`) — signup restructured to a one-field-first gate (identifier + OTP verify, then
password/referral/Terms), matching the funnel shape of every major competitor (owner decision).
**Phase 5** (`f6c6635`) — logged-in core rebuild across 8 screens (Dashboard, ProfileCard, MyProfileView,
ProfileDetail, Chat, Settings) with independent doctrine audits before/after each. Real bugs found+fixed:
white-on-gold CTA contrast (~2.4:1, fails AA) on 2 files caught by cross-referencing an out-of-scope flag
from the Chat agent; `Settings.jsx` `PrivacyTab` silently swallowed fetch errors and rendered hardcoded
defaults with no error state; Chat's conversation list was entirely keyboard-unreachable (`<div onClick>`
not a real button). Also added the AI-generated-imagery disclosure (`<AiTag>` + `data/editorialImages.js`
manifest) per owner decision to ship AI imagery as an interim with a small, subtle disclosure.
**Phase 6** (final sweep) — 10 independent audit groups covering every remaining page (home-final,
subscription-final, funnel-auth, onboarding-a/b/c, legal-public-a/b, profile-editor, payments-guardian).
**All 10 failed their first audit** (10 critical + ~100 major/minor findings total) — each got a fix pass,
re-verified live in-browser (light/dark/elder, 375/768/1440) by the fixing agent, then spot-checked directly
in source by me before commit. Notable critical fixes: `Home.jsx`'s `FontLoader` had forked its own
burgundy/gold hex and font stack (doctrine-banned "do not fork the tokens") plus an unscoped `html{font-size:
14px}` overriding the whole document for non-elder visitors — both now read live off the real tokens/index.css;
`Subscription.jsx` had 2 eyebrow-label pills (banned outright) and 5 ghost-card elements (border+shadow both
declared); `AboutYourselfStep.jsx`/`BasicInfoStep.jsx` had zero dark-mode classes on core onboarding fields
(bio textarea, gender-chip selected-state text at ~1.3:1 contrast); `About.jsx`/`Safety.jsx`/`Help.jsx` had
only 1-2 `dark:` occurrences each despite `html.dark` being a real toggle — dark mode was assumed, not shipped.
39 files touched, +989/-591. Gates: FE 121/121 · build ✓ · root lint 0 errors · slop-lint clean.

**Not done in this campaign (explicit scope cuts / owner decisions):** admin + marketing portals (deferred);
RN mobile (deferred, follows this same doctrine through its own §10 translation next); the "member proof
rail" feature (skipped — too few real users + a consent gap); legal-document accuracy review was run as a
separate read-only pass (`docs/LEGAL_REVIEW_2026-09-17.md`) with 2 items still open pending owner/counsel
(Grievance Officer identity, age-gate mismatch between Terms and the signup validator).

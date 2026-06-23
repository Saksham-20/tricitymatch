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

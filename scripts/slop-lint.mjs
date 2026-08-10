#!/usr/bin/env node
/**
 * slop-lint — keeps the 2026-06-23 design system permanent.
 *
 * Off-token colors (rose/pink/purple washes, random hexes) crept back in three
 * successive audits. This scans member-facing source for:
 *   1. literal hex colors outside the brand allowlist
 *   2. off-brand Tailwind gradient/color utilities (from-rose-*, from-pink-*, …)
 *
 * Wired into `npm run lint`. Violations fail the build. Intentional local
 * palettes get a per-file exception WITH a reason — never a silent pass.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIRS = ['frontend/src', 'mobile/src'];
const EXTENSIONS = /\.(jsx?|tsx?)$/;

/* Brand + system palette. Anything hex NOT here (case-insensitive) is a violation
 * unless the file has an exception. Sources: frontend/src/index.css tokens,
 * docs/design-handoff/ts-system.css, Home.jsx's local editorial palette,
 * mobile theme (callTheme dark-navy + neutral re-theme 2026-06-09). */
const ALLOWED_HEX = new Set([
  // burgundy family
  '#8b2346', '#7c1d3a', '#5c1229', '#9b2248', '#b60d2f' /* legacy, being retired */,
  '#3a0e1e', '#be123c' /* legacy meter, retired */,
  // gold family
  '#c9a227', '#b8952a', '#f0d080', '#d4b048', '#fef3c7',
  // cream / paper
  '#fdf8f2', '#f5ede0', '#fffaf6', '#faf7f2', '#fdf6ec',
  // ink / neutrals (web ramp + mobile re-theme)
  '#2d1a22', '#4a3b30', '#2d2d2d', '#1a1a1a', '#171717', '#0a0a0a',
  '#fafafa', '#ffffff', '#fff', '#000', '#000000',
  '#e8e8e8', '#e4dcd3', '#d4d4d4', '#a3a3a3', '#8b8b8b', '#8b8078', '#6b6560',
  '#525252', '#737373', '#404040', '#262626', '#475569',
  // semantic (success/warning/destructive/info tokens)
  '#16a34a', '#4ade80', '#22c55e', '#dcfce7', '#e8f5e9',
  '#d97706', '#f59e0b', '#fef9c3',
  '#dc2626', '#ef4444', '#fee2e2',
  '#2563eb', '#3b82f6', '#dbeafe',
  // mobile call theme (dark navy, deliberate 2026-06-09)
  '#0f172a', '#1e293b', '#334155',
  // dark-mode surface ramp (html.dark theme)
  '#1a1f2e', '#252b3b', '#14182a', '#0f1117',
  // deep semantic pair (mobile re-theme 2026-06-09)
  '#2e7d32', '#c62828',
  // burgundy/gold deep shades (UpgradeModal, gold-dark)
  '#6b1d3a', '#401123', '#2a2010',
  // neutrals in long-standing use
  '#f5f5f5', '#6b6b6b',
  // MatchPopup confetti palette — deliberate celebration, kept-toned (2026-07-03 decision)
  '#f8e8ec', '#e5a3b8',
  // third-party BRAND colors (social buttons — externally fixed, not ours to re-token)
  '#e1306c', '#0077b5', '#1877f2', '#1da1f2', '#ff0000', '#1db954',
  // cream tints + dark-mode card surfaces in long-standing use
  '#fefcf3', '#fdf2f5', '#1c2130', '#221f16',
  // admin chart series ramp (data-viz needs distinguishable brand-adjacent hues)
  '#b76e79', '#5e1730', '#d8b24a', '#f3f4f6',
  // mobile: success-on-scrim, dark skeleton ramp, error toast, gray-500
  '#5dd27a', '#222838', '#2c3346', '#fbfbfb', '#ff6b6b', '#6b7280',
]);

/* Files whose local palettes are intentional. Reason required. */
const FILE_EXCEPTIONS = {
  // Home.jsx: self-contained editorial landing palette defined as CSS vars in
  // FontLoader — reviewed against the system 2026-06-23 + 2026-08-09.
  'frontend/src/pages/Home.jsx': 'editorial landing palette (CSS vars, reviewed)',
  // Admin/marketing portals keep semantic status-chip colors; marketing identity
  // decision is a standing owner call (refinement plan, Standing Decision 2).
  'frontend/src/pages/marketing': 'separate-portal identity pending owner call',
  // Deliberate dark-navy in-call palette (2026-06-09 re-theme decision).
  'mobile/src/features/calls/callTheme.ts': 'call-screen dark-navy palette, deliberate',
  // Admin/bureau RN screens are outside member scope (styling deferred per CLAUDE.md).
  'mobile/src/features/admin': 'RN admin out of member scope',
  'mobile/src/features/bureau': 'RN bureau dead code, deletion pending memo decision',
};

const GRADIENT_SLOP = /\b(?:from|via|to)-(?:rose|pink|purple|fuchsia|violet|indigo|cyan|teal|lime|orange)-\d{2,3}\b/g;
const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g;

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'tests' || name === '__tests__') continue;
      walk(p);
    } else if (EXTENSIONS.test(name)) files.push(p);
  }
};
for (const d of SCAN_DIRS) walk(join(ROOT, d));

const violations = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  const excepted = Object.keys(FILE_EXCEPTIONS).find((k) => rel.startsWith(k));
  if (excepted) continue;
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
    for (const m of line.matchAll(HEX)) {
      if (!ALLOWED_HEX.has(m[0].toLowerCase())) {
        violations.push(`${rel}:${i + 1} off-token hex ${m[0]}`);
      }
    }
    for (const m of line.matchAll(GRADIENT_SLOP)) {
      violations.push(`${rel}:${i + 1} off-brand gradient utility "${m[0]}"`);
    }
  });
}

if (violations.length) {
  console.error(`slop-lint: ${violations.length} violation(s)\n`);
  for (const v of violations.slice(0, 50)) console.error('  ' + v);
  if (violations.length > 50) console.error(`  … and ${violations.length - 50} more`);
  console.error('\nUse a design-system token, or add a justified FILE_EXCEPTIONS entry.');
  process.exit(1);
}
console.log(`slop-lint: clean (${files.length} files scanned)`);

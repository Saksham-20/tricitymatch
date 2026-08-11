#!/usr/bin/env node
/**
 * lint-staged hook: typecheck the RN app whenever mobile/ or shared/ is staged.
 *
 * Why this exists
 * ---------------
 * `founding_premium` was added to shared/src/constants/plans.ts and shipped.
 * It broke two exhaustive `Record<SubscriptionPlanType, …>` maps in the RN app,
 * and `mobile tsc` stayed red across a release because the `mobile` workspace —
 * a declared workspace — was in neither `npm run lint` nor `npm run test`, and
 * lint-staged only globbed backend/** and frontend/**. Nothing anyone ran could
 * fail. The Phase S checklist even predicted the break; it was noted, not caught.
 *
 * `shared/**` is the load-bearing glob here, not `mobile/**`. An author editing a
 * shared enum has no reason to open the RN app, and every OTHER consumer of that
 * enum is gated — so shared/ is precisely where a change goes unnoticed.
 *
 * lint-staged passes the staged filenames as argv; we ignore them. tsc runs over
 * the whole project because a type error surfaces in files the author did not
 * touch — that is the entire failure mode being defended against.
 */

const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const repoRoot = join(__dirname, '..');
const mobileDir = join(repoRoot, 'mobile');

// The repo-local TypeScript. `tsc` on PATH is v4 here and fails on modern syntax
// with errors that look like real type errors — a documented time sink.
const tscBin = join(mobileDir, 'node_modules', '.bin', 'tsc');

if (!existsSync(tscBin)) {
  console.warn('[mobile-typecheck] mobile/node_modules/.bin/tsc missing — run `npm install`. Skipping.');
  process.exit(0);
}

try {
  execFileSync(tscBin, ['--noEmit', '-p', 'tsconfig.json'], {
    cwd: mobileDir,
    stdio: 'inherit',
  });
} catch {
  console.error(
    '\n[mobile-typecheck] The RN app does not typecheck against this change.\n' +
      'If you edited shared/, a type there is consumed by mobile/src — fix it there too,\n' +
      'or the app ships broken while every other workspace stays green.\n'
  );
  process.exit(1);
}

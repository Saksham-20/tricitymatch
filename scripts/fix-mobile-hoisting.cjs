#!/usr/bin/env node
/**
 * postinstall: keep Expo config plugins resolvable from `mobile/`.
 *
 * The problem
 * -----------
 * npm workspaces hoist shared packages to the root `node_modules`. Expo config
 * plugins (`expo-build-properties` and friends) `require('expo/config-plugins')`
 * — a SUBPATH of the `expo` package, which is NOT hoisted, because `expo` only
 * exists in `mobile/`. So the hoisted plugin sits at the root and cannot see
 * `expo` at all, and `npx expo prebuild` dies with
 * `Cannot find module 'expo/config-plugins'`.
 *
 * A symlink does not fix it: Node resolves a symlinked module to its realpath
 * and then searches upward from THERE, i.e. from the root again. The package has
 * to be physically present under `mobile/node_modules`.
 *
 * Why this matters beyond convenience: `prebuild --clean` DELETES android/ and
 * ios/ before it applies plugins. A plugin that fails to load leaves the repo
 * with no native projects at all, which is a confusing state to land in.
 */

const { existsSync, cpSync, rmSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const repoRoot = join(__dirname, '..');
const mobileModules = join(repoRoot, 'mobile', 'node_modules');
const rootModules = join(repoRoot, 'node_modules');

// Packages that must resolve `expo` as a sibling. Add to this list if a new
// config plugin starts failing the same way.
const NEEDS_LOCAL = ['expo-build-properties'];

if (!existsSync(mobileModules)) {
  // mobile deps not installed yet (e.g. `npm ci --workspace=backend`) — nothing to do.
  process.exit(0);
}

const sameVersion = (a, b) => {
  try {
    return (
      JSON.parse(readFileSync(join(a, 'package.json'), 'utf8')).version ===
      JSON.parse(readFileSync(join(b, 'package.json'), 'utf8')).version
    );
  } catch {
    return false;
  }
};

for (const pkg of NEEDS_LOCAL) {
  const src = join(rootModules, pkg);
  const dest = join(mobileModules, pkg);

  if (!existsSync(src)) continue;          // not hoisted (or not installed) — fine
  if (existsSync(dest) && sameVersion(src, dest)) continue;  // already correct

  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true, dereference: true });
  console.log(`[fix-mobile-hoisting] copied ${pkg} into mobile/node_modules (needs \`expo\` as a sibling)`);
}

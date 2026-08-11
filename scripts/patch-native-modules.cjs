#!/usr/bin/env node
/**
 * postinstall: patch third-party native sources that do not compile on the
 * installed toolchain.
 *
 * These are toolchain gaps, not app bugs. Expo SDK 52 predates Xcode 26, so a
 * few of its modules were written against an older SDK and fail against the
 * newer one. Each patch below is narrow, idempotent, and re-applied after every
 * `npm install` (which rewrites node_modules and would otherwise drop it).
 *
 * Every entry should say what breaks without it and when it can be deleted.
 */

const { existsSync, readFileSync, writeFileSync, statSync, chmodSync } = require('node:fs');
const { join } = require('node:path');

const repoRoot = join(__dirname, '..');

const patches = [
  {
    name: 'expo-localization: exhaustive Calendar.Identifier switch',
    file: join(repoRoot, 'mobile', 'node_modules', 'expo-localization', 'ios', 'LocalizationModule.swift'),
    marker: '@unknown default:',
    // The iOS 26 SDK added Calendar.Identifier cases, so Swift rejects the
    // switch as non-exhaustive:
    //   LocalizationModule.swift:93:5: error: switch must be exhaustive
    // Falling back to "gregory" matches what the module already returns for the
    // Gregorian calendar and is the BCP 47 default.
    // Delete when expo-localization ships a version with @unknown default.
    apply: (src) =>
      src.replace(
        '    case .iso8601:\n      return "iso8601"\n    }',
        '    case .iso8601:\n      return "iso8601"\n    @unknown default:\n      return "gregory"\n    }'
      ),
  },
];

let applied = 0;
let missing = 0;

for (const patch of patches) {
  if (!existsSync(patch.file)) {
    missing += 1;
    continue;
  }

  const src = readFileSync(patch.file, 'utf8');
  if (src.includes(patch.marker)) continue; // already patched

  const out = patch.apply(src);
  if (out === src) {
    console.warn(
      `[patch-native-modules] ${patch.name}: pattern no longer matches — the upstream file changed. ` +
        'Verify whether the patch is still needed and update or delete it.'
    );
    continue;
  }

  const mode = statSync(patch.file).mode;
  chmodSync(patch.file, 0o644);
  writeFileSync(patch.file, out);
  chmodSync(patch.file, mode);
  console.log(`[patch-native-modules] applied: ${patch.name}`);
  applied += 1;
}

if (applied === 0 && missing === patches.length) {
  // mobile deps not installed in this context — nothing to do, not an error.
  process.exit(0);
}

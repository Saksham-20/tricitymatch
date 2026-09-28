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
 * Not every entry is a compile gap: a couple patch third-party JS that misbehaves at
 * runtime (the gorhom worklet crash, the toast library's animation hook). Each says so.
 *
 * Every entry should say what breaks without it and when it can be deleted.
 */

const { existsSync, readFileSync, writeFileSync, statSync, chmodSync } = require('node:fs');
const { join } = require('node:path');

const repoRoot = join(__dirname, '..');

const patches = [
  {
    name: '@gorhom/bottom-sheet: useAnimatedLayout worklet closes over a param named `window`',
    file: join(repoRoot, 'node_modules', '@gorhom', 'bottom-sheet', 'src', 'hooks', 'useAnimatedLayout.ts'),
    marker: 'nextWindow',
    // JS, not native. Metro resolves this package through its "react-native": "src/index.ts" field.
    // The Dimensions 'change' listener destructures `{ window }` and a worklet inside it then
    // assigns `_state.window = window`. Reanimated's plugin treats `window` as a browser global
    // and does not capture the local, so the first Dimensions change (Dynamic Type, split view,
    // foldables, display size) throws "Property 'window' doesn't exist" on the UI runtime:
    // a redbox in dev and, unhandled, a crash in release. Seen on both platforms in the Phase 6
    // sweep once the Filters sheet had mounted. Renaming the local avoids the global.
    // Delete when @gorhom/bottom-sheet ships the rename upstream.
    apply: (src) =>
      src
        .replace("({ window }) => {", "({ window: nextWindow }) => {")
        .replace('_state.window = window;', '_state.window = nextWindow;'),
  },
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
  {
    name: 'react-native-toast-message: underdamped JS-thread spring + no Reduce Motion path',
    file: join(repoRoot, 'node_modules', 'react-native-toast-message', 'lib', 'src', 'hooks', 'useSlideAnimation.js'),
    marker: 'tricitymatch-motion-patch',
    // JS, not native. The library slides every toast with a core `Animated.spring({ friction: 8 })`
    // (underdamped: it overshoots and rocks), runs it on the native driver on iOS only — so on
    // Android the toast animates on the JS thread exactly when JS is busiest (the request that
    // raised the toast has just resolved) — and has no Reduce Motion handling at all.
    // Patched to: tension 140 / friction 22 (an overdamped ~400ms settle, no overshoot, matching
    // duration.toast in shared/constants/motion.ts), the native driver on both platforms (only
    // opacity + translateY are animated, both native-supported), and — under Reduce Motion — a
    // fade in place instead of the slide from off-screen.
    // Delete when react-native-toast-message ships any of these upstream.
    apply: (src) => {
      const steps = [
        [
          "import { Animated, Platform } from 'react-native';",
          "import { Animated, AccessibilityInfo } from 'react-native';",
        ],
        [
          "export function translateYOutputRangeFor(",
          "// tricitymatch-motion-patch: the library has no Reduce Motion path of its own.\n" +
            "let reduceMotion = false;\n" +
            "AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotion = v; }).catch(() => {});\n" +
            "AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion = v; });\n" +
            "export function translateYOutputRangeFor(",
        ],
        [
          "const range = [-(height * 2), Math.max(offset, keyboardAwareOffset)];",
          "const restingOffset = Math.max(offset, keyboardAwareOffset);\n" +
            "    // Reduce Motion: fade in place (no slide from off-screen).\n" +
            "    const range = [reduceMotion ? restingOffset : -(height * 2), restingOffset];",
        ],
        [
          "const useNativeDriver = Platform.select({\n    ios: true,\n    default: false\n});",
          "const useNativeDriver = true;",
        ],
        [
          "            useNativeDriver,\n            friction: 8\n",
          "            useNativeDriver,\n            tension: 140,\n            friction: 22\n",
        ],
      ];
      let out = src;
      for (const [from, to] of steps) {
        // All-or-nothing: if upstream changed any anchor, leave the file untouched (the runner
        // then warns) rather than ship a half-patched animation hook.
        if (!out.includes(from)) return src;
        out = out.replace(from, to);
      }
      return out;
    },
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

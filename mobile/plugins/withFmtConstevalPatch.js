/**
 * Expo config plugin: make `fmt` compile under Xcode 26's clang.
 *
 * react-native 0.76.9 vendors fmt 9.x, which builds `FMT_STRING(...)` inside a
 * consteval context that the newer front-end rejects:
 *
 *   fmt/format-inl.h:59:24: error: call to consteval function
 *   'fmt::basic_format_string<...>' is not a constant expression
 *
 * A `-D` define cannot fix it. fmt/base.h opens its selection chain with a bare
 * `#if !defined(__cpp_lib_is_constant_evaluated)` and no `#ifndef FMT_USE_CONSTEVAL`
 * guard, so the header unconditionally redefines the macro and the command-line
 * value loses. The header itself has to be edited.
 *
 * Forcing the first branch selects FMT_USE_CONSTEVAL 0 — the same path fmt takes
 * on every compiler it already considers to have broken consteval (see its
 * Apple-clang < 14 and MSVC < 16.10 branches). Format checking moves from compile
 * time to runtime; every format string inside fmt is a literal, so nothing is
 * lost at runtime.
 *
 * WHY A PLUGIN, not an edit to ios/Podfile: `expo prebuild --clean` regenerates
 * the Podfile from the template. This patch was originally written directly into
 * that file and survived exactly one prebuild before being silently erased,
 * taking the iOS build with it. Anything that must outlive prebuild belongs here.
 *
 * Delete this when react-native ships a newer fmt.
 */

const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# fmt-consteval-patch';

const HOOK = `
    ${MARKER} — see mobile/plugins/withFmtConstevalPatch.js
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      contents = File.read(fmt_base)
      patch_marker = '/* patched: consteval disabled for Xcode 26 clang */'
      unless contents.include?(patch_marker)
        patched = contents.sub(
          "#if !defined(__cpp_lib_is_constant_evaluated)",
          "#if 1 #{patch_marker}"
        )
        if patched != contents
          # CocoaPods installs pod sources read-only; restore the mode after writing.
          original_mode = File.stat(fmt_base).mode
          File.chmod(0o644, fmt_base)
          File.write(fmt_base, patched)
          File.chmod(original_mode, fmt_base)
          Pod::UI.puts '[fmt] disabled consteval (Xcode 26 clang rejects FMT_STRING in a consteval context)'
        end
      end
    end
`;

const withFmtConstevalPatch = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(MARKER)) return cfg;

      // Inject at the top of the existing post_install block, which the Expo
      // template always emits.
      const anchor = 'post_install do |installer|';
      if (!podfile.includes(anchor)) {
        throw new Error(
          '[withFmtConstevalPatch] no post_install block in the generated Podfile. ' +
            'The Expo template changed — update this plugin instead of editing the Podfile by hand.'
        );
      }

      podfile = podfile.replace(anchor, `${anchor}\n${HOOK}`);
      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);

module.exports = withFmtConstevalPatch;

/**
 * Expo config plugin: pick the Google Play flavour of react-native-iap.
 *
 * react-native-iap publishes two Android product flavours on a `store`
 * dimension — `play` and `amazon`. The app module does not declare that
 * dimension, so Gradle cannot choose and the build dies with:
 *
 *   Could not resolve project :react-native-iap.
 *   However we cannot choose between the following variants:
 *     - amazonDebugApiElements
 *     - playDebugApiElements
 *
 * `missingDimensionStrategy 'store', 'play'` tells the consumer which flavour to
 * take. We ship through Google Play, never the Amazon Appstore.
 *
 * This lives in a plugin rather than as an edit to android/app/build.gradle
 * because `expo prebuild` regenerates that file — a hand-edit works exactly once
 * and then silently disappears, which is the failure mode this whole native pass
 * exists to clean up.
 */

const { withAppBuildGradle } = require('expo/config-plugins');

const STRATEGY = "missingDimensionStrategy 'store', 'play'";

const withIapStoreFlavor = (config) =>
  withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes(STRATEGY)) return cfg;

    // Anchor on the versionName line inside defaultConfig — stable across Expo
    // templates, and unambiguous (it appears once).
    const anchor = /(\n\s*versionName\s+["'][^"']+["'])/;
    if (!anchor.test(gradle)) {
      throw new Error(
        '[withIapStoreFlavor] could not find versionName in app/build.gradle. ' +
          'The Expo template changed — update this plugin rather than editing build.gradle by hand.'
      );
    }

    gradle = gradle.replace(anchor, `$1\n        ${STRATEGY}`);
    cfg.modResults.contents = gradle;
    return cfg;
  });

module.exports = withIapStoreFlavor;

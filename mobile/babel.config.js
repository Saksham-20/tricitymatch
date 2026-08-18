module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // must be last
    ],
    env: {
      production: {
        // Release bundles must not ship console.log noise (perf + PII in logcat).
        // error/warn kept so crash reporting still sees them.
        plugins: [['transform-remove-console', { exclude: ['error', 'warn'] }]],
      },
    },
  };
};

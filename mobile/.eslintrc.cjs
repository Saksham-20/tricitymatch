/**
 * ESLint for the RN app.
 *
 * Kept deliberately lean. `tsc` already carries type correctness and runs in the
 * same gate, so this file is for the things a typechecker cannot see: dead
 * bindings, hook dependency mistakes, and the specific escape hatches that have
 * produced real bugs in this codebase.
 *
 * Pinned to the eslint 8 line (typescript-eslint 7.x is the last that supports
 * it) because the root workspace hoists eslint 8 for backend and frontend.
 * Bumping this in isolation breaks the shared install.
 */

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { es2022: true, node: true },
  globals: {
    __DEV__: 'readonly',
    console: 'readonly',
    fetch: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    require: 'readonly',
    module: 'writable',
  },
  ignorePatterns: ['node_modules/', 'android/', 'ios/', '*.config.js', 'jest.setup.js'],
  rules: {
    // Underscore-prefixed args are the conventional "deliberately unused" marker.
    //
    // WARN, not error, and deliberately so: there are currently 62 unused
    // bindings across 32 files (19 dead imports, 43 dead locals — leftovers from
    // the anti-slop and API-contract passes, e.g. STRENGTH_COLORS in
    // SignupScreen, MAX_DURATION_MS in VoiceIntroRecorder). Setting this to error
    // today would block the gate on pre-existing debt and tempt whoever hits it
    // to disable the rule outright.
    //
    // The number above is the contract: it should only go down. RN-G flips this
    // to 'error' once the sweep clears them.
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

    // Native modules are loaded through dynamic require on purpose so the bundle
    // still runs in Expo Go — that pattern is intentional here, not a smell.
    '@typescript-eslint/no-var-requires': 'off',

    // `any` is worth flagging but there is a backlog of it; error-level would
    // block the gate on pre-existing code rather than on new work.
    '@typescript-eslint/no-explicit-any': 'warn',

    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    eqeqeq: ['error', 'smart'],
  },
  overrides: [
    {
      // The api layer is where this repo's recurring bug class lives: a wrong
      // path or a wrong response envelope, hidden behind a cast that stops the
      // typechecker from ever noticing.
      files: ['src/api/**/*.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: 'TSAsExpression > TSUnknownKeyword',
            message:
              'Double-casting through `unknown` in the api layer defeats the only check on the server contract. ' +
              'Type the response shape, or parse it — see src/api/apiConformance.test.ts.',
          },
        ],
      },
    },
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      env: { jest: true },
      rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
  ],
};

// RN-G will add the rule that matters most for the craft pass: banning
// `colours.*` / `darkColours.*` inside module-scope StyleSheet.create, which
// evaluates once at import and therefore cannot respond to a theme change.
// It is not enabled here because 84 of 88 files currently violate it — turning
// it on before the themed-style rails exist would only produce noise.

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  // Compile-time constants injected by Vite's `define` (see vite.config.js).
  globals: {
    __APP_VERSION__: 'readonly',
    __BUILD_TIME__: 'readonly',
  },
  plugins: ['react', 'react-hooks'],
  rules: {
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // Vitest injects describe/it/expect/afterEach as globals (globals: true).
      files: ['src/**/*.test.{js,jsx}', 'src/test/**/*.js', 'src/tests/**/*.{js,jsx}'],
      env: { node: true },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
  ],
  // `.d.ts` files carry types only and need the TS parser this config does not
  // load; there is no runtime code in them to lint.
  ignorePatterns: ['dist', 'node_modules', '*.config.js', '*.config.cjs', '*.config.mjs', '*.d.ts'],
};

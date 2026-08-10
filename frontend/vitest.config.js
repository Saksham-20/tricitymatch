import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Build-time constants that `vite.config.js` injects. Without them here, any
  // test whose import graph reaches `src/config/index.js` dies with
  // "__APP_VERSION__ is not defined" — a config gap, not a product bug.
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __BUILD_TIME__: JSON.stringify('1970-01-01T00:00:00.000Z'),
  },
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Global test setup
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    
    // Include patterns
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/*'
      ],
      thresholds: {
        global: {
          branches: 50,
          functions: 50,
          lines: 50,
          statements: 50
        }
      }
    },
    
    // Performance
    pool: 'forks',
    maxConcurrency: 5,
    
    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000
  }
});

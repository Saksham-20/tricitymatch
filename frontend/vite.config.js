import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode`
  const env = loadEnv(mode, process.cwd(), '')
  const isProduction = mode === 'production'

  return {
    plugins: [
      react({
        // Enable Fast Refresh in development
        fastRefresh: !isProduction,
      }),
    ],

    // Support both .jsx and .tsx files
    esbuild: {
      loader: 'tsx',
      include: /src\/.*\.[tj]sx?$/,
      exclude: [],
    },

    // Development server configuration
    server: {
      port: 3000,
      host: true, // Expose to network
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: env.VITE_WS_URL || 'http://localhost:5000',
          changeOrigin: true,
          ws: true,
        },
      },
    },

    // Preview server (for testing production build locally)
    preview: {
      port: 4173,
      host: true,
    },

    // Path aliases (include workspace root node_modules for hoisted deps like dompurify)
    resolve: {
      alias: {
        dompurify: path.resolve(__dirname, '../node_modules/dompurify'),
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@context': path.resolve(__dirname, './src/context'),
        '@api': path.resolve(__dirname, './src/api'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@assets': path.resolve(__dirname, './src/assets'),
      },
    },

    // Build configuration
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      
      // Generate source maps only in development or when explicitly enabled
      sourcemap: !isProduction || env.VITE_ENABLE_SOURCE_MAPS === 'true',
      
      // Use terser for better minification
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
        },
        mangle: {
          safari10: true,
        },
        format: {
          comments: false,
        },
      },

      // Chunk size warning limit (500kb)
      chunkSizeWarningLimit: 500,

      // Rollup options for code splitting
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks - rarely change, cached long-term
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['framer-motion', 'react-hot-toast', 'lucide-react', 'react-icons'],
            'vendor-utils': ['axios', 'socket.io-client', 'dompurify', 'clsx'],
          },
          
          // Asset file naming
          assetFileNames: (assetInfo) => {
            const extType = assetInfo.name?.split('.').at(-1) || 'asset';
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
              return 'assets/images/[name]-[hash][extname]';
            }
            if (/woff2?|eot|ttf|otf/i.test(extType)) {
              return 'assets/fonts/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
          
          // Chunk file naming
          chunkFileNames: 'assets/js/[name]-[hash].js',
          
          // Entry file naming
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },

      // CSS code splitting
      cssCodeSplit: true,

      // Target modern browsers for smaller bundle
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    },

    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'framer-motion',
        'axios',
        'socket.io-client',
        'dompurify',
      ],
      exclude: [],
    },

    // Define global constants
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },

    // CSS configuration (PostCSS/Tailwind loaded from postcss.config.js)
    css: {
      devSourcemap: true,
    },

    // Test configuration
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
          '**/*.d.ts',
          '**/*.config.*',
        ],
      },
    },
  }
})

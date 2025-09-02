import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Umgebung für Node.js-basierte Cloud Functions
    environment: 'node',
    
    // Test-Dateien-Pattern
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'lib', 'dist'],
    
    // Global setup für Firebase Admin Mock
    globals: true,
    
    // Coverage-Konfiguration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'lib/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/config/env.ts', // Konfigurationsdateien
        'vitest.config.ts'
      ]
      // Coverage-Thresholds werden später für echte Tests aktiviert
    },
    
    // Timeout-Konfiguration für Cloud Functions Tests
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Mock-Konfiguration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Parallelisierung für bessere Performance
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4
      }
    },
    
    // Reporter-Konfiguration
    reporters: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results.json',
      html: './test-report.html'
    }
  },
  
  // Resolve-Konfiguration für TypeScript-Pfade
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@config': resolve(__dirname, './src/config'),
      '@utils': resolve(__dirname, './src/utils'),
      '@types': resolve(__dirname, './src/types'),
      '@validators': resolve(__dirname, './src/validators')
    }
  },
  
  // Definition von globalen Variablen für Tests
  define: {
    'process.env.FUNCTIONS_EMULATOR': '"true"',
    'process.env.FIRESTORE_EMULATOR_HOST': '"localhost:8080"',
    'process.env.FIREBASE_AUTH_EMULATOR_HOST': '"localhost:9099"'
  }
});

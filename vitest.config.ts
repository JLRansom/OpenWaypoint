import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Use Node environment — all tested code is server-side
    environment: 'node',

    // Collect tests from __tests__ directory
    include: ['__tests__/**/*.test.ts'],

    // Runs once in the main process — creates temp directories, sets env vars
    globalSetup: './__tests__/helpers/global-setup.ts',

    // Runs inside each worker before the test file is loaded.
    // Used to give every test file its own isolated SQLite database.
    setupFiles: ['./__tests__/helpers/setup.ts'],

    // Each test file runs in its own worker with a fresh module registry.
    // This is critical: lib/db/client.ts has top-level singleton init code
    // that must re-run with the per-file DB path set by setupFiles.
    isolate: true,

    // Integration tests involve real disk I/O and DB migrations — be generous
    testTimeout: 20000,

    reporter: 'verbose',
  },
  resolve: {
    alias: {
      // Mirror the @/* → ./* path alias from tsconfig.json
      '@': path.resolve(__dirname, '.'),
    },
  },
})

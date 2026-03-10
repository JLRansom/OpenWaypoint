/**
 * Vitest globalSetup — runs once in the main process before any workers start.
 *
 * Responsibilities:
 *  - Ensure data/uploads directory exists inside the worktree so uploads don't
 *    fail on a fresh clone.
 *  - Expose a teardown hook (currently a no-op — per-file DB files live in
 *    os.tmpdir() and are cleaned by the OS; disk uploads are cleaned per-test).
 */
import fs from 'fs'
import path from 'path'

export default function globalSetup() {
  // Make sure the uploads directory exists in the worktree so upload routes
  // don't fail when the first test runs in a clean environment.
  const uploadsRoot = path.join(process.cwd(), 'data', 'uploads')
  fs.mkdirSync(uploadsRoot, { recursive: true })

  return async function teardown() {
    // Per-file SQLite DBs live in os.tmpdir() — the OS cleans them up.
    // Disk uploads from tests are cleaned in each test file's afterAll.
  }
}

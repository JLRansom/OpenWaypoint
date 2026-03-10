/**
 * Vitest setupFiles — runs inside each worker before the test file is loaded.
 *
 * By setting SQLITE_DB_PATH here (before any module is imported), we ensure
 * that lib/db/client.ts — which reads this env var at module-init time and
 * holds a globalThis singleton — creates a brand-new, isolated database for
 * every test file rather than touching the dev database.
 *
 * Each test file therefore gets a fresh SQLite file with full migrations run
 * automatically by lib/db/client.ts's top-level migrate() call.
 */
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

const dbPath = join(tmpdir(), `ag-test-${randomUUID()}.db`)
process.env.SQLITE_DB_PATH = dbPath

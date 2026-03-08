import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import fs from 'fs'
import path from 'path'

const dbPath = process.env.SQLITE_DB_PATH ?? './data/agents.db'
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const g = globalThis as typeof globalThis & { __db?: Database.Database }
if (!g.__db) {
  g.__db = new Database(dbPath)
  g.__db.pragma('journal_mode = WAL')
  g.__db.pragma('foreign_keys = ON')
}

export const db = drizzle(g.__db, { schema })
migrate(db, { migrationsFolder: './lib/db/migrations' })

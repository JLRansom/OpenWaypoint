import { eq } from 'drizzle-orm'
import { db } from '../client'
import { settings } from '../schema'

/**
 * Retrieve a setting value by key.
 * Returns undefined when the key has no row in the DB.
 */
export function dbGetSetting(key: string): string | undefined {
  const row = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get()
  return row?.value
}

/**
 * Upsert a setting value.  Creates the row if it doesn't exist, updates
 * it if it does.
 */
export function dbSetSetting(key: string, value: string): void {
  db
    .insert(settings)
    .values({ key, value, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: Date.now() },
    })
    .run()
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { taskRuns } from '@/lib/db/schema'
import { calculateCost } from '@/lib/pricing'
import { isNull, eq } from 'drizzle-orm'

/**
 * POST /api/runs/backfill-costs
 *
 * Recalculates costUsd for historical task_runs rows where:
 *   - costUsd IS NULL (no cost recorded yet)
 *   - inputTokens IS NOT NULL (we have the data to compute it)
 *   - model IS NOT NULL (we know which model to price)
 *
 * Returns { updated: number } — count of rows updated.
 *
 * Idempotent: safe to call multiple times; rows with existing costUsd are skipped.
 */
export async function POST() {
  // Fetch rows that are missing cost but have the data needed to compute it
  const rows = await db
    .select({
      id: taskRuns.id,
      inputTokens: taskRuns.inputTokens,
      outputTokens: taskRuns.outputTokens,
      model: taskRuns.model,
    })
    .from(taskRuns)
    .where(
      // costUsd IS NULL AND inputTokens IS NOT NULL AND model IS NOT NULL
      // Drizzle doesn't have a multi-condition helper, so we run a raw check
      // via a JS filter after fetching the candidate rows.
      isNull(taskRuns.costUsd),
    )

  const candidates = rows.filter(
    (r) => r.inputTokens != null && r.model != null,
  )

  let updated = 0
  for (const row of candidates) {
    const cost = calculateCost(
      row.inputTokens!,
      row.outputTokens ?? 0,
      row.model!,
    )
    if (cost == null) continue // unknown model — skip

    await db
      .update(taskRuns)
      .set({ costUsd: cost })
      .where(eq(taskRuns.id, row.id))

    updated++
  }

  return NextResponse.json({ updated })
}

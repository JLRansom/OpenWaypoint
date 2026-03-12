import { NextRequest, NextResponse } from 'next/server'
import { getSetting, setSetting } from '@/lib/store'

// Well-known setting keys — requests for unknown keys are rejected.
const ALLOWED_KEYS = new Set(['dangerouslySkipPermissions'])

// ---------------------------------------------------------------------------
// GET /api/settings — return all well-known settings as {key: value}
// ---------------------------------------------------------------------------

export function GET() {
  const result: Record<string, string> = {}
  for (const key of ALLOWED_KEYS) {
    result[key] = getSetting(key) ?? 'false'
  }
  return NextResponse.json(result)
}

// ---------------------------------------------------------------------------
// PUT /api/settings — upsert a single setting
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { key, value } = body as { key?: string; value?: string }

  if (!key || !ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: 'unknown setting key' }, { status: 400 })
  }

  if (typeof value !== 'string') {
    return NextResponse.json({ error: 'value must be a string' }, { status: 400 })
  }

  setSetting(key, value)
  return NextResponse.json({ ok: true, key, value })
}

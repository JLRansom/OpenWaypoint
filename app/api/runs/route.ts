import { NextRequest, NextResponse } from 'next/server'
import { dbGetTaskRunsPaginated } from '@/lib/db/repositories/taskRunRepo'
import type { PaginatedRunsResponse } from '@/lib/types'

export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // Parse and clamp numeric params so they can't be used to DoS the server
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))

  // Optional filter params — undefined means "no filter applied"
  const role   = searchParams.get('role')   ?? undefined
  const status = searchParams.get('status') ?? undefined
  const q      = searchParams.get('q')      ?? undefined

  const fromParam = searchParams.get('from')
  const toParam   = searchParams.get('to')
  const from = fromParam ? parseInt(fromParam, 10) : undefined
  const to   = toParam   ? parseInt(toParam,   10) : undefined

  const { runs, total } = dbGetTaskRunsPaginated({ page, limit, role, status, q, from, to })

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const body: PaginatedRunsResponse = { runs, total, page, limit, totalPages }
  return NextResponse.json(body)
}

import { NextRequest, NextResponse } from 'next/server'
import { getProject } from '@/lib/store'
import { dbGetProjectAnalytics } from '@/lib/db/repositories/analyticsRepo'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { searchParams } = req.nextUrl
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const from = fromParam ? parseInt(fromParam, 10) : undefined
  const to = toParam ? parseInt(toParam, 10) : undefined

  const data = dbGetProjectAnalytics(id, from, to)
  return NextResponse.json(data)
}

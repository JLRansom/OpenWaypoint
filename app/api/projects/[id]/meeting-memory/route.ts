import { NextRequest, NextResponse } from 'next/server'
import { getProject, getSetting, setSetting } from '@/lib/store'

const MEMORY_KEY_PREFIX = 'meeting-memory:'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const memory = getSetting(MEMORY_KEY_PREFIX + id) ?? null
  return NextResponse.json({ memory })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  setSetting(MEMORY_KEY_PREFIX + id, '')
  return new NextResponse(null, { status: 204 })
}

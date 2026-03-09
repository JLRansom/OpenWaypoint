import { NextRequest, NextResponse } from 'next/server'
import { getProject, updateProject } from '@/lib/store'
import type { BoardType } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  const { name, description, directory, boardType } = body as { name?: string; description?: string; directory?: string; boardType?: BoardType }

  updateProject(id, {
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(directory !== undefined && { directory }),
    ...(boardType !== undefined && { boardType }),
    updatedAt: Date.now(),
  })

  return NextResponse.json(getProject(id))
}

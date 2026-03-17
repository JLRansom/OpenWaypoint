import { NextRequest, NextResponse } from 'next/server'
import { getProject, getTag, updateTag, deleteTag } from '@/lib/store'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> },
) {
  const { id, tagId } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  const tag = getTag(tagId)
  if (!tag || tag.projectId !== id) return NextResponse.json({ error: 'tag not found' }, { status: 404 })

  let body: { name?: string; color?: string } = {}
  try { body = await req.json() } catch { /* empty body */ }

  const patch: { name?: string; color?: string } = {}
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.color === 'string' && body.color.trim()) patch.color = body.color.trim()

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  updateTag(tagId, patch)
  return NextResponse.json({ ...tag, ...patch })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> },
) {
  const { id, tagId } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  const tag = getTag(tagId)
  if (!tag || tag.projectId !== id) return NextResponse.json({ error: 'tag not found' }, { status: 404 })

  deleteTag(tagId)
  return new NextResponse(null, { status: 204 })
}

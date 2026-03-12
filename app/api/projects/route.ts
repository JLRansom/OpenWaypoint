import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Project, BoardType } from '@/lib/types'
import { getAllProjects, addProject } from '@/lib/store'

export async function GET() {
  return NextResponse.json(getAllProjects())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, description, directory, boardType } = body as { name: string; description: string; directory?: string; boardType?: BoardType }

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Reject directory values that contain path-traversal sequences or null bytes
  if (directory && (directory.includes('..') || directory.includes('\0'))) {
    return NextResponse.json({ error: 'invalid directory path' }, { status: 400 })
  }

  const project: Project = {
    id: randomUUID(),
    name,
    description: description ?? '',
    directory: directory ?? '',
    boardType: boardType ?? 'coding',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  addProject(project)

  return NextResponse.json(project, { status: 201 })
}

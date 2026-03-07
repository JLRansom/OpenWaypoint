import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Project } from '@/lib/types'
import { getAllProjects, addProject } from '@/lib/store'

export async function GET() {
  return NextResponse.json(getAllProjects())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, description } = body as { name: string; description: string }

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const project: Project = {
    id: randomUUID(),
    name,
    description: description ?? '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  addProject(project)

  return NextResponse.json(project, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { getTask, getFilesByTask, addTaskFile, updateTask } from '@/lib/store'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  ensureTaskUploadsDir,
  sanitiseFilename,
} from '@/lib/file-utils'

// ---------------------------------------------------------------------------
// GET /api/tasks/[id]/files — list all attachments for a task
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = getTask(id)
  if (!task) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json(getFilesByTask(id))
}

// ---------------------------------------------------------------------------
// POST /api/tasks/[id]/files — upload one or more files (multipart/form-data)
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = getTask(id)
  if (!task) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid multipart body' }, { status: 400 })
  }

  const fileEntries = formData.getAll('file') as File[]
  if (fileEntries.length === 0) {
    return NextResponse.json({ error: 'no files provided' }, { status: 400 })
  }

  const dir = ensureTaskUploadsDir(id)
  const saved = []
  const errors = []

  for (const file of fileEntries) {
    // Validate MIME type
    const mimeType = file.type || 'application/octet-stream'
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      errors.push({ filename: file.name, error: `unsupported file type: ${mimeType}` })
      continue
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      errors.push({ filename: file.name, error: 'file exceeds 50 MB limit' })
      continue
    }

    // Write to disk
    const uuid = randomUUID()
    const safe = sanitiseFilename(file.name)
    const diskName = `${uuid}-${safe}`
    const diskPath = path.join(dir, diskName)
    const relativePath = ['data', 'uploads', id, diskName].join('/')

    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(diskPath, buffer)

    // Persist metadata
    const record = {
      id: randomUUID(),
      taskId: id,
      filename: file.name,
      mimeType,
      sizeBytes: buffer.length,
      storagePath: relativePath,
      createdAt: Date.now(),
    }
    addTaskFile(record)
    saved.push(record)
  }

  // Bump task updatedAt so SSE broadcast reflects the change
  if (saved.length > 0) {
    updateTask(id, {})
  }

  if (saved.length === 0) {
    return NextResponse.json({ error: 'no files saved', details: errors }, { status: 400 })
  }

  return NextResponse.json({ saved, errors }, { status: 201 })
}

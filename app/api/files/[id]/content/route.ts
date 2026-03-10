import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getTaskFile } from '@/lib/store'

// ---------------------------------------------------------------------------
// GET /api/files/[id]/content — stream a stored file for preview / download
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const record = getTaskFile(id)
  if (!record) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const diskPath = path.join(process.cwd(), record.storagePath)
  if (!fs.existsSync(diskPath)) {
    return NextResponse.json({ error: 'file not found on disk' }, { status: 404 })
  }

  const buffer = fs.readFileSync(diskPath)

  // Decide disposition: images and PDFs render inline; everything else downloads
  const isInline =
    record.mimeType.startsWith('image/') || record.mimeType === 'application/pdf'
  const disposition = isInline
    ? `inline; filename="${record.filename}"`
    : `attachment; filename="${record.filename}"`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': record.mimeType,
      'Content-Disposition': disposition,
      'Content-Length': String(record.sizeBytes),
      // Allow browser to cache previews for the session
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

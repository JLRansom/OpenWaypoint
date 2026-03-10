/**
 * Server-only file utilities for the file attachment feature.
 *
 * This module uses Node.js `fs` and `path` — it must never be imported from
 * client components.  Browser-safe helpers (formatFileSize, etc.) live in
 * lib/format-utils.ts instead.
 */
import path from 'path'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Allowed MIME types
// ---------------------------------------------------------------------------

export const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  // Code / data
  'text/javascript',
  'text/typescript',
  'application/json',
  'text/html',
  'text/css',
  'application/xml',
  'text/xml',
])

/** 50 MB upload limit. */
export const MAX_FILE_SIZE = 50 * 1024 * 1024

// ---------------------------------------------------------------------------
// Storage paths
// ---------------------------------------------------------------------------

/** Absolute path to the uploads root (data/uploads/ inside project root). */
export function uploadsRoot(): string {
  return path.join(process.cwd(), 'data', 'uploads')
}

/** Absolute directory for a specific task's uploads. */
export function taskUploadsDir(taskId: string): string {
  return path.join(uploadsRoot(), taskId)
}

/** Ensure the per-task upload directory exists. */
export function ensureTaskUploadsDir(taskId: string): string {
  const dir = taskUploadsDir(taskId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Sanitise a filename: strip directory components, replace non-alphanumeric
 * characters (except dots and hyphens) with underscores, and truncate to 200
 * chars to stay safe for all filesystems.
 */
export function sanitiseFilename(raw: string): string {
  const base = path.basename(raw)
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}

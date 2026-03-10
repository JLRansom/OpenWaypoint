# Current Sprint

> Last updated: 2026-03-10 (review fix pass)

## Active Worktrees
_(none — all worktrees cleaned up)_

## In Progress
- [ ] Authentication & role-based access (protect dashboard + API routes)
- [ ] Agent log search & filtering

## Up Next
- [ ] Deployment pipeline (Docker / Vercel)
- [ ] Persistent working directory integration (agent file system access)
- [ ] Error handling & retry UX improvements (phase 2: structured error objects, replace split-string convention)
- [ ] Files API executor integration (upload via `anthropic.beta.files.upload()` for API-based executor when added)

## Recently Done
- [x] File attachments for task cards — drag/drop onto cards, image/PDF/text previews in modal, count badge on card, agent prompt injection of file content (inline ≤100KB text, path reference for binaries); `task_files` table + migration 0007; `FileDropZone` + `FileAttachmentList` components; server-only `lib/file-utils.ts`; `formatFileSize` added to `format-utils.ts`; security hardening: path traversal guards on all three disk-delete code paths (file DELETE, task DELETE bulk cleanup, file content serve), ownership check before DB delete, `Content-Disposition` sanitisation, forward-slash path normalization, `UploadState.id` UUID fix (2026-03-10)
- [x] Extract `ROLE_COLORS` to `lib/constants.ts` — DRY fix; also extracted `ROLE_COLOR_FALLBACK`; both consumers updated (2026-03-09)
- [x] Agent stats review fixes — journal entry for 0006_agent_stats added (was missing, would crash at startup); no-op `?? undefined` removed from local.ts; partial stats emitted on error results; `finalStats` capture comment; `totalTokens` clarification in agentService; Step 12 fallback estimation (~tokens) in KanbanCard (2026-03-09)
- [x] Agent stats on cards — `AgentStats` type, `onStats` pipeline through executor→runner→store→SSE; token/cost columns on `task_runs`; KanbanCard stats row, AgentProgressBar live counter, TaskDetailModal per-run + aggregate stats; new `lib/format-utils.ts` (2026-03-09)
- [x] Delete agents feature — `dbDeleteAgent()` repo, `deleteAgent()` store, refactored DELETE endpoint (action=cancel|delete), trash button on AgentRow + AgentLog, modal auto-close on SSE removal (2026-03-09)
- [x] SVG triangle refactor — replaced `▼`/`▲` unicode chars with inline SVG in `AgentProgressBar` + `TaskDetailModal`; consistent cross-platform rendering (2026-03-09)
- [x] Active-stage arrow indicator — `▼` below active pipeline segment; `textColor` field added to `PipelineStage`; merged directly into master (2026-03-09)
- [x] `taskStartedAt` field — added to Agent type, schema, repo, and service; elapsed timer now uses `taskStartedAt ?? createdAt` for accurate duration tracking (2026-03-09)
- [x] `isAgentActive` utility — extracted shared predicate to `lib/types.ts`; replaced inline `status === 'running' || status === 'queued'` in 3 components (2026-03-09)
- [x] KanbanCard progress bar — AgentProgressBar with segmented pipeline stages, role label, elapsed timer (2026-03-09)
- [x] Error classification UI (reason + recovery hint), graceful failure cards, auto-merge on senior sign-off, backlog minor-issue parsing (2026-03-08)
- [x] Agent terminal modal + history terminal tab
- [x] Edit project modal (name, description, directory fields)
- [x] Executor abstraction layer (pluggable model configs per project)
- [x] Automated multi-agent pipeline (researcher → coder → senior-coder) with real cancellation + results tab
- [x] SQLite + Drizzle ORM migration (replaced in-memory singleton store)
- [x] Idle agent pool model
- [x] Trello-style Kanban board (cards, columns, drag-and-drop, fluid layout)

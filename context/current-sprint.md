# Current Sprint

> Last updated: 2026-03-10 (analytics panel in progress)

## Active Worktrees
- `feat/project-analytics` — PR ready, awaiting merge (`worktrees/feat-project-analytics`)

## In Progress
- [ ] Authentication & role-based access (protect dashboard + API routes)
- [ ] Agent log search & filtering

## Up Next
- [ ] Deployment pipeline (Docker / Vercel)
- [ ] Persistent working directory integration (agent file system access)
- [ ] Error handling & retry UX improvements (phase 2: structured error objects, replace split-string convention)
- [ ] Files API executor integration (upload via `anthropic.beta.files.upload()` for API-based executor when added)

## Recently Done
- [x] Project analytics panel — Board/Analytics URL toggle (`?view=analytics`) on project pages; 4 Recharts charts (weekly tasks, daily tokens, cumulative cost, cost-by-role); summary stats row; time range presets (7d/30d/90d/all); `analyticsRepo.ts` + `GET /api/projects/[id]/analytics`; `ROLE_HEX` constants; recharts dep added; worktree `feat/project-analytics` (2026-03-10)
- [x] Vitest test suite for file I/O — 75 tests (unit, integration, E2E round-trip); DB + disk isolation per worker; Windows-safe fixture seeding; merged into master (2026-03-10)
- [x] Server-side token pricing — `lib/pricing.ts` with MODEL_PRICING table (claude-opus/sonnet/haiku families); `calculateCost()` with longest-prefix matching for snapshot-dated model IDs; live costUsd on every onStats emit; fallback in agentService before dbAddTaskRun; `POST /api/runs/backfill-costs` for historical rows; live cost in AgentProgressBar; input/output cost breakdown tooltip in TaskDetailModal (2026-03-10)
- [x] File attachments — review fix pass: strict path traversal guard (removed `&& diskPath !== root` clause in content route + fileId delete route); `key={u.id}` on UploadToast in both compact and full variants; `sizeBytes: buffer.length` (actual written bytes, not browser-reported `file.size`) (2026-03-10)
- [x] File attachments for task cards — drag/drop onto cards, image/PDF/text previews in modal, count badge on card, agent prompt injection of file content (inline ≤100KB text, path reference for binaries); `task_files` table + migration 0007; `FileDropZone` + `FileAttachmentList` components; server-only `lib/file-utils.ts`; `formatFileSize` added to `format-utils.ts`; security hardening: path traversal guards on all three disk-delete code paths, ownership check, `Content-Disposition` sanitisation, forward-slash normalization (2026-03-10)
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

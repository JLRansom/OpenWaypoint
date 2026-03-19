# Architecture Decision Records

> Append new entries at the top. Keep each entry ≤ 10 lines.

## ADR-040 — Role-aware health baselines (2026-03-18)
**Decision:** Add `lib/health-baselines.ts` — a dedicated module that computes and caches 30-day median baselines (completionRate, errorDensity, weeklyThroughput) per agent role. `applyRoleBaseline()` in `health.ts` normalises raw sub-metrics relative to the role's median before badge thresholds are applied, so a tester at 72% completion looks healthy if testers average 70% but alarming if they average 92%.
**Architecture:** `BaselineNorms` interface defined in `health.ts` (not `health-baselines.ts`) to break the potential circular import. `health-baselines.ts` satisfies it structurally. 5-minute TTL cache; `MIN_COHORT_SIZE = 3` guard falls back to flat thresholds when cohort is too thin. Feature-flagged via `ROLE_BASELINES_ENABLED` env var (default off) for safe A/B rollout.
**Degradation contract:** Cohort < 3 → flat thresholds. Agent < 5 runs → skip (hasEnoughData unchanged). Baseline metric null or zero → skip that sub-metric. DB error → return stale cache or null-metrics. New role → cohort = 0 → flat thresholds until data accumulates (≈2–3 weeks).
**New role warning:** Adding a new AgentType requires a baseline recalibration period; documented in `docs/agent-types.md`.
**Affects:** `lib/health-baselines.ts` (new), `lib/health.ts` (+`applyRoleBaseline`, `BaselineNorms`, `MIN_COHORT_SIZE_FOR_BASELINE`), `lib/health-cache.ts` (+role lookup, feature flag), `lib/db/repositories/taskRunRepo.ts` (+`dbGetTaskRunsByRole`), `__tests__/unit/health-baselines.test.ts` (new), `__tests__/unit/health-cache.test.ts` (extended), `docs/agent-types.md`.
**PR:** #28 (`feat/role-aware-health-baselines`) — depends on #26, #27.

## ADR-037 — Meetings toggle in HistoryList + global meetings API (2026-03-14)
**Decision:** Added `mode` state (`'runs' | 'meetings'`) to `HistoryList`. Meetings view shows a filterable table (date, topic, project, status, agents, tokens, cost) via a new global `GET /api/meetings` endpoint. Endpoint enriches data from `dbGetAllMeetings()` + per-meeting message aggregations (agentCount, totalTokens, totalCostUsd). Supports `from`/`to` epoch-ms and `status` query params.
**Why:** History tab covers all runs; logical to extend it to meetings. Global endpoint needed because /history has no projectId.
**Affects:** `app/api/meetings/route.ts` (new), `lib/db/repositories/meetingRepo.ts` (+`dbGetAllMeetings`), `components/HistoryList.tsx`.
**PR:** #19 merged (2026-03-17).

## ADR-036 — Meeting analytics stats in AnalyticsPanel (2026-03-14)
**Decision:** Added `dbGetMeetingAnalytics(projectId, from?, to?)` that joins `meetings` + `meeting_messages`, aggregates concluded meetings by day. Analytics route merges `meetingStats` into response. AnalyticsPanel shows 2 new stat cards (Meetings Held, Meeting Cost) and a Meetings Over Time BarChart with Line overlay for cost.
**Affects:** `lib/types.ts` (+`MeetingAnalytics`, `MeetingsByDayData`), `analyticsRepo.ts`, `app/api/projects/[id]/analytics/route.ts`, `components/AnalyticsPanel.tsx`.
**PR:** #18 merged (2026-03-17).

## ADR-035 — Per-project meeting memory via settings table (2026-03-14)
**Decision:** Meeting memory stored in existing `settings` table with key `meeting-memory:{projectId}`. On `runMeeting()` start, memory is injected into all agent system prompts as "Past Meeting Context". After conclusion, a 2–3 sentence summary is prepended (bullet format); trimmed to 4000 chars at last complete bullet when full. Collapsible UI in MeetingsPanel; GET/DELETE `/api/projects/[id]/meeting-memory`.
**Pattern:** Reuses `getSetting`/`setSetting` — no new table or migration needed.
**Affects:** `lib/services/agentService.ts`, `app/api/projects/[id]/meeting-memory/route.ts` (new), `components/MeetingsPanel.tsx`.
**PR:** #17 merged (2026-03-17).

## ADR-034 — First-class project tags with hex colors (2026-03-14)
**Decision:** Added `project_tags` table (migration 0019) with `id, project_id, name, color (hex), created_at`. Tags become first-class entities; KanbanCard/Column/Board look up the hex color from `StreamPayload.projectTags` and apply it via inline styles (background + '33', border + '55' for transparency). Pipeline auto-tags (approved, etc.) retain their Tailwind classes. TagsPanel (new tab) provides CRUD with a 12-swatch inline color picker (no external library).
**Why:** Task.tags was an unmanaged string array; no way to assign colors consistently. Per-project tag entities allow color management and future per-project tag namespacing.
**Affects:** `lib/db/schema.ts`, `lib/types.ts`, `lib/db/repositories/tagRepo.ts` (new), `lib/store.ts`, API routes (new), `components/TagsPanel.tsx` (new), `components/KanbanCard/Column/Board.tsx`, `components/ProjectViewToggle.tsx`, `app/projects/[id]/page.tsx`.
**PR:** #16 merged (2026-03-17).

## ADR-033 — "Create Card" button on concluded meetings (2026-03-14)
**Decision:** Added "Create Card" button to MeetingView's concluded-meeting footer. Uses tester agent's final output as the card description; falls back to concatenated all-agent outputs. POSTs to existing `POST /api/projects/:id/tasks` endpoint — no new route. Shows loading + success states (`creatingCard`, `cardCreated`).
**Affects:** `components/MeetingView.tsx` only.
**PR:** #15 merged (2026-03-17).

## ADR-032 — Meetings v2: writer autonomy + in-app scheduling + croner (2026-03-13)
**Decision:** Removed manual topic input — writer agent receives project task list and generates idea autonomously; topic auto-extracted from first sentence of writer output. In-app cron scheduling via `croner` library + `meeting_schedules` DB table + 30s `setInterval` singleton in `lib/meeting-scheduler.ts`. SSE payload now includes `meetingSchedules`. Calendar grid (no library) is the default meetings view.
**Why:** User shouldn't need to prime the AI with ideas. Recurring meetings needed a reliable cron mechanism without adding a job queue. Calendar view is more useful than a flat list.
**Alternatives rejected:** Claude Code scheduled tasks (can't call MCP tools from web app). External calendar library (vanilla Date math sufficient for month grid).
**Affects:** `lib/types.ts`, `lib/db/schema.ts`, `lib/store.ts`, `lib/services/agentService.ts`, `lib/meeting-scheduler.ts`, `lib/cron-utils.ts`, all Meeting* components.
**PR:** #11 merged (2026-03-14).

## ADR-031 — Extract getMondayEpoch helper to eliminate duplication (2026-03-13)
**Decision:** Extracted `export function getMondayEpoch(epochMs): number` in `analyticsRepo.ts`. Both `getMondayKey()` and the `weekLabel` initialiser now delegate to it. Uses `getUTCDay`/`setUTCDate`/`setUTCHours` for timezone-deterministic results.
**Why:** Two independent Monday-calculation implementations existed in the same file (local-time `setDate/getDay` in `getMondayKey` vs inline epoch arithmetic in `weekLabel`). Senior review flagged that test helpers would need a third copy. Exporting the function prevents future test drift.
**Alternatives rejected:** Keeping local-time methods (would still fix duplication, but UTC is strictly safer for server code).
**Affects:** `lib/db/repositories/analyticsRepo.ts` only.
**PR:** #9 merged (2026-03-13).

## ADR-030 — Project dashboard replaces Analytics as default view (2026-03-13)
**Decision:** Renamed "Analytics" → "Dashboard"; made it the default (`view !== 'board'`). Dashboard now shows 6 stat cards (Tasks Done, Failed Runs, Active Tasks, Total Cost, Avg Cost/Run, Success Rate), a task pipeline strip (all statuses with counts, dimmed at 0), a two-column activity section (Recent Runs + Recently Updated Tasks), and the existing 4 Recharts charts. Route handler enriches analytics response with task-store data (`taskStatusCounts`, `recentlyUpdatedTasks`, `activeTaskCount`, `successRate`). New types: `RecentRunEntry`, `RecentTaskEntry`, `TaskStatusCount` added to `lib/types.ts`. `ProjectAnalyticsSummary` gains `avgDurationMs`, `activeTaskCount`, `successRate`.
**URL:** `/projects/[id]` = Dashboard (default), `/projects/[id]?view=board` = Board.
**Alternatives rejected:** New API endpoint for task data (unnecessary — route handler already has store access).
**Affects:** `lib/types.ts`, `lib/db/repositories/analyticsRepo.ts`, `app/api/projects/[id]/analytics/route.ts`, `app/projects/[id]/page.tsx`, `components/ProjectViewToggle.tsx`, `components/AnalyticsPanel.tsx`.
**Status:** Accepted (direct commit to master, per user instruction).

## ADR-029 — Lift /runs and /files fetches to KanbanCard to eliminate double-fetch on modal open (2026-03-13)
**Decision:** Moved both `/api/tasks/{id}/runs` and `/api/tasks/{id}/files` fetches from `TaskDetailModal`/`FileAttachmentList` into `KanbanCard`. A single `useEffect([modalOpen, task.id])` fires both in parallel when the modal opens. Data is passed as props (`runs`, `runsLoading`, `files`, `onFilesRefresh`). `FileAttachmentList` gained an `initialFiles` prop — when provided it seeds state directly and skips its own HTTP fetch.
**Why:** Modal components owning their own `useEffect` fetches violated "components are pure UI — receive data as props". React's component lifecycle (cleanup → re-run) produced one cancelled + one successful request per endpoint on every card open.
**Alternatives rejected:** `reactStrictMode: false` (hides symptoms, loses StrictMode benefits); deduplication ref (fights React model).
**Affects:** `components/KanbanCard.tsx`, `components/TaskDetailModal.tsx`, `components/FileAttachmentList.tsx`.
**Status:** Accepted (direct commit to master, per user instruction).

## ADR-028 — task.fileCount derived field eliminates per-card fetch waterfall (2026-03-12)
**Decision:** Added `fileCount?: number` as a derived (non-stored) field on `Task`. Computed via a single `SELECT task_id, COUNT(*) FROM task_files GROUP BY task_id` (one query for bulk fetches). `FileAttachmentList` compact mode accepts a `preloadedCount` prop — when provided it skips the HTTP fetch entirely. `KanbanCard` passes `task.fileCount ?? 0`. `addTaskFile`/`deleteTaskFile` in `store.ts` now broadcast SSE so counts stay live.
**Why:** N cards → N `GET /api/tasks/{id}/files` on board open; a 20-task board fired 20 requests just for count badges.
**Alternatives rejected:** LEFT JOIN in task queries (more complex, broke existing `.map(rowToTask)` pattern); client-side cache (complexity for little gain).
**Affects:** `lib/types.ts`, `lib/db/repositories/taskRepo.ts`, `lib/store.ts`, `components/FileAttachmentList.tsx`, `components/KanbanCard.tsx`.
**Branch:** `fix/file-count-perf` — PR #7 open.
**Status:** Accepted.

## ADR-027 — History role filter extended to Tester + Writer (2026-03-12)
**Decision:** `RoleFilter` type and `ROLE_OPTIONS` in `HistoryList.tsx` now include `'tester'` and `'writer'`. The API already accepted any role string — this was a UI-only omission.
**Affects:** `components/HistoryList.tsx`, `__tests__/integration/history-tester-filter.test.ts`.
**Branch:** `fix/history-tester-filter` — PR #6 open.
**Status:** Accepted.

## ADR-026 — Task tag system + board filter (2026-03-12)
**Decision:** Added `tags TEXT NOT NULL DEFAULT '[]'` (JSON array) to `tasks` via migration 0009. Tags managed via `PATCH /api/tasks/[id]` (sanitised: lowercase, dedup, max 32 chars, max 20). Displayed as coloured pills on cards; editable in `TaskDetailModal`. Pipeline auto-stamps verdict tags (`approved`, `changes-requested`, `tests-passed`, `tests-failed`). Board filter bar (client-side AND logic) + `?tags=` API param (DB LIKE per tag).
**Colour convention:** green=approved/tests-passed, red=changes-requested/bug/blocked, orange=tests-failed, purple=default.
**Affects:** `lib/types.ts`, `lib/db/schema.ts`, migration 0009, `taskRepo.ts`, `app/api/tasks/[id]/route.ts`, `app/api/projects/[id]/tasks/route.ts`, `agentService.ts`, `KanbanCard.tsx`, `KanbanBoard.tsx`, `TaskDetailModal.tsx`.
**Branch:** `feat/card-tags` PR #4 + `feat/tag-filter` PR #5.
**Status:** Accepted.

## ADR-025 — Archive filter on GET /api/projects/[id]/tasks (2026-03-12)
**Decision:** Added `?archived=` query-parameter filtering to the tasks listing endpoint. `?archived=true` returns only archived tasks, `?archived=false` returns only active tasks, `?archived=all` or no param returns everything (backward-compatible). Logic lives in `TaskQueryOptions` + Drizzle `and(eq(projectId), eq(archived))` in `dbGetTasksByProject`; store wrapper forwards the opts; route handler parses the string param.
**Why:** `Task.archived` was already persisted but the listing endpoint exposed no way to filter — dashboards had to do client-side filtering over a potentially large dataset.
**Scope:** API + repo only; UI toggle for showing/hiding archived tasks is a separate ticket.
**Affects:** `lib/db/repositories/taskRepo.ts`, `lib/store.ts`, `app/api/projects/[id]/tasks/route.ts`, `__tests__/integration/task-archive-filter.test.ts` (new, 5 tests).
**Branch:** `feat/task-archive-filter` — PR #3 open.
**Status:** Accepted.

## ADR-024 — Tester role API unblock + prompt improvements (2026-03-12)
**Decision:** Fixed two API validation arrays that were silently blocking the tester role: `validTypes` in `app/api/agents/route.ts` and `VALID_ROLES` in `app/api/tasks/[id]/assign/route.ts` both omitted `'tester'`. Without this fix, tester agents could never be spawned (400 from dashboard) and the "Assign Tester" button always returned 400. Since no idle tester could ever exist, `agentService` always hit the "no idle tester" fallback after `VERDICT: APPROVED`, marking tasks done and skipping testing entirely.
**Prompt improvement:** Tester system prompt rewritten with an explicit 5-step process: (1) study implementation, (2) write test files (`.test.ts` / `test_*.py` / `*_test.go`), (3) run project test runner (`npm run test:run`, `pytest`, `go test`), (4) fix infra issues and re-run, (5) report failures without fixing implementation bugs. Verdict format enforced: `VERDICT: TESTS PASSED` / `VERDICT: TESTS FAILED`.
**Affects:** `app/api/agents/route.ts`, `app/api/tasks/[id]/assign/route.ts`, `lib/services/agentService.ts`.
**Branch:** `fix/tester-pipeline` — PR #2 open.
**Status:** Accepted.

## ADR-023 — Analytics test coverage + NaN guard in analytics route (2026-03-12)
**Decision:** Added 15 unit tests for `dbGetProjectAnalytics` and 5 integration tests for `GET /api/projects/[id]/analytics`. Also fixed a NaN bug in the route: `parseInt('abc', 10)` returns `NaN`; passing NaN to Drizzle's `gte`/`lte` causes all rows to be filtered out (SQL `col >= NaN` is always false). Route now guards: `const from = fromParsed !== undefined && !Number.isNaN(fromParsed) ? fromParsed : undefined`.
**avgCostPerRun formula:** `totalCostUsd / totalRunsDone` — numerator is ALL runs' cost (done + failed), denominator is done-only count. Divides the full total by done so the per-success cost is meaningful.
**Timezone safety:** `getDayKey()` uses `toISOString()` (UTC, deterministic). `getMondayKey()` uses `getDay()` (local time) — safe when timestamps are noon UTC 7+ days apart. Tests never assert string date labels (locale-dependent).
**Drizzle migration limit (ADR-022):** `better-sqlite3` migrator passes entire `.sql` file as one string — cannot run multiple statements even with `-->statement-breakpoint`. Solved by keeping each migration file single-statement; seed defaults enforced in code (`=== 'true'` check, defaults to `false`).
**Affects:** `__tests__/unit/analytics-repo.test.ts` (new), `__tests__/integration/analytics-api.test.ts` (new), `__tests__/helpers/test-utils.ts` (+`makeTestTaskRun`), `app/api/projects/[id]/analytics/route.ts`.
**Status:** Accepted.

## ADR-022 — Security hardening sprint (2026-03-12)
**Decision:** 8 security commits on master: HTTP headers (CSP/X-Frame-Options/nosniff via `next.config.ts`); MIME allowlist tightened (removed `text/html`, `text/js`, `text/css`; SVG served as `attachment`); path traversal guard in `buildFileContext`; bulk `taskIds` cap (500); LIKE wildcard escaping with `ESCAPE '\\'` via `sql` tag (Drizzle's `like()` has no escape clause); directory path traversal rejection in project create/update; git commit-msg newline injection fix; `--dangerously-skip-permissions` moved from hardcoded CLI args to a Settings page DB toggle.
**Settings table:** Migration `0008_settings.sql` — single `CREATE TABLE` only (no seed INSERT; `better-sqlite3` can't run multi-statement files). Default `'false'` enforced in `settingsRepo.ts` via `?? 'false'` fallback.
**Authentication skipped:** Localhost-only project; authentication deferred to a future sprint.
**Affects:** `next.config.ts`, `lib/file-utils.ts`, `app/api/files/[id]/content/route.ts`, `lib/services/agentService.ts`, `app/api/tasks/bulk/route.ts`, `lib/db/repositories/taskRunRepo.ts`, `app/api/projects/route.ts`, `app/api/projects/[id]/route.ts`, `lib/git-utils.ts`, `lib/db/` (schema + migration 0008), `lib/store.ts`, `app/api/settings/route.ts` (new), `app/settings/page.tsx` (new), `components/SettingsClient.tsx` (new), `components/Sidebar.tsx`, `lib/executors/local.ts`.
**Status:** Accepted.

## ADR-021 — Project analytics panel (2026-03-10)
**Decision:** Added Board/Analytics URL toggle (`?view=analytics`) on project pages. Analytics data served from `GET /api/projects/[id]/analytics?from=&to=` backed by `analyticsRepo.ts` — single `SELECT` on `task_runs` filtered by `projectId` + optional epoch-ms window, aggregated in JS (no SQL GROUP BY needed at current scale).
**Charts:** 4 Recharts charts — weekly tasks done/failed (BarChart), daily input+output tokens (LineChart), cumulative cost (AreaChart with gradient), cost by agent role (horizontal BarChart with Cell per-bar coloring). All themed with Dracula hex palette via file-local `D` constant (Tailwind classes can't be used as SVG fill props).
**Toggle:** `ProjectViewToggle` client component uses `router.push(?view=...)` — URL is shareable and survives refresh. Board is the default (`view !== 'analytics'`).
**Per-bar colors:** Recharts requires `<Cell fill={hex}>` children inside `<Bar>` for per-bar colors; SVG `fill` can't take Tailwind classes. Added `ROLE_HEX` + `ROLE_HEX_FALLBACK` to `lib/constants.ts` alongside existing `ROLE_COLORS`.
**Affects:** `lib/types.ts`, `lib/constants.ts`, `lib/db/repositories/analyticsRepo.ts` (new), `app/api/projects/[id]/analytics/route.ts` (new), `components/ProjectViewToggle.tsx` (new), `components/AnalyticsPanel.tsx` (new), `app/projects/[id]/page.tsx`, `package.json` (+recharts).
**Status:** Accepted.

## ADR-020 — Vitest test suite for file I/O (2026-03-10)
**Decision:** Installed Vitest 3 (native ESM + TS, no Babel) as the test framework. 75 tests across 6 files cover `lib/file-utils.ts` units, all four file route handlers (upload/download/delete/list), and an E2E round-trip test.
**DB isolation:** `setupFiles` sets a unique `SQLITE_DB_PATH` per worker before any module loads. `lib/db/client.ts` reads this at module-init time, so each test file gets a fresh SQLite DB (migrations run automatically). No dev-DB pollution.
**Disk isolation:** Tests write to the real `data/uploads/` tree in the worktree using unique task UUIDs; `afterAll` removes the task-specific subdirectory. No `fs` mocking needed.
**Windows gotcha:** Content-Disposition sanitisation tests store malicious filenames (`"`, `\n`, `\`) only in the DB `filename` field — never in the actual on-disk filename (illegal chars crash `writeFileSync` on Windows). `seedFile()` always uses a UUID-only disk name.
**Path-alias:** `vitest.config.ts` maps `@/*` → `./` to match `tsconfig.json` paths.
**Affects:** `vitest.config.ts` (new), `package.json` (+test scripts), `__tests__/` tree (new).
**Status:** Accepted.

## ADR-019 — Server-side token pricing table (2026-03-10)
**Decision:** Added `lib/pricing.ts` with a `MODEL_PRICING` table (keyed by model ID prefix) and `calculateCost(inputTokens, outputTokens, model)` utility. Cost is now computed server-side for every run, not just when the Claude CLI emits `cost_usd` in the result line.
**Why:** `cost_usd` in the CLI result line is optional and absent for many runs; this left `costUsd` blank in the UI. Prefix-matching handles snapshot-dated model IDs (e.g. `claude-opus-4-6-20260301`); longest-prefix wins so `claude-opus-4-6` beats `claude-opus-4`.
**Priority:** CLI-reported `cost_usd` still takes priority in the success result handler — the pricing table is a fallback only. Live streaming emits calculated cost on every `message_start` / `message_delta` event so cost appears during execution, not just at the end.
**Backfill:** `POST /api/runs/backfill-costs` recalculates `costUsd` for historical rows where it is null but token counts + model are present. Idempotent.
**UI:** `AgentProgressBar` now shows live cost for general boards and pipeline boards; `TaskDetailModal` run rows show input/output cost breakdown on hover tooltip.
**Affects:** `lib/pricing.ts` (new), `lib/executors/local.ts`, `lib/services/agentService.ts`, `components/AgentProgressBar.tsx`, `components/TaskDetailModal.tsx`, `app/api/runs/backfill-costs/route.ts` (new).
**Status:** Accepted.

## ADR-018 — File attachments for task cards (2026-03-10) [updated: review-fix 2026-03-10]
**Decision:** Store uploaded files on local disk (`data/uploads/{taskId}/{uuid}-{filename}`) tracked in a new `task_files` SQLite table with CASCADE delete. Browser-safe utilities (`formatFileSize`) live in `lib/format-utils.ts`; server-only utilities (`fs`, `path`, MIME allow-list) live in `lib/file-utils.ts` to avoid Next.js bundling Node modules into client chunks.
**UI:** `FileDropZone` detects file drags via `dataTransfer.types.includes('Files')` so it coexists with dnd-kit card drags without conflict. `FileAttachmentList` has compact (badge) and full (thumbnail + preview) modes.
**Agent integration:** `buildUserPrompt()` in `agentService.ts` reads `dbGetFilesByTask()` and inlines text/code files ≤100 KB; larger/binary files are referenced by absolute path so a local CLI executor can access them via shell tools.
**Security hardening (complete):** Path traversal guard is strictly `diskPath.startsWith(root + path.sep)` — no `&& diskPath !== root` exception — in both `GET /api/files/[id]/content` and `DELETE /api/tasks/[id]/files/[fileId]`; same pattern in bulk task-delete cleanup. File ownership verified before DB delete. `Content-Disposition` filename sanitised. `sizeBytes` stored as `buffer.length` (actual written bytes). `Content-Length` uses `buffer.length`. `storagePath` stored with forward slashes. `UploadToast` uses `key={u.id}` (stable UUID) not index in both compact and full `FileDropZone` variants.
**Deferred:** Anthropic Files API (`anthropic.beta.files.api`) integration deferred until an API-based executor is added; pattern documented in spec.
**Affects:** `lib/types.ts`, `lib/db/schema.ts`, `lib/db/migrations/0007_task_files.sql`, `lib/db/repositories/taskFileRepo.ts`, `lib/store.ts`, `lib/file-utils.ts`, `lib/format-utils.ts`, `lib/services/agentService.ts`, `app/api/tasks/[id]/route.ts`, `app/api/tasks/[id]/files/`, `app/api/files/`, `components/FileDropZone.tsx`, `components/FileAttachmentList.tsx`, `components/KanbanCard.tsx`, `components/TaskDetailModal.tsx`.
**Status:** Accepted.

## ADR-017 — ROLE_COLORS extracted to lib/constants.ts (2026-03-09)
**Decision:** Moved `ROLE_COLORS` (Record<string, string>, 5 role entries) and `ROLE_COLOR_FALLBACK` out of `TaskDetailModal.tsx` and `HistoryList.tsx` into a new `lib/constants.ts`.
**Why:** The map was byte-identical in both files — classic DRY violation. Any new role or color change now needs exactly one edit.
**Pattern:** `lib/constants.ts` is the canonical home for shared UI constants (Tailwind class maps, fallback strings). Import from there; never redefine locally.
**Worktree:** `refactor/extract-role-colors`
**Status:** Accepted.

## ADR-016 — Agent execution statistics on cards (2026-03-09)
**Decision:** Added `AgentStats` type to `Agent` (live, JSON-blob in `agents.stats` column, broadcast via SSE) and token/cost columns directly on `task_runs`. Stats accumulate from `message_start`/`message_delta` stream events for live updates; final `result` line takes priority for definitive totals.
**Why:** Stats column on `agents` must survive SSE re-broadcasts (store reads from DB each broadcast), so in-memory-only wasn't viable. JSON blob keeps migration simple for ephemeral live data. Individual columns on `task_runs` keep historical stats queryable.
**New file:** `lib/format-utils.ts` consolidates `formatTokens`, `formatDuration`, `formatElapsed` (previously duplicated in 3 components).
**Migration:** `0006_agent_stats.sql` — all new columns nullable; old rows display `—` gracefully.
**Affects:** `lib/types.ts`, `lib/db/schema.ts`, `lib/db/migrations/`, `lib/executors/`, `lib/agent-runner.ts`, `lib/services/agentService.ts`, `lib/db/repositories/`, `components/KanbanCard.tsx`, `components/AgentProgressBar.tsx`, `components/TaskDetailModal.tsx`.
**Status:** Accepted.

## ADR-015 — DELETE /api/agents/[id] action dispatch via JSON body (2026-03-09)
**Decision:** Refactored DELETE endpoint to read `action` from JSON body: `action=cancel` preserves existing cancel behavior; `action=delete` (default) permanently deletes the agent row.
**Why:** Avoids introducing a new endpoint or query-param surface; DELETE body is RFC-valid; body is already parsed for cancel payloads. Default-to-delete makes the endpoint RESTful (DELETE means remove).
**Validation:** 409 returned if agent is `running` or `queued`; task `activeAgentId` is cleared before deletion; `agentEvents` cascade-deleted via FK.
**Affects:** `app/api/agents/[id]/route.ts`, `lib/store.ts`, `lib/db/repositories/agentRepo.ts`, `components/AgentRow.tsx`, `components/AgentLog.tsx`.
**Status:** Accepted.

## ADR-014 — isAgentActive() utility in lib/types.ts (2026-03-09)
**Decision:** Extracted `isAgentActive(agent?: Agent | null): boolean` into `lib/types.ts`, replacing the inline `status === 'running' || status === 'queued'` expression duplicated across AgentProgressBar, AgentTerminalModal, and KanbanCard.
**Why:** Single source of truth for the "running or queued" semantic. If the `AgentStatus` type ever grows (e.g. `'paused'`), one edit suffices.
**Naming:** `isAgentActive` (not `isAgentRunning`) to avoid confusion with the intentional bare `status === 'running'` checks in AgentRow and AgentLog that exclude `queued` by design.
**Affects:** `lib/types.ts`, `components/AgentProgressBar.tsx`, `components/AgentTerminalModal.tsx`, `components/KanbanCard.tsx`.
**Status:** Accepted.

## ADR-013 — PipelineStage textColor + active-stage arrow indicator (2026-03-09)
**Decision:** Added `textColor: string` to `PipelineStage` interface (explicit Tailwind class, not dynamic string replace). Rendered `▼` (U+25BC) in a `flex justify-center` div below the active segment; `text-[8px] leading-none`; no pulse.
**Why:** Dynamic `bg-` → `text-` string replace risks Tailwind purge removing classes. Explicit field is safe. Arrow provides an unambiguous visual anchor beyond color+pulse alone.
**Affects:** `components/AgentProgressBar.tsx` — interface, both pipeline arrays, render loop.
**Status:** Accepted.

## ADR-012 — Agent taskStartedAt field for accurate elapsed timer (2026-03-09)
**Decision:** Added `taskStartedAt: number | null` to the `Agent` type, Drizzle schema (`task_started_at` INTEGER), repo, and service. `AgentProgressBar` uses `taskStartedAt ?? createdAt` as the timer origin.
**Why:** `createdAt` is set when the agent record is created (may be seconds before task assignment). `taskStartedAt` is set at task dispatch, giving an accurate elapsed duration per task.
**Migration:** `0005_agents_task_started_at.sql` — nullable column, old rows fall back to `createdAt` gracefully.
**Affects:** `lib/types.ts`, `lib/db/schema.ts`, `lib/db/agentRepo.ts`, `lib/agentService.ts`, `components/AgentProgressBar.tsx`.
**Status:** Accepted.

## ADR-011 — AgentProgressBar: explicit null guard + destructured createdAt (2026-03-09)
**Decision:** Split `!activeAgent?.createdAt` into `!activeAgent` (explicit null-check) + destructure `const { createdAt } = activeAgent` after the guard. Closure closes over a `const number`, eliminating narrowing ambiguity.
**Why:** `createdAt` is `number` (never optional) on `Agent`; `?.` was doing double duty for null-check and falsy-check. Destructuring makes intent unambiguous and prevents stale-reference risk in `setInterval`.
**Affects:** `components/AgentProgressBar.tsx` — the useEffect block (around line 102).
**Status:** Accepted.

## ADR-010 — AgentProgressBar: pipeline stages on KanbanCard (2026-03-09)
**Decision:** New `AgentProgressBar` component shows segmented pipeline (Research→Code→Review→Test for coding boards, single stage for research, role chip + timer only for general). Renders in KanbanCard bottom-meta section.
**Key constraint:** `showProgressBar` guards against general boards with no active agent to prevent an empty border container — `isAgentRunning || (boardType !== 'general' && MID_PIPELINE.includes(task.status))`.
**Affects:** `components/AgentProgressBar.tsx` (new), `components/KanbanCard.tsx`.
**Status:** Accepted.

## ADR-009 — Multi-agent pipeline with review cycles (2026-03-08)
**Context:** Projects need structured multi-agent workflows without manual hand-offs.
**Decision:** Automated researcher → coder → senior-coder pipeline; each stage hands output to the next; senior-coder can trigger review cycles back to coder. Real cancellation cancels the active stage.
**Status:** Accepted.

## ADR-008 — Executor abstraction layer (2026-03-08)
**Context:** Different projects may need different model configs, system prompts, or provider backends.
**Decision:** `executor` interface wraps model call details; each project can bind a different executor config without changing pipeline logic.
**Status:** Accepted.

## ADR-007 — Idle agent pool model (2026-03-08)
**Context:** Spawning a new agent process per task introduced latency and wasted resources.
**Decision:** Agents are spawned once into an idle pool and assigned tasks on demand; they return to idle after completion rather than being destroyed.
**Status:** Accepted.

## ADR-006 — SQLite + Drizzle ORM (2026-03-08)
**Context:** In-memory singleton store (ADR-002) couldn't survive server restarts and blocked multi-process deployments.
**Decision:** Migrate to SQLite via Drizzle ORM; schema lives in `/lib/db`; all state access goes through Drizzle queries instead of `getStore()`.
**Supersedes:** ADR-002.
**Status:** Accepted.

## ADR-005 — Project context system + brain skill (2026-03-08)
**Context:** Needed a structured way to maintain project memory across sessions.
**Decision:** `context/` directory with roadmap, decisions, and sprint files; `.agents/skills/brain/` skill manages them.
**Status:** Accepted.

## ADR-004 — Tailwind + Dracula theme (2026-03-08)
**Context:** Needed consistent dark-mode styling across the dashboard.
**Decision:** Use Tailwind CSS with `tailwind-dracula` plugin for a unified colour palette.
**Status:** Accepted.

## ADR-003 — Server-Sent Events for real-time updates (2026-03-08)
**Context:** Needed push updates for agent status without WebSocket complexity.
**Decision:** SSE endpoint at `/api/stream` — simpler, HTTP-native, no extra infrastructure.
**Status:** Accepted.

## ADR-002 — In-memory singleton store (2026-03-08)
**Context:** Need shared state across API routes during prototype phase.
**Decision:** `getStore()` singleton in `/lib/store.ts`. Will replace with a database when persistence is needed.
**Status:** Superseded by ADR-006.

## ADR-001 — Next.js 15 App Router (2026-03-08)
**Context:** Need server components, streaming, and API routes in one framework.
**Decision:** Next.js 15 with App Router, TypeScript, and Tailwind CSS.
**Status:** Accepted.

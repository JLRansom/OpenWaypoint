# Current Sprint

> Last updated: 2026-03-13 (2)

## Active Worktrees
- `feat/task-archive-filter` — PR #3 open, awaiting review
- `feat/card-tags` — PR #4 open, awaiting review
- `feat/tag-filter` — PR #5 open, awaiting review (depends on #4)
- `fix/history-tester-filter` — PR #6 open, awaiting review
- `fix/file-count-perf` — PR #7 open, awaiting review
- `fix/double-fetch-modal` — PR #8 merged
- `chore/extract-monday-epoch-helper` — PR #9 open, awaiting review

## In Progress
- [ ] Authentication & role-based access (protect dashboard + API routes)
- [ ] Agent log search & filtering

## Up Next
- [ ] Agent role rename to waypoint theme (`feat/agent-rename`) — see `docs/agent-types.md`
- [ ] Deployment pipeline (Docker / Vercel)
- [ ] Persistent working directory integration (agent file system access)
- [ ] Error handling & retry UX improvements (phase 2: structured error objects)
- [ ] Files API executor integration (upload via `anthropic.beta.files.upload()`)

## Recently Done
- [x] Project dashboard redesign — Dashboard is default view (no `?view=` needed); Board is `?view=board`; 6 stat cards; task pipeline strip; two-column recent runs + recently updated tasks; 4 charts unchanged; `RecentRunEntry`/`RecentTaskEntry`/`TaskStatusCount` types added; route enriches analytics with task-store data; master (2026-03-13)
- [x] Single-fetch on card open — lift `/runs` + `/files` fetches to `KanbanCard`; modal receives data as props; `FileAttachmentList` gains `initialFiles` prop; eliminates cancelled+retry pattern; master (2026-03-13)
- [x] Double-fetch AbortController fix — `AbortController` cleanup on `TaskDetailModal` runs fetch + `FileAttachmentList` files fetch; removes `useCallback` wrapper; PR #8 merged (2026-03-13)
- [x] File-count waterfall fix — `task.fileCount` derived from single SQL GROUP BY; `preloadedCount` prop on compact `FileAttachmentList`; SSE broadcast on file mutations; 9 tests; PR #7 merged (2026-03-12)
- [x] Tag system on cards — `Task.tags`, migration 0009, pipeline auto-stamps verdict tags, card pills, modal editor; 11 tests; PR #4 (2026-03-12)
- [x] Tag filter bar on board — client-side AND filter, pill bar UI, `?tags=` API param, DB LIKE filter; 6 tests; PR #5 (2026-03-12)
- [x] History tester/writer filter fix — `RoleFilter` type + ROLE_OPTIONS now include Tester + Writer; 4 tests; PR #6 (2026-03-12)
- [x] Archive filter on task listing — `?archived=true/false/all` on `GET /api/projects/[id]/tasks`; 5 integration tests; PR #3 open (2026-03-12)
- [x] Tester pipeline fix — `'tester'` added to `validTypes` + `VALID_ROLES`; system prompt rewritten with 5-step QA process; PR #2 merged (2026-03-12)
- [x] Claude Code consolidation — fix settings.json path, launch.json stale entry, CLAUDE.md title/commands; create docs/architecture.md + docs/agent-types.md; prune context (2026-03-12)
- [x] Security hardening (8 commits, master) — HTTP security headers; blocked `text/html`/`text/css`/`text/js`; SVG as attachment; path traversal guards; bulk cap; LIKE escaping; Settings page toggle for `--dangerously-skip-permissions` (2026-03-12)
- [x] Analytics test coverage + CI workflow — 15 unit + 5 integration tests; NaN guard on route params; GitHub Actions workflow; `makeTestTaskRun()` factory (2026-03-12)
- [x] Project analytics panel — Board/Analytics toggle; 4 Recharts charts; summary stats; time range presets; `analyticsRepo.ts` (2026-03-10)
- [x] Vitest test suite for file I/O — 96 tests; DB + disk isolation per worker; Windows-safe (2026-03-10)
- [x] Server-side token pricing — MODEL_PRICING table; live cost on cards; backfill endpoint (2026-03-10)
- [x] File attachments — drag/drop; image/PDF/text previews; agent prompt injection; `task_files` table (2026-03-10)
- [x] Agent stats on cards — live tokens, cost, model; per-run history in TaskDetailModal (2026-03-09)

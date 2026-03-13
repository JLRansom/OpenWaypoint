# Current Sprint

> Last updated: 2026-03-12

## Active Worktrees
- `fix/tester-pipeline` — PR #2 open, awaiting review_

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
- [x] Tester pipeline fix — `'tester'` added to `validTypes` + `VALID_ROLES`; system prompt rewritten with 5-step QA process; PR #2 open (2026-03-12)
- [x] Claude Code consolidation — fix settings.json path, launch.json stale entry, CLAUDE.md title/commands; create docs/architecture.md + docs/agent-types.md; prune context (2026-03-12)
- [x] Security hardening (8 commits, master) — HTTP security headers; blocked `text/html`/`text/css`/`text/js`; SVG as attachment; path traversal guards; bulk cap; LIKE escaping; Settings page toggle for `--dangerously-skip-permissions` (2026-03-12)
- [x] Analytics test coverage + CI workflow — 15 unit + 5 integration tests; NaN guard on route params; GitHub Actions workflow; `makeTestTaskRun()` factory (2026-03-12)
- [x] Project analytics panel — Board/Analytics toggle; 4 Recharts charts; summary stats; time range presets; `analyticsRepo.ts` (2026-03-10)
- [x] Vitest test suite for file I/O — 96 tests; DB + disk isolation per worker; Windows-safe (2026-03-10)
- [x] Server-side token pricing — MODEL_PRICING table; live cost on cards; backfill endpoint (2026-03-10)
- [x] File attachments — drag/drop; image/PDF/text previews; agent prompt injection; `task_files` table (2026-03-10)
- [x] Agent stats on cards — live tokens, cost, model; per-run history in TaskDetailModal (2026-03-09)

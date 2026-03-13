# Roadmap

> Last updated: 2026-03-12

## Current Priorities
1. Authentication & role-based access (protect dashboard + API routes)
2. Agent role rename to waypoint theme (`scout`, `navigator`, `pilot`, `cartographer`, `herald`)
3. Deployment pipeline (Docker / Vercel)

## Planned
- Persistent working directory integration (agent file system access)
- Agent log search & filtering
- Error handling & retry UX improvements (phase 2: structured error objects)
- Notifications / webhooks when pipeline completes
- Files API executor integration (`anthropic.beta.files.upload()` for API-based executor)
- Fix ESLint config (currently broken — `next lint` has no config)
- Fix pre-existing TypeScript errors (3 errors in test-utils, backfill-costs route, vitest.config)

## Completed
- ✅ Claude Code consolidation (settings portability, docs/, context pruning) (2026-03-12)
- ✅ GitHub Actions CI workflow (`npm run test:run` on all PRs) (2026-03-12)
- ✅ Security hardening — CSP headers, MIME allowlist, path traversal guards, LIKE escaping, Settings page (2026-03-12)
- ✅ Analytics test coverage — 15 unit + 5 integration tests; NaN route guard (2026-03-12)
- ✅ Project analytics panel — 4 Recharts charts, summary stats, time range presets (2026-03-10)
- ✅ Vitest test suite — 96 tests (unit, integration, E2E); per-worker DB isolation (2026-03-10)
- ✅ Server-side token pricing — MODEL_PRICING, calculateCost, live cost, backfill endpoint (2026-03-10)
- ✅ File attachments — drag/drop, previews, agent prompt injection, disk storage (2026-03-10)
- ✅ Agent execution stats on cards — live tokens, cost, model, per-run history (2026-03-09)
- ✅ Multi-agent pipeline — researcher → coder → tester → senior-coder with cancellation (2026-03-09)
- ✅ SQLite + Drizzle ORM (replaced in-memory singleton store)
- ✅ Projects page + Kanban board, drag-and-drop, card detail modal
- ✅ SSE streaming for real-time updates
- ✅ Executor abstraction layer (pluggable model configs per project)

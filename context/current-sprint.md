# Current Sprint

> Last updated: 2026-03-18

## Active Worktrees

- `feat/role-aware-health-baselines` — PR #29 open, awaiting review (depends on #26, #27)

## In Progress
- [ ] Role-aware health baselines — PR #29 open (awaiting #26 + #27 as prerequisites)
- [ ] Authentication & role-based access (protect dashboard + API routes)
- [ ] Agent log search & filtering

## Up Next
- [ ] Agent role rename to waypoint theme (`feat/agent-rename`) — see `docs/agent-types.md`
- [ ] Deployment pipeline (Docker / Vercel)
- [ ] Persistent working directory integration (agent file system access)
- [ ] Error handling & retry UX improvements (phase 2: structured error objects)
- [ ] Files API executor integration (upload via `anthropic.beta.files.upload()`)

## Recently Done
- [x] Meeting history tab — Meetings toggle in HistoryList, global GET /api/meetings endpoint with enrichment (project name, agent count, tokens, cost), date/status filters; PR #19 merged (2026-03-17)
- [x] Meetings analytics — 2 meeting stat cards + Meetings Over Time BarChart in AnalyticsPanel; `dbGetMeetingAnalytics()`; `MeetingAnalytics` type; PR #18 merged (2026-03-17)
- [x] Meeting memory — persistent per-project memory in settings table, injected into agent system prompts, collapsible UI in MeetingsPanel with Clear button; GET/DELETE /api/projects/[id]/meeting-memory; PR #17 merged (2026-03-17)
- [x] Tag management — first-class `project_tags` table (migration 0019), CRUD API, TagsPanel with 12-color inline palette, KanbanCard/Column/Board updated to use hex colors from DB; PR #16 merged (2026-03-17)
- [x] Meeting output to card — "Create Card" button on concluded meetings; creates backlog task from tester output; PR #15 merged (2026-03-17)
- [x] Meeting types (Ideas + Card Discussion) — `meetingType` + `taskId` columns (migrations 0017–0018), MeetingTypeSelector modal, card context injected into agent prompts, meeting notes appended to card description; PR #14 merged (2026-03-17)
- [x] Cache-aware token pricing — cache reads 0.1× + writes 1.25× base input rate, `cacheReadTokens`/`cacheWriteTokens` tracked through executor → agentService → cost calculation; PR #13 merged (2026-03-17)
- [x] Meeting scene layout fix — side-by-side flex layout (45% scene / 55% chat), MeetingScene given dark bg so robots are visible; PR #12 merged (2026-03-17)
- [x] Meetings v2 — writer autonomy, in-app cron scheduling (`croner` + `meeting_schedules` table), calendar-first UI, cost/token tracking, MeetingScene 5 robots; PR #11 merged (2026-03-14)
- [x] Extract getMondayEpoch helper; PR #9 merged (2026-03-13)
- [x] Double-fetch AbortController fix; PR #8 merged (2026-03-13)
- [x] File-count waterfall fix — SQL GROUP BY, SSE broadcast on mutations; PR #7 merged (2026-03-13)
- [x] History tester/writer filter fix; PR #6 merged (2026-03-13)
- [x] Tag filter bar on board; PR #5 merged (2026-03-13)
- [x] Tag system on cards — `Task.tags`, migration 0009, pipeline auto-stamps verdict tags; PR #4 merged (2026-03-13)
- [x] Archive filter on GET /api/projects/[id]/tasks; PR #3 merged (2026-03-13)
- [x] Tester pipeline fix + prompt improvements; PR #2 merged (2026-03-13)
- [x] Analytics test coverage + CI workflow; PR #1 merged (2026-03-12)

# Current Sprint

> Last updated: 2026-03-09 (agent stats review feedback addressed)

## Active Worktrees
- `feat/extract-is-agent-active` — PR-ready, awaiting merge
- `feat/delete-agents` — complete, awaiting merge (worktree: `.claude/worktrees/agent-aba00e6f`)
- `worktree-feat/agent-stats-on-cards` — review feedback resolved, commit `76ed8b6` (worktree: `.claude/worktrees/feat/agent-stats-on-cards`)

## In Progress
- [ ] Authentication & role-based access (protect dashboard + API routes)
- [ ] Agent log search & filtering

## Up Next
- [ ] Deployment pipeline (Docker / Vercel)
- [ ] Persistent working directory integration (agent file system access)
- [ ] Error handling & retry UX improvements (phase 2: structured error objects, replace split-string convention)

## Recently Done
- [x] Agent stats review fixes — journal entry for 0006_agent_stats added (was missing, would crash at startup); no-op `?? undefined` removed from local.ts; partial stats emitted on error results; `finalStats` capture comment; `totalTokens` clarification in agentService; Step 12 fallback estimation (~tokens) in KanbanCard (2026-03-09)
- [x] Agent stats on cards — `AgentStats` type, `onStats` pipeline through executor→runner→store→SSE; token/cost columns on `task_runs`; KanbanCard stats row, AgentProgressBar live counter, TaskDetailModal per-run + aggregate stats; new `lib/format-utils.ts` (2026-03-09)
- [x] Delete agents feature — `dbDeleteAgent()` repo, `deleteAgent()` store, refactored DELETE endpoint (action=cancel|delete), trash button on AgentRow + AgentLog, modal auto-close on SSE removal (2026-03-09)
- [x] ADR-011 stale line numbers — replaced hard line numbers with fuzzy landmark references in `context/decisions.md` (2026-03-09)
- [x] SVG triangle refactor — replaced `▼`/`▲` unicode chars with inline SVG in `AgentProgressBar` + `TaskDetailModal`; consistent cross-platform rendering (2026-03-09)
- [x] Active-stage arrow indicator — `▼` below active pipeline segment; `textColor` field added to `PipelineStage`; merged directly into master (2026-03-09)
- [x] `taskStartedAt` field — added to Agent type, schema, repo, and service; elapsed timer now uses `taskStartedAt ?? createdAt` for accurate duration tracking (2026-03-09)
- [x] `isAgentActive` utility — extracted shared predicate to `lib/types.ts`; replaced inline `status === 'running' || status === 'queued'` in 3 components (2026-03-09)
- [x] `isRunning` deduplication — refactored `getCodingProgress`/`getResearchProgress` to accept `isRunning: boolean` param instead of re-deriving from `activeAgent` (2026-03-09)
- [x] `activeAgent.createdAt` type safety — explicit null guard + destructured const in AgentProgressBar; eliminates closure narrowing ambiguity (2026-03-09)
- [x] KanbanCard progress bar — AgentProgressBar with segmented pipeline stages, role label, elapsed timer; review fix for empty general-board container (2026-03-09)
- [x] Error classification UI (reason + recovery hint), graceful failure cards, auto-merge on senior sign-off, backlog minor-issue parsing — merged + review fixes applied (2026-03-08)
- [x] Agent terminal modal + history terminal tab
- [x] Edit project modal (name, description, directory fields)
- [x] Executor abstraction layer (pluggable model configs per project)
- [x] Automated multi-agent pipeline (researcher → coder → senior-coder) with real cancellation + results tab
- [x] Prettier, ESLint config, and Claude Code hooks
- [x] SQLite + Drizzle ORM migration (replaced in-memory singleton store)
- [x] Card detail modal, archived cards view, date tracking
- [x] Idle agent pool model
- [x] Collapsible icon-rail sidebar with localStorage persistence
- [x] Trello-style Kanban board (cards, columns, drag-and-drop, fluid layout)
- [x] Projects page + Kanban board with multi-agent workflow
- [x] Dracula colour scheme + left sidebar navigation
- [x] Initial dashboard layout, SSE streaming, drag-and-drop agent board

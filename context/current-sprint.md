# Current Sprint

> Last updated: 2026-03-09 (delete agents review fixes applied)

## Active Worktrees
- `feat/delete-agents` — review fixes applied, PR-ready (worktree: `.claude/worktrees/agent-aba00e6f`)

## In Progress
- [ ] Authentication & role-based access (protect dashboard + API routes)
- [ ] Agent log search & filtering

## Up Next
- [ ] Deployment pipeline (Docker / Vercel)
- [ ] Persistent working directory integration (agent file system access)
- [ ] Error handling & retry UX improvements (phase 2: structured error objects, replace split-string convention)

## Recently Done
- [x] Delete agents feature (review fix) — `handleStop` in AgentRow + AgentTerminalModal now explicitly sends `{ action: 'cancel' }` body; prevents accidental permanent deletion when clicking Stop (2026-03-09)
- [x] ADR-011 stale line numbers — replaced hard line numbers with fuzzy landmark references in `context/decisions.md` (2026-03-09)
- [x] SVG triangle refactor — replaced `▼`/`▲` unicode chars with inline SVG in `AgentProgressBar` + `TaskDetailModal`; consistent cross-platform rendering (2026-03-09)
- [x] Active-stage arrow indicator — `▼` below active pipeline segment; `textColor` field added to `PipelineStage`; merged directly into master (2026-03-09)
- [x] `taskStartedAt` field — added to Agent type, schema, repo, and service; elapsed timer now uses `taskStartedAt ?? createdAt` for accurate duration tracking (2026-03-09)
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

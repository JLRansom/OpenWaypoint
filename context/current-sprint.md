# Current Sprint

> Last updated: 2026-03-09

## Active Worktrees
- `worktree-agent-af0e5f3e` — feat: card progress bar — committed, awaiting PR

## In Progress
- [ ] Authentication & role-based access (protect dashboard + API routes)
- [ ] Agent log search & filtering

## Up Next
- [ ] Deployment pipeline (Docker / Vercel)
- [ ] Persistent working directory integration (agent file system access)
- [ ] Error handling & retry UX improvements (phase 2: structured error objects, replace split-string convention)

## Recently Done
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

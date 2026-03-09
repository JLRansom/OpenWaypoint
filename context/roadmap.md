# Roadmap

> Last updated: 2026-03-08

## Current Priorities
1. Authentication & role-based access (protect dashboard + API routes)
2. Deployment pipeline (Docker / Vercel)
3. Persistent working directory integration (agent file system access)

## Planned
- Agent log search & filtering
- Error handling & retry UX improvements
- Notifications / webhooks when pipeline completes
- Usage tracking & cost dashboard per project

## Completed
- ✅ Next.js 15 App Router scaffold
- ✅ SSE streaming for real-time updates (`/api/stream`)
- ✅ Agent type system and simulation runner
- ✅ Drag-and-drop agent board UI
- ✅ Project context system (`context/` + brain skill)
- ✅ Dark mode conversion
- ✅ Dracula colour scheme + left sidebar navigation
- ✅ Projects page + Kanban board with multi-agent workflow
- ✅ Trello-style Kanban cards with fluid columns and drag-and-drop
- ✅ Independent column heights, drag performance, board min-height
- ✅ Per-column inline Add Card form (one-at-a-time)
- ✅ Collapsible icon-rail sidebar with localStorage persistence
- ✅ Card detail modal, archived cards view, and date tracking
- ✅ SQLite + Drizzle ORM (replaced in-memory singleton store)
- ✅ Executor abstraction layer (pluggable model configs per project)
- ✅ Automated multi-agent pipeline (researcher → coder → senior-coder review cycles)
- ✅ Real pipeline cancellation support
- ✅ Pipeline results tab
- ✅ Agent terminal modal
- ✅ History terminal tab on agent detail
- ✅ Edit project modal (name, description, directory fields)
- ✅ Prettier, ESLint config, and Claude Code hooks
- ✅ Idle agent pool model (spawn once, assign on demand)

# agents-galore

Next.js 15 (App Router) agent management dashboard — spawn, monitor, and visualize AI agents working on projects in real time.

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build
npm run lint         # eslint check
npm run lint:fix     # eslint auto-fix
npm run type-check   # tsc --noEmit
```

## Workflow
**All code changes MUST be made in a git worktree** — never edit directly on the main working tree.
- Before making any code edits, create or enter a worktree (`isolation: "worktree"` for agents, or `git worktree add` manually).
- This allows multiple agents/developers to work in parallel without file conflicts.
- Each worktree gets its own branch — name it descriptively (e.g., `feat/add-dashboard-filters`).
- When finished, open a PR from the worktree branch. Do NOT merge directly into main.
- Clean up worktrees after the branch is merged: `git worktree remove <path>`.

**One worktree per ticket — always.**
- Before creating a new worktree, run `git worktree list` and check `context/current-sprint.md` to see if one already exists for this ticket.
- If a worktree exists for the ticket, use it. Do NOT create a new one.
- Senior developer feedback, review comments, and change requests all go into the **same worktree and branch**. Never start a fresh branch for changes on an existing ticket.
- The worktree branch is the single source of truth for that card until it is merged and removed.

## Brain Update Protocol

**After every significant task, before closing the session — run `/brain`.**

This is not optional. Keeping `context/` current is part of completing a ticket.

### What counts as significant:
- Any architectural or design decision was made
- A new pattern, convention, or constraint was established
- A plan changed or was abandoned
- A gotcha, bug, or non-obvious behavior was discovered
- A ticket was completed or a PR was opened

### What to update:

**`context/decisions.md`** — for any choice that future agents/devs need to know:
```
## [Date] - [Short title]
**Decision:** What was decided
**Why:** The reasoning  
**Alternatives rejected:** What we didn't do and why
**Affects:** Which files/systems this touches
```

**`context/current-sprint.md`** — update ticket status and active worktrees:
```
## Active Worktrees
- `feat/add-dashboard-filters` — In progress, ~60% done
- `fix/sse-reconnect` — PR #12 open, awaiting review
```

**`context/roadmap.md`** — only if priorities or goals shifted

**`claude.md`** — only if a permanent rule or convention changed (rare)

### Rules:
- Keep entries concise — 3-5 bullet points max per session
- Prune stale entries (merged worktrees, resolved decisions) when you update
- Never let `current-sprint.md` reflect worktrees that no longer exist

## Architecture

- API routes live in `/app/api/[resource]/route.ts`
- In-memory singleton store in `/lib/store.ts` — import `getStore()` for all state access
- Agent simulation logic in `/lib/agent-runner.ts` — hook real Claude API calls here
- Real-time updates via Server-Sent Events at `/app/api/stream/route.ts`
- Shared TypeScript types in `/lib/types.ts` — import from here, never redefine
- Components are pure UI — no direct store access, receive data as props
- Page-level data fetching happens in `page.tsx` Server Components only

## Project Context

Living project memory lives in `context/` — updated via the `brain` skill:

- `context/roadmap.md` — high-level goals & priorities
- `context/decisions.md` — ADR-style log of key past choices (newest first)
- `context/current-sprint.md` — what's in flight right now

Run the brain skill (`/brain`) after significant changes to keep context current and pruned.

## @imports

@docs/architecture.md
@docs/agent-types.md
@context/roadmap.md
@context/decisions.md
@context/current-sprint.md

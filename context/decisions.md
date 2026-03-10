# Architecture Decision Records

> Append new entries at the top. Keep each entry ≤ 10 lines.

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
**Affects:** `components/AgentProgressBar.tsx` lines 103–117.
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

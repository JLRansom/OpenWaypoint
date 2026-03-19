# Agent Types

Each agent in OpenWaypoint has a **role** that determines its system prompt, pipeline position,
and UI colour. Roles are defined as `AgentType` in `lib/types.ts` and styled in `lib/constants.ts`.

## Current Roles

| Role | Colour | Purpose |
|---|---|---|
| `researcher` | cyan | Produces a research brief / specification from the task description |
| `coder` | green | Implements the feature based on researcher output |
| `tester` | pink | Runs tests against the coder's implementation; reports failures |
| `senior-coder` | orange | Reviews the full thread and either signs off or requests changes |
| `writer` | purple | Produces documentation, changelogs, or prose output |

## Planned Rename — Waypoint Theme

To align with the OpenWaypoint brand, roles will be renamed in a future ticket (`feat/agent-rename`).

| Current | Proposed | Rationale |
|---|---|---|
| `researcher` | `scout` | Scouts ahead, maps unknowns before the team moves |
| `coder` | `navigator` | Charts and executes the implementation route |
| `tester` | `cartographer` | Maps failures so the navigator can correct course |
| `senior-coder` | `pilot` | Final authority — approves the route or redirects |
| `writer` | `herald` | Communicates the outcome to the outside world |

The rename affects: `lib/types.ts` (AgentType union), `lib/constants.ts` (ROLE_COLORS / ROLE_HEX),
`lib/services/agentService.ts` (system prompts + pipeline logic), and all UI labels.

## Pipeline

The automated multi-agent pipeline runs roles in sequence on a task:

```
researcher → coder → [tester → coder (retry loop)] → senior-coder
```

Each stage writes its output to a dedicated field on the Task row:

| Role | Output field | Consumed by |
|---|---|---|
| `researcher` | `task.researcherOutput` | `coder`, `senior-coder` |
| `coder` | `task.coderOutput` | `tester`, `senior-coder` |
| `tester` | `task.testerOutput` | `coder` (retry), `senior-coder` |
| `senior-coder` | signs off or triggers retry | — |

Pipeline orchestration lives in `lib/services/agentService.ts` (`handleCompletion()`).
The executor abstraction (`lib/executors/`) is role-agnostic — it runs whatever prompt
`agentService` builds.

## Constants

```ts
// lib/constants.ts

export const ROLE_COLORS: Record<string, string>   // Tailwind classes for badges
export const ROLE_COLOR_FALLBACK: string            // fallback Tailwind class
export const ROLE_HEX: Record<string, string>       // hex values for Recharts SVG fills
export const ROLE_HEX_FALLBACK: string              // fallback hex
```

Always use these constants for role-based styling — never hardcode colours inline.

## Kanban Column Mapping

```ts
// lib/services/agentService.ts — getColumnForRole()

researcher  → 'planning'
coder       → 'in-progress'
senior-coder→ 'review'
tester      → 'testing'
```

Cards are automatically moved to the matching column when an agent of that role starts.

## Health Baselines and New Role Addition

When `ROLE_BASELINES_ENABLED=true`, each agent's health sub-metrics are
normalised against the median performance of its role cohort (see
`lib/health-baselines.ts` and ADR-040).

**Adding a new AgentType requires a baseline recalibration period.**

When a sixth (or later) role is added to the `AgentType` union:

1. At deploy time, the new role has zero historical runs → `cohortSize = 0`
   → `MIN_COHORT_SIZE` guard fires → health scores fall back to flat thresholds
   automatically. No crash, no code change needed.
2. After approximately **2–3 weeks** of production traffic, once the cohort
   accumulates ≥ 3 agents each with ≥ 5 runs per week, the baseline will
   self-populate on the next 5-minute cache refresh.
3. During the recalibration window, health badges for the new role display raw
   absolute values (same as before `ROLE_BASELINES_ENABLED` was set).

**Action required when adding a new role:**
- Update `AgentType` in `lib/types.ts`
- Update `ROLE_COLORS` / `ROLE_HEX` in `lib/constants.ts`
- Update pipeline logic in `lib/services/agentService.ts` if it joins the pipeline
- Note the recalibration period in the PR description so the team knows to
  monitor badge accuracy for the new role for 2–3 weeks post-deploy
- Call `invalidateRoleBaselines()` in any migration script that back-fills
  historical runs for the new role (so the cache doesn't serve stale data)

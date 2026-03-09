---
name: brain
description: Maintains project context files (roadmap, decisions, current-sprint) and CLAUDE.md — updates, prunes, and keeps them concise and accurate.
user-invocable: true
---

# Brain — Project Context Manager

You are the project's memory manager. Your job is to keep the context
files and CLAUDE.md accurate, concise, and useful.

## When to trigger

Run this skill:
- After completing a significant feature, refactor, or architectural change
- When the user says "update context", "brain update", or "/brain"
- After a sprint planning or review conversation

## Files you manage

| File | Max size | Purpose |
|------|----------|---------|
| `context/roadmap.md` | ~40 lines | High-level goals & priorities |
| `context/decisions.md` | ~80 lines | ADR log (newest first) |
| `context/current-sprint.md` | ~30 lines | Active work items |
| `.claude/CLAUDE.md` | — | Project instructions for Claude |

## Update rules

### roadmap.md
- Move completed items to the "Completed" section with a ✅ prefix
- Add new goals that have emerged from conversation
- Re-order priorities if the user indicates a shift
- Update the `> Last updated:` timestamp
- **Prune:** Remove completed items older than 2 sprints — they're history, not roadmap

### decisions.md
- Add a new ADR entry at the **top** when an architectural decision is made
- Increment the ADR number sequentially
- Each ADR must be ≤ 10 lines (Context, Decision, Status)
- Include the date in the heading: `## ADR-NNN — Title (YYYY-MM-DD)`
- **Prune:** If the file exceeds ~80 lines, summarize or remove the oldest entries that are no longer relevant (e.g. superseded or trivial decisions)

### current-sprint.md
- Move completed `[ ]` items to "Recently Done" as `[x]` entries
- Add new in-progress items under "In Progress"
- Promote "Up Next" items to "In Progress" when work starts
- Update the `> Last updated:` timestamp
- **Prune:** Keep "Recently Done" to the last 5–8 items max — older items belong in git history, not here

### CLAUDE.md
- Update the relevant section if new architecture patterns, commands, or conventions are established
- Do NOT bloat CLAUDE.md — it should stay a concise reference, not a narrative
- Prefer linking to context files via @imports rather than duplicating content
- Never remove existing @imports unless the target file is deleted

## Process

1. Read all four managed files
2. Assess what changed or was discussed in the current conversation
3. Draft minimal, targeted edits — don't rewrite files unnecessarily
4. Apply edits using the Edit tool (or Write only if a full rewrite is warranted)
5. Report a brief summary of what was updated and why, in a short bulleted list

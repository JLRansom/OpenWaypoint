# Architecture

OpenWaypoint is a Next.js 15 App Router application. All server logic runs in Route Handlers and
Server Components; the browser receives only UI components and SSE event streams.

## Directory Map

```
app/
  (root)/page.tsx          # Welcome / landing page
  api/
    agents/route.ts        # CRUD + cancel/delete actions
    files/[id]/content/    # File download (binary, with path-traversal guard)
    projects/route.ts      # List + create projects
    projects/[id]/
      route.ts             # Get / update / delete a project
      analytics/route.ts   # GET analytics (summary + charts)
    runs/route.ts          # List task runs
    runs/backfill-costs/   # POST — recalculate costUsd for historical rows
    settings/route.ts      # GET all settings / PUT upsert one
    stream/route.ts        # SSE — real-time broadcast to all clients
    tasks/
      route.ts             # List + create tasks
      [id]/route.ts        # Get / update / delete a task
      [id]/files/route.ts  # Upload + list file attachments
      [id]/files/[fileId]/ # Delete a single attachment
      bulk/route.ts        # Bulk status update (capped at 500 IDs)
  dashboard/page.tsx
  projects/page.tsx
  projects/[id]/page.tsx
  settings/page.tsx

lib/
  types.ts          # ALL shared TS types — import from here, never redefine
  store.ts          # In-memory singleton; re-exports DB repos + broadcasts SSE
  agent-runner.ts   # Spawns executors, wires onStats / onOutput callbacks
  broadcast.ts      # SSE event emitter (send to all open /api/stream clients)
  constants.ts      # ROLE_COLORS, ROLE_HEX, ROLE_HEX_FALLBACK, ROLE_COLOR_FALLBACK
  pricing.ts        # MODEL_PRICING table + calculateCost() (longest-prefix match)
  file-utils.ts     # Server-only: ALLOWED_MIME_TYPES, MAX_FILE_SIZE, sanitiseFilename
  format-utils.ts   # Browser-safe: formatFileSize, formatDuration, etc.
  git-utils.ts      # createGitBranch() — sanitises commit messages
  executors/
    types.ts        # Executor interface
    registry.ts     # Maps project.executorType → executor instance
    local.ts        # Runs Claude CLI as a subprocess; reads --dangerously-skip-permissions from DB
    constants.ts    # DEFAULT_MODEL, system prompts
  services/
    agentService.ts # Builds prompts per role, orchestrates the pipeline, writes task outputs
  db/
    client.ts       # Drizzle singleton (reads SQLITE_DB_PATH env; runs migrate() on init)
    schema.ts       # Table definitions (projects, tasks, agents, taskRuns, taskFiles, settings)
    migrations/     # Drizzle SQL migrations (0000–0008); one statement per file
    repositories/   # One file per table — all DB reads/writes go here

components/         # Pure UI — props only, no store/DB imports
  SettingsClient.tsx  # 'use client' — only file that calls PUT /api/settings
  ...
```

## Data Flow

### Agent execution (happy path)

```
User clicks "Run"
  → POST /api/agents  (creates Agent row in DB, enqueues)
  → store.assignAgentToTask()
  → agentRunner.runAgent()
  → executor.run()  (local.ts: spawns `claude` CLI subprocess)
  → onStats callback  → store.updateAgent() → broadcast SSE
  → onOutput callback → store.updateAgent() → broadcast SSE
  → agentService.handleCompletion()
    → updateTask(researcherOutput | coderOutput | testerOutput)
    → dbAddTaskRun()  (persists token counts, costUsd, model)
    → assignAgentToTask(nextRole)  ← triggers next pipeline stage
  → broadcast SSE "task_updated"
```

### Real-time updates (SSE)

```
GET /api/stream  → keeps connection open, registers client
Any mutation     → broadcast.ts emits JSON event
Browser          → SSE listener updates React state (no polling)
```

### Database access

- All reads/writes go through `lib/db/repositories/*.ts`
- `lib/store.ts` re-exports everything — callers import from `@/lib/store`, never directly from repos
- Drizzle's `migrate()` runs automatically on startup (`lib/db/client.ts`)
- Test workers get isolated DBs via `SQLITE_DB_PATH` env var set before module load

## Key Patterns

### Singleton store
`lib/store.ts` holds an in-memory cache (agents, project lookups) layered over the DB.
Always import via `getStore()` — never instantiate directly.

### Pure components
Components in `components/` receive all data as props. They never call `getStore()` or
fetch from the DB. Page-level Server Components (`app/**/page.tsx`) do the data fetching
and pass it down.

### Server-only modules
`lib/file-utils.ts`, `lib/db/**`, `lib/store.ts` — never import these from Client Components.
They use `fs`, `better-sqlite3`, and other Node-only APIs.

### Executor abstraction
`lib/executors/registry.ts` maps `project.executorType` to an executor. Currently only
`local` is implemented (Claude CLI subprocess). New executors (API-based, remote, etc.)
implement the interface in `lib/executors/types.ts` and register themselves in `registry.ts`.

### Settings
Runtime configuration lives in the `settings` SQLite table.
- Read: `getSetting(key)` from `lib/store.ts` (wraps `dbGetSetting`)
- Write: `PUT /api/settings` (key allowlist enforced server-side)
- Currently only `dangerouslySkipPermissions` is a valid key

## Security Conventions

- **Path traversal guard** — `diskPath.startsWith(root + path.sep)` before any read/delete
- **MIME allowlist** — `ALLOWED_MIME_TYPES` in `lib/file-utils.ts`; no `text/html`, `text/js`, `text/css`
- **SVG** — allowed to upload but always served as `attachment` (never `inline`)
- **LIKE injection** — use `sql\`col LIKE ${pattern} ESCAPE '\\'\`` not Drizzle's `like()`
- **Bulk cap** — `MAX_BULK_IDS = 500` in `app/api/tasks/bulk/route.ts`
- **HTTP headers** — CSP, X-Frame-Options: DENY, X-Content-Type-Options in `next.config.ts`

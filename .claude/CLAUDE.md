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

## Architecture

- API routes live in `/app/api/[resource]/route.ts`
- In-memory singleton store in `/lib/store.ts` — import `getStore()` for all state access
- Agent simulation logic in `/lib/agent-runner.ts` — hook real Claude API calls here
- Real-time updates via Server-Sent Events at `/app/api/stream/route.ts`
- Shared TypeScript types in `/lib/types.ts` — import from here, never redefine
- Components are pure UI — no direct store access, receive data as props
- Page-level data fetching happens in `page.tsx` Server Components only

## @imports

@docs/architecture.md
@docs/agent-types.md

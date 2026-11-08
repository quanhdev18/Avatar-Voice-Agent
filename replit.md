# Sensei AI

1-1 Japanese (JLPT N5) lessons for Vietnamese learners with an AI teacher (Yuki-sensei) in a video-call style classroom. See README.md.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- DB schema: `lib/db/src/schema/` · curriculum seed: `lib/db/src/curriculum/n5.ts` · SM-2: `lib/db/src/srs.ts`
- API contract: `lib/api-spec/openapi.yaml` · routes: `artifacts/api-server/src/routes/`
- Agent: `artifacts/api-server/src/senseiAgent.ts` · classroom UI: `artifacts/sensei-ai/src/pages/classroom.tsx`

## Architecture decisions

- Without CLERK_SECRET_KEY the API runs in demo-auth mode (single `demo-learner`, refused in production); the web app uses demo mode unless VITE_CLERK_PUBLISHABLE_KEY is set.
- Voice/avatar providers sit behind interfaces in `artifacts/api-server/src/agent/providers.ts` (VOICE_PROVIDER, AVATAR_PROVIDER).
- Without LiveKit/voice keys, the classroom offers a browser-side demo teacher (`artifacts/sensei-ai/src/classroom/demoTransport.ts`) emitting the same events as the agent.
- Usage minutes are billed from server-measured wall time; per-session and per-day limits in `lib/config.ts`.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

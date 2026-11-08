# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

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

- `artifacts/stick-brawl` — **Que Chiến**, multiplayer stick-figure fighting game (UI phase, local demo only, no netcode yet)
  - `src/index.css` — design tokens (paper / chalkboard themes) and sketchy primitives (`.sk`, `.btn`, `.hl`, `.hatch`)
  - `src/components/StickFigure.tsx` — animated SVG fighter (poses, accessories, weapons)
  - `src/components/ui.tsx` — Button, Panel, Bar, Badge, Tabs, Toggle, Slider, Modal, Burst…
  - `src/pages/*` — Home, Lobby, Room, Customize, Play (HUD + local bot sim), Results, Kit
  - Run: `pnpm --filter @workspace/stick-brawl run dev` (port 25224)

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

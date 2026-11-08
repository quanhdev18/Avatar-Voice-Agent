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

- `artifacts/stick-brawl` — **Que Chiến**, multiplayer stick-figure fighting game (web client)
  - `src/index.css` — design tokens (paper / chalkboard themes) and sketchy primitives (`.sk`, `.btn`, `.hl`, `.hatch`)
  - `src/components/StickFigure.tsx` — animated SVG fighter (poses, accessories, weapons)
  - `src/components/ui.tsx` — Button, Panel, Bar, Badge, Tabs, Toggle, Slider, Modal, Burst…
  - `src/pages/*` — Home, Lobby, Room, Customize, Play (online via `/room/:id/play`, offline bots via `/play`), Results, Kit
  - `src/net/client.ts` — WebSocket client, lobby/room state (`useNet`), `NetMatch` (snapshot interpolation + own-fighter prediction)
  - Run: `pnpm --filter @workspace/stick-brawl run dev` (port 25224; proxies `/api` incl. WebSocket to `API_PROXY_TARGET`, default `http://localhost:8080`)
- `lib/game-core` — shared fight simulation (`sim.ts`), cosmetics whitelist, and the WebSocket protocol + zod schemas (`protocol.ts`). Used by both client and server.
- `artifacts/api-server/src/game/` — authoritative game server on `/api/game/ws` (same port as the API): `server.ts` (connections, validation, rate limits, lobby), `room.ts` (members, bots, countdown, 30 Hz match loop, 15 Hz snapshots)
  - `GAME_MATCH_SECONDS` env overrides match length (default 180) for quick testing

## Architecture decisions

- Que Chiến multiplayer is server-authoritative: clients send only packed key states (`{t:'in', s:seq, b:bits}`) at 30 Hz; the server simulates and broadcasts snapshots. Clients never send positions or damage.
- The same `lib/game-core` sim runs on the client to predict the local fighter (replaying un-acked inputs after each snapshot); other fighters are interpolated ~100 ms in the past.
- Game state is in-memory only (rooms vanish on restart). Single process; scaling out would need sticky routing per room.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

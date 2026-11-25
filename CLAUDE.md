# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this repo is

**Adios Subscriptions** — open-source rebuilds of paid apps. It's a monorepo of
independent projects; there is **no root package.json or shared tooling**. Always
`cd` into the specific project (and sub-package) before installing, running, or
building. Each sub-package has its own `package-lock.json` — use `npm`.

| Project         | What it is                                     | Stack                                                              |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| `strong/`       | Workout tracker (templates, workouts, history) | Expo mobile app + Hono backend + Supabase (auth + Postgres)        |
| `myfitnesspal/` | Food / calorie diary with barcode scanning     | Same stack as `strong/`; Open Food Facts lookup in the mobile app  |
| `note-taker/`   | Local meeting recorder + transcription         | Electron + electron-vite + React 19 + Tailwind v4 + shadcn; Gladia |

## Mobile + backend projects (`strong/`, `myfitnesspal/`)

Both share the same layout and conventions:

```
<project>/
├── supabase/     # Local Supabase config (`supabase start` from project root; needs Docker)
├── backend/      # Hono API, Drizzle ORM, deployed to Vercel
└── mobile-app/   # Expo Router app, NativeWind (Tailwind) styling
```

### Backend (`backend/`)

- Commands: `npm run dev` (tsx watch, http://localhost:3000), `npm run migrate`
  (drizzle-kit push), `npm run db:generate`, `npm run db:migrate`.
- `src/app.ts` builds the Hono app and exports `AppType`; `src/dev.ts` is the local
  Node server; `src/index.ts` is the Vercel serverless entry.
- All `/api/*` routes go through `middleware/auth.ts`, which validates the Supabase
  bearer token and sets `c.get("user")`. Feature routes live in `src/routes/*.ts`
  and are mounted in `routes/api.ts`.
- Validate request bodies with `zValidator` + `zod`. Keep routes **chained** on the
  Hono instance (`new Hono().get(...).post(...)`) so RPC types flow to the client.
- Schema is in `src/db/schema.ts` (Drizzle). ESM with `.js` import suffixes.
- Config comes from `backend/.env` (Supabase URL, service role key, `DATABASE_URL`).

**Do not run migrations after changing the schema** — the owner runs them manually
(see `strong/.cursor/rules/project.mdc`).

### Mobile app (`mobile-app/`)

- Commands: `npm start` (expo start), `npm run ios`, `npm run android`, `npm run lint`.
- Routing via Expo Router in `app/` (`(tabs)/` for the tab bar). State/data lives in
  React context providers under `providers/`. Reusable UI in `components/`.
- `lib/api.ts` is a typed Hono RPC client (`hc<AppType>`) importing the backend type
  via the `@backend/*` tsconfig path alias, and injects the Supabase access token.
  Backend route changes therefore affect mobile type-checking.
- Config comes from `mobile-app/.env` (`EXPO_PUBLIC_*`: API URL, Supabase keys).
- Auth: Supabase magic link and Sign in with Apple; onboarding flow after sign-in.

## `note-taker/` (Electron)

- Commands: `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run format`,
  `npm run build`, `npm run build:mac|win|linux`.
- `src/main/` — main process: IPC handlers (`index.ts`), JSON/file storage under
  Electron `userData` (`storage.ts`, `settings.ts`), Gladia API client (`gladia.ts`).
- `src/preload/index.ts` — exposes the typed `api` bridge via `contextBridge`.
  When adding an IPC channel, update the `ipcMain.handle` in main, the preload `api`,
  and `preload/index.d.ts` together. Channels are namespaced (`meeting:*`,
  `recording:*`, `settings:*`, `system:*`).
- `src/shared/types.ts` — types shared across main/preload/renderer.
- `src/renderer/` — React UI; shadcn components in `components/ui/` (don't hand-edit
  those unless necessary), app views in `components/`.
- Style: Prettier (single quotes, no semicolons) + ESLint. Run lint and typecheck
  before considering a change done.
- Gladia API key comes from settings or `MAIN_VITE_GLADIA_API_KEY`.

## General

- Never commit `.env` files or secrets.
- There are no automated test suites; verify with lint / typecheck (`tsc --noEmit`)
  in the affected package.

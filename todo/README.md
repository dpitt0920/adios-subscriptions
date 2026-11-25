# Todo Agent

A to-do app with a Claude-powered assistant. It uses the same stack as `strong/` and `myfitnesspal/`: an Expo (React Native) mobile app, a Hono backend, and Supabase for sign-in and the database.

```
todo/
├── supabase/     # Local Supabase config (auth + Postgres)
├── backend/      # Hono API server + the Claude agent
└── mobile-app/   # Expo mobile app
```

## What the assistant does

- **Plain-language capture:** type "call mom tomorrow 5pm" or "pay rent Friday, urgent" in the bar on Today or Tasks. The assistant creates the task with its date, time and priority, and can create several tasks from one message.
- **Chat to manage tasks:** in the Assistant tab, ask it to complete, reschedule, rename, reprioritize or delete tasks ("move everything due today to tomorrow").
- **Break down:** on a task's page, tap **Break down** to have the assistant add 3–7 subtasks, each with a rough time estimate.
- **Plan my day:** on Today, tap **Plan my day**. The assistant picks what fits today, saves the order, and explains what it left out.

### How it works

`backend/src/lib/agent.ts` runs Claude (`claude-opus-5-5`) through the Anthropic SDK's tool runner, with five tools: `list_tasks`, `create_tasks`, `update_task`, `delete_task` and `set_daily_plan`. Every tool is tied to the signed-in user's id, so the model can only read or change that user's tasks. The mobile app keeps the chat history and sends the most recent turns, along with the user's local date and time zone, to `POST /api/agent/chat`. The backend doesn't store any chat state.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Supabase CLI](https://supabase.com/docs/guides/cli) and [Docker](https://www.docker.com/)
- An [Anthropic API key](https://console.anthropic.com/)

## 1. Run Supabase locally

```bash
supabase start
```

## 2. Run the backend

Create `backend/.env`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<from `supabase status`>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
ANTHROPIC_API_KEY=<your key>
```

```bash
cd backend
npm install
npm run migrate   # creates the users and tasks tables (drizzle-kit push)
npm run dev       # http://localhost:3000
```

## 3. Run the mobile app

Create `mobile-app/.env`:

```
EXPO_PUBLIC_API_URL=http://<your machine's LAN IP>:3000
EXPO_PUBLIC_SUPABASE_URL=http://<your machine's LAN IP>:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<from `supabase status`>
```

```bash
cd mobile-app
npm install
npm run ios       # or: npm start
```

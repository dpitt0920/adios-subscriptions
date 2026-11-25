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

- **The three piles:** every task is sorted by area (work, home, family, money, health, other) and into one of three piles, and then the agent does the work:
  - **Claude** (`claude`): Claude can do it alone: research, look things up, write something, add an event to your calendar. It does it fully and marks the task done only when it's truly finished.
  - **Together** (`together`): Claude does most of it and you finish. It researches, prepares materials and writes emails as **Gmail drafts**; you review and send, sign or pay. The result lists exactly what's left for you.
  - **Me** (`me`): only you can do it (in person, a phone call, a decision), but Claude still helps with a reminder, phone script, checklist or talking points. Claude never marks these done.
- **How I like things:** a free-text profile (Settings) the agent reads before every chat request and every task run: tone, sign-off, budget, who to contact, and so on.
- **Gmail and Google Calendar (optional):** connect Google in the app to let the agent search and read your email, write drafts, see your calendar and add events. **Emails are only ever drafts** (there is no send tool), and **calendar events never have attendees**, so no invitations go out.

### How it works

`backend/src/lib/agent.ts` runs the chat assistant (`claude-opus-5-5`) through the Anthropic SDK's tool runner, with these tools: `list_tasks`, `create_tasks`, `update_task`, `delete_task`, `set_daily_plan` and `start_task`. Every tool is tied to the signed-in user's id, so the model can only read or change that user's tasks. When it captures tasks it always sets their area and pile. The mobile app keeps the chat history and sends the most recent turns, along with the user's local date and time zone, to `POST /api/agent/chat`. The backend doesn't store any chat state.

`backend/src/lib/worker.ts` is the worker agent that does a task. `POST /api/tasks/:id/run` (or `start_task` in chat, e.g. "go do the Claude pile") starts it in the background and returns `202` at once; the app polls `GET /api/tasks/:id` while `agentStatus` is `working`. The worker has web search, `finish_task` (and `set_pile` if the task has no pile yet), plus, when Google is connected, `gmail_search`, `gmail_read`, `gmail_create_draft`, `calendar_list_events` and `calendar_create_event`. Its result is saved on the task as markdown (`agentOutput`) with status `done`, `needs_you` or `failed`. Email bodies and web pages are treated as untrusted data.

**Background runs need a long-running Node server** (`npm run dev` or `npm start`). On Vercel serverless the function is frozen after the response, so a run started with `POST /run` wouldn't finish. A run that doesn't finish within 15 minutes is shown as failed.

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
# Encrypts stored Google refresh tokens and signs the OAuth state. 32+ chars:
#   openssl rand -base64 32
TOKEN_SECRET=<random string>
# Optional: Gmail + Google Calendar (see "Connect Google" below)
GOOGLE_CLIENT_ID=<...>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<...>
GOOGLE_REDIRECT_URI=http://localhost:3000/google/callback
```

```bash
cd backend
npm install
npm run migrate   # creates/updates the users, tasks and google_accounts tables (drizzle-kit push)
npm run dev       # http://localhost:3000
```

### Connect Google (optional)

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or pick) a project.
2. **APIs & Services → Library:** enable the **Gmail API** and the **Google Calendar API**.
3. **APIs & Services → OAuth consent screen:** set it up as **External**, add the scopes `openid`, `email`, `gmail.readonly`, `gmail.compose` and `calendar.events`, and **add yourself as a test user**. These Gmail scopes are sensitive/restricted, so while the app is in Testing only listed test users can connect (and Google shows an "unverified app" warning; continue past it).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**. Under **Authorized redirect URIs** add exactly your `GOOGLE_REDIRECT_URI`, e.g. `http://localhost:3000/google/callback`.
5. Put the client id and secret in `backend/.env` and restart the backend.

The app opens Google's consent page in the browser; Google redirects to `GET /google/callback` on the backend, which stores the account and sends the browser back to the app (`todoagent://...` or your Expo Go `exp://...` link) with `?google=connected` or `?google=error`.

**Phones on your LAN:** Google only accepts plain `http` redirect URIs on `localhost`, and the callback runs in the phone's browser, so `http://localhost:3000` won't reach your machine from a phone. Use an HTTPS tunnel (e.g. `ngrok http 3000`) and set `GOOGLE_REDIRECT_URI=https://<your-tunnel>/google/callback` (and add it in the Console), or use a deployed backend. The iOS simulator can use `localhost` directly.

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

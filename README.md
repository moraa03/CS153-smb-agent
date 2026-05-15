# smb-agent

AI-assisted operations for small service businesses: **Express** backend, **Supabase** (Postgres), **Claude** tool-calling agent, **WhatsApp Cloud API**, **M-Pesa** (Daraja) callback stub, **cron** jobs, and a **Vite + React + Tailwind** owner dashboard in [`client/`](client/).

## Quick start

1. **Supabase:** run [`src/db/schema.sql`](src/db/schema.sql) in the SQL editor.
2. **Env:** `cp .env.example .env` and fill keys (see comments in [`.env.example`](.env.example)).
3. **Seed:** `npm install && npm run seed` — note the printed `business id`.
4. **Dashboard:** `cp client/.env.example client/.env` and set `VITE_*` to match Supabase + the seeded `VITE_BUSINESS_ID`. Then:

```bash
npm run dev          # API + scheduler on PORT (default 3000)
cd client && npm run dev   # dashboard (default 5173)
```

5. **Demo script:** see [`demo.md`](demo.md).

## HTTP routes

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/webhook` | WhatsApp verify token handshake |
| POST | `/webhook` | WhatsApp inbound messages |
| POST | `/mpesa/callback` | Daraja STK callback (metadata parse) |
| POST | `/demo/trigger-weekly-pulse?businessId=` | Dev-only weekly summary to owner |
| GET | `/health` | Liveness |

## Project layout

- [`src/routes/`](src/routes/) — webhooks + demo trigger  
- [`src/agent/`](src/agent/) — Claude `processMessage`  
- [`src/db/`](src/db/) — schema, client, queries, seed  
- [`src/scheduler/`](src/scheduler/) — weekly pulse + follow-ups  
- [`src/integrations/`](src/integrations/) — WhatsApp send, M-Pesa token stub  

UI tokens in the client mirror the editorial mockup palette (see [`client/src/index.css`](client/src/index.css)).

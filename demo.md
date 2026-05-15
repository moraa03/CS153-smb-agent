# smb-agent live demo (3 steps)

## Prereqs

1. Apply [`src/db/schema.sql`](src/db/schema.sql) in the Supabase SQL editor.
2. Copy [`.env.example`](.env.example) to `.env` and fill `SUPABASE_*`, `ANTHROPIC_API_KEY`, WhatsApp, and `SEED_OWNER_PHONE` (your real WhatsApp number for summaries).
3. `npm install && npm run seed` — copy the printed **business id** into `client/.env` as `VITE_BUSINESS_ID`, plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Point Meta’s WhatsApp webhook to your public URL (e.g. ngrok) `https://<host>/webhook` and set `WHATSAPP_VERIFY_TOKEN` to match Meta.

## Step 1 — WhatsApp quote flow

From your phone, message the business WhatsApp number:

> How much to move from Kilimani to Westlands?

The agent should ask for the **move date** before giving a firm quote (per system prompt), then respond with a short professional reply. A new lead should appear in Supabase (and on the dashboard after refresh).

## Step 2 — Dashboard

Run `cd client && npm run dev` and open the local URL. Confirm the lead appears in the **Lead pipeline** (likely `new` or `quote_sent` depending on tool calls). Use **Move to …** to advance statuses.

## Step 3 — Weekly pulse (without waiting for Sunday)

With the API running (`npm run dev` in the repo root), trigger the same job the Sunday cron uses:

```bash
curl -X POST "http://localhost:3000/demo/trigger-weekly-pulse?businessId=<YOUR_BUSINESS_UUID>"
```

You should receive the weekly summary WhatsApp on **`SEED_OWNER_PHONE`**.

**Note:** M-Pesa callbacks require Safaricom to reach your public `/mpesa/callback` URL (ngrok + Daraja sandbox).

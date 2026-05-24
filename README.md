# Yorlegacy Backend

## Run

```bash
npm install
npm run dev
```

The backend listens on `http://127.0.0.1:8787` by default.

## Environment

Copy `.env.example` to `.env` and fill:

```bash
PORT=8787
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

If Supabase is not configured yet, the API still works using the built-in static fallback content.

## Supabase Setup

Run these SQL files in order:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

## Verify

```bash
npm test
npm run build
```

# YorInternational Backend

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
FRONTEND_ORIGIN=http://127.0.0.1:5173
APP_SESSION_SECRET=change-me-before-production
SESSION_TTL_HOURS=12
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

If Supabase is not configured yet:

- page content still works using built-in fallback content
- auth still works using the demo credentials from `.env`

If Supabase is configured and you apply the schema/seed:

- auth can read from `app_users`
- member data can read from `member_profiles`
- admin data can read from `admin_profiles`

## Supabase Setup

Run these SQL files in order:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

The seed creates local starter accounts:

- `member@yor.local`
- `admin@yor.local`

## Verify

```bash
npm test
npm run build
```

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
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,https://yorinternational.net,https://www.yorinternational.net
APP_SESSION_SECRET=change-me-before-production
SESSION_TTL_HOURS=12
SUPABASE_URL=your-supabase-url
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-supabase-secret-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEMO_MEMBER_EMAIL=member@yor.local
DEMO_MEMBER_PASSWORD=YorMember123!
DEMO_ADMIN_EMAIL=admin@yor.local
DEMO_ADMIN_PASSWORD=YorAdmin123!
DEMO_CASHIER_EMAIL=cashier@yor.local
DEMO_CASHIER_PASSWORD=joyjoy05
DEMO_BOD_EMAIL=bod@yor.local
DEMO_BOD_PASSWORD=yoralliance321654
DEMO_SUPERADMIN_EMAIL=yoradmin@gmail.com
DEMO_SUPERADMIN_PASSWORD=1
```

For the phase-1 production encoding path, the backend also needs:

```bash
YOR_RUNTIME_MODE=production
SUPABASE_URL=your-supabase-url
SUPABASE_SECRET_KEY=your-supabase-secret-key
```

`FRONTEND_ORIGIN` accepts a comma-separated allowlist for local dev origins and deployed frontend domains.

If Supabase is not configured yet:

- page content still works using built-in fallback content
- auth still works using the demo credentials from `.env`

If Supabase is configured and you apply the schema/seed:

- auth can read from `app_users`
- member data can read from `member_profiles`
- admin data can read from `admin_profiles`
- public pages and compensation policy can read from Supabase using a publishable key only

`SUPABASE_SECRET_KEY` is the preferred modern server-side key. `SUPABASE_SERVICE_ROLE_KEY` is kept for compatibility with older projects. `SUPABASE_PUBLISHABLE_KEY` can safely power read-only public routes when server credentials are not present.

Production note:

- `YOR_RUNTIME_MODE=sandbox` keeps the mutable branch-local runtime active.
- `YOR_RUNTIME_MODE=production` switches registration and activation-code writes to the Supabase-backed encoding service.
- Do not flip to `production` until the live database has the latest schema and the backend has a real privileged Supabase key.
- The current production cutover target in this workspace is the Supabase project named `Yorinternationalprod`.
- Use the operator-provided database password during the Supabase provisioning step, then wire the resulting project URL and server key into `.env`.

## Supabase Setup

Run these SQL files in order:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

For the live `Yorinternationalprod` project, use the lean production bootstrap instead of the broader demo seed:

1. `supabase/schema.sql`
2. `supabase/prod-bootstrap.sql`

For the production encoding cutover, re-run the updated `supabase/schema.sql` against the real project before switching `YOR_RUNTIME_MODE` to `production`. The schema now includes production sequences, activation-code event history, placement reservations, compensation queue tables, and server-only grants for the new operational tables in the exposed `public` schema.

The demo seed creates local starter accounts:

- `member@yor.local`
- `admin@yor.local`
- `cashier@yor.local`
- `bod@yor.local`
- `yoradmin@gmail.com`

The production bootstrap creates only:

- admin username `yoradmin` / password `1`
- root member username `yor01` / password `1`

## Verify

```bash
npm test
npm run build
```

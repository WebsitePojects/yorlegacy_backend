# Supabase Migrations

Versioned, additive-only schema changes for the Yor backend.

## Rules

- Apply in filename order (`0001_`, `0002_`, ...) against the target project.
- Migrations must be **re-runnable**: guard with `if not exists` / `drop ... if exists`.
- Migrations must never destroy or mutate existing rows destructively. Data
  normalizations run through audited application scripts (`scripts/`), not raw SQL.
- The Staging/Dev workspace applies migrations to the **Dev** Supabase project.
  Production (`Yorinternationalprod`) receives the same files only during a
  reviewed cutover.

## How to apply

Option A — Supabase SQL editor: paste the migration file content and run.

Option B — Supabase CLI from `yor_backend/`:

```bash
supabase db push
```

## History

| File | Purpose |
| --- | --- |
| `0001_baseline_note.sql` | Marks `schema.sql` (2026-06-12 state) as the applied baseline |
| `0002_encashments_and_settlement.sql` | Encashment workflow table, CD settlement audit, cap tracking, retainer ledger type |
| `0003_settled_event_action.sql` | `settled` action for activation-code events |

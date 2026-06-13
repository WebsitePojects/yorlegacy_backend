-- Audit trail for identity/code normalization runs (scripts/normalize-codes.ts).
create table if not exists code_normalization_audit (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid not null,
  column_name text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

alter table code_normalization_audit enable row level security;
revoke all on table code_normalization_audit from anon, authenticated;
grant all on table code_normalization_audit to service_role;

alter table if exists public.shadow_accounts
  add column if not exists package_tier text,
  add column if not exists account_type text,
  add column if not exists activation_code text,
  add column if not exists pv_value numeric(12, 2) not null default 0,
  add column if not exists salesmatch_value numeric(12, 2) not null default 0,
  add column if not exists activated_at timestamptz,
  add column if not exists last_upgraded_at timestamptz;

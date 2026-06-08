create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'rls_auto_enable'
      and pg_function_is_visible(oid)
  ) then
    revoke execute on function public.rls_auto_enable() from anon, authenticated;
  end if;
end;
$$;

create table if not exists site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  eyebrow text,
  strapline text,
  summary text not null,
  stats jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  cta_label text,
  cta_href text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists page_sections (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null references site_pages(slug) on delete cascade,
  section_key text not null,
  heading text not null,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_slug, section_key)
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  role text not null check (role in ('member', 'admin', 'cashier', 'bod', 'superadmin')),
  status text not null default 'active' check (status in ('active', 'disabled', 'pending')),
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_profiles (
  user_id uuid primary key references app_users(id) on delete cascade,
  access_scope text not null default 'platform',
  office_title text not null default 'Operations Admin',
  is_superadmin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists package_catalog (
  id uuid primary key default gen_random_uuid(),
  legacy_account_type integer not null unique,
  package_code text not null unique,
  package_name text not null,
  display_order integer not null default 0,
  package_price numeric(12, 2),
  pv integer,
  binary_points integer,
  direct_referral_bonus numeric(12, 2),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists member_profiles (
  user_id uuid primary key references app_users(id) on delete cascade,
  legacy_uid bigint unique,
  username text unique,
  referral_code text unique,
  sponsor_code text,
  package_tier text,
  account_status text not null default 'active',
  first_name text,
  last_name text,
  middle_name text,
  address text,
  gender text,
  date_of_birth date,
  payout_method text,
  payout_details text,
  payout_identifier text,
  contact_number text,
  facebook_account text,
  reference_number text,
  tos_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists legacy_access_accounts (
  id uuid primary key default gen_random_uuid(),
  legacy_access_id bigint not null unique,
  legacy_uid bigint,
  username text not null unique,
  display_name text,
  rights integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activation_codes (
  id uuid primary key default gen_random_uuid(),
  legacy_code_id bigint unique,
  code text not null unique,
  assigned_user_id uuid references app_users(id) on delete set null,
  generated_at timestamptz,
  transferred_at timestamptz,
  transfer_history text,
  process_id text,
  status text not null default 'available' check (status in ('available', 'assigned', 'used', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists network_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references app_users(id) on delete cascade,
  sponsor_user_id uuid references app_users(id) on delete set null,
  direct_referrer_user_id uuid references app_users(id) on delete set null,
  placement_parent_user_id uuid references app_users(id) on delete set null,
  main_account_user_id uuid references app_users(id) on delete set null,
  stockist_legacy_uid bigint,
  account_type_code integer,
  current_account_type_code integer,
  package_catalog_id uuid references package_catalog(id) on delete set null,
  legacy_code_id bigint,
  activation_code text,
  placement_position smallint check (placement_position in (1, 2)),
  binary_points integer not null default 0,
  direct_referral_value numeric(12, 2) not null default 0,
  incentive_points integer not null default 0,
  cd_amount numeric(12, 2) not null default 0,
  cd_total numeric(12, 2) not null default 0,
  cd_status integer not null default 0,
  profit_sharing_percent numeric(5, 2) not null default 0,
  registration_status text not null default 'pending' check (registration_status in ('pending', 'active', 'disabled', 'archived')),
  registered_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists upgrade_events (
  id uuid primary key default gen_random_uuid(),
  legacy_upgrade_id bigint unique,
  user_id uuid not null references app_users(id) on delete cascade,
  product_type_code integer,
  transaction_type integer,
  legacy_code_id bigint,
  total_items integer,
  binary_points integer,
  incentive_points integer,
  unilevel_points integer,
  process_id text,
  transacted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists pairing_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  legacy_pairing_id bigint,
  snapshot_date date not null,
  week_number integer,
  total_left_accounts numeric(12, 2) not null default 0,
  total_left_points integer not null default 0,
  total_right_accounts numeric(12, 2) not null default 0,
  total_right_points integer not null default 0,
  matched_left_value numeric(12, 2) not null default 0,
  matched_right_value numeric(12, 2) not null default 0,
  matched_points numeric(12, 2) not null default 0,
  total_binary_pay numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create table if not exists payout_transactions (
  id uuid primary key default gen_random_uuid(),
  legacy_payout_id bigint unique,
  user_id uuid not null references app_users(id) on delete cascade,
  main_account_user_id uuid references app_users(id) on delete set null,
  beginning_balance numeric(12, 2) not null default 0,
  ending_balance numeric(12, 2) not null default 0,
  cash_balance numeric(12, 2) not null default 0,
  income_breakdown jsonb not null default '{}'::jsonb,
  encashment_breakdown jsonb not null default '{}'::jsonb,
  encashment_fee numeric(12, 2) not null default 0,
  cd_deduction numeric(12, 2) not null default 0,
  cash_status integer not null default 0,
  payment_option text,
  payment_details text,
  cash_transacted_at timestamptz,
  redeemed_at timestamptz,
  transaction_created_at timestamptz,
  orders_no bigint,
  invoice_no bigint,
  receiver_legacy_uid bigint,
  sender_legacy_uid bigint,
  stockist_legacy_uid bigint,
  transaction_type integer,
  process_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  entry_type text not null check (
    entry_type in (
      'direct_referral',
      'salesmatch',
      'binary_cycle',
      'get_five',
      'lifestyle_rewards',
      'unilevel',
      'global_bonus',
      'encashment',
      'encashment_fee',
      'withholding_tax',
      'cd_deduction',
      'adjustment'
    )
  ),
  source_reference text,
  credit_amount numeric(12, 2) not null default 0,
  debit_amount numeric(12, 2) not null default 0,
  balance_after numeric(12, 2),
  notes text,
  process_id text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists compensation_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  mode text not null default 'gated-simulation' check (mode in ('gated-simulation')),
  title text not null,
  source_references jsonb not null default '[]'::jsonb,
  unresolved_decisions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists earning_stream_policies (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references compensation_policies(id) on delete cascade,
  stream_key text not null,
  label text not null,
  basis text not null,
  write_status text not null default 'gated' check (write_status in ('gated')),
  unresolved_decisions jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_id, stream_key)
);

create table if not exists income_simulation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  stream_key text not null,
  simulated_gross numeric(12, 2) not null default 0,
  simulated_net numeric(12, 2) not null default 0,
  cap_applied boolean not null default false,
  calculation_trace jsonb not null default '[]'::jsonb,
  required_evidence jsonb not null default '[]'::jsonb,
  process_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists shadow_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app_users(id) on delete cascade,
  shadow_code text not null unique,
  state text not null check (state in ('reserved_shadow', 'activated_shadow', 'converted_full')),
  placement text not null check (placement in ('left', 'right')),
  wallet_enabled boolean not null default false,
  unilevel_enabled boolean not null default false,
  binary_cycle_enabled boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_review_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references app_users(id) on delete set null,
  action_key text not null,
  target_reference text not null,
  status text not null default 'blocked' check (status in ('blocked', 'draft', 'reviewed', 'approved', 'rejected')),
  money_mode text not null default 'gated-simulation',
  reason text not null,
  created_at timestamptz not null default now()
);

create sequence if not exists yor_activation_code_seq start 1000;
create sequence if not exists yor_member_seq start 1000;

create or replace function public.yor_next_activation_code_sequence()
returns bigint
language sql
as $$
  select nextval('yor_activation_code_seq');
$$;

create or replace function public.yor_next_member_sequence()
returns bigint
language sql
as $$
  select nextval('yor_member_seq');
$$;

alter table if exists member_profiles add column if not exists full_name text;
alter table if exists member_profiles add column if not exists normalized_full_name text;

alter table if exists activation_codes add column if not exists code_family text not null default 'YOR CODES';
alter table if exists activation_codes add column if not exists package_tier text;
alter table if exists activation_codes add column if not exists account_type text;
alter table if exists activation_codes add column if not exists payment_status text not null default 'unpaid';
alter table if exists activation_codes add column if not exists released_at timestamptz;
alter table if exists activation_codes add column if not exists used_at timestamptz;
alter table if exists activation_codes add column if not exists used_by_user_id uuid references app_users(id) on delete set null;
alter table if exists activation_codes add column if not exists generated_by_user_id uuid references app_users(id) on delete set null;
alter table if exists activation_codes add column if not exists registration_eligible boolean not null default false;
alter table if exists activation_codes add column if not exists locked_direct_referral_bonus numeric(12, 2) not null default 0;
alter table if exists activation_codes add column if not exists locked_salesmatch_value numeric(12, 2) not null default 0;
alter table if exists activation_codes add column if not exists locked_binary_points integer not null default 0;
alter table if exists activation_codes add column if not exists locked_get_five_amount numeric(12, 2) not null default 0;
alter table if exists activation_codes add column if not exists remarks text not null default '';

alter table if exists network_accounts add column if not exists placement_side text check (placement_side in ('left', 'right'));
alter table if exists network_accounts add column if not exists current_account_type text;
alter table if exists network_accounts add column if not exists package_tier text;
alter table if exists network_accounts add column if not exists left_points integer not null default 0;
alter table if exists network_accounts add column if not exists right_points integer not null default 0;

alter table if exists wallet_ledger add column if not exists wallet_type text not null default 'main';
alter table if exists wallet_ledger add column if not exists status text not null default 'posted';

create table if not exists activation_code_events (
  id uuid primary key default gen_random_uuid(),
  activation_code_id uuid not null references activation_codes(id) on delete cascade,
  code text not null,
  action text not null check (action in ('generated', 'released', 'transferred', 'consumed')),
  actor_user_id uuid references app_users(id) on delete set null,
  actor_name text not null,
  from_user_id uuid references app_users(id) on delete set null,
  to_user_id uuid references app_users(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists placement_reservations (
  id uuid primary key default gen_random_uuid(),
  sponsor_user_id uuid not null references app_users(id) on delete cascade,
  referral_code text not null,
  placement_parent_user_id uuid not null references app_users(id) on delete cascade,
  placement_parent_username text not null,
  placement_side text not null check (placement_side in ('left', 'right')),
  share_token text not null unique,
  status text not null default 'active' check (status in ('active', 'consumed', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists compensation_queue (
  id uuid primary key default gen_random_uuid(),
  process_id text not null unique,
  event_type text not null check (event_type in ('placement-sales')),
  status text not null default 'pending' check (status in ('pending', 'processed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists salesmatch_balances (
  user_id uuid primary key references app_users(id) on delete cascade,
  left_sales numeric(12, 2) not null default 0,
  right_sales numeric(12, 2) not null default 0,
  matched_sales numeric(12, 2) not null default 0,
  left_points integer not null default 0,
  right_points integer not null default 0,
  matched_points integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_profiles_legacy_uid on member_profiles (legacy_uid);
create index if not exists idx_network_accounts_sponsor on network_accounts (sponsor_user_id);
create index if not exists idx_network_accounts_referrer on network_accounts (direct_referrer_user_id);
create index if not exists idx_pairing_snapshots_user_date on pairing_snapshots (user_id, snapshot_date desc);
create index if not exists idx_payout_transactions_user_date on payout_transactions (user_id, transaction_created_at desc);
create index if not exists idx_wallet_ledger_user_date on wallet_ledger (user_id, occurred_at desc);
create index if not exists idx_member_profiles_status_package on member_profiles (account_status, package_tier);
create index if not exists idx_network_accounts_status_type on network_accounts (registration_status, current_account_type_code);
create index if not exists idx_activation_codes_status_assigned on activation_codes (status, assigned_user_id);
create index if not exists idx_upgrade_events_user_date on upgrade_events (user_id, transacted_at desc);
create index if not exists idx_payout_transactions_status_date on payout_transactions (cash_status, transaction_created_at desc);
create index if not exists idx_wallet_ledger_entry_date on wallet_ledger (entry_type, occurred_at desc);
create index if not exists idx_earning_stream_policies_policy_order on earning_stream_policies (policy_id, sort_order);
create index if not exists idx_income_simulation_runs_user_stream on income_simulation_runs (user_id, stream_key, created_at desc);
create index if not exists idx_shadow_accounts_owner_state on shadow_accounts (owner_user_id, state);
create index if not exists idx_admin_review_actions_status_date on admin_review_actions (status, created_at desc);
create index if not exists idx_member_profiles_normalized_full_name on member_profiles (normalized_full_name);
create index if not exists idx_activation_code_events_code_date on activation_code_events (code, created_at desc);
create index if not exists idx_placement_reservations_sponsor_status on placement_reservations (sponsor_user_id, status, expires_at desc);
create index if not exists idx_compensation_queue_status_date on compensation_queue (status, created_at asc);
create unique index if not exists uq_wallet_ledger_process_id on wallet_ledger (process_id) where process_id is not null;

drop trigger if exists trg_site_pages_updated_at on site_pages;
create trigger trg_site_pages_updated_at
before update on site_pages
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_page_sections_updated_at on page_sections;
create trigger trg_page_sections_updated_at
before update on page_sections
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_app_users_updated_at on app_users;
create trigger trg_app_users_updated_at
before update on app_users
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_admin_profiles_updated_at on admin_profiles;
create trigger trg_admin_profiles_updated_at
before update on admin_profiles
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_package_catalog_updated_at on package_catalog;
create trigger trg_package_catalog_updated_at
before update on package_catalog
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_member_profiles_updated_at on member_profiles;
create trigger trg_member_profiles_updated_at
before update on member_profiles
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_legacy_access_accounts_updated_at on legacy_access_accounts;
create trigger trg_legacy_access_accounts_updated_at
before update on legacy_access_accounts
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_activation_codes_updated_at on activation_codes;
create trigger trg_activation_codes_updated_at
before update on activation_codes
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_network_accounts_updated_at on network_accounts;
create trigger trg_network_accounts_updated_at
before update on network_accounts
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_payout_transactions_updated_at on payout_transactions;
create trigger trg_payout_transactions_updated_at
before update on payout_transactions
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_compensation_policies_updated_at on compensation_policies;
create trigger trg_compensation_policies_updated_at
before update on compensation_policies
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_earning_stream_policies_updated_at on earning_stream_policies;
create trigger trg_earning_stream_policies_updated_at
before update on earning_stream_policies
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_shadow_accounts_updated_at on shadow_accounts;
create trigger trg_shadow_accounts_updated_at
before update on shadow_accounts
for each row execute function public.set_row_updated_at();

alter table site_pages enable row level security;
alter table page_sections enable row level security;
alter table app_users enable row level security;
alter table admin_profiles enable row level security;
alter table package_catalog enable row level security;
alter table member_profiles enable row level security;
alter table legacy_access_accounts enable row level security;
alter table activation_codes enable row level security;
alter table network_accounts enable row level security;
alter table upgrade_events enable row level security;
alter table pairing_snapshots enable row level security;
alter table payout_transactions enable row level security;
alter table wallet_ledger enable row level security;
alter table activation_code_events enable row level security;
alter table placement_reservations enable row level security;
alter table compensation_queue enable row level security;
alter table salesmatch_balances enable row level security;
alter table compensation_policies enable row level security;
alter table earning_stream_policies enable row level security;
alter table income_simulation_runs enable row level security;
alter table shadow_accounts enable row level security;
alter table admin_review_actions enable row level security;

revoke all on table activation_codes from anon, authenticated;
revoke all on table activation_code_events from anon, authenticated;
revoke all on table placement_reservations from anon, authenticated;
revoke all on table compensation_queue from anon, authenticated;
revoke all on table salesmatch_balances from anon, authenticated;
revoke all on table wallet_ledger from anon, authenticated;
revoke all on table network_accounts from anon, authenticated;
revoke all on table member_profiles from anon, authenticated;
revoke all on table app_users from anon, authenticated;

grant all on table activation_codes to service_role;
grant all on table activation_code_events to service_role;
grant all on table placement_reservations to service_role;
grant all on table compensation_queue to service_role;
grant all on table salesmatch_balances to service_role;
grant all on table wallet_ledger to service_role;
grant all on table network_accounts to service_role;
grant all on table member_profiles to service_role;
grant all on table app_users to service_role;

revoke all on sequence yor_activation_code_seq from anon, authenticated;
revoke all on sequence yor_member_seq from anon, authenticated;
grant usage, select, update on sequence yor_activation_code_seq to service_role;
grant usage, select, update on sequence yor_member_seq to service_role;

revoke execute on function public.yor_next_activation_code_sequence() from anon, authenticated;
revoke execute on function public.yor_next_member_sequence() from anon, authenticated;
grant execute on function public.yor_next_activation_code_sequence() to service_role;
grant execute on function public.yor_next_member_sequence() to service_role;

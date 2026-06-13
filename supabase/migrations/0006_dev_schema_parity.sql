-- Dev database schema parity migration (2026-06-13).
-- Brings hcrsrxdroldfvbplbuuz (dev) to match rdiyejmsxqrgjvtiewwd (prod).
-- All statements are idempotent (IF NOT EXISTS / DROP...IF EXISTS).
-- Covers: 4 missing schema.sql baseline tables + migrations 0002-0005 + 5 prod-only tables.

-- ─────────────────────────────────────────────────────────────────────────────
-- PART A: Missing schema.sql baseline tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists activation_code_events (
  id                 uuid        primary key default gen_random_uuid(),
  activation_code_id uuid        not null references activation_codes(id) on delete cascade,
  code               text        not null,
  action             text        not null check (action in ('generated','released','transferred','consumed')),
  actor_user_id      uuid        references app_users(id) on delete set null,
  actor_name         text        not null,
  from_user_id       uuid        references app_users(id) on delete set null,
  to_user_id         uuid        references app_users(id) on delete set null,
  notes              text        not null default '',
  created_at         timestamptz not null default now()
);

create table if not exists placement_reservations (
  id                            uuid        primary key default gen_random_uuid(),
  sponsor_user_id               uuid        not null references app_users(id) on delete cascade,
  referral_code                 text        not null,
  placement_parent_user_id      uuid        not null references app_users(id) on delete cascade,
  placement_parent_username     text        not null,
  placement_parent_shadow_side  text        check (placement_parent_shadow_side in ('left','right')),
  placement_side                text        not null check (placement_side in ('left','right')),
  share_token                   text        not null unique,
  status                        text        not null default 'active' check (status in ('active','consumed','expired')),
  expires_at                    timestamptz not null,
  created_at                    timestamptz not null default now()
);

create table if not exists compensation_queue (
  id           uuid        primary key default gen_random_uuid(),
  process_id   text        not null unique,
  event_type   text        not null check (event_type in ('placement-sales')),
  status       text        not null default 'pending' check (status in ('pending','processed')),
  payload      jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists salesmatch_balances (
  user_id        uuid          primary key references app_users(id) on delete cascade,
  left_sales     numeric(12,2) not null default 0,
  right_sales    numeric(12,2) not null default 0,
  matched_sales  numeric(12,2) not null default 0,
  left_points    integer       not null default 0,
  right_points   integer       not null default 0,
  matched_points integer       not null default 0,
  updated_at     timestamptz   not null default now()
);

-- Baseline indexes (safe to re-run)
create index if not exists idx_activation_code_events_code_date       on activation_code_events (code, created_at desc);
create index if not exists idx_placement_reservations_sponsor_status  on placement_reservations (sponsor_user_id, status, expires_at desc);
create index if not exists idx_compensation_queue_status_date         on compensation_queue     (status, created_at asc);
create index if not exists idx_member_profiles_legacy_uid             on member_profiles        (legacy_uid);
create index if not exists idx_network_accounts_sponsor               on network_accounts       (sponsor_user_id);
create index if not exists idx_network_accounts_referrer              on network_accounts       (direct_referrer_user_id);
create index if not exists idx_pairing_snapshots_user_date            on pairing_snapshots      (user_id, snapshot_date desc);
create index if not exists idx_payout_transactions_user_date          on payout_transactions    (user_id, transaction_created_at desc);
create index if not exists idx_wallet_ledger_user_date                on wallet_ledger          (user_id, occurred_at desc);
create index if not exists idx_member_profiles_status_package         on member_profiles        (account_status, package_tier);
create index if not exists idx_network_accounts_status_type           on network_accounts       (registration_status, current_account_type_code);
create index if not exists idx_activation_codes_status_assigned       on activation_codes       (status, assigned_user_id);
create index if not exists idx_upgrade_events_user_date               on upgrade_events         (user_id, transacted_at desc);
create index if not exists idx_payout_transactions_status_date        on payout_transactions    (cash_status, transaction_created_at desc);
create index if not exists idx_wallet_ledger_entry_date               on wallet_ledger          (entry_type, occurred_at desc);
create index if not exists idx_earning_stream_policies_policy_order   on earning_stream_policies(policy_id, sort_order);
create index if not exists idx_income_simulation_runs_user_stream     on income_simulation_runs (user_id, stream_key, created_at desc);
create index if not exists idx_shadow_accounts_owner_state            on shadow_accounts        (owner_user_id, state);
create index if not exists idx_admin_review_actions_status_date       on admin_review_actions   (status, created_at desc);
create index if not exists idx_member_profiles_normalized_full_name   on member_profiles        (normalized_full_name);
create unique index if not exists uq_wallet_ledger_process_id         on wallet_ledger          (process_id) where process_id is not null;

-- Activation-code production columns and sequence RPCs expected by the
-- production-mode backend. Some dev databases were created before these
-- schema.sql additions, which makes admin code generation fail before insert.
create sequence if not exists yor_activation_code_seq start 1000;
create sequence if not exists yor_member_seq start 1000;

create or replace function public.yor_next_activation_code_sequence()
returns bigint
language sql
security definer
set search_path = public, pg_catalog
as $$
  select nextval('yor_activation_code_seq');
$$;

create or replace function public.yor_next_member_sequence()
returns bigint
language sql
security definer
set search_path = public, pg_catalog
as $$
  select nextval('yor_member_seq');
$$;

alter table if exists activation_codes
  add column if not exists code_family                  text not null default 'YOR CODES',
  add column if not exists package_tier                 text,
  add column if not exists account_type                 text,
  add column if not exists payment_status               text not null default 'unpaid',
  add column if not exists released_at                  timestamptz,
  add column if not exists used_at                      timestamptz,
  add column if not exists used_by_user_id              uuid references app_users(id) on delete set null,
  add column if not exists generated_by_user_id         uuid references app_users(id) on delete set null,
  add column if not exists registration_eligible        boolean not null default false,
  add column if not exists locked_direct_referral_bonus numeric(12, 2) not null default 0,
  add column if not exists locked_salesmatch_value      numeric(12, 2) not null default 0,
  add column if not exists locked_binary_points         integer not null default 0,
  add column if not exists locked_get_five_amount       numeric(12, 2) not null default 0,
  add column if not exists remarks                      text not null default '';

revoke all on sequence yor_activation_code_seq from anon, authenticated;
revoke all on sequence yor_member_seq          from anon, authenticated;
grant  usage, select, update on sequence yor_activation_code_seq to service_role;
grant  usage, select, update on sequence yor_member_seq          to service_role;

revoke execute on function public.yor_next_activation_code_sequence() from anon, authenticated;
revoke execute on function public.yor_next_member_sequence()          from anon, authenticated;
grant  execute on function public.yor_next_activation_code_sequence() to service_role;
grant  execute on function public.yor_next_member_sequence()          to service_role;

-- RLS + grants for baseline tables
alter table activation_code_events  enable row level security;
alter table placement_reservations  enable row level security;
alter table compensation_queue      enable row level security;
alter table salesmatch_balances     enable row level security;
revoke all on table activation_code_events from anon, authenticated;
revoke all on table placement_reservations from anon, authenticated;
revoke all on table compensation_queue     from anon, authenticated;
revoke all on table salesmatch_balances    from anon, authenticated;
grant  all on table activation_code_events to service_role;
grant  all on table placement_reservations to service_role;
grant  all on table compensation_queue     to service_role;
grant  all on table salesmatch_balances    to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART B: Migration 0002 — encashments table + column additions + constraints
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists encashments (
  id                  uuid          primary key default gen_random_uuid(),
  user_id             uuid          not null references app_users(id) on delete cascade,
  process_id          text          not null unique,
  gross_amount        numeric(12,2) not null check (gross_amount > 0),
  processing_fee      numeric(12,2) not null default 50,
  tax_amount          numeric(12,2) not null default 0,
  system_retainer     numeric(12,2) not null default 0,
  cd_deduction        numeric(12,2) not null default 0,
  total_deductions    numeric(12,2) not null default 0,
  net_amount          numeric(12,2) not null default 0,
  status              text          not null default 'pending'
    check (status in ('pending','queued','approved','paid','cancelled','rejected')),
  payout_method       text,
  payout_details      text,
  reviewed_by_user_id uuid          references app_users(id) on delete set null,
  reviewed_at         timestamptz,
  paid_at             timestamptz,
  remarks             text          not null default '',
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);
create index if not exists idx_encashments_user_date   on encashments (user_id, created_at desc);
create index if not exists idx_encashments_status_date on encashments (status,  created_at desc);
drop trigger if exists trg_encashments_updated_at on encashments;
create trigger trg_encashments_updated_at
  before update on encashments
  for each row execute function public.set_row_updated_at();
alter table encashments enable row level security;
revoke all on table encashments from anon, authenticated;
grant  all on table encashments to service_role;

alter table if exists activation_codes
  add column if not exists settled_at         timestamptz,
  add column if not exists settled_by_user_id uuid references app_users(id) on delete set null;

alter table if exists pairing_snapshots
  add column if not exists paid_salesmatch      numeric(12,2) not null default 0,
  add column if not exists forfeited_salesmatch numeric(12,2) not null default 0;

alter table wallet_ledger drop constraint if exists wallet_ledger_entry_type_check;
alter table wallet_ledger add constraint wallet_ledger_entry_type_check check (
  entry_type in (
    'direct_referral','salesmatch','binary_cycle','get_five',
    'lifestyle_rewards','unilevel','global_bonus','encashment',
    'encashment_fee','withholding_tax','system_retainer','cd_deduction','adjustment'
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART C: Migration 0003 — activation_code_events action constraint
-- ─────────────────────────────────────────────────────────────────────────────

alter table activation_code_events drop constraint if exists activation_code_events_action_check;
alter table activation_code_events add constraint activation_code_events_action_check
  check (action in ('generated','released','transferred','consumed','settled','revoked','restored'));

-- ─────────────────────────────────────────────────────────────────────────────
-- PART D: Migration 0004 — code_normalization_audit
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists code_normalization_audit (
  id          uuid        primary key default gen_random_uuid(),
  table_name  text        not null,
  row_id      uuid        not null,
  column_name text        not null,
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);
alter table code_normalization_audit enable row level security;
revoke all on table code_normalization_audit from anon, authenticated;
grant  all on table code_normalization_audit to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART E: Migration 0005 — member_profiles company-account tagging
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.member_profiles
  add column if not exists is_company_account     boolean not null default false,
  add column if not exists is_leaderboard_excluded boolean not null default false,
  add column if not exists company_account_tag    text;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART F: Prod-only tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists binary_point_events (
  id               uuid         primary key default gen_random_uuid(),
  process_key      varchar(256) not null unique,
  source_member_id uuid         not null references app_users(id) on delete cascade,
  owner_id         uuid         references app_users(id) on delete set null,
  parent_id        uuid         references app_users(id) on delete set null,
  leg              varchar(8)   not null check (leg in ('left','right')),
  event_type       varchar(32)  not null,
  package_tier     varchar(32),
  point_value      numeric      not null default 0,
  reference_key    varchar(256) not null unique,
  event_ts         timestamptz  not null default now(),
  created_at       timestamptz  not null default now()
);
create index if not exists idx_bpe_source    on binary_point_events (source_member_id, event_ts);
create index if not exists idx_bpe_owner_leg on binary_point_events (owner_id, leg, event_ts);
create index if not exists idx_bpe_parent    on binary_point_events (parent_id, leg, event_ts);
alter table binary_point_events enable row level security;
revoke all on table binary_point_events from anon, authenticated;
grant  all on table binary_point_events to service_role;

create table if not exists binary_tree_closure (
  ancestor_id   uuid        not null references app_users(id) on delete cascade,
  descendant_id uuid        not null references app_users(id) on delete cascade,
  depth         integer     not null default 0,
  leg           varchar(8)  not null check (leg in ('left','right','root')),
  is_shadow     boolean     not null default false,
  created_at    timestamptz not null default now(),
  primary key (ancestor_id, descendant_id)
);
create index if not exists idx_btc_ancestor_depth on binary_tree_closure (ancestor_id, depth);
create index if not exists idx_btc_ancestor_leg   on binary_tree_closure (ancestor_id, leg, depth);
create index if not exists idx_btc_descendant     on binary_tree_closure (descendant_id, ancestor_id);
alter table binary_tree_closure enable row level security;
revoke all on table binary_tree_closure from anon, authenticated;
grant  all on table binary_tree_closure to service_role;

create table if not exists pairing_ledger (
  id                 uuid         primary key default gen_random_uuid(),
  ledger_uid         uuid         not null unique default gen_random_uuid(),
  owner_id           uuid         not null references app_users(id) on delete cascade,
  left_process_key   varchar(256),
  right_process_key  varchar(256),
  pair_points        numeric      not null default 0,
  pair_cap           numeric      not null default 0,
  points_used        numeric      not null default 0,
  income_process_key varchar(256),
  paired_at          timestamptz  not null default now(),
  created_at         timestamptz  not null default now()
);
create index if not exists idx_pl_owner on pairing_ledger (owner_id, paired_at);
alter table pairing_ledger enable row level security;
revoke all on table pairing_ledger from anon, authenticated;
grant  all on table pairing_ledger to service_role;

create table if not exists rankings (
  id                        uuid        primary key default gen_random_uuid(),
  user_id                   uuid        not null unique references app_users(id) on delete cascade,
  current_rank              integer     not null default 0,
  highest_rank              integer     not null default 0,
  binary_points_total       numeric     not null default 0,
  basis_points              numeric     not null default 0,
  consumed_points           numeric     not null default 0,
  remaining_rankable_points numeric     not null default 0,
  left_qualified_count      integer     not null default 0,
  right_qualified_count     integer     not null default 0,
  race_basis_mode           varchar(40) not null default 'repurchase-event',
  rank_date                 timestamptz,
  qualified_date            timestamptz,
  last_calculated_at        timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists idx_rankings_rank on rankings (current_rank);
drop trigger if exists trg_rankings_updated_at on rankings;
create trigger trg_rankings_updated_at
  before update on rankings
  for each row execute function public.set_row_updated_at();
alter table rankings enable row level security;
revoke all on table rankings from anon, authenticated;
grant  all on table rankings to service_role;

create table if not exists repurchases (
  id               uuid         primary key default gen_random_uuid(),
  process_key      varchar(256) not null unique,
  user_id          uuid         not null references app_users(id) on delete cascade,
  product_code     varchar(80)  not null,
  product_name     varchar(255),
  product_type     varchar(32)  not null default 'perfume',
  quantity         integer      not null default 1,
  unit_price       numeric      not null default 0,
  total_amount     numeric      not null default 0,
  pv_earned        numeric      not null default 0,
  activation_code  varchar(80),
  transaction_date timestamptz  not null default now(),
  created_at       timestamptz  not null default now()
);
create index if not exists idx_rp_user    on repurchases (user_id,      transaction_date);
create index if not exists idx_rp_product on repurchases (product_type, transaction_date);
alter table repurchases enable row level security;
revoke all on table repurchases from anon, authenticated;
grant  all on table repurchases to service_role;

-- Refresh PostgREST after adding columns/RPCs so local production-mode code can
-- use them immediately through supabase-js.
notify pgrst, 'reload schema';

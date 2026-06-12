-- Encashment request workflow (production mode) + CD settlement tracking.
create table if not exists encashments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  process_id text not null unique,
  gross_amount numeric(12, 2) not null check (gross_amount > 0),
  processing_fee numeric(12, 2) not null default 50,
  tax_amount numeric(12, 2) not null default 0,
  system_retainer numeric(12, 2) not null default 0,
  cd_deduction numeric(12, 2) not null default 0,
  total_deductions numeric(12, 2) not null default 0,
  net_amount numeric(12, 2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'approved', 'paid', 'cancelled', 'rejected')),
  payout_method text,
  payout_details text,
  reviewed_by_user_id uuid references app_users(id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz,
  remarks text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_encashments_user_date on encashments (user_id, created_at desc);
create index if not exists idx_encashments_status_date on encashments (status, created_at desc);

drop trigger if exists trg_encashments_updated_at on encashments;
create trigger trg_encashments_updated_at
before update on encashments
for each row execute function public.set_row_updated_at();

alter table encashments enable row level security;
revoke all on table encashments from anon, authenticated;
grant all on table encashments to service_role;

-- CD settlement audit on activation codes (when payment_status flips to paid).
alter table if exists activation_codes add column if not exists settled_at timestamptz;
alter table if exists activation_codes add column if not exists settled_by_user_id uuid references app_users(id) on delete set null;

-- Weekly pairing payout tracking (cap enforcement with forfeiture).
alter table if exists pairing_snapshots add column if not exists paid_salesmatch numeric(12, 2) not null default 0;
alter table if exists pairing_snapshots add column if not exists forfeited_salesmatch numeric(12, 2) not null default 0;

-- Add the System Retainer ledger entry type used by the production encashment flow.
alter table wallet_ledger drop constraint if exists wallet_ledger_entry_type_check;
alter table wallet_ledger add constraint wallet_ledger_entry_type_check check (
  entry_type in (
    'direct_referral', 'salesmatch', 'binary_cycle', 'get_five',
    'lifestyle_rewards', 'unilevel', 'global_bonus', 'encashment',
    'encashment_fee', 'withholding_tax', 'system_retainer', 'cd_deduction', 'adjustment'
  )
);

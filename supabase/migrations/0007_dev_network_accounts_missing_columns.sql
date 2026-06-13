-- Dev schema parity: network_accounts missing columns (2026-06-13).
-- Adds 6 columns present in prod but absent in dev, populates them, and
-- removes 3 incorrect get_five wallet_ledger entries posted before the
-- current_account_type column existed (FS directs were treated as PD).
-- GATE-GYF-TIER-20260613: FS accounts are ineligible for Get Yor Five.

alter table network_accounts
  add column if not exists current_account_type          text,
  add column if not exists package_tier                  text,
  add column if not exists placement_side                text,
  add column if not exists placement_parent_shadow_side  text,
  add column if not exists left_points                   integer not null default 0,
  add column if not exists right_points                  integer not null default 0;

-- Derive current_account_type from current_account_type_code:
-- 2 → 'FS', 1 + cd_amount > 0 → 'CD', else → 'PD'
update network_accounts
set current_account_type =
  case
    when current_account_type_code = 2 then 'FS'
    when current_account_type_code = 1 and cd_amount > 0 then 'CD'
    else 'PD'
  end
where current_account_type is null;

-- Populate package_tier from member_profiles
update network_accounts na
set package_tier = mp.package_tier
from member_profiles mp
where mp.user_id = na.user_id
  and na.package_tier is null;

-- Remove the three old-format get_five entries (pre-eligibility-enforcement).
-- Process keys lack the group index that the current engine appends; these
-- entries credited FS directs that should never qualify.
delete from wallet_ledger
where entry_type = 'get_five'
  and process_id in (
    'registration-get-five:00000000-0000-4000-8000-000000000002:VIP',
    'registration-get-five:d6134833-87fb-4194-9755-713733df29d3:BUSINESS',
    'registration-get-five:dff72a0b-7342-4ea9-9472-52a20c410aaf:BUSINESS'
  );

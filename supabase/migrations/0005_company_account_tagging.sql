-- Company-account tagging for leaderboard exclusion (owner sign-off item 8, 2026-06-13).
-- Tags are keyed by the immutable member_profiles row so exclusion survives any
-- future username / full-name change. The Prince I.T owner account additionally
-- carries the 'owner-system-retainer' tag used by the System Retainer workstream.
-- Applied to Yorinternationalprod (rdiyejmsxqrgjvtiewwd) on 2026-06-13 via MCP
-- migration `add_company_account_tagging_columns`; this file keeps dev + future
-- environments in schema parity. Additive only.
alter table public.member_profiles
  add column if not exists is_company_account boolean not null default false,
  add column if not exists is_leaderboard_excluded boolean not null default false,
  add column if not exists company_account_tag text;

-- Data tagging is environment-specific (prod user_ids) and was applied directly to
-- production. For reference, production tags these usernames (by captured user_id):
--   yor01, Yorintl, Yorintl2, Yorintl3, Yorintl4  -> 'company'
--   PrinceI.T                                      -> 'owner-system-retainer'
-- Office-role accounts (admin/cashier/bod/superadmin) are excluded from
-- leaderboards by role at query time, not by this flag.

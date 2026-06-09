-- Yorinternationalprod bootstrap
-- Applies the minimum live operational data set requested for production:
-- one admin office account and one root member account.

delete from admin_review_actions;
delete from income_simulation_runs;
delete from shadow_accounts;
delete from earning_stream_policies;
delete from compensation_policies;
delete from activation_code_events;
delete from placement_reservations;
delete from compensation_queue;
delete from salesmatch_balances;
delete from wallet_ledger;
delete from payout_transactions;
delete from pairing_snapshots;
delete from upgrade_events;
delete from network_accounts;
delete from activation_codes;
delete from member_profiles;
delete from admin_profiles;
delete from legacy_access_accounts;
delete from app_users;

insert into app_users (id, email, display_name, role, status, password_hash, password_salt)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'yoradmin@yorinternational.local',
    'Yor Admin',
    'admin',
    'active',
    '079450fd07bb5eff043d90fb17c1f9bb81f8a48c1f21b465e9f64387a49c801589dbf2d4285cc42f35cbd4fa5933ac46ef815bc98fcd0bb2f3996ecb58d9dc00',
    'c81b8dea45d83233463ab99c9a4261b2'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'yor01@yorinternational.local',
    'Yor Company 01',
    'member',
    'active',
    'ae31dfa1f98ad65f601af079c561b642fced012182c4546a01f584e3ee26a9cd3bc18e029eb6ed73fb6e6dd2569fcb0169d5c514206fda90d9d550065dc51448',
    'b0ea5370f0b9a1e59db3176e577bfcc2'
  );

insert into admin_profiles (user_id, access_scope, office_title, is_superadmin)
values
  ('00000000-0000-4000-8000-000000000001', 'platform', 'Admin Office', false);

insert into legacy_access_accounts (
  legacy_access_id,
  legacy_uid,
  username,
  display_name,
  rights,
  is_active
)
values
  (1, 1, 'yoradmin', 'Yor Admin', 1, true);

insert into member_profiles (
  user_id,
  legacy_uid,
  username,
  referral_code,
  sponsor_code,
  package_tier,
  account_status,
  full_name,
  first_name,
  last_name,
  contact_number,
  normalized_full_name,
  payout_method,
  payout_details
)
values
  (
    '00000000-0000-4000-8000-000000000002',
    1,
    'yor01',
    '7QK2EPYN',
    null,
    'VIP',
    'active',
    'Yor Company 01',
    'Yor Company',
    '01',
    '',
    'YOR COMPANY 01',
    null,
    null
  );

insert into network_accounts (
  user_id,
  sponsor_user_id,
  direct_referrer_user_id,
  placement_parent_user_id,
  placement_parent_shadow_side,
  placement_side,
  current_account_type_code,
  current_account_type,
  package_tier,
  activation_code,
  registration_status,
  left_points,
  right_points,
  created_at
)
values
  (
    '00000000-0000-4000-8000-000000000002',
    null,
    null,
    null,
    null,
    null,
    60,
    'FS',
    'VIP',
    null,
    'active',
    0,
    0,
    now()
  );

insert into salesmatch_balances (
  user_id,
  left_sales,
  right_sales,
  matched_sales,
  left_points,
  right_points,
  matched_points,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000002',
    0,
    0,
    0,
    0,
    0,
    0,
    now()
  );

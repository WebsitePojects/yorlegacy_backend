import type { AppRole } from './auth';

export type AppUserStatus = 'active' | 'disabled' | 'pending';

export type MemberAccountStatus = 'active' | 'pending' | 'frozen' | 'suspended';
export type RegistrationStatus = 'pending' | 'active' | 'disabled' | 'archived';
export type PlacementSide = 'left' | 'right';

export type ActivationCodeStatus = 'unreleased' | 'available' | 'assigned' | 'used' | 'disabled';
export type ActivationCodePaymentStatus = 'unpaid' | 'paid' | 'externally-paid';
export type ActivationCodeEventAction = 'generated' | 'released' | 'transferred' | 'consumed' | 'settled' | 'revoked' | 'restored';

export type TreeLeg = 'left' | 'right' | 'self';
export type ShadowAccountState = 'reserved_shadow' | 'activated_shadow' | 'converted_full';
export type PlacementReservationStatus = 'active' | 'consumed' | 'expired';
export type BinaryPointEventType =
  | 'registration'
  | 'package_upgrade'
  | 'qualifying_code'
  | 'product_purchase'
  | 'manual_adjustment';

export type WalletEntryType =
  | 'direct_referral'
  | 'salesmatch'
  | 'binary_cycle'
  | 'get_five'
  | 'lifestyle_rewards'
  | 'unilevel'
  | 'global_bonus'
  | 'encashment'
  | 'encashment_fee'
  | 'withholding_tax'
  | 'cd_deduction'
  | 'adjustment';

export type WalletLedgerStatus = 'posted' | 'pending' | 'reversed';

export type EncashmentStatus =
  | 'submitted'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'rejected'
  | 'cancelled'
  | 'reversed';

export type CompensationEventType = 'placement-sales';
export type CompensationQueueStatus = 'pending' | 'processed';
export type AdminReviewStatus = 'blocked' | 'draft' | 'reviewed' | 'approved' | 'rejected';
export type RepurchaseProductType = 'perfume' | 'refill' | 'vision' | 'other';

export interface AppUserRow {
  id: string;
  email: string;
  display_name: string;
  role: AppRole;
  status: AppUserStatus;
  password_hash: string;
  password_salt: string;
  created_at: string;
  updated_at: string;
}

export interface AdminProfileRow {
  user_id: string;
  access_scope: string;
  office_title: string;
  is_superadmin: boolean;
  created_at: string;
  updated_at: string;
}

export interface LegacyAccessAccountRow {
  id: string;
  legacy_access_id: number;
  legacy_uid: number | null;
  username: string;
  display_name: string | null;
  rights: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberProfileRow {
  user_id: string;
  legacy_uid: number | null;
  username: string | null;
  referral_code: string | null;
  sponsor_code: string | null;
  package_tier: string | null;
  account_status: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  full_name: string | null;
  normalized_full_name: string | null;
  address: string | null;
  gender: string | null;
  date_of_birth: string | null;
  payout_method: string | null;
  payout_details: string | null;
  payout_identifier: string | null;
  contact_number: string | null;
  facebook_account: string | null;
  reference_number: string | null;
  tos_accepted: boolean;
  created_at: string;
  updated_at: string;
}

export interface NetworkAccountRow {
  id: string;
  user_id: string;
  sponsor_user_id: string | null;
  direct_referrer_user_id: string | null;
  placement_parent_user_id: string | null;
  placement_parent_shadow_side: PlacementSide | null;
  main_account_user_id: string | null;
  stockist_legacy_uid: number | null;
  account_type_code: number | null;
  current_account_type_code: number | null;
  package_catalog_id: string | null;
  legacy_code_id: number | null;
  activation_code: string | null;
  placement_position: 1 | 2 | null;
  placement_side: PlacementSide | null;
  current_account_type: string | null;
  package_tier: string | null;
  binary_points: number;
  left_points: number;
  right_points: number;
  direct_referral_value: number;
  incentive_points: number;
  cd_amount: number;
  cd_total: number;
  cd_status: number;
  profit_sharing_percent: number;
  registration_status: RegistrationStatus;
  registered_at: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackageCatalogRow {
  id: string;
  legacy_account_type: number;
  package_code: string;
  package_name: string;
  display_order: number;
  package_price: number | null;
  pv: number | null;
  binary_points: number | null;
  direct_referral_bonus: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivationCodeRow {
  id: string;
  legacy_code_id: number | null;
  code: string;
  code_family: string;
  package_tier: string | null;
  account_type: string | null;
  payment_status: ActivationCodePaymentStatus;
  status: ActivationCodeStatus;
  assigned_user_id: string | null;
  generated_by_user_id: string | null;
  used_by_user_id: string | null;
  generated_at: string | null;
  transferred_at: string | null;
  released_at: string | null;
  used_at: string | null;
  transfer_history: string | null;
  process_id: string | null;
  registration_eligible: boolean;
  locked_direct_referral_bonus: number;
  locked_salesmatch_value: number;
  locked_binary_points: number;
  locked_get_five_amount: number;
  remarks: string;
  settled_at: string | null;
  settled_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EncashmentRow {
  id: string;
  user_id: string;
  process_id: string;
  gross_amount: number;
  processing_fee: number;
  tax_amount: number;
  system_retainer: number;
  cd_deduction: number;
  total_deductions: number;
  net_amount: number;
  status: 'pending' | 'queued' | 'approved' | 'paid' | 'cancelled' | 'rejected';
  payout_method: string | null;
  payout_details: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface ActivationCodeEventRow {
  id: string;
  activation_code_id: string;
  code: string;
  action: ActivationCodeEventAction;
  actor_user_id: string | null;
  actor_name: string;
  from_user_id: string | null;
  to_user_id: string | null;
  notes: string;
  created_at: string;
}

export interface PlacementReservationRow {
  id: string;
  sponsor_user_id: string;
  referral_code: string;
  placement_parent_user_id: string;
  placement_parent_username: string;
  placement_parent_shadow_side: PlacementSide | null;
  placement_side: PlacementSide;
  share_token: string;
  status: PlacementReservationStatus;
  expires_at: string;
  created_at: string;
}

export interface ShadowAccountRow {
  id: string;
  owner_user_id: string;
  shadow_code: string;
  state: ShadowAccountState;
  placement: PlacementSide;
  wallet_enabled: boolean;
  unilevel_enabled: boolean;
  binary_cycle_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletLedgerRow {
  id: string;
  user_id: string;
  wallet_type: string;
  entry_type: WalletEntryType;
  source_reference: string | null;
  credit_amount: number;
  debit_amount: number;
  balance_after: number | null;
  notes: string | null;
  process_id: string | null;
  status: WalletLedgerStatus;
  occurred_at: string;
  created_at: string;
}

export interface PayoutTransactionRow {
  id: string;
  legacy_payout_id: number | null;
  user_id: string;
  main_account_user_id: string | null;
  beginning_balance: number;
  ending_balance: number;
  cash_balance: number;
  income_breakdown: Record<string, unknown>;
  encashment_breakdown: Record<string, unknown>;
  encashment_fee: number;
  cd_deduction: number;
  cash_status: number;
  payment_option: string | null;
  payment_details: string | null;
  cash_transacted_at: string | null;
  redeemed_at: string | null;
  transaction_created_at: string | null;
  orders_no: number | null;
  invoice_no: number | null;
  receiver_legacy_uid: number | null;
  sender_legacy_uid: number | null;
  stockist_legacy_uid: number | null;
  transaction_type: number | null;
  process_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesmatchBalanceRow {
  user_id: string;
  left_sales: number;
  right_sales: number;
  matched_sales: number;
  left_points: number;
  right_points: number;
  matched_points: number;
  updated_at: string;
}

export interface CompensationQueueRow {
  id: string;
  process_id: string;
  event_type: CompensationEventType;
  status: CompensationQueueStatus;
  payload: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
}

export interface CompensationPolicyRow {
  id: string;
  policy_key: string;
  mode: string;
  title: string;
  source_references: unknown[];
  unresolved_decisions: unknown[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EarningStreamPolicyRow {
  id: string;
  policy_id: string;
  stream_key: string;
  label: string;
  basis: string;
  write_status: string;
  unresolved_decisions: unknown[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface IncomeSimulationRunRow {
  id: string;
  user_id: string | null;
  stream_key: string;
  simulated_gross: number;
  simulated_net: number;
  cap_applied: boolean;
  calculation_trace: unknown[];
  required_evidence: unknown[];
  process_id: string;
  created_at: string;
}

export interface BinaryTreeClosureRow {
  ancestor_id: string;
  descendant_id: string;
  depth: number;
  leg: TreeLeg;
  is_shadow: boolean;
  created_at: string;
}

export interface BinaryPointEventRow {
  id: string;
  process_key: string;
  source_member_id: string;
  owner_id: string | null;
  parent_id: string | null;
  leg: TreeLeg | 'unknown';
  event_type: BinaryPointEventType;
  package_tier: string | null;
  point_value: number;
  reference_key: string;
  event_ts: string;
  created_at: string;
}

export interface PairingLedgerRow {
  id: string;
  ledger_uid: string;
  owner_id: string;
  left_process_key: string | null;
  right_process_key: string | null;
  pair_points: number;
  pair_cap: number;
  points_used: number;
  income_process_key: string | null;
  paired_at: string;
  created_at: string;
}

export interface PairingSnapshotRow {
  id: string;
  user_id: string;
  legacy_pairing_id: number | null;
  snapshot_date: string;
  week_number: number | null;
  total_left_accounts: number;
  total_left_points: number;
  total_right_accounts: number;
  total_right_points: number;
  matched_left_value: number;
  matched_right_value: number;
  matched_points: number;
  total_binary_pay: number;
  created_at: string;
}

export interface RankingRow {
  id: string;
  user_id: string;
  current_rank: number;
  highest_rank: number;
  binary_points_total: number;
  basis_points: number;
  consumed_points: number;
  remaining_rankable_points: number;
  left_qualified_count: number;
  right_qualified_count: number;
  race_basis_mode: string;
  rank_date: string | null;
  qualified_date: string | null;
  last_calculated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpgradeEventRow {
  id: string;
  legacy_upgrade_id: number | null;
  user_id: string;
  product_type_code: number | null;
  transaction_type: number | null;
  legacy_code_id: number | null;
  total_items: number | null;
  binary_points: number | null;
  incentive_points: number | null;
  unilevel_points: number | null;
  process_id: string | null;
  transacted_at: string | null;
  created_at: string;
}

export interface RepurchaseRow {
  id: string;
  process_key: string;
  user_id: string;
  product_code: string;
  product_name: string | null;
  product_type: RepurchaseProductType;
  quantity: number;
  unit_price: number;
  total_amount: number;
  pv_earned: number;
  activation_code: string | null;
  transaction_date: string;
  created_at: string;
}

export interface AdminReviewActionRow {
  id: string;
  actor_user_id: string | null;
  action_key: string;
  target_reference: string;
  status: AdminReviewStatus;
  money_mode: string;
  reason: string;
  created_at: string;
}

export interface SitePageRow {
  id: string;
  slug: string;
  title: string;
  eyebrow: string | null;
  strapline: string | null;
  summary: string;
  stats: unknown[];
  highlights: unknown[];
  cta_label: string | null;
  cta_href: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageSectionRow {
  id: string;
  page_slug: string;
  section_key: string;
  heading: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ProductionActivationCode,
  ProductionActivationCodeEvent,
  ProductionAppUser,
  ProductionCompensationQueueItem,
  ProductionEncashment,
  ProductionEncodingRepository,
  ProductionMemberProfile,
  ProductionNetworkAccount,
  ProductionPlacementReservation,
  ProductionSalesmatchBalance,
  ProductionShadowAccount,
  ProductionWalletLedgerEntry
} from './encoding-service.js';
import type {
  ActivationCodeEventRow,
  ActivationCodeRow,
  AppUserRow,
  CompensationQueueRow,
  EncashmentRow,
  MemberProfileRow,
  NetworkAccountRow,
  PlacementReservationRow,
  SalesmatchBalanceRow,
  ShadowAccountRow,
  WalletLedgerRow
} from '../../types/db';

function isoNow() {
  return new Date().toISOString();
}

function mapDbText(value: string | null): string {
  return value as string;
}

function mapMemberPackageTier(value: string | null): ProductionMemberProfile['packageTier'] {
  return value as ProductionMemberProfile['packageTier'];
}

function mapMemberAccountStatus(value: string): ProductionMemberProfile['accountStatus'] {
  return value as ProductionMemberProfile['accountStatus'];
}

function mapNetworkAccountType(value: string | null): ProductionNetworkAccount['currentAccountType'] {
  return value as ProductionNetworkAccount['currentAccountType'];
}

function mapNetworkRegistrationStatus(value: NetworkAccountRow['registration_status']): ProductionNetworkAccount['registrationStatus'] {
  return value as ProductionNetworkAccount['registrationStatus'];
}

function mapCodeFamily(value: string): ProductionActivationCode['codeFamily'] {
  return value as ProductionActivationCode['codeFamily'];
}

function mapCodeAccountType(value: string | null): ProductionActivationCode['accountType'] {
  return value as ProductionActivationCode['accountType'];
}

function mapCodeStatus(value: ActivationCodeRow['status']): ProductionActivationCode['status'] {
  return value as ProductionActivationCode['status'];
}

function mapWalletType(value: string): ProductionWalletLedgerEntry['walletType'] {
  return value as ProductionWalletLedgerEntry['walletType'];
}

function mapWalletEntryType(value: WalletLedgerRow['entry_type']): ProductionWalletLedgerEntry['entryType'] {
  return value as ProductionWalletLedgerEntry['entryType'];
}

function mapWalletStatus(value: WalletLedgerRow['status']): ProductionWalletLedgerEntry['status'] {
  return value as ProductionWalletLedgerEntry['status'];
}

function mapQueuePayload(value: CompensationQueueRow['payload']): ProductionCompensationQueueItem['payload'] {
  return value as ProductionCompensationQueueItem['payload'];
}

function mapUserRow(row: AppUserRow): ProductionAppUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    createdAt: row.created_at ?? isoNow()
  };
}

function mapMemberRow(row: MemberProfileRow): ProductionMemberProfile {
  return {
    userId: row.user_id,
    username: mapDbText(row.username),
    referralCode: mapDbText(row.referral_code),
    sponsorCode: row.sponsor_code,
    packageTier: mapMemberPackageTier(row.package_tier),
    accountStatus: mapMemberAccountStatus(row.account_status),
    fullName:
      row.full_name ??
      [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    middleName: row.middle_name ?? '',
    contactNumber: row.contact_number ?? '',
    normalizedFullName: row.normalized_full_name ?? '',
    createdAt: row.created_at ?? isoNow(),
    payoutMethod: row.payout_method ?? undefined,
    payoutDetails: row.payout_details ?? undefined,
    isCompanyAccount: row.is_company_account ?? false,
    isLeaderboardExcluded: row.is_leaderboard_excluded ?? false,
    companyAccountTag: row.company_account_tag ?? null,
    stockistLevel: (row.stockist_level as import('./encoding-service.js').StockistLevel) ?? 'none'
  };
}

function mapNetworkRow(row: NetworkAccountRow): ProductionNetworkAccount {
  return {
    userId: row.user_id,
    sponsorUserId: row.sponsor_user_id,
    directReferrerUserId: row.direct_referrer_user_id,
    placementParentUserId: row.placement_parent_user_id,
    placementParentShadowSide: row.placement_parent_shadow_side,
    placementSide: row.placement_side,
    currentAccountTypeCode: row.current_account_type_code ?? 0,
    currentAccountType: mapNetworkAccountType(row.current_account_type ?? 'PD'),
    packageTier: mapMemberPackageTier(row.package_tier),
    activationCode: row.activation_code,
    registrationStatus: mapNetworkRegistrationStatus(row.registration_status),
    leftPoints: row.left_points ?? 0,
    rightPoints: row.right_points ?? 0,
    cdStatus: row.cd_status ?? 0,
    cdAmount: Number(row.cd_amount ?? 0),
    cdTotal: Number(row.cd_total ?? 0),
    createdAt: row.created_at ?? isoNow()
  };
}

function mapCodeRow(row: ActivationCodeRow): ProductionActivationCode {
  return {
    id: row.id,
    code: row.code,
    codeFamily: mapCodeFamily(row.code_family),
    packageTier: mapDbText(row.package_tier),
    accountType: mapCodeAccountType(row.account_type),
    status: mapCodeStatus(row.status),
    paymentStatus: row.payment_status,
    assignedUserId: row.assigned_user_id,
    generatedByUserId: row.generated_by_user_id,
    generatedAt: row.generated_at ?? isoNow(),
    releasedAt: row.released_at,
    transferredAt: row.transferred_at,
    usedAt: row.used_at,
    usedByUserId: row.used_by_user_id,
    registrationEligible: row.registration_eligible ?? false,
    lockedDirectReferralBonus: Number(row.locked_direct_referral_bonus ?? 0),
    lockedSalesmatchValue: Number(row.locked_salesmatch_value ?? 0),
    lockedBinaryPoints: Number(row.locked_binary_points ?? 0),
    lockedGetFiveAmount: Number(row.locked_get_five_amount ?? 0),
    processId: row.process_id ?? '',
    remarks: row.remarks ?? '',
    settledAt: row.settled_at ?? null,
    settledByUserId: row.settled_by_user_id ?? null,
    pendingRecipientUserId: row.transfer_history ?? null,
    cashierUserId: row.cashier_user_id ?? null
  };
}

function mapCodeEventRow(row: ActivationCodeEventRow): ProductionActivationCodeEvent {
  return {
    id: row.id,
    activationCodeId: row.activation_code_id,
    code: row.code,
    action: row.action,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    notes: row.notes ?? '',
    createdAt: row.created_at ?? isoNow()
  };
}

function mapWalletRow(row: WalletLedgerRow): ProductionWalletLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    walletType: mapWalletType(row.wallet_type ?? 'main'),
    entryType: mapWalletEntryType(row.entry_type),
    sourceReference: row.source_reference ?? '',
    creditAmount: Number(row.credit_amount ?? 0),
    debitAmount: Number(row.debit_amount ?? 0),
    balanceAfter: Number(row.balance_after ?? 0),
    processId: row.process_id ?? '',
    notes: row.notes ?? '',
    occurredAt: row.occurred_at ?? isoNow(),
    status: mapWalletStatus(row.status ?? 'posted')
  };
}

function mapReservationRow(row: PlacementReservationRow): ProductionPlacementReservation {
  return {
    id: row.id,
    sponsorUserId: row.sponsor_user_id,
    referralCode: row.referral_code,
    placementParentUserId: row.placement_parent_user_id,
    placementParentUsername: row.placement_parent_username,
    placementParentShadowSide: row.placement_parent_shadow_side,
    placementSide: row.placement_side,
    shareToken: row.share_token,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at ?? isoNow()
  };
}

function mapSalesmatchRow(row: SalesmatchBalanceRow): ProductionSalesmatchBalance {
  return {
    userId: row.user_id,
    leftSales: Number(row.left_sales ?? 0),
    rightSales: Number(row.right_sales ?? 0),
    matchedSales: Number(row.matched_sales ?? 0),
    leftPoints: Number(row.left_points ?? 0),
    rightPoints: Number(row.right_points ?? 0),
    matchedPoints: Number(row.matched_points ?? 0),
    updatedAt: row.updated_at ?? isoNow()
  };
}

function mapQueueRow(row: CompensationQueueRow): ProductionCompensationQueueItem {
  return {
    id: row.id,
    processId: row.process_id,
    eventType: row.event_type,
    status: row.status,
    payload: mapQueuePayload(row.payload),
    createdAt: row.created_at ?? isoNow(),
    processedAt: row.processed_at
  };
}

function mapShadowRow(row: ShadowAccountRow): ProductionShadowAccount {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    shadowCode: row.shadow_code,
    state: row.state,
    placement: row.placement,
    walletEnabled: row.wallet_enabled ?? false,
    unilevelEnabled: row.unilevel_enabled ?? false,
    binaryCycleEnabled: row.binary_cycle_enabled ?? false,
    note: row.notes ?? '',
    packageTier: (row.package_tier as ProductionShadowAccount['packageTier']) ?? null,
    accountType: (row.account_type as ProductionShadowAccount['accountType']) ?? null,
    activationCode: row.activation_code ?? null,
    pvValue: Number(row.pv_value ?? 0),
    salesmatchValue: Number(row.salesmatch_value ?? 0),
    activatedAt: row.activated_at ?? null,
    lastUpgradedAt: row.last_upgraded_at ?? null,
    leftVolume: Number(row.left_volume ?? 0),
    rightVolume: Number(row.right_volume ?? 0),
    matchedPoints: Number(row.matched_points ?? 0),
    totalEarned: Number(row.total_earned ?? 0),
    createdAt: row.created_at ?? isoNow(),
    updatedAt: row.updated_at ?? isoNow()
  };
}

function mapEncashmentRow(row: EncashmentRow): ProductionEncashment {
  return {
    id: row.id,
    userId: row.user_id,
    processId: row.process_id,
    grossAmount: Number(row.gross_amount ?? 0),
    processingFee: Number(row.processing_fee ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    systemRetainer: Number(row.system_retainer ?? 0),
    cdDeduction: Number(row.cd_deduction ?? 0),
    totalDeductions: Number(row.total_deductions ?? 0),
    netAmount: Number(row.net_amount ?? 0),
    status: row.status,
    payoutMethod: row.payout_method,
    payoutDetails: row.payout_details,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    paidAt: row.paid_at,
    remarks: row.remarks ?? '',
    createdAt: row.created_at ?? isoNow()
  };
}

function mapEncashmentToRow(row: ProductionEncashment) {
  return {
    id: row.id,
    user_id: row.userId,
    process_id: row.processId,
    gross_amount: row.grossAmount,
    processing_fee: row.processingFee,
    tax_amount: row.taxAmount,
    system_retainer: row.systemRetainer,
    cd_deduction: row.cdDeduction,
    total_deductions: row.totalDeductions,
    net_amount: row.netAmount,
    status: row.status,
    payout_method: row.payoutMethod,
    payout_details: row.payoutDetails,
    reviewed_by_user_id: row.reviewedByUserId,
    reviewed_at: row.reviewedAt,
    paid_at: row.paidAt,
    remarks: row.remarks,
    created_at: row.createdAt
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

function assertNoError(error: any, context: string): void {
  if (error) {
    throw Object.assign(new Error(`Supabase error in ${context}: ${error.message ?? JSON.stringify(error)}`), { cause: error });
  }
}

async function singleNumberRpc(client: SupabaseClient, fn: string): Promise<number> {
  const { data, error } = await client.rpc(fn);
  if (error) {
    throw error;
  }
  return Number(data ?? 0);
}

export function createSupabaseProductionEncodingRepository(client: SupabaseClient): ProductionEncodingRepository {
  return {
    getMoneyMode: () => 'production',
    now: () => isoNow(),
    nextActivationCodeSequence: async () => singleNumberRpc(client, 'yor_next_activation_code_sequence'),
    nextMemberSequence: async () => singleNumberRpc(client, 'yor_next_member_sequence'),
    findUserById: async (userId) => {
      const { data } = await client.from('app_users').select('*').eq('id', userId).maybeSingle();
      return data ? mapUserRow(data) : null;
    },
    findMemberByUserId: async (userId) => {
      const { data } = await client.from('member_profiles').select('*').eq('user_id', userId).maybeSingle();
      return data ? mapMemberRow(data) : null;
    },
    findMemberByUsername: async (username) => {
      const { data } = await client.from('member_profiles').select('*').ilike('username', username).maybeSingle();
      return data ? mapMemberRow(data) : null;
    },
    findMemberByReferralCode: async (referralCode) => {
      const { data } = await client.from('member_profiles').select('*').eq('referral_code', referralCode).maybeSingle();
      return data ? mapMemberRow(data) : null;
    },
    findUserByUsername: async (username) => {
      const member = await client.from('member_profiles').select('user_id').ilike('username', username).maybeSingle();
      if (!member.data?.user_id) {
        return null;
      }
      const { data } = await client.from('app_users').select('*').eq('id', member.data.user_id).maybeSingle();
      return data ? mapUserRow(data) : null;
    },
    findUserByReferralCode: async (referralCode) => {
      const member = await client.from('member_profiles').select('user_id').eq('referral_code', referralCode).maybeSingle();
      if (!member.data?.user_id) {
        return null;
      }
      const { data } = await client.from('app_users').select('*').eq('id', member.data.user_id).maybeSingle();
      return data ? mapUserRow(data) : null;
    },
    findUserByEmail: async (email) => {
      const { data } = await client.from('app_users').select('*').eq('email', email).maybeSingle();
      return data ? mapUserRow(data) : null;
    },
    countMembersByNormalizedFullName: async (normalizedFullName) => {
      const { count } = await client
        .from('member_profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('normalized_full_name', normalizedFullName);
      return count ?? 0;
    },
    listActivationCodes: async () => {
      const { data } = await client.from('activation_codes').select('*').order('generated_at', { ascending: false });
      return (data ?? []).map(mapCodeRow);
    },
    listActivationCodesForUser: async (userId) => {
      const { data } = await client.from('activation_codes').select('*').eq('assigned_user_id', userId);
      return (data ?? []).map(mapCodeRow);
    },
    saveActivationCodes: async (rows) => {
      const { error } = await client.from('activation_codes').upsert(
        rows.map((row) => ({
          id: row.id,
          code: row.code,
          code_family: row.codeFamily,
          package_tier: row.packageTier,
          account_type: row.accountType,
          status: row.status,
          payment_status: row.paymentStatus,
          assigned_user_id: row.assignedUserId,
          generated_by_user_id: row.generatedByUserId,
          generated_at: row.generatedAt,
          released_at: row.releasedAt,
          transferred_at: row.transferredAt,
          used_at: row.usedAt,
          used_by_user_id: row.usedByUserId,
          registration_eligible: row.registrationEligible,
          locked_direct_referral_bonus: row.lockedDirectReferralBonus,
          locked_salesmatch_value: row.lockedSalesmatchValue,
          locked_binary_points: row.lockedBinaryPoints,
          locked_get_five_amount: row.lockedGetFiveAmount,
          process_id: row.processId,
          remarks: row.remarks,
          settled_at: row.settledAt,
          settled_by_user_id: row.settledByUserId,
          transfer_history: row.pendingRecipientUserId,
          cashier_user_id: row.cashierUserId
        })),
        { onConflict: 'id' }
      );
      assertNoError(error, 'saveActivationCodes');
    },
    appendActivationCodeEvents: async (events) => {
      const { error } = await client.from('activation_code_events').insert(
        events.map((event) => ({
          id: event.id,
          activation_code_id: event.activationCodeId,
          code: event.code,
          action: event.action,
          actor_user_id: event.actorUserId,
          actor_name: event.actorName,
          from_user_id: event.fromUserId,
          to_user_id: event.toUserId,
          notes: event.notes,
          created_at: event.createdAt
        }))
      );
      assertNoError(error, 'appendActivationCodeEvents');
    },
    listActivationCodeEvents: async () => {
      const { data } = await client.from('activation_code_events').select('*').order('created_at', { ascending: false });
      return (data ?? []).map(mapCodeEventRow);
    },
    listMembers: async () => {
      const { data } = await client.from('member_profiles').select('*');
      return (data ?? []).map(mapMemberRow);
    },
    listUsers: async () => {
      const { data } = await client.from('app_users').select('*');
      return (data ?? []).map(mapUserRow);
    },
    listUsersByRole: async (role) => {
      const { data } = await client.from('app_users').select('*').eq('role', role);
      return (data ?? []).map(mapUserRow);
    },
    listShadowAccounts: async () => {
      const { data } = await client.from('shadow_accounts').select('*');
      return (data ?? []).map(mapShadowRow);
    },
    listShadowAccountsForOwner: async (ownerUserId) => {
      const { data } = await client.from('shadow_accounts').select('*').eq('owner_user_id', ownerUserId).order('placement', { ascending: true });
      return (data ?? []).map(mapShadowRow);
    },
    findShadowAccountByCode: async (shadowCode) => {
      const { data } = await client.from('shadow_accounts').select('*').ilike('shadow_code', shadowCode).maybeSingle();
      return data ? mapShadowRow(data) : null;
    },
    saveShadowAccounts: async (rows) => {
      const { error } = await client.from('shadow_accounts').upsert(
        rows.map((row) => ({
          id: row.id,
          owner_user_id: row.ownerUserId,
          shadow_code: row.shadowCode,
          state: row.state,
          placement: row.placement,
          wallet_enabled: row.walletEnabled,
          unilevel_enabled: row.unilevelEnabled,
          binary_cycle_enabled: row.binaryCycleEnabled,
          notes: row.note,
          package_tier: row.packageTier,
          account_type: row.accountType,
          activation_code: row.activationCode,
          pv_value: row.pvValue,
          salesmatch_value: row.salesmatchValue,
          activated_at: row.activatedAt,
          last_upgraded_at: row.lastUpgradedAt,
          created_at: row.createdAt,
          updated_at: row.updatedAt
        })),
        { onConflict: 'id' }
      );
      assertNoError(error, 'saveShadowAccounts');
    },
    listWalletLedgerEntriesForUser: async (userId) => {
      const { data } = await client.from('wallet_ledger').select('*').eq('user_id', userId).order('occurred_at', { ascending: true });
      return (data ?? []).map(mapWalletRow);
    },
    listRecentWalletLedger: async (limit) => {
      const { data } = await client.from('wallet_ledger').select('*').order('occurred_at', { ascending: false }).limit(limit);
      return (data ?? []).map(mapWalletRow);
    },
    appendWalletLedgerEntry: async (entry) => {
      // A unique violation on process_id means another caller already posted
      // this exact event — idempotent replay, not a failure.
      const { error } = await client.from('wallet_ledger').insert({
        id: entry.id,
        user_id: entry.userId,
        wallet_type: entry.walletType,
        entry_type: entry.entryType,
        source_reference: entry.sourceReference,
        credit_amount: entry.creditAmount,
        debit_amount: entry.debitAmount,
        balance_after: entry.balanceAfter,
        process_id: entry.processId,
        notes: entry.notes,
        occurred_at: entry.occurredAt,
        status: entry.status
      });
      if (error && isUniqueViolation(error)) {
        return;
      }
      assertNoError(error, 'appendWalletLedgerEntry');
    },
    hasWalletLedgerProcess: async (processId) => {
      const { count } = await client.from('wallet_ledger').select('id', { count: 'exact', head: true }).eq('process_id', processId);
      return (count ?? 0) > 0;
    },
    saveUser: async (user) => {
      const { error } = await client.from('app_users').upsert(
        {
          id: user.id,
          email: user.email,
          display_name: user.displayName,
          role: user.role,
          status: user.status,
          password_hash: user.passwordHash,
          password_salt: user.passwordSalt,
          created_at: user.createdAt
        },
        { onConflict: 'id' }
      );
      assertNoError(error, 'saveUser');
    },
    saveMemberProfile: async (profile) => {
      const { error } = await client.from('member_profiles').upsert(
        {
          user_id: profile.userId,
          username: profile.username,
          referral_code: profile.referralCode,
          sponsor_code: profile.sponsorCode,
          package_tier: profile.packageTier,
          account_status: profile.accountStatus,
          full_name: profile.fullName,
          first_name: profile.firstName,
          last_name: profile.lastName,
          middle_name: profile.middleName,
          contact_number: profile.contactNumber,
          normalized_full_name: profile.normalizedFullName,
          created_at: profile.createdAt,
          payout_method: profile.payoutMethod ?? null,
          payout_details: profile.payoutDetails ?? null
        },
        { onConflict: 'user_id' }
      );
      assertNoError(error, 'saveMemberProfile');
    },
    saveNetworkAccount: async (account) => {
      const { error } = await client.from('network_accounts').upsert(
        {
          user_id: account.userId,
          sponsor_user_id: account.sponsorUserId,
          direct_referrer_user_id: account.directReferrerUserId,
          placement_parent_user_id: account.placementParentUserId,
          placement_parent_shadow_side: account.placementParentShadowSide ?? null,
          placement_side: account.placementSide,
          current_account_type_code: account.currentAccountTypeCode,
          current_account_type: account.currentAccountType,
          package_tier: account.packageTier,
          activation_code: account.activationCode,
          registration_status: account.registrationStatus,
          left_points: account.leftPoints,
          right_points: account.rightPoints,
          cd_status: account.cdStatus,
          cd_amount: account.cdAmount,
          cd_total: account.cdTotal,
          created_at: account.createdAt
        },
        { onConflict: 'user_id' }
      );
      assertNoError(error, 'saveNetworkAccount');
    },
    findNetworkAccountByUserId: async (userId) => {
      const { data } = await client.from('network_accounts').select('*').eq('user_id', userId).maybeSingle();
      return data ? mapNetworkRow(data) : null;
    },
    findActivationCodeByCode: async (code) => {
      // Escape LIKE wildcards: code values are operator input and `%`/`_`
      // patterns must never match (and settle) a different code.
      const escaped = code.trim().replace(/([\\%_])/g, '\\$1');
      const { data } = await client.from('activation_codes').select('*').ilike('code', escaped).maybeSingle();
      return data ? mapCodeRow(data) : null;
    },
    findActivationCodesByCodes: async (codes) => {
      if (codes.length === 0) {
        return [];
      }
      const { data } = await client
        .from('activation_codes')
        .select('*')
        .in('code', codes.map((code) => code.trim()));
      return (data ?? []).map(mapCodeRow);
    },
    listMembersBySponsorCode: async (sponsorCode) => {
      const { data } = await client.from('member_profiles').select('*').eq('sponsor_code', sponsorCode);
      return (data ?? []).map(mapMemberRow);
    },
    findUsersByIds: async (userIds) => {
      if (userIds.length === 0) {
        return [];
      }
      const { data } = await client.from('app_users').select('*').in('id', userIds);
      return (data ?? []).map(mapUserRow);
    },
    listActivationCodeEventsForUser: async (userId, limit) => {
      // The .or() filter is a string grammar — only a verified UUID may be
      // interpolated, or a crafted id could widen the query.
      if (!UUID_PATTERN.test(userId)) {
        return [];
      }
      const { data } = await client
        .from('activation_code_events')
        .select('*')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId},actor_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(limit);
      return (data ?? []).map(mapCodeEventRow);
    },
    listRecentActivationCodeEvents: async (limit) => {
      const { data } = await client
        .from('activation_code_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      return (data ?? []).map(mapCodeEventRow);
    },
    listNetworkAccounts: async () => {
      const { data } = await client.from('network_accounts').select('*');
      return (data ?? []).map(mapNetworkRow);
    },
    listDirectsBySponsor: async (sponsorUserId) => {
      const { data } = await client.from('network_accounts').select('*').eq('sponsor_user_id', sponsorUserId);
      return (data ?? []).map(mapNetworkRow);
    },
    findPlacementChild: async (parentUserId, side, shadowSide) => {
      let query = client
        .from('network_accounts')
        .select('*')
        .eq('placement_parent_user_id', parentUserId)
        .eq('placement_side', side)
        .eq('registration_status', 'active');

      if (shadowSide) {
        query = query.eq('placement_parent_shadow_side', shadowSide);
      }

      const { data } = await query.maybeSingle();
      return data ? mapNetworkRow(data) : null;
    },
    findPlacementChildrenBatch: async (parentUserIds) => {
      if (parentUserIds.length === 0) return [];
      const { data } = await client
        .from('network_accounts')
        .select('*')
        .in('placement_parent_user_id', parentUserIds)
        .eq('registration_status', 'active')
        .is('placement_parent_shadow_side', null);
      return (data ?? []).map(mapNetworkRow);
    },
    saveSalesmatchBalance: async (balance) => {
      const { error } = await client.from('salesmatch_balances').upsert(
        {
          user_id: balance.userId,
          left_sales: balance.leftSales,
          right_sales: balance.rightSales,
          matched_sales: balance.matchedSales,
          left_points: balance.leftPoints,
          right_points: balance.rightPoints,
          matched_points: balance.matchedPoints,
          updated_at: balance.updatedAt
        },
        { onConflict: 'user_id' }
      );
      assertNoError(error, 'saveSalesmatchBalance');
    },
    getSalesmatchBalance: async (userId) => {
      const { data } = await client.from('salesmatch_balances').select('*').eq('user_id', userId).maybeSingle();
      return data ? mapSalesmatchRow(data) : null;
    },
    listUsersWithPendingSalesmatch: async () => {
      const { data } = await client
        .from('salesmatch_balances')
        .select('user_id, left_sales, right_sales, matched_sales');
      return (data ?? [])
        .filter((row) => Math.min(Number(row.left_sales), Number(row.right_sales)) > Number(row.matched_sales))
        .map((row) => row.user_id as string);
    },
    getPaidSalesmatchSince: async (userId, sinceIso) => {
      const { data, error } = await client
        .from('wallet_ledger')
        .select('credit_amount')
        .eq('user_id', userId)
        .eq('entry_type', 'salesmatch')
        .gte('occurred_at', sinceIso);
      assertNoError(error, 'getPaidSalesmatchSince');
      return (data ?? []).reduce((sum, row) => sum + Number(row.credit_amount ?? 0), 0);
    },
    recordPairingSnapshot: async (input) => {
      const { data: existing } = await client
        .from('pairing_snapshots')
        .select('id, matched_left_value, matched_right_value, paid_salesmatch, forfeited_salesmatch, total_binary_pay')
        .eq('user_id', input.userId)
        .eq('snapshot_date', input.snapshotDate)
        .maybeSingle();
      const { error } = await client.from('pairing_snapshots').upsert(
        {
          ...(existing?.id ? { id: existing.id } : {}),
          user_id: input.userId,
          snapshot_date: input.snapshotDate,
          matched_left_value: Number(existing?.matched_left_value ?? 0) + input.matchedDelta,
          matched_right_value: Number(existing?.matched_right_value ?? 0) + input.matchedDelta,
          paid_salesmatch: Number(existing?.paid_salesmatch ?? 0) + input.paidDelta,
          forfeited_salesmatch: Number(existing?.forfeited_salesmatch ?? 0) + input.forfeitedDelta,
          total_binary_pay: Number(existing?.total_binary_pay ?? 0) + input.paidDelta
        },
        { onConflict: 'user_id,snapshot_date' }
      );
      assertNoError(error, 'recordPairingSnapshot');
    },
    sumLedgerMainBalance: async (userId) => {
      const { data, error } = await client
        .from('wallet_ledger')
        .select('credit_amount, debit_amount')
        .eq('user_id', userId)
        .eq('wallet_type', 'main');
      assertNoError(error, 'sumLedgerMainBalance');
      return (data ?? []).reduce((sum, row) => sum + Number(row.credit_amount ?? 0) - Number(row.debit_amount ?? 0), 0);
    },
    createEncashment: async (row) => {
      const { error } = await client.from('encashments').insert(mapEncashmentToRow(row));
      // A duplicate process key means this request was already recorded — replay is a no-op.
      if (error && isUniqueViolation(error)) {
        return;
      }
      assertNoError(error, 'createEncashment');
    },
    saveEncashment: async (row) => {
      const { error } = await client.from('encashments').upsert(mapEncashmentToRow(row), { onConflict: 'id' });
      assertNoError(error, 'saveEncashment');
    },
    findEncashmentById: async (encashmentId) => {
      const { data } = await client.from('encashments').select('*').eq('id', encashmentId).maybeSingle();
      return data ? mapEncashmentRow(data) : null;
    },
    listEncashments: async (filter, limit) => {
      let query = client.from('encashments').select('*').order('created_at', { ascending: false }).limit(limit);
      if (filter.status) {
        query = query.eq('status', filter.status);
      }
      const { data } = await query;
      return (data ?? []).map(mapEncashmentRow);
    },
    listEncashmentsForUser: async (userId) => {
      const { data } = await client.from('encashments').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      return (data ?? []).map(mapEncashmentRow);
    },
    listPairingSnapshotsForUser: async (userId) => {
      const { data } = await client
        .from('pairing_snapshots')
        .select('id, user_id, snapshot_date, matched_left_value, paid_salesmatch, forfeited_salesmatch')
        .eq('user_id', userId)
        .order('snapshot_date', { ascending: false });
      return (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        snapshotDate: row.snapshot_date,
        matchedSales: Number(row.matched_left_value ?? 0),
        paidSalesmatch: Number(row.paid_salesmatch ?? 0),
        forfeitedSalesmatch: Number(row.forfeited_salesmatch ?? 0)
      }));
    },
    recordPairingEvent: async (input) => {
      const { error } = await client.from('pairing_events').insert({
        owner_user_id: input.ownerUserId,
        source_username: input.sourceUsername,
        left_volume: input.leftVolume,
        right_volume: input.rightVolume,
        matched_points: input.matchedPoints,
        left_remaining: input.leftRemaining,
        right_remaining: input.rightRemaining,
        salesmatch_amount: input.salesmatchAmount
      });
      assertNoError(error, 'recordPairingEvent');
    },
    listPairingEventsForUser: async (userId, limit) => {
      const { data } = await client
        .from('pairing_events')
        .select('*')
        .eq('owner_user_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(limit);
      return (data ?? []).map((row) => ({
        id: row.id,
        ownerUserId: row.owner_user_id,
        sourceUsername: row.source_username ?? '',
        leftVolume: Number(row.left_volume ?? 0),
        rightVolume: Number(row.right_volume ?? 0),
        matchedPoints: Number(row.matched_points ?? 0),
        leftRemaining: Number(row.left_remaining ?? 0),
        rightRemaining: Number(row.right_remaining ?? 0),
        salesmatchAmount: Number(row.salesmatch_amount ?? 0),
        occurredAt: row.occurred_at ?? isoNow()
      }));
    },
    reconcileShadowEarnings: async () => {
      // Recomputes shadow sub-leg volumes and pays the increase in matched to owners,
      // tagged left/right_shadow_earning. Encapsulated in a SQL function (idempotent).
      const { data, error } = await client.rpc('reconcile_shadow_earnings');
      if (error) {
        console.error('[reconcileShadowEarnings] rpc error:', error.message);
        return [];
      }
      return (data ?? []).map((row: { paid_user_id: string; entry: string; amount: number | string }) => ({
        userId: row.paid_user_id,
        entryType: row.entry,
        amount: Number(row.amount ?? 0)
      }));
    },
    enqueueCompensation: async (item) => {
      const { error } = await client.from('compensation_queue').upsert(
        {
          id: item.id,
          process_id: item.processId,
          event_type: item.eventType,
          status: item.status,
          payload: item.payload,
          created_at: item.createdAt,
          processed_at: item.processedAt
        },
        { onConflict: 'process_id' }
      );
      assertNoError(error, 'enqueueCompensation');
    },
    listPendingCompensation: async (limit) => {
      const { data } = await client
        .from('compensation_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);
      return (data ?? []).map(mapQueueRow);
    },
    markCompensationProcessed: async (queueId, processedAt) => {
      const { error } = await client.from('compensation_queue').update({ status: 'processed', processed_at: processedAt }).eq('id', queueId);
      assertNoError(error, 'markCompensationProcessed');
    },
    savePlacementReservation: async (reservation) => {
      const { error } = await client.from('placement_reservations').upsert(
        {
          id: reservation.id,
          sponsor_user_id: reservation.sponsorUserId,
          referral_code: reservation.referralCode,
          placement_parent_user_id: reservation.placementParentUserId,
          placement_parent_username: reservation.placementParentUsername,
          placement_parent_shadow_side: reservation.placementParentShadowSide ?? null,
          placement_side: reservation.placementSide,
          share_token: reservation.shareToken,
          status: reservation.status,
          expires_at: reservation.expiresAt,
          created_at: reservation.createdAt
        },
        { onConflict: 'id' }
      );
      assertNoError(error, 'savePlacementReservation');
    },
    listPlacementReservationsForSponsor: async (sponsorUserId) => {
      const { data } = await client.from('placement_reservations').select('*').eq('sponsor_user_id', sponsorUserId);
      return (data ?? []).map(mapReservationRow);
    },
    findPlacementReservationById: async (reservationId) => {
      const { data } = await client.from('placement_reservations').select('*').eq('id', reservationId).maybeSingle();
      return data ? mapReservationRow(data) : null;
    },
    findPlacementReservationByToken: async (token) => {
      const { data } = await client.from('placement_reservations').select('*').eq('share_token', token).maybeSingle();
      return data ? mapReservationRow(data) : null;
    },
    listMembersFiltered: async (query, page, pageSize) => {
      const offset = (page - 1) * pageSize;
      let q = client.from('member_profiles').select('*').order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
      if (query) {
        const upper = query.toUpperCase();
        q = q.or(`username.ilike.%${upper}%,normalized_full_name.ilike.%${upper}%,referral_code.ilike.%${upper}%`);
      }
      const { data } = await q;
      return (data ?? []).map(mapMemberRow);
    },
    countMembersFiltered: async (query) => {
      let q = client.from('member_profiles').select('id', { count: 'exact', head: true });
      if (query) {
        const upper = query.toUpperCase();
        q = q.or(`username.ilike.%${upper}%,normalized_full_name.ilike.%${upper}%,referral_code.ilike.%${upper}%`);
      }
      const { count } = await q;
      return count ?? 0;
    },
    listNetworkAccountsByUserIds: async (userIds) => {
      if (userIds.length === 0) return [];
      const { data } = await client.from('network_accounts').select('*').in('user_id', userIds);
      return (data ?? []).map(mapNetworkRow);
    },
    sumWalletMainBalancesByUserIds: async (userIds) => {
      const result = new Map<string, number>();
      if (userIds.length === 0) return result;
      const { data } = await client
        .from('wallet_ledger')
        .select('user_id, credit_amount, debit_amount')
        .in('user_id', userIds)
        .eq('wallet_type', 'main');
      for (const row of data ?? []) {
        const prev = result.get(row.user_id) ?? 0;
        result.set(row.user_id, prev + Number(row.credit_amount ?? 0) - Number(row.debit_amount ?? 0));
      }
      return result;
    },
    countDirectReferralsByUserIds: async (userIds) => {
      const result = new Map<string, number>();
      if (userIds.length === 0) return result;
      const { data } = await client
        .from('network_accounts')
        .select('sponsor_user_id')
        .in('sponsor_user_id', userIds)
        .eq('registration_status', 'active');
      for (const row of data ?? []) {
        const prev = result.get(row.sponsor_user_id) ?? 0;
        result.set(row.sponsor_user_id, prev + 1);
      }
      return result;
    },

    insertRepurchase: async (row) => {
      await client.from('repurchases').insert({
        id: row.id,
        process_key: row.processKey,
        user_id: row.userId,
        product_code: row.productCode,
        product_name: row.productName,
        product_type: row.productType,
        quantity: row.quantity,
        unit_price: row.unitPrice,
        srp_price: row.srpPrice,
        total_amount: row.totalAmount,
        pv_earned: row.pvEarned,
        activation_code: row.activationCode,
        transaction_date: row.transactionDate,
        created_at: row.createdAt,
        global_bonus_included: false
      });
    },

    sumLifestyleCreditsForUserToday: async (userId, dayIso) => {
      const dayStart = `${dayIso.slice(0, 10)}T00:00:00.000Z`;
      const dayEnd   = `${dayIso.slice(0, 10)}T23:59:59.999Z`;
      const { data } = await client
        .from('wallet_ledger')
        .select('credit_amount')
        .eq('user_id', userId)
        .eq('wallet_type', 'lifestyle')
        .eq('entry_type', 'lifestyle_rewards')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);
      return (data ?? []).reduce((sum, r) => sum + Number(r.credit_amount ?? 0), 0);
    },

    sumLifestyleCreditsForUserThisMonth: async (userId, yearMonthPrefix) => {
      const monthStart = `${yearMonthPrefix}-01T00:00:00.000Z`;
      const [year, month] = yearMonthPrefix.split('-').map(Number);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const monthEnd = `${yearMonthPrefix}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;
      const { data } = await client
        .from('wallet_ledger')
        .select('credit_amount')
        .eq('user_id', userId)
        .eq('wallet_type', 'lifestyle')
        .eq('entry_type', 'lifestyle_rewards')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);
      return (data ?? []).reduce((sum, r) => sum + Number(r.credit_amount ?? 0), 0);
    },

    sumRepurchasePvForUserInMonth: async (userId, yearMonthPrefix) => {
      const monthStart = `${yearMonthPrefix}-01T00:00:00.000Z`;
      const [year, month] = yearMonthPrefix.split('-').map(Number);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const monthEnd = `${yearMonthPrefix}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;
      const { data } = await client
        .from('repurchases')
        .select('pv_earned')
        .eq('user_id', userId)
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd);
      return (data ?? []).reduce((sum, r) => sum + Number(r.pv_earned ?? 0), 0);
    },

    setStockistLevel: async (userId, level) => {
      const { error } = await client
        .from('member_profiles')
        .update({ stockist_level: level, updated_at: isoNow() })
        .eq('user_id', userId);
      assertNoError(error, 'setStockistLevel');
    },

    sumPendingGlobalBonusNetSales: async () => {
      const { data } = await client
        .from('repurchases')
        .select('unit_price')
        .eq('global_bonus_included', false);
      return (data ?? []).reduce((sum, r) => sum + Number(r.unit_price ?? 0), 0);
    },

    markRepurchasesGlobalBonusIncluded: async () => {
      await client
        .from('repurchases')
        .update({ global_bonus_included: true })
        .eq('global_bonus_included', false);
    }
  };
}

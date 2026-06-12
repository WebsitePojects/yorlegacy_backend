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
    payoutDetails: row.payout_details ?? undefined
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
    settledByUserId: row.settled_by_user_id ?? null
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
          settled_by_user_id: row.settledByUserId
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
    listWalletLedgerEntriesForUser: async (userId) => {
      const { data } = await client.from('wallet_ledger').select('*').eq('user_id', userId).order('occurred_at', { ascending: true });
      return (data ?? []).map(mapWalletRow);
    },
    appendWalletLedgerEntry: async (entry) => {
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
      const { data } = await client.from('activation_codes').select('*').ilike('code', code.trim()).maybeSingle();
      return data ? mapCodeRow(data) : null;
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
      if (error && !String(error.message ?? '').toLowerCase().includes('duplicate')) {
        assertNoError(error, 'createEncashment');
      }
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
    }
  };
}

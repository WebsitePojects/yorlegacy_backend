import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ProductionActivationCode,
  ProductionActivationCodeEvent,
  ProductionAppUser,
  ProductionCompensationQueueItem,
  ProductionEncodingRepository,
  ProductionMemberProfile,
  ProductionNetworkAccount,
  ProductionPlacementReservation,
  ProductionSalesmatchBalance,
  ProductionWalletLedgerEntry
} from './encoding-service.js';

function isoNow() {
  return new Date().toISOString();
}

function mapUserRow(row: any): ProductionAppUser {
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

function mapMemberRow(row: any): ProductionMemberProfile {
  return {
    userId: row.user_id,
    username: row.username,
    referralCode: row.referral_code,
    sponsorCode: row.sponsor_code,
    packageTier: row.package_tier,
    accountStatus: row.account_status,
    fullName:
      row.full_name ??
      [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    middleName: row.middle_name ?? '',
    contactNumber: row.contact_number ?? '',
    normalizedFullName: row.normalized_full_name ?? '',
    createdAt: row.created_at ?? isoNow()
  };
}

function mapNetworkRow(row: any): ProductionNetworkAccount {
  return {
    userId: row.user_id,
    sponsorUserId: row.sponsor_user_id,
    directReferrerUserId: row.direct_referrer_user_id,
    placementParentUserId: row.placement_parent_user_id,
    placementSide: row.placement_side,
    currentAccountTypeCode: row.current_account_type_code ?? 0,
    currentAccountType: row.current_account_type ?? 'PD',
    packageTier: row.package_tier,
    activationCode: row.activation_code,
    registrationStatus: row.registration_status,
    leftPoints: row.left_points ?? 0,
    rightPoints: row.right_points ?? 0,
    createdAt: row.created_at ?? isoNow()
  };
}

function mapCodeRow(row: any): ProductionActivationCode {
  return {
    id: row.id,
    code: row.code,
    codeFamily: row.code_family,
    packageTier: row.package_tier,
    accountType: row.account_type,
    status: row.status,
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
    remarks: row.remarks ?? ''
  };
}

function mapCodeEventRow(row: any): ProductionActivationCodeEvent {
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

function mapWalletRow(row: any): ProductionWalletLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    walletType: row.wallet_type ?? 'main',
    entryType: row.entry_type,
    sourceReference: row.source_reference ?? '',
    creditAmount: Number(row.credit_amount ?? 0),
    debitAmount: Number(row.debit_amount ?? 0),
    balanceAfter: Number(row.balance_after ?? 0),
    processId: row.process_id ?? '',
    notes: row.notes ?? '',
    occurredAt: row.occurred_at ?? isoNow(),
    status: row.status ?? 'posted'
  };
}

function mapReservationRow(row: any): ProductionPlacementReservation {
  return {
    id: row.id,
    sponsorUserId: row.sponsor_user_id,
    referralCode: row.referral_code,
    placementParentUserId: row.placement_parent_user_id,
    placementParentUsername: row.placement_parent_username,
    placementSide: row.placement_side,
    shareToken: row.share_token,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at ?? isoNow()
  };
}

function mapSalesmatchRow(row: any): ProductionSalesmatchBalance {
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

function mapQueueRow(row: any): ProductionCompensationQueueItem {
  return {
    id: row.id,
    processId: row.process_id,
    eventType: row.event_type,
    status: row.status,
    payload: row.payload,
    createdAt: row.created_at ?? isoNow(),
    processedAt: row.processed_at
  };
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
      const { data } = await client.from('member_profiles').select('*').eq('username', username).maybeSingle();
      return data ? mapMemberRow(data) : null;
    },
    findMemberByReferralCode: async (referralCode) => {
      const { data } = await client.from('member_profiles').select('*').eq('referral_code', referralCode).maybeSingle();
      return data ? mapMemberRow(data) : null;
    },
    findUserByUsername: async (username) => {
      const member = await client.from('member_profiles').select('user_id').eq('username', username).maybeSingle();
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
      await client.from('activation_codes').upsert(
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
          remarks: row.remarks
        })),
        { onConflict: 'id' }
      );
    },
    appendActivationCodeEvents: async (events) => {
      await client.from('activation_code_events').insert(
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
      await client.from('wallet_ledger').insert({
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
    },
    hasWalletLedgerProcess: async (processId) => {
      const { count } = await client.from('wallet_ledger').select('id', { count: 'exact', head: true }).eq('process_id', processId);
      return (count ?? 0) > 0;
    },
    saveUser: async (user) => {
      await client.from('app_users').upsert(
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
    },
    saveMemberProfile: async (profile) => {
      await client.from('member_profiles').upsert(
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
          created_at: profile.createdAt
        },
        { onConflict: 'user_id' }
      );
    },
    saveNetworkAccount: async (account) => {
      await client.from('network_accounts').upsert(
        {
          user_id: account.userId,
          sponsor_user_id: account.sponsorUserId,
          direct_referrer_user_id: account.directReferrerUserId,
          placement_parent_user_id: account.placementParentUserId,
          placement_side: account.placementSide,
          current_account_type_code: account.currentAccountTypeCode,
          current_account_type: account.currentAccountType,
          package_tier: account.packageTier,
          activation_code: account.activationCode,
          registration_status: account.registrationStatus,
          left_points: account.leftPoints,
          right_points: account.rightPoints,
          created_at: account.createdAt
        },
        { onConflict: 'user_id' }
      );
    },
    findNetworkAccountByUserId: async (userId) => {
      const { data } = await client.from('network_accounts').select('*').eq('user_id', userId).maybeSingle();
      return data ? mapNetworkRow(data) : null;
    },
    findPlacementChild: async (parentUserId, side) => {
      const { data } = await client
        .from('network_accounts')
        .select('*')
        .eq('placement_parent_user_id', parentUserId)
        .eq('placement_side', side)
        .eq('registration_status', 'active')
        .maybeSingle();
      return data ? mapNetworkRow(data) : null;
    },
    saveSalesmatchBalance: async (balance) => {
      await client.from('salesmatch_balances').upsert(
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
    },
    getSalesmatchBalance: async (userId) => {
      const { data } = await client.from('salesmatch_balances').select('*').eq('user_id', userId).maybeSingle();
      return data ? mapSalesmatchRow(data) : null;
    },
    enqueueCompensation: async (item) => {
      await client.from('compensation_queue').upsert(
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
      await client.from('compensation_queue').update({ status: 'processed', processed_at: processedAt }).eq('id', queueId);
    },
    savePlacementReservation: async (reservation) => {
      await client.from('placement_reservations').upsert(
        {
          id: reservation.id,
          sponsor_user_id: reservation.sponsorUserId,
          referral_code: reservation.referralCode,
          placement_parent_user_id: reservation.placementParentUserId,
          placement_parent_username: reservation.placementParentUsername,
          placement_side: reservation.placementSide,
          share_token: reservation.shareToken,
          status: reservation.status,
          expires_at: reservation.expiresAt,
          created_at: reservation.createdAt
        },
        { onConflict: 'id' }
      );
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

import crypto from 'node:crypto';
import { revokeUserSessions } from '../auth/session.js';
import {
  CD_STATUS_NONE,
  CD_STATUS_OUTSTANDING,
  CD_STATUS_SETTLED,
  countsForDirectReferralSource,
  countsForPairingSource,
  type AccountStateInput
} from '../compensation/account-state.js';
import { manilaDateKey, manilaMonthStartIso, manilaWeekStartIso } from '../compensation/cap-windows.js';
import { computeGetYorFiveGroups, type GyfDirect } from '../compensation/get-yor-five.js';
import { rankForIncome, type RankProgress } from '../compensation/rank-ladder.js';
import { packagePolicies, PV_PESO_RATE } from '../compensation/mvp-service.js';
import {
  repeatPurchaseProductCatalog,
  resolveRepurchaseProduct,
  getProductDp,
  lifestyleDailyCapByPackage,
  lifestyleMonthlyCapByPackage
} from '../compensation/repurchase-product-catalog.js';
import { createPasswordHashSync } from '../auth/password.js';
import type { MoneyMode, OperationalMetric, ReportTable, SessionUser } from '../../types/auth.js';
import { decodeReferralCode } from '../../lib/referral-utils.js';
import { buildRegistrationUrl } from '../../lib/frontend-origin.js';
import { notifyUser } from '../../lib/live-events.js';

export type PackageTier = 'Basic' | 'Classic' | 'Standard' | 'Business' | 'VIP';
export type CodeFamily = 'YOR CODES' | 'YOR MAINTENANCE' | 'YOR PERFUME' | 'YOR REFILL' | 'YOR VISION';
export type AccountType = 'PD' | 'FS' | 'CD';
export type ActivationCodeStatus = 'unreleased' | 'available' | 'used' | 'disabled';
export type PaymentStatus = 'unpaid' | 'paid' | 'externally-paid';
export type PlacementSide = 'left' | 'right';
export type RegistrationOrigin = 'referral-link' | 'genealogy-slot';
export type SponsorResolutionMode = 'referral-link' | 'manual-sponsor' | 'signed-in-member';
export type QueueEventType = 'placement-sales';

// Unilevel percentages per sponsor-tree depth (index = depth, index 0 = root earns nothing).
// Unilevel is triggered by monthly product repurchases (NOT registration encoding).
// Sponsor-tree levels map 1:1 to unilevel levels — shadow accounts never appear in the
// sponsor chain so no skipping is needed there. In the binary tree visual, real members
// appear at even depths (0, 2, 4 … 20), which correspond to logical levels 0-10 in the UI.
export const UNILEVEL_PERCENTAGES: readonly number[] = [0, 10, 8, 5, 5, 3, 3, 2, 1, 1, 1];
export const UNILEVEL_MAX_LEVELS = 10;
// Monthly repurchase-PV maintenance to qualify for unilevel income. Resets every
// calendar month — a month below this earns nothing and carries nothing forward.
export const UNILEVEL_MONTHLY_MAINTENANCE_PV = 200;

// GATE-RETAINER-EXEMPT-20260613: account identified by immutable userId, not username,
// so name/username changes never affect the exemption. PrinceI.T is the system operator
// account and is not charged the 5% system retainer on encashments.
const SYSTEM_RETAINER_EXEMPT_USER_IDS = new Set([
  '0f0464cf-9886-471f-9adf-5a4255a8043f' // PrinceI.T — system operator (userId is immutable)
]);

export type PackageConfig = {
  packageTier: PackageTier;
  accountType: AccountType;
  price: number;
  directReferralBonus: number;
  salesmatchValue: number;
  salesmatchBinaryPoints: number;
  binaryCyclePercent: number;
  getFiveAmount: number;
  binaryPoints: number;
  weeklySalesmatchCap: number;
  monthlySalesmatchCap: number;
};

const PACKAGE_CONFIGS = new Map<string, PackageConfig>(
  packagePolicies.map((policy) => {
    const packageTier = toPackageTier(policy.name);
    return [
      packageTier.toUpperCase(),
      {
        packageTier,
        accountType: packageTier === 'Business' || packageTier === 'VIP' ? 'FS' : 'PD',
        price: policy.price,
        directReferralBonus: policy.directReferralBonus,
        salesmatchValue: policy.salesmatchValue,
        salesmatchBinaryPoints: policy.salesmatchValue / PV_PESO_RATE,
        binaryCyclePercent: policy.binaryCyclePercent ?? 0,
        getFiveAmount: packageTier === 'Basic' ? 0 : policy.price,
        binaryPoints: policy.pv,
        weeklySalesmatchCap: policy.weeklySalesmatchCap,
        monthlySalesmatchCap: policy.monthlySalesmatchCap
      }
    ];
  })
);

export type ProductionAppUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'member' | 'admin' | 'cashier' | 'bod' | 'superadmin';
  status: 'active' | 'pending' | 'disabled';
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

export type StockistLevel = 'none' | 'mobile_kiosk' | 'city_center' | 'mega_center';

export type ProductionMemberProfile = {
  userId: string;
  username: string;
  referralCode: string;
  sponsorCode: string | null;
  packageTier: PackageTier;
  accountStatus: 'active' | 'pending' | 'disabled';
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string;
  contactNumber: string;
  normalizedFullName: string;
  createdAt: string;
  payoutMethod?: string;
  payoutDetails?: string;
  // Company/owner accounts (owner sign-off item 8) — excluded from leaderboards
  // even after a username/full-name change, keyed by the immutable row.
  isCompanyAccount?: boolean;
  isLeaderboardExcluded?: boolean;
  companyAccountTag?: string | null;
  stockistLevel?: StockistLevel;
};

export type ProductionNetworkAccount = {
  userId: string;
  sponsorUserId: string | null;
  directReferrerUserId: string | null;
  placementParentUserId: string | null;
  placementParentShadowSide?: PlacementSide | null;
  placementSide: PlacementSide | null;
  currentAccountTypeCode: number;
  currentAccountType: AccountType;
  packageTier: PackageTier;
  activationCode: string | null;
  registrationStatus: 'pending' | 'active' | 'disabled';
  leftPoints: number;
  rightPoints: number;
  cdStatus: number;
  cdAmount: number;
  cdTotal: number;
  createdAt: string;
};

export type SponsorTreeApiNode = {
  nodeId: string;
  username: string;
  fullName: string;
  packageTier: string;
  accountStateLabel: 'PD' | 'FS' | 'CD - Paid' | 'CD - Unpaid';
  status: 'active' | 'pending' | 'disabled';
  depth: number;
  directReferrals: number;
  children: SponsorTreeApiNode[];
};

export type ProductionActivationCode = {
  id: string;
  code: string;
  codeFamily: CodeFamily;
  packageTier: string;
  accountType: AccountType;
  status: ActivationCodeStatus;
  paymentStatus: PaymentStatus;
  assignedUserId: string | null;
  generatedByUserId: string | null;
  generatedAt: string;
  releasedAt: string | null;
  transferredAt: string | null;
  usedAt: string | null;
  usedByUserId: string | null;
  registrationEligible: boolean;
  lockedDirectReferralBonus: number;
  lockedSalesmatchValue: number;
  lockedBinaryPoints: number;
  lockedGetFiveAmount: number;
  processId: string;
  remarks: string;
  settledAt: string | null;
  settledByUserId: string | null;
  // Cashier-held intended recipient: set when a cashier transfers a code to a member
  // before releasing; applied to assignedUserId at release time so the code stays
  // visible in the cashier's inventory until they perform the release action.
  pendingRecipientUserId: string | null;
  // Set once at generation when a code is directly assigned to a cashier; never
  // changed thereafter so cashiers can see their full code history regardless of
  // whether the code has been transferred, released, or even used.
  cashierUserId: string | null;
};

export type ProductionActivationCodeEvent = {
  id: string;
  activationCodeId: string;
  code: string;
  action: 'generated' | 'released' | 'transferred' | 'consumed' | 'settled' | 'revoked' | 'restored';
  actorUserId: string | null;
  actorName: string;
  fromUserId: string | null;
  toUserId: string | null;
  notes: string;
  createdAt: string;
};

export type ProductionPlacementReservation = {
  id: string;
  sponsorUserId: string;
  referralCode: string;
  placementParentUserId: string;
  placementParentUsername: string;
  placementParentShadowSide?: PlacementSide | null;
  placementSide: PlacementSide;
  shareToken: string;
  status: 'active' | 'consumed' | 'expired';
  expiresAt: string;
  createdAt: string;
};

export type ProductionWalletLedgerEntry = {
  id: string;
  userId: string;
  walletType: 'main' | 'lifestyle' | 'product' | 'pending' | 'encashment';
  entryType:
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
    | 'system_retainer'
    | 'cd_deduction'
    | 'adjustment';
  sourceReference: string;
  creditAmount: number;
  debitAmount: number;
  balanceAfter: number;
  processId: string;
  notes: string;
  occurredAt: string;
  status: 'posted';
};

export type ProductionSalesmatchBalance = {
  userId: string;
  leftSales: number;
  rightSales: number;
  matchedSales: number;
  leftPoints: number;
  rightPoints: number;
  matchedPoints: number;
  updatedAt: string;
};

export type ProductionEncashmentStatus = 'pending' | 'queued' | 'approved' | 'paid' | 'cancelled' | 'rejected';

export type ProductionEncashment = {
  id: string;
  userId: string;
  processId: string;
  grossAmount: number;
  processingFee: number;
  taxAmount: number;
  systemRetainer: number;
  cdDeduction: number;
  totalDeductions: number;
  netAmount: number;
  status: ProductionEncashmentStatus;
  payoutMethod: string | null;
  payoutDetails: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  paidAt: string | null;
  remarks: string;
  createdAt: string;
};

export type ProductionPairingSnapshot = {
  id: string;
  userId: string;
  snapshotDate: string;
  matchedSales: number;
  paidSalesmatch: number;
  forfeitedSalesmatch: number;
};

export type ProductionPairingEvent = {
  id: string;
  ownerUserId: string;
  sourceUsername: string;
  leftVolume: number;
  rightVolume: number;
  matchedPoints: number;
  leftRemaining: number;
  rightRemaining: number;
  salesmatchAmount: number;
  occurredAt: string;
};

export type ProductionCompensationQueueItem = {
  id: string;
  processId: string;
  eventType: QueueEventType;
  status: 'pending' | 'processed';
  payload: {
    placementParentUserId: string;
    placementParentShadowSide?: PlacementSide | null;
    placementSide: PlacementSide;
    salesmatchValue: number;
    binaryPoints: number;
    createdMemberUserId: string;
    createdMemberUsername: string;
    activationCode: string;
    shadowCode?: string | null;
    binaryCycleEligible?: boolean;
    // GATE-SHADOW-ACT-20260613: sibling-shadow pair block — when set, leg
    // accumulates at this userId but match execution is suppressed so the
    // owner's two shadows cannot pair each other.
    shadowPairBlockOwnerUserId?: string | null;
  };
  createdAt: string;
  processedAt: string | null;
};

export type ProductionShadowAccount = {
  id: string;
  ownerUserId: string;
  shadowCode: string;
  state: 'reserved_shadow' | 'activated_shadow' | 'converted_full';
  placement: PlacementSide;
  walletEnabled: boolean;
  unilevelEnabled: boolean;
  binaryCycleEnabled: boolean;
  note: string;
  packageTier: PackageTier | null;
  accountType: AccountType | null;
  activationCode: string | null;
  pvValue: number;
  salesmatchValue: number;
  activatedAt: string | null;
  lastUpgradedAt: string | null;
  // Shadow's own gross sub-leg volumes + matched + lifetime earned (GATE-PV-GROSS / shadow engine).
  leftVolume?: number;
  rightVolume?: number;
  matchedPoints?: number;
  totalEarned?: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductionRegistrationInput = {
  origin?: RegistrationOrigin;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
  password?: string;
  activationCode?: string;
  referralCode?: string;
  sponsorReferralCode?: string;
  placementParentUsername?: string;
  placementSide?: PlacementSide;
  placementToken?: string;
  placementReservationId?: string;
  payoutOption?: string;
  payoutDetails?: string;
};

export type ProductionPlacementContext = {
  placementUsername: string;
  placementParentShadowSide?: PlacementSide | null;
  placementSide: PlacementSide;
  note: string;
};

export type ProductionRegistrationPreview = {
  moneyMode: MoneyMode;
  origin: RegistrationOrigin;
  canProceed: boolean;
  sponsorResolutionMode: SponsorResolutionMode | null;
  sponsor: {
    username: string;
    fullName: string;
    referralCode: string;
    packageTier: PackageTier;
  } | null;
  selectedPackage: PackageTier | null;
  placementSide: PlacementSide | null;
  resolvedAccountType: AccountType | null;
  placementReservationId: string | null;
  placementToken: string | null;
  matchingCode: {
    id: string;
    code: string;
    codeFamily: CodeFamily;
    accountType: AccountType;
      packageTier: string;
    assignedTo: string;
    status: ActivationCodeStatus;
    paymentStatus: PaymentStatus;
    generatedAt: string;
    transferredAt: string | null;
    releasedAt: string | null;
    registrationEligible: boolean;
    copyEnabled: boolean;
    transferable: boolean;
    upgradable: boolean;
    visibility: string;
  } | null;
  placement: ProductionPlacementContext | null;
  availableCodes: Array<{
    id: string;
    code: string;
    codeFamily: CodeFamily;
    accountType: AccountType;
      packageTier: string;
    assignedTo: string;
    status: ActivationCodeStatus;
    paymentStatus: PaymentStatus;
    generatedAt: string;
    transferredAt: string | null;
    releasedAt: string | null;
    registrationEligible: boolean;
    copyEnabled: boolean;
    transferable: boolean;
    upgradable: boolean;
    visibility: string;
  }>;
  issues: string[];
  checklist: string[];
};

export type ProductionRegistrationSubmitResponse = {
  moneyMode: MoneyMode;
  action: 'production-registration-submit';
  status: 'completed';
  reason: string;
  detail: string;
  placementReservationId: string | null;
  queuedCompensation: string[];
  createdMember: {
    username: string;
    fullName: string;
    email: string;
    referralCode: string;
    sponsorUsername: string;
    packageTier: PackageTier;
    accountType: AccountType;
    loginEmail: string;
  };
};

type ProductionGenealogyNode = {
  nodeId: string;
  username: string;
  fullName: string;
  referralCode: string;
  packageTier: string;
  placement: 'root' | 'left' | 'right';
  status: string;
  depth: number;
  tracePath: string;
  binaryPoints: number;
  directReferrals: number;
  leftPoints: number;
  rightPoints: number;
  openSlots: {
    left: boolean;
    right: boolean;
  };
  shadowSlots: {
    left: {
      id: string;
      owner: string;
      placement: 'left';
      state: 'reserved_shadow' | 'activated_shadow';
      shadowCode: string;
      label: string;
      hasUpgradeCode: boolean;
      registrationEnabled: boolean;
      walletEnabled: boolean;
      unilevelEnabled: boolean;
      binaryCycleEnabled: boolean;
      note: string;
      packageTier: PackageTier | null;
      accountType: AccountType | null;
      activationCode: string | null;
      pvValue: number;
      salesmatchValue: number;
      activatedAt: string | null;
      lastUpgradedAt: string | null;
    };
    right: {
      id: string;
      owner: string;
      placement: 'right';
      state: 'reserved_shadow' | 'activated_shadow';
      shadowCode: string;
      label: string;
      hasUpgradeCode: boolean;
      registrationEnabled: boolean;
      walletEnabled: boolean;
      unilevelEnabled: boolean;
      binaryCycleEnabled: boolean;
      note: string;
      packageTier: PackageTier | null;
      accountType: AccountType | null;
      activationCode: string | null;
      pvValue: number;
      salesmatchValue: number;
      activatedAt: string | null;
      lastUpgradedAt: string | null;
    };
  };
  accountStateLabel: 'PD' | 'FS' | 'CD - Paid' | 'CD - Unpaid';
  children: ProductionGenealogyNode[];
};

export type ProductionEncodingRepository = {
  getMoneyMode(): MoneyMode;
  now(): string;
  nextActivationCodeSequence(): Promise<number>;
  nextMemberSequence(): Promise<number>;
  findUserById(userId: string): Promise<ProductionAppUser | null>;
  findMemberByUserId(userId: string): Promise<ProductionMemberProfile | null>;
  findMemberByUsername(username: string): Promise<ProductionMemberProfile | null>;
  findMemberByReferralCode(referralCode: string): Promise<ProductionMemberProfile | null>;
  findUserByUsername(username: string): Promise<ProductionAppUser | null>;
  findUserByReferralCode(referralCode: string): Promise<ProductionAppUser | null>;
  findUserByEmail(email: string): Promise<ProductionAppUser | null>;
  countMembersByNormalizedFullName(normalizedFullName: string): Promise<number>;
  listActivationCodes(): Promise<ProductionActivationCode[]>;
  listActivationCodesForUser(userId: string): Promise<ProductionActivationCode[]>;
  saveActivationCodes(rows: ProductionActivationCode[]): Promise<void>;
  appendActivationCodeEvents(events: ProductionActivationCodeEvent[]): Promise<void>;
  listActivationCodeEvents(): Promise<ProductionActivationCodeEvent[]>;
  listMembers(): Promise<ProductionMemberProfile[]>;
  listUsers(): Promise<ProductionAppUser[]>;
  listShadowAccounts(): Promise<ProductionShadowAccount[]>;
  listShadowAccountsForOwner(ownerUserId: string): Promise<ProductionShadowAccount[]>;
  findShadowAccountByCode(shadowCode: string): Promise<ProductionShadowAccount | null>;
  saveShadowAccounts(rows: ProductionShadowAccount[]): Promise<void>;
  listWalletLedgerEntriesForUser(userId: string): Promise<ProductionWalletLedgerEntry[]>;
  listRecentWalletLedger(limit: number): Promise<ProductionWalletLedgerEntry[]>;
  appendWalletLedgerEntry(entry: ProductionWalletLedgerEntry): Promise<void>;
  hasWalletLedgerProcess(processId: string): Promise<boolean>;
  saveUser(user: ProductionAppUser): Promise<void>;
  saveMemberProfile(profile: ProductionMemberProfile): Promise<void>;
  saveNetworkAccount(account: ProductionNetworkAccount): Promise<void>;
  findNetworkAccountByUserId(userId: string): Promise<ProductionNetworkAccount | null>;
  findActivationCodeByCode(code: string): Promise<ProductionActivationCode | null>;
  findActivationCodesByCodes(codes: string[]): Promise<ProductionActivationCode[]>;
  listMembersBySponsorCode(sponsorCode: string): Promise<ProductionMemberProfile[]>;
  findUsersByIds(userIds: string[]): Promise<ProductionAppUser[]>;
  listActivationCodeEventsForUser(userId: string, limit: number): Promise<ProductionActivationCodeEvent[]>;
  listRecentActivationCodeEvents(limit: number): Promise<ProductionActivationCodeEvent[]>;
  listNetworkAccounts(): Promise<ProductionNetworkAccount[]>;
  listDirectsBySponsor(sponsorUserId: string): Promise<ProductionNetworkAccount[]>;
  findPlacementChild(parentUserId: string, side: PlacementSide, shadowSide?: PlacementSide | null): Promise<ProductionNetworkAccount | null>;
  findPlacementChildrenBatch(parentUserIds: string[]): Promise<ProductionNetworkAccount[]>;
  saveSalesmatchBalance(balance: ProductionSalesmatchBalance): Promise<void>;
  getSalesmatchBalance(userId: string): Promise<ProductionSalesmatchBalance | null>;
  listUsersWithPendingSalesmatch(): Promise<string[]>;
  getPaidSalesmatchSince(userId: string, sinceIso: string): Promise<number>;
  recordPairingSnapshot(input: {
    userId: string;
    snapshotDate: string;
    matchedDelta: number;
    paidDelta: number;
    forfeitedDelta: number;
  }): Promise<void>;
  listPairingSnapshotsForUser(userId: string): Promise<ProductionPairingSnapshot[]>;
  recordPairingEvent(input: {
    ownerUserId: string;
    sourceUsername: string;
    leftVolume: number;
    rightVolume: number;
    matchedPoints: number;
    leftRemaining: number;
    rightRemaining: number;
    salesmatchAmount: number;
  }): Promise<void>;
  listPairingEventsForUser(userId: string, limit: number): Promise<ProductionPairingEvent[]>;
  reconcileShadowEarnings(): Promise<Array<{ userId: string; entryType: string; amount: number }>>;
  sumLedgerMainBalance(userId: string): Promise<number>;
  createEncashment(row: ProductionEncashment): Promise<void>;
  saveEncashment(row: ProductionEncashment): Promise<void>;
  findEncashmentById(encashmentId: string): Promise<ProductionEncashment | null>;
  listEncashments(filter: { status?: ProductionEncashmentStatus }, limit: number): Promise<ProductionEncashment[]>;
  listEncashmentsForUser(userId: string): Promise<ProductionEncashment[]>;
  enqueueCompensation(item: ProductionCompensationQueueItem): Promise<void>;
  listPendingCompensation(limit: number): Promise<ProductionCompensationQueueItem[]>;
  markCompensationProcessed(queueId: string, processedAt: string): Promise<void>;
  savePlacementReservation(reservation: ProductionPlacementReservation): Promise<void>;
  listPlacementReservationsForSponsor(sponsorUserId: string): Promise<ProductionPlacementReservation[]>;
  findPlacementReservationById(reservationId: string): Promise<ProductionPlacementReservation | null>;
  findPlacementReservationByToken(token: string): Promise<ProductionPlacementReservation | null>;
  listMembersFiltered(query: string, page: number, pageSize: number): Promise<ProductionMemberProfile[]>;
  countMembersFiltered(query: string): Promise<number>;
  listNetworkAccountsByUserIds(userIds: string[]): Promise<ProductionNetworkAccount[]>;
  sumWalletMainBalancesByUserIds(userIds: string[]): Promise<Map<string, number>>;
  countDirectReferralsByUserIds(userIds: string[]): Promise<Map<string, number>>;
  insertRepurchase(row: {
    id: string;
    processKey: string;
    userId: string;
    productCode: string;
    productName: string;
    productType: string;
    quantity: number;
    unitPrice: number;
    srpPrice: number;
    totalAmount: number;
    pvEarned: number;
    activationCode: string;
    transactionDate: string;
    createdAt: string;
  }): Promise<void>;
  sumLifestyleCreditsForUserToday(userId: string, dayIso: string): Promise<number>;
  sumLifestyleCreditsForUserThisMonth(userId: string, yearMonthPrefix: string): Promise<number>;
  // Sum of repurchase PV (pvEarned) for a user within a calendar month (YYYY-MM prefix).
  // Drives unilevel maintenance qualification and the monthly unilevel batch.
  sumRepurchasePvForUserInMonth(userId: string, yearMonthPrefix: string): Promise<number>;
  setStockistLevel(userId: string, level: StockistLevel): Promise<void>;
  listUsersByRole(role: string): Promise<ProductionAppUser[]>;
  // Global bonus pool: sum unit_price of repurchases not yet included in a distribution.
  sumPendingGlobalBonusNetSales(): Promise<number>;
  // Mark repurchases as included in the current global bonus distribution cycle.
  markRepurchasesGlobalBonusIncluded(): Promise<void>;
};

export function normalizeFullName(fullName: string): string {
  return fullName.trim().replace(/\s+/g, ' ').toUpperCase();
}

function toPackageTier(value: string): PackageTier {
  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case 'BASIC':
      return 'Basic';
    case 'CLASSIC':
      return 'Classic';
    case 'STANDARD':
      return 'Standard';
    case 'BUSINESS':
      return 'Business';
    case 'VIP':
      return 'VIP';
    default:
      throw new Error(`Unsupported package tier: ${value}`);
  }
}

function getPackageConfig(packageTier: string): PackageConfig {
  const config = PACKAGE_CONFIGS.get(packageTier.trim().toUpperCase());
  if (!config) {
    throw new Error(`Unsupported package tier: ${packageTier}`);
  }
  return config;
}

function normalizeProductionUsernameAlias(value: string): string | null {
  const compact = value.trim().toUpperCase().replace(/[\s-]+/g, '');
  const match = compact.match(/^YOR0*(\d+)$/);

  if (!match) {
    return null;
  }

  return `YOR${match[1].padStart(4, '0')}`;
}

function resolveActivationCodeTemplate(packageTier: string, codeFamily: CodeFamily): {
  packageTier: string;
  accountType: AccountType;
  directReferralBonus: number;
  salesmatchValue: number;
  salesmatchBinaryPoints: number;
  binaryCyclePercent: number;
  getFiveAmount: number;
  binaryPoints: number;
} {
  if (codeFamily === 'YOR CODES') {
    return getPackageConfig(packageTier);
  }

  const normalizedPackageTier = packageTier.trim().toUpperCase();
  const product = repeatPurchaseProductCatalog.find(
    (item) => item.label.trim().toUpperCase() === normalizedPackageTier || item.sku.trim().toUpperCase() === normalizedPackageTier
  );

  if (!product) {
    throw new Error(`Unsupported product tier: ${packageTier}`);
  }

  return {
    packageTier: product.label,
    accountType: 'PD' as const,
    directReferralBonus: 0,
    salesmatchValue: 0,
    salesmatchBinaryPoints: 0,
    binaryCyclePercent: 0,
    getFiveAmount: 0,
    binaryPoints: 0
  };
}

function buildActivationCodeValue(accountType: AccountType, packageTier: string, codeFamily: CodeFamily, sequence: number): string {
  let pkg: string;
  if (codeFamily === 'YOR CODES') {
    const pkgMap: Record<string, string> = { Basic: 'BA', Classic: 'CL', Standard: 'ST', Business: 'BU', VIP: 'VI' };
    pkg = pkgMap[packageTier] ?? 'XX';
  } else {
    const cfMap: Record<string, string> = {
      'YOR MAINTENANCE': 'YM',
      'YOR PERFUME': 'YP',
      'YOR REFILL': 'YR',
      'YOR VISION': 'YV',
    };
    pkg = cfMap[codeFamily] ?? 'YX';
  }
  return `${accountType}${pkg}${String(sequence).padStart(6, '0')}`;
}

function visibilityForCode(code: ProductionActivationCode, assignedUsername: string | null): string {
  if (code.status === 'used') {
    return 'used';
  }
  if (code.status === 'unreleased') {
    return assignedUsername ? 'reserved-awaiting-release' : 'unreleased-admin-pool';
  }
  if (code.status === 'available' && assignedUsername) {
    return 'released-by-sponsor';
  }
  return 'released-to-network';
}

function mapCodeRow(
  code: ProductionActivationCode,
  assignedUsername: string | null
): ProductionRegistrationPreview['availableCodes'][number] {
  return {
    id: code.id,
    code: code.code,
    codeFamily: code.codeFamily,
    accountType: code.accountType,
    packageTier: code.packageTier,
    assignedTo: assignedUsername ?? 'Unassigned',
    status: code.status,
    paymentStatus: code.paymentStatus,
    generatedAt: code.generatedAt,
    transferredAt: code.transferredAt,
    releasedAt: code.releasedAt,
    registrationEligible: code.registrationEligible,
    copyEnabled: code.registrationEligible && code.status === 'available' && Boolean(assignedUsername),
    transferable: code.status !== 'used' && code.status !== 'disabled',
    upgradable: code.codeFamily === 'YOR CODES' && code.status === 'available',
    visibility: visibilityForCode(code, assignedUsername)
  };
}

function splitFullName(fullName: string): { firstName: string; lastName: string; middleName: string } {
  const parts = fullName.trim().split(/\s+/g).filter(Boolean);
  const firstName = parts[0] ?? '';
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  const middleName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
  return { firstName, lastName, middleName };
}

function parsePlacementParentAddress(username: string): {
  memberUsername: string;
  shadowSide: PlacementSide | null;
  label: string;
} {
  const label = username.trim();
  if (label.endsWith('-L')) {
    return { memberUsername: label.slice(0, -2), shadowSide: 'left', label };
  }
  if (label.endsWith('-R')) {
    return { memberUsername: label.slice(0, -2), shadowSide: 'right', label };
  }
  return { memberUsername: label, shadowSide: null, label };
}

function buildProcessId(scope: string, ...parts: string[]) {
  return [scope, ...parts].join(':');
}

// Serializes money-mutating operations per key. Service instances are created
// per request, so the lock table lives at module scope. This guards the
// single-process PM2 deployment against TOCTOU races (balance check vs debit,
// concurrent status reviews, queue double-processing); a multi-node deployment
// must replace this with a database-level lock.
const moneyLocks = new Map<string, Promise<void>>();

async function withMoneyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = moneyLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  moneyLocks.set(key, current);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (moneyLocks.get(key) === current) {
      moneyLocks.delete(key);
    }
  }
}

function randomToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export class ProductionEncodingService {
  constructor(private readonly repo: ProductionEncodingRepository) {}

  private buildShadowCode(ownerUsername: string, placement: PlacementSide) {
    return `${ownerUsername}-${placement === 'left' ? 'L' : 'R'}`;
  }

  private buildDefaultShadowNote(placement: PlacementSide, state: ProductionShadowAccount['state']) {
    if (state === 'activated_shadow') {
      return `Activated ${placement} shadow support. Carries PV for Salesmatch only; no wallet, direct referral, unilevel, or binary cycle rights.`;
    }
    return `Reserved ${placement} shadow support. Binary Function Only until a paid code activates this slot.`;
  }

  private createDefaultShadowAccount(owner: ProductionMemberProfile, placement: PlacementSide): ProductionShadowAccount {
    const now = this.repo.now();
    // GATE-SHADOW-ACT-20260613: shadows are activated at encoding time with the
    // owner's package tier. pvValue/salesmatchValue remain 0 until an upgrade
    // code is applied. State 'reserved_shadow' is no longer the creation default.
    return {
      id: crypto.randomUUID(),
      ownerUserId: owner.userId,
      shadowCode: this.buildShadowCode(owner.username, placement),
      state: 'activated_shadow',
      placement,
      walletEnabled: false,
      unilevelEnabled: false,
      binaryCycleEnabled: false,
      note: this.buildDefaultShadowNote(placement, 'activated_shadow'),
      packageTier: toPackageTier(owner.packageTier as string),
      accountType: (owner.packageTier === 'Business' || owner.packageTier === 'VIP' ? 'FS' : 'PD') as AccountType,
      activationCode: null,
      pvValue: 0,
      salesmatchValue: 0,
      activatedAt: now,
      lastUpgradedAt: null,
      leftVolume: 0,
      rightVolume: 0,
      matchedPoints: 0,
      totalEarned: 0,
      createdAt: now,
      updatedAt: now
    };
  }

  private async ensureShadowAccountsForMembers(members: ProductionMemberProfile[]) {
    const existing = await this.repo.listShadowAccounts();
    const byOwnerPlacement = new Map<string, ProductionShadowAccount>(existing.map((row) => [`${row.ownerUserId}:${row.placement}`, row]));
    const created: ProductionShadowAccount[] = [];

    for (const member of members) {
      for (const placement of ['left', 'right'] as const) {
        const key = `${member.userId}:${placement}`;
        if (!byOwnerPlacement.has(key)) {
          const row = this.createDefaultShadowAccount(member, placement);
          byOwnerPlacement.set(key, row);
          created.push(row);
        }
      }
    }

    if (created.length > 0) {
      await this.repo.saveShadowAccounts(created);
    }

    return [...existing, ...created];
  }

  private async ensureShadowAccountsForOwner(owner: ProductionMemberProfile) {
    const rows = await this.repo.listShadowAccountsForOwner(owner.userId);
    if (rows.length >= 2 && rows.some((row) => row.placement === 'left') && rows.some((row) => row.placement === 'right')) {
      return rows;
    }
    const missing: ProductionShadowAccount[] = [];
    if (!rows.some((row) => row.placement === 'left')) {
      missing.push(this.createDefaultShadowAccount(owner, 'left'));
    }
    if (!rows.some((row) => row.placement === 'right')) {
      missing.push(this.createDefaultShadowAccount(owner, 'right'));
    }
    if (missing.length > 0) {
      await this.repo.saveShadowAccounts(missing);
    }
    return [...rows, ...missing].sort((a, b) => a.placement.localeCompare(b.placement));
  }

  private toGenealogyShadowSlot(owner: ProductionMemberProfile, row: ProductionShadowAccount) {
    return {
      id: row.id,
      owner: owner.username,
      placement: row.placement,
      state: row.state === 'converted_full' ? 'activated_shadow' : row.state,
      shadowCode: row.shadowCode,
      label: `${owner.username} ${row.placement === 'left' ? 'Left' : 'Right'} Shadow`,
      hasUpgradeCode: row.pvValue > 0,
      registrationEnabled: false,
      walletEnabled: row.walletEnabled,
      unilevelEnabled: row.unilevelEnabled,
      binaryCycleEnabled: row.binaryCycleEnabled,
      note: row.note,
      packageTier: row.packageTier,
      accountType: row.accountType,
      activationCode: row.activationCode,
      pvValue: row.pvValue,
      salesmatchValue: row.salesmatchValue,
      activatedAt: row.activatedAt,
      lastUpgradedAt: row.lastUpgradedAt
    };
  }

  async buildScopedBinaryGenealogyCenter(user: SessionUser, rootUsername?: string) {
    const signedInMember = await this.requireMemberByUserId(user.id);
    const [members, networks] = await Promise.all([this.repo.listMembers(), this.repo.listNetworkAccounts()]);
    const shadowAccounts = await this.ensureShadowAccountsForMembers(members);
    const membersByUserId = new Map(members.map((member) => [member.userId, member]));
    const networksByUserId = new Map(networks.map((network) => [network.userId, network]));
    const membersByUsername = new Map(members.map((member) => [member.username, member]));
    const shadowByOwnerPlacement = new Map(
      shadowAccounts.map((row) => [`${row.ownerUserId}:${row.placement}`, row] as const)
    );
    const directReferralCounts = new Map<string, number>();

    for (const member of members) {
      if (!member.sponsorCode) {
        continue;
      }
      const sponsor = members.find((candidate) => candidate.referralCode === member.sponsorCode);
      if (!sponsor) {
        continue;
      }
      directReferralCounts.set(sponsor.userId, (directReferralCounts.get(sponsor.userId) ?? 0) + 1);
    }

    const flattenTree = (root: ProductionGenealogyNode) => {
      const nodes: Array<Omit<ProductionGenealogyNode, 'children'> & { parentNodeId: string | null; level: number }> = [];

      const walk = (node: ProductionGenealogyNode, parentNodeId: string | null, level: number) => {
        const { children, ...rest } = node;
        nodes.push({
          ...rest,
          parentNodeId,
          level
        });

        for (const child of children) {
          walk(child, node.nodeId, level + 1);
        }
      };

      walk(root, null, 0);
      return nodes;
    };

    const toAccountStateLabel = (network: ProductionNetworkAccount | null): 'PD' | 'FS' | 'CD - Paid' | 'CD - Unpaid' => {
      if (!network) return 'PD';
      if (network.currentAccountType === 'FS') return 'FS';
      if (network.currentAccountType === 'CD') {
        return network.cdStatus > 0 ? 'CD - Paid' : 'CD - Unpaid';
      }
      return 'PD';
    };

    const buildTreeNode = (
      member: ProductionMemberProfile,
      placement: 'root' | 'left' | 'right',
      depth: number,
      path: string[]
    ): ProductionGenealogyNode => {
      const network = networksByUserId.get(member.userId) ?? null;
      const tracePath = [...path, member.username];
      const leftShadow = shadowByOwnerPlacement.get(`${member.userId}:left`) ?? this.createDefaultShadowAccount(member, 'left');
      const rightShadow = shadowByOwnerPlacement.get(`${member.userId}:right`) ?? this.createDefaultShadowAccount(member, 'right');

      return {
        nodeId: member.username,
        username: member.username,
        fullName: member.fullName,
        referralCode: member.referralCode,
        packageTier: member.packageTier,
        placement,
        status: member.accountStatus,
        depth,
        tracePath: tracePath.join(' > '),
        binaryPoints: Math.min(network?.leftPoints ?? 0, network?.rightPoints ?? 0),
        directReferrals: directReferralCounts.get(member.userId) ?? 0,
        leftPoints: network?.leftPoints ?? 0,
        rightPoints: network?.rightPoints ?? 0,
        openSlots: {
          left: false,
          right: false
        },
        shadowSlots: {
          left: { ...this.toGenealogyShadowSlot(member, leftShadow), placement: 'left' as const },
          right: { ...this.toGenealogyShadowSlot(member, rightShadow), placement: 'right' as const }
        },
        accountStateLabel: toAccountStateLabel(network),
        children: [
          buildShadowTreeNode(member, 'left', depth + 1, tracePath),
          buildShadowTreeNode(member, 'right', depth + 1, tracePath)
        ]
      };
    };

    const findShadowChildNetwork = (
      parentUserId: string,
      shadowSide: PlacementSide,
      childSide: PlacementSide
    ) =>
      networks.find(
        (candidate) =>
          candidate?.placementParentUserId === parentUserId &&
          candidate.placementSide === childSide &&
          candidate.registrationStatus === 'active' &&
          (candidate.placementParentShadowSide === shadowSide ||
            (!candidate.placementParentShadowSide && candidate.placementSide === shadowSide))
      ) ?? null;

    const buildShadowTreeNode = (
      owner: ProductionMemberProfile,
      placement: PlacementSide,
      depth: number,
      path: string[]
    ): ProductionGenealogyNode => {
      const nodeId = `${owner.username}-${placement === 'left' ? 'L' : 'R'}`;
      const tracePath = [...path, nodeId];
      const leftNetwork = findShadowChildNetwork(owner.userId, placement, 'left');
      const rightNetwork = findShadowChildNetwork(owner.userId, placement, 'right');
      const leftMember = leftNetwork ? membersByUserId.get(leftNetwork.userId) ?? null : null;
      const rightMember = rightNetwork ? membersByUserId.get(rightNetwork.userId) ?? null : null;
      const children: ProductionGenealogyNode[] = [];

      if (leftMember) {
        children.push(buildTreeNode(leftMember, 'left', depth + 1, tracePath));
      }

      if (rightMember) {
        children.push(buildTreeNode(rightMember, 'right', depth + 1, tracePath));
      }

      return {
        nodeId,
        username: nodeId,
        fullName: 'Binary Function Only',
        referralCode: '',
        packageTier: 'Binary Function Only',
        placement,
        status: 'shadow',
        depth,
        tracePath: tracePath.join(' > '),
        binaryPoints: 0,
        directReferrals: 0,
        leftPoints: 0,
        rightPoints: 0,
        openSlots: {
          left: !leftMember,
          right: !rightMember
        },
        shadowSlots: {
          left: null as any,
          right: null as any
        },
        accountStateLabel: 'PD',
        children
      };
    };

    const memberRoot = buildTreeNode(signedInMember, 'root', 0, []);
    const requestedRoot = rootUsername ? membersByUsername.get(rootUsername) ?? null : null;
    const resolvedRoot = requestedRoot ?? signedInMember;
    const root =
      resolvedRoot.username === signedInMember.username ? memberRoot : buildTreeNode(resolvedRoot, 'root', 0, []);

    return {
      moneyMode: this.repo.getMoneyMode(),
      treeType: 'binary-placement',
      root,
      nodes: flattenTree(root),
      notes: [
        'Direct sponsor genealogy and binary placement remain separate so placement and referral logic do not get mixed.',
        resolvedRoot.username === signedInMember.username
          ? 'Tree is centered on the signed-in member root.'
          : `Tree is centered on ${resolvedRoot.username} for placement review.`,
        'Open slots are generated from the live production-backed placement tree.'
      ]
    };
  }

  async buildAdminBinaryGenealogyCenter(rootUsername?: string) {
    const members = await this.repo.listMembers();
    const byUsername = new Map(members.map((m) => [m.username, m]));
    const companyRoot = members.find((m) => m.isCompanyAccount) ?? members[0];
    const rootMember = rootUsername ? (byUsername.get(rootUsername) ?? companyRoot) : companyRoot;
    if (!rootMember) {
      throw new Error('No company root found in production database.');
    }
    const syntheticUser: SessionUser = {
      id: rootMember.userId,
      name: rootMember.fullName,
      email: '',
      role: 'member'
    };
    return this.buildScopedBinaryGenealogyCenter(syntheticUser, rootUsername);
  }

  async buildScopedSponsorGenealogyCenter(user: SessionUser, rootUsername?: string): Promise<{
    moneyMode: MoneyMode;
    treeType: 'sponsor';
    root: SponsorTreeApiNode;
  }> {
    const signedInMember = await this.requireMemberByUserId(user.id);
    const [members, networks] = await Promise.all([this.repo.listMembers(), this.repo.listNetworkAccounts()]);

    const networksByUserId = new Map(networks.map((n) => [n.userId, n]));
    const membersByReferralCode = new Map(members.map((m) => [m.referralCode, m]));
    const membersByUsername = new Map(members.map((m) => [m.username, m]));

    const sponsorChildren = new Map<string, ProductionMemberProfile[]>();
    for (const member of members) {
      if (!member.sponsorCode) continue;
      const sponsor = membersByReferralCode.get(member.sponsorCode);
      if (!sponsor) continue;
      const list = sponsorChildren.get(sponsor.userId) ?? [];
      list.push(member);
      sponsorChildren.set(sponsor.userId, list);
    }

    const toStateLabel = (userId: string): 'PD' | 'FS' | 'CD - Paid' | 'CD - Unpaid' => {
      const network = networksByUserId.get(userId) ?? null;
      if (!network) return 'PD';
      if (network.currentAccountType === 'FS') return 'FS';
      if (network.currentAccountType === 'CD') return network.cdStatus > 0 ? 'CD - Paid' : 'CD - Unpaid';
      return 'PD';
    };

    const MAX_DEPTH = 20;

    const buildNode = (member: ProductionMemberProfile, depth: number, visited: Set<string>): SponsorTreeApiNode => {
      const children: SponsorTreeApiNode[] = [];
      if (depth < MAX_DEPTH) {
        const nextVisited = new Set(visited);
        nextVisited.add(member.userId);
        for (const child of sponsorChildren.get(member.userId) ?? []) {
          // Cycle guard on the CHILD (the node itself is always "visited" as the path
          // head, so guarding on self wrongly suppressed the root's entire downline).
          if (nextVisited.has(child.userId)) continue;
          children.push(buildNode(child, depth + 1, nextVisited));
        }
      }
      return {
        nodeId: member.username,
        username: member.username,
        fullName: member.fullName,
        packageTier: member.packageTier,
        accountStateLabel: toStateLabel(member.userId),
        status: member.accountStatus,
        depth,
        directReferrals: sponsorChildren.get(member.userId)?.length ?? 0,
        children
      };
    };

    const requestedRoot = rootUsername ? membersByUsername.get(rootUsername) ?? null : null;
    const resolvedRoot = requestedRoot ?? signedInMember;

    return {
      moneyMode: this.repo.getMoneyMode(),
      treeType: 'sponsor',
      root: buildNode(resolvedRoot, 0, new Set([resolvedRoot.userId]))
    };
  }

  async buildMemberShadowAccountCenter(user: SessionUser, ownerUsername?: string) {
    const owner = ownerUsername ? await this.requireMemberByUsername(ownerUsername) : await this.requireMemberByUserId(user.id);
    if (user.role === 'member' && owner.userId !== user.id) {
      throw new Error('Members can only view their own shadow accounts.');
    }

    const [shadowAccounts, availableCodes] = await Promise.all([
      this.ensureShadowAccountsForOwner(owner),
      this.repo.listActivationCodesForUser(owner.userId)
    ]);

    return {
      moneyMode: this.repo.getMoneyMode(),
      owner: owner.username,
      accounts: shadowAccounts.map((row) => ({
        id: row.id,
        owner: owner.username,
        shadowCode: row.shadowCode,
        label: `${owner.username} ${row.placement === 'left' ? 'Left' : 'Right'} Shadow`,
        state: row.state,
        hasUpgradeCode: row.pvValue > 0,
        placement: row.placement,
        walletEnabled: row.walletEnabled,
        unilevelEnabled: row.unilevelEnabled,
        binaryCycleEnabled: row.binaryCycleEnabled,
        packageTier: row.packageTier,
        accountType: row.accountType,
        activationCode: row.activationCode,
        pvValue: row.pvValue,
        salesmatchValue: row.salesmatchValue,
        activatedAt: row.activatedAt,
        lastUpgradedAt: row.lastUpgradedAt,
        note: row.note,
        // Shadow's own pairing income (its two sub-legs pair → owner earns, transferred tagged).
        leftVolume: row.leftVolume ?? 0,
        rightVolume: row.rightVolume ?? 0,
        matchedPoints: row.matchedPoints ?? 0,
        totalEarned: row.totalEarned ?? 0,
        // GATE-SHADOW-ACT-20260613: shadows are activated at encoding — no manual Activate.
        // Only reserved shadows (legacy) can activate; everything else just upgrades / views income.
        canActivate: row.state === 'reserved_shadow',
        canUpgrade: row.state !== 'reserved_shadow'
      })),
      availableCodes: availableCodes
        .filter(
          (item) =>
            item.codeFamily === 'YOR CODES' &&
            item.status === 'available' &&
            item.paymentStatus !== 'unpaid' &&
            item.registrationEligible
        )
        .map((item) => ({
          id: item.id,
          code: item.code,
          codeFamily: item.codeFamily,
          accountType: item.accountType,
          packageTier: item.packageTier,
          assignedTo: owner.username,
          status: item.status,
          paymentStatus: item.paymentStatus,
          generatedAt: item.generatedAt,
          transferredAt: item.transferredAt,
          releasedAt: item.releasedAt,
          registrationEligible: item.registrationEligible,
          copyEnabled: true,
          transferable: false,
          upgradable: true,
          visibility: 'shadow-activation'
        })),
      notes: [
        'Shadow accounts are Binary Function Only until activated.',
        'Activated shadows add Salesmatch PV only. They never generate Direct Referral, Unilevel, or Binary Cycle.'
      ]
    };
  }

  async activateShadowAccount(
    actor: SessionUser,
    payload: { shadowCode: string; code: string }
  ) {
    const shadowCode = payload.shadowCode.trim().toUpperCase();
    const codeValue = payload.code.trim().toUpperCase();
    if (!shadowCode) {
      throw new Error('Select a shadow account first.');
    }
    if (!codeValue) {
      throw new Error('Select an activation code first.');
    }

    return withMoneyLock(`shadow:${shadowCode}`, async () => {
      const shadow = await this.repo.findShadowAccountByCode(shadowCode);
      if (!shadow) {
        throw new Error('Shadow account not found.');
      }
      if (actor.role === 'member' && shadow.ownerUserId !== actor.id) {
        throw new Error('You can only activate your own shadow account.');
      }

      const owner = await this.requireMemberByUserId(shadow.ownerUserId);
      const code = await this.repo.findActivationCodeByCode(codeValue);
      if (!code) {
        throw new Error('Activation code not found.');
      }
      if (code.codeFamily !== 'YOR CODES' || !code.registrationEligible) {
        throw new Error('Only registration activation codes can activate a shadow account.');
      }
      if (code.assignedUserId !== shadow.ownerUserId) {
        throw new Error(`Activation code ${code.code} is not assigned to ${owner.username}.`);
      }
      if (code.status !== 'available') {
        throw new Error(`Activation code ${code.code} is not available.`);
      }
      if (code.paymentStatus === 'unpaid') {
        throw new Error(`Activation code ${code.code} must be settled before it can activate a shadow account.`);
      }

      const previousSalesmatchValue = shadow.salesmatchValue;
      const previousPvValue = shadow.pvValue;
      const nextSalesmatchValue = code.lockedSalesmatchValue;
      const nextPvValue = code.lockedBinaryPoints;

      // GATE-SHADOW-ACT-20260613: guard changed — all shadows start activated now,
      // so block upgrade-via-lower-code only when pvValue is already set (first code always allowed)
      if (previousSalesmatchValue > 0 && nextSalesmatchValue <= previousSalesmatchValue && nextPvValue <= previousPvValue) {
        throw new Error('Use a higher-value code to upgrade this activated shadow account.');
      }

      const now = this.repo.now();
      shadow.state = 'activated_shadow';
      // GATE-SHADOW-ACT-20260613: shadows have their own wallet enabled when a code is applied
      shadow.walletEnabled = true;
      shadow.unilevelEnabled = false;
      shadow.binaryCycleEnabled = false;
      shadow.note = this.buildDefaultShadowNote(shadow.placement, 'activated_shadow');
      shadow.packageTier = toPackageTier(code.packageTier);
      shadow.accountType = code.accountType;
      shadow.activationCode = code.code;
      shadow.pvValue = nextPvValue;
      shadow.salesmatchValue = nextSalesmatchValue;
      shadow.activatedAt = shadow.activatedAt ?? now;
      shadow.lastUpgradedAt = now;
      shadow.updatedAt = now;

      code.status = 'used';
      code.usedAt = now;
      code.usedByUserId = shadow.ownerUserId;

      await this.repo.saveShadowAccounts([shadow]);
      await this.repo.saveActivationCodes([code]);
      await this.repo.appendActivationCodeEvents([
        {
          id: crypto.randomUUID(),
          activationCodeId: code.id,
          code: code.code,
          action: 'consumed',
          actorUserId: actor.id,
          actorName: actor.name,
          fromUserId: shadow.ownerUserId,
          toUserId: shadow.ownerUserId,
          notes: `Activation code consumed for shadow account ${shadow.shadowCode}.`,
          createdAt: now
        }
      ]);

      const salesmatchDelta = Math.max(0, Number((nextSalesmatchValue - previousSalesmatchValue).toFixed(2)));
      const pvDelta = Math.max(0, Number((nextPvValue - previousPvValue).toFixed(2)));
      if (salesmatchDelta > 0 || pvDelta > 0) {
        await this.repo.enqueueCompensation({
          id: crypto.randomUUID(),
          processId: buildProcessId('shadow-activate', shadow.shadowCode, code.code),
          eventType: 'placement-sales',
          status: 'pending',
          payload: {
            placementParentUserId: shadow.ownerUserId,
            placementParentShadowSide: shadow.placement,
            placementSide: shadow.placement,
            salesmatchValue: salesmatchDelta,
            binaryPoints: pvDelta,
            createdMemberUserId: shadow.ownerUserId,
            createdMemberUsername: shadow.shadowCode,
            activationCode: code.code,
            shadowCode: shadow.shadowCode,
            binaryCycleEligible: false,
            // GATE-SHADOW-ACT-20260613: prevents left-shadow PV from pairing
            // with right-shadow PV at the owner's own level.
            shadowPairBlockOwnerUserId: shadow.ownerUserId
          },
          createdAt: now,
          processedAt: null
        });
      }

      return {
        moneyMode: this.repo.getMoneyMode(),
        action: 'member-shadow-account-activate',
        status: 'completed' as const,
        reason:
          previousSalesmatchValue > 0
            ? `Shadow account ${shadow.shadowCode} upgraded to ${shadow.packageTier}.`
            : `Shadow account ${shadow.shadowCode} activated with ${shadow.packageTier}.`,
        detail: `Shadow ${shadow.shadowCode} now carries ${shadow.pvValue} PV and PHP ${shadow.salesmatchValue} Salesmatch value. Binary Cycle, Direct Referral, and Unilevel remain disabled.`,
        shadowAccount: {
          shadowCode: shadow.shadowCode,
          placement: shadow.placement,
          packageTier: shadow.packageTier,
          accountType: shadow.accountType,
          pvValue: shadow.pvValue,
          salesmatchValue: shadow.salesmatchValue
        }
      };
    });
  }

  async getMemberBinaryBalance(userId: string): Promise<{
    leftPoints: number;
    rightPoints: number;
    matchedPoints: number;
    matchedSales: number;
  } | null> {
    const [balance, network] = await Promise.all([
      this.repo.getSalesmatchBalance(userId),
      this.repo.findNetworkAccountByUserId(userId)
    ]);
    if (!balance && !network) return null;
    return {
      leftPoints: network?.leftPoints ?? balance?.leftPoints ?? 0,
      rightPoints: network?.rightPoints ?? balance?.rightPoints ?? 0,
      matchedPoints: balance?.matchedPoints ?? 0,
      matchedSales: Number(balance?.matchedSales ?? 0)
    };
  }

  // Unilevel rank (owner item 8): determined solely by lifetime TOTAL INCOME =
  // gross sum of every wallet credit (no debits/deductions), mapped onto the
  // image-2 rank ladder.
  async getMemberRank(userId: string): Promise<RankProgress & { moneyMode: MoneyMode }> {
    const ledger = await this.repo.listWalletLedgerEntriesForUser(userId);
    const totalIncome = ledger.reduce((sum, entry) => sum + (entry.creditAmount ?? 0), 0);
    return { moneyMode: this.repo.getMoneyMode(), ...rankForIncome(totalIncome) };
  }

  // Real-DB tables for admin operational modules that otherwise render the static
  // sandbox catalog. Returns null for modules without a production override so the
  // caller keeps the existing module table.
  async buildAdminModuleProductionData(
    moduleId: string
  ): Promise<{ metrics: OperationalMetric[]; table: ReportTable } | null> {
    const php = (v: number) =>
      `PHP ${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const buildTable = (title: string, rows: ReportTable['rows']): ReportTable => ({
      title,
      columns: Object.keys(rows[0] ?? {}).map((key) => ({
        key,
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
      })),
      rows
    });

    if (moduleId === 'rankings') {
      const members = (await this.repo.listMembers()).filter((m) => m.accountStatus === 'active');
      const userIds = members.map((m) => m.userId);
      const [networkRows, directMap] = await Promise.all([
        this.repo.listNetworkAccountsByUserIds(userIds),
        this.repo.countDirectReferralsByUserIds(userIds)
      ]);
      const networkMap = new Map(networkRows.map((r) => [r.userId, r]));
      const rows = await Promise.all(
        members.map(async (m) => {
          const net = networkMap.get(m.userId);
          const ledger = await this.repo.listWalletLedgerEntriesForUser(m.userId);
          const income = ledger.reduce((sum, e) => sum + (e.creditAmount ?? 0), 0);
          return {
            username: m.username,
            package: m.packageTier,
            directReferrals: directMap.get(m.userId) ?? 0,
            leftPoints: net?.leftPoints ?? 0,
            rightPoints: net?.rightPoints ?? 0,
            totalIncome: php(income),
            currentRank: rankForIncome(income).rankName
          };
        })
      );
      rows.sort((a, b) => {
        const parse = (s: unknown) => parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0;
        return parse(b.totalIncome) - parse(a.totalIncome);
      });
      return {
        metrics: [
          { label: 'Members Ranked', value: String(rows.length) },
          { label: 'VIP Packages', value: String(members.filter((m) => m.packageTier === 'VIP').length) }
        ],
        table: buildTable('Rankings & Network Volume', rows)
      };
    }

    if (moduleId === 'finance-accounting') {
      const [ledger, members] = await Promise.all([this.repo.listRecentWalletLedger(200), this.repo.listMembers()]);
      const nameByUserId = new Map(members.map((m) => [m.userId, m.username]));
      let grossCredits = 0;
      let grossDebits = 0;
      const rows = ledger.map((e) => {
        grossCredits += e.creditAmount ?? 0;
        grossDebits += e.debitAmount ?? 0;
        return {
          date: (e.occurredAt ?? '').slice(0, 10),
          type: e.entryType,
          source: e.sourceReference || nameByUserId.get(e.userId) || '—',
          credit: php(e.creditAmount ?? 0),
          debit: php(e.debitAmount ?? 0),
          balance: php(e.balanceAfter ?? 0),
          status: e.status
        };
      });
      return {
        metrics: [
          { label: 'Ledger Entries', value: String(ledger.length) },
          { label: 'Gross Credits', value: php(grossCredits), tone: 'good' },
          { label: 'Gross Debits', value: php(grossDebits), tone: 'warning' }
        ],
        table: buildTable('Wallet Ledger', rows)
      };
    }

    return null;
  }

  // Income leaderboard (owner item 8). Ranks true members by lifetime total
  // income. Company/owner-tagged accounts are excluded (rename-stable flag);
  // office-role accounts are not members and never appear here.
  async getLeaderboard(limit = 100): Promise<{
    moneyMode: MoneyMode;
    entries: Array<{
      position: number;
      userId: string;
      username: string;
      fullName: string;
      packageTier: string;
      totalIncome: number;
      rankName: string;
      rankLevel: number;
    }>;
  }> {
    const members = await this.repo.listMembers();
    const COMPANY_USERNAMES = new Set(['yor01', 'yor0001', 'yor-company-root']);
    const eligible = members.filter(
      (member) =>
        member.accountStatus === 'active' &&
        !member.isCompanyAccount &&
        !member.isLeaderboardExcluded &&
        !COMPANY_USERNAMES.has(member.username.toLowerCase())
    );
    const ranked = await Promise.all(
      eligible.map(async (member) => {
        const ledger = await this.repo.listWalletLedgerEntriesForUser(member.userId);
        const totalIncome = ledger.reduce((sum, entry) => sum + (entry.creditAmount ?? 0), 0);
        const rank = rankForIncome(totalIncome);
        return {
          userId: member.userId,
          username: member.username,
          fullName: member.fullName,
          packageTier: member.packageTier,
          totalIncome,
          rankName: rank.rankName,
          rankLevel: rank.level
        };
      })
    );
    ranked.sort((a, b) => b.totalIncome - a.totalIncome || a.username.localeCompare(b.username));
    return {
      moneyMode: this.repo.getMoneyMode(),
      entries: ranked.slice(0, limit).map((entry, index) => ({ position: index + 1, ...entry }))
    };
  }

  // Unilevel bonus (owner sign-off item 8). A member's product repurchase credits
  // their SPONSOR bloodline up to 10 levels, amplified per level by
  // UNILEVEL_PERCENTAGES (L1 10% .. L10 1%). Sponsor tree only (network.sponsorUserId),
  // never binary placement. Each level posts at most once per repurchase event via a
  // deterministic process key. Recipient eligibility is intentionally NOT gated here —
  // every sponsor in the bloodline is credited per the owner ruling.
  // GATE-UNI-20260613. (200-PV monthly maintenance gating is recorded as a pending
  // decision and intentionally NOT enforced yet.)
  async applyRepurchaseUnilevel(input: {
    repurchasingUserId: string;
    repurchasePv: number;
    repurchaseRef: string;
    sourceLabel: string;
  }): Promise<{ levelsCredited: number; totalCredited: number }> {
    if (input.repurchasePv <= 0) {
      return { levelsCredited: 0, totalCredited: 0 };
    }
    let current = await this.repo.findNetworkAccountByUserId(input.repurchasingUserId);
    let level = 1;
    let totalCredited = 0;
    let levelsCredited = 0;
    const visited = new Set<string>([input.repurchasingUserId]);

    while (current?.sponsorUserId && level <= UNILEVEL_MAX_LEVELS) {
      const recipientUserId = current.sponsorUserId;
      if (visited.has(recipientUserId)) {
        break; // cycle guard
      }
      visited.add(recipientUserId);

      const percent = UNILEVEL_PERCENTAGES[level] ?? 0;
      if (percent > 0) {
        const credit = Number(((input.repurchasePv * percent) / 100).toFixed(2));
        if (credit > 0) {
          await this.postLedgerIfNeeded({
            userId: recipientUserId,
            entryType: 'unilevel',
            sourceReference: input.sourceLabel,
            creditAmount: credit,
            processId: `${input.repurchaseRef}:unilevel:L${level}:${recipientUserId}`,
            notes: `Unilevel L${level} (${percent}%) from ${input.sourceLabel}.`
          });
          totalCredited += credit;
          levelsCredited += 1;
        }
      }

      current = await this.repo.findNetworkAccountByUserId(recipientUserId);
      level += 1;
    }

    return { levelsCredited, totalCredited: Number(totalCredited.toFixed(2)) };
  }

  // Resolves a repurchase product from the catalog and credits the sponsor
  // bloodline. The repurchase ref makes each posting idempotent per event.
  async creditUnilevelForRepurchase(input: {
    repurchasingUserId: string;
    sku: string;
    repurchaseRef: string;
  }): Promise<{ levelsCredited: number; totalCredited: number; repurchasePv: number }> {
    const product = resolveRepurchaseProduct(input.sku);
    if (!product || !product.unilevelEligible) {
      return { levelsCredited: 0, totalCredited: 0, repurchasePv: 0 };
    }
    const member = await this.repo.findMemberByUserId(input.repurchasingUserId);
    const result = await this.applyRepurchaseUnilevel({
      repurchasingUserId: input.repurchasingUserId,
      repurchasePv: product.repurchasePv,
      repurchaseRef: input.repurchaseRef,
      sourceLabel: member?.username ? `${member.username} · ${product.label}` : product.label
    });
    return { ...result, repurchasePv: product.repurchasePv };
  }

  // GATE-UNI-MONTHLY-20260615: monthly unilevel batch (official Yor Unilevel Bonus plan).
  // Walks each earner's SPONSOR / bloodline tree — NOT the binary tree — up to 10 levels
  // and pays a percentage of each downline's repurchase PV accrued that calendar month
  // (L1 10%, L2 8%, L3 5%, L4 5%, L5 3%, L6 3%, L7 2%, L8 1%, L9 1%, L10 1%). An earner
  // qualifies only with >= 200 repurchase PV that month (maintenance — resets monthly,
  // a non-maintaining month earns nothing and carries nothing forward). Idempotent per
  // (earner, month, level, downline) via the wallet process key, so it is safe to re-run
  // and is intended to settle a closed calendar month. Default month = current.
  async reconcileMonthlyUnilevel(yearMonthPrefix?: string): Promise<{ credited: number; earners: number }> {
    return withMoneyLock('unilevel-monthly', async () => {
      const month = (yearMonthPrefix ?? this.repo.now()).slice(0, 7);
      const members = await this.repo.listMembers();
      const usernameByUserId = new Map(members.map((m) => [m.userId, m.username]));
      let credited = 0;
      let earners = 0;

      for (const earner of members) {
        const selfPv = await this.repo.sumRepurchasePvForUserInMonth(earner.userId, month);
        if (selfPv < UNILEVEL_MONTHLY_MAINTENANCE_PV) continue; // maintenance gate (resets monthly)

        let earnerEarned = false;
        const visited = new Set<string>([earner.userId]);
        let levelMembers = await this.repo.listDirectsBySponsor(earner.userId);

        for (let level = 1; level <= UNILEVEL_MAX_LEVELS && levelMembers.length > 0; level += 1) {
          const percent = UNILEVEL_PERCENTAGES[level] ?? 0;
          const next: ProductionNetworkAccount[] = [];

          for (const downline of levelMembers) {
            if (visited.has(downline.userId)) continue;
            visited.add(downline.userId);

            if (percent > 0) {
              const downlinePv = await this.repo.sumRepurchasePvForUserInMonth(downline.userId, month);
              if (downlinePv > 0) {
                const credit = Number(((downlinePv * percent) / 100).toFixed(2));
                const processId = `unilevel-monthly:${earner.userId}:${month}:L${level}:${downline.userId}`;
                if (credit > 0 && !(await this.repo.hasWalletLedgerProcess(processId))) {
                  await this.postLedgerIfNeeded({
                    userId: earner.userId,
                    entryType: 'unilevel',
                    sourceReference: usernameByUserId.get(downline.userId) ?? downline.userId,
                    creditAmount: credit,
                    processId,
                    notes: `Unilevel L${level} (${percent}%) of ${downlinePv} repurchase PV for ${month}.`
                  });
                  credited += credit;
                  earnerEarned = true;
                }
              }
            }

            const children = await this.repo.listDirectsBySponsor(downline.userId);
            next.push(...children);
          }

          levelMembers = next;
        }

        if (earnerEarned) earners += 1;
      }

      return { credited: Number(credited.toFixed(2)), earners };
    });
  }

  // GATE-LFR-20260613: Lifestyle Rewards production posting (owner sign-off item 9).
  // Credits the PURCHASING MEMBER's lifestyle wallet (not sponsor bloodline).
  // Caps enforced per package: daily and monthly. Both caps must have room.
  // Process key LFR:<memberUserId>:<repurchaseRef> makes re-credit a no-op.
  async applyRepurchaseLifestyle(input: {
    memberUserId: string;
    sku: string;
    repurchaseRef: string;
    memberPackageTier: PackageTier;
  }): Promise<{ credited: number; cappedOut: boolean; reason: string }> {
    if (input.memberPackageTier === 'Basic') {
      return { credited: 0, cappedOut: false, reason: 'Basic package is not eligible for Lifestyle Rewards.' };
    }
    const product = resolveRepurchaseProduct(input.sku);
    if (!product || !product.lifestyleEligible) {
      return { credited: 0, cappedOut: false, reason: 'Product is not lifestyle-eligible.' };
    }

    const nowIso = this.repo.now();
    const dayIso = nowIso.slice(0, 10);
    const yearMonthPrefix = nowIso.slice(0, 7);

    const tier = input.memberPackageTier as Exclude<PackageTier, 'Basic'>;
    const dailyCap = lifestyleDailyCapByPackage[tier];
    const monthlyCap = lifestyleMonthlyCapByPackage[tier];

    const [dailyUsed, monthlyUsed] = await Promise.all([
      this.repo.sumLifestyleCreditsForUserToday(input.memberUserId, dayIso),
      this.repo.sumLifestyleCreditsForUserThisMonth(input.memberUserId, yearMonthPrefix)
    ]);

    if (dailyUsed >= dailyCap) {
      return { credited: 0, cappedOut: true, reason: `Daily lifestyle cap (${dailyCap}) reached.` };
    }
    if (monthlyUsed >= monthlyCap) {
      return { credited: 0, cappedOut: true, reason: `Monthly lifestyle cap (${monthlyCap}) reached.` };
    }

    const credit = product.lifestyleRewardPer;
    await this.postLedgerIfNeeded({
      userId: input.memberUserId,
      walletType: 'lifestyle',
      entryType: 'lifestyle_rewards',
      sourceReference: product.sku,
      creditAmount: credit,
      processId: `LFR:${input.memberUserId}:${input.repurchaseRef}`,
      notes: `Lifestyle Rewards from ${product.label}.`
    });

    return { credited: credit, cappedOut: false, reason: 'Credited.' };
  }

  // Combined repurchase trigger: inserts repurchase record, credits unilevel
  // up the sponsor bloodline, and credits lifestyle to the purchasing member.
  async submitProductRepurchase(input: {
    memberUserId: string;
    activationCodeValue: string;
    sku: string;
    memberPackageTier: PackageTier;
  }): Promise<{
    repurchasePv: number;
    unilevel: { levelsCredited: number; totalCredited: number };
    lifestyle: { credited: number; cappedOut: boolean; reason: string };
  }> {
    const product = resolveRepurchaseProduct(input.sku);
    if (!product) {
      throw new Error(`Unknown repurchase product or code family: ${input.sku}`);
    }

    const repurchaseRef = `repurchase-${input.activationCodeValue}-${this.repo.now()}`;
    const repurchaseId = crypto.randomUUID();
    // GATE-PRODUCT-DP-20260615: unit_price = buyer's tier-based discounted price (DP),
    // NOT the SRP. The SRP is stored separately in srp_price for audit/retail-profit reference.
    const dpPrice = getProductDp(product, input.memberPackageTier);

    await this.repo.insertRepurchase({
      id: repurchaseId,
      processKey: repurchaseRef,
      userId: input.memberUserId,
      productCode: product.sku,
      productName: product.label,
      productType: product.codeFamily === 'YOR REFILL' ? 'refill' : product.codeFamily === 'YOR VISION' ? 'vision' : 'perfume',
      quantity: 1,
      unitPrice: dpPrice,
      srpPrice: product.srpPrice,
      totalAmount: dpPrice,
      pvEarned: product.repurchasePv,
      activationCode: input.activationCodeValue,
      transactionDate: this.repo.now(),
      createdAt: this.repo.now()
    });

    // Lifestyle Rewards post immediately (per-purchase). Unilevel is NOT credited inline:
    // GATE-UNI-MONTHLY-20260615 settles it as a monthly batch over the sponsor tree, gated
    // by each earner's 200-PV monthly maintenance. The repurchase recorded above is the
    // PV the batch reads. unilevel here is reported as deferred (0 credited now).
    const lifestyle = await this.applyRepurchaseLifestyle({
      memberUserId: input.memberUserId,
      sku: product.sku,
      repurchaseRef,
      memberPackageTier: input.memberPackageTier
    });

    return {
      repurchasePv: product.repurchasePv,
      unilevel: { levelsCredited: 0, totalCredited: 0 },
      lifestyle
    };
  }

  async getMemberProfileForUser(userId: string): Promise<ProductionMemberProfile | null> {
    return this.repo.findMemberByUserId(userId);
  }

  // Returns an assigned, released (available) maintenance or refill code owned by userId.
  async findOwnedMaintenanceCode(userId: string, codeValue: string): Promise<ProductionActivationCode | null> {
    const code = await this.repo.findActivationCodeByCode(codeValue);
    if (!code) return null;
    if (code.assignedUserId !== userId) return null;
    if (code.status !== 'available') return null;
    if (code.codeFamily !== 'YOR MAINTENANCE' && code.codeFamily !== 'YOR REFILL' && code.codeFamily !== 'YOR VISION') return null;
    return code;
  }

  // Marks the code used, then fires submitProductRepurchase (lifestyle + unilevel).
  async consumeMaintenanceCode(
    memberUserId: string,
    codeValue: string,
    sku: string,
    memberPackageTier: PackageTier
  ): Promise<{
    repurchasePv: number;
    unilevel: { levelsCredited: number; totalCredited: number };
    lifestyle: { credited: number; cappedOut: boolean; reason: string };
  }> {
    const code = await this.repo.findActivationCodeByCode(codeValue);
    if (!code || code.assignedUserId !== memberUserId || code.status !== 'available') {
      throw new Error('Code is not available for consumption.');
    }

    code.status = 'used';
    await this.repo.saveActivationCodes([code]);

    return this.submitProductRepurchase({
      memberUserId,
      activationCodeValue: codeValue,
      sku,
      memberPackageTier
    });
  }

  // Member unilevel earnings view: total + per-level breakdown + recent entries.
  async getMemberUnilevelData(userId: string): Promise<{
    moneyMode: MoneyMode;
    levelPercentages: number[];
    totalEarned: number;
    byLevel: Array<{ level: number; percent: number; amount: number; count: number }>;
    entries: Array<{ id: string; level: number; sourceReference: string; creditAmount: number; occurredAt: string; status: string }>;
  }> {
    const ledger = await this.repo.listWalletLedgerEntriesForUser(userId);
    const unilevelEntries = ledger.filter((entry) => entry.entryType === 'unilevel');

    const levelOf = (processId: string): number => {
      const match = /:unilevel:L(\d+):/.exec(processId);
      return match ? Number(match[1]) : 0;
    };

    const byLevel = Array.from({ length: UNILEVEL_MAX_LEVELS }, (_, index) => {
      const level = index + 1;
      const levelEntries = unilevelEntries.filter((entry) => levelOf(entry.processId) === level);
      return {
        level,
        percent: UNILEVEL_PERCENTAGES[level] ?? 0,
        amount: Number(levelEntries.reduce((sum, entry) => sum + entry.creditAmount, 0).toFixed(2)),
        count: levelEntries.length
      };
    });

    return {
      moneyMode: this.repo.getMoneyMode(),
      levelPercentages: [...UNILEVEL_PERCENTAGES].slice(1),
      totalEarned: Number(unilevelEntries.reduce((sum, entry) => sum + entry.creditAmount, 0).toFixed(2)),
      byLevel,
      entries: unilevelEntries.map((entry) => ({
        id: entry.id,
        level: levelOf(entry.processId),
        sourceReference: entry.sourceReference,
        creditAmount: entry.creditAmount,
        occurredAt: entry.occurredAt,
        status: entry.status
      }))
    };
  }

  async getMemberUnilevelDataByUsername(username: string) {
    const member = await this.repo.findMemberByUsername(username);
    if (!member) throw new Error(`Member '${username}' not found.`);
    return this.getMemberUnilevelData(member.userId);
  }

  async getMemberGetYorFiveData(userId: string): Promise<{
    moneyMode: MoneyMode;
    memberPackageTier: string;
    tierProgress: Array<{
      tier: string;
      claimValue: number;
      referralCount: number;
      completedGroups: number;
      remainingToNext: number;
      remainingDays: number;
      nextThreshold: number;
    }>;
    voidedGroups: Array<{
      tier: string;
      memberCount: number;
      startDate: string;
      deadline: string;
    }>;
    ledgerEntries: Array<{
      id: string;
      sourceReference: string;
      creditAmount: number;
      balanceAfter: number;
      status: string;
      occurredAt: string;
    }>;
    totalEarned: number;
    completedGroupsTotal: number;
  }> {
    const ELIGIBLE_TIERS = ['Classic', 'Standard', 'Business', 'VIP'] as const;
    const CLAIM_VALUES: Record<string, number> = {
      Classic: 5998,
      Standard: 25998,
      Business: 50998,
      VIP: 159998
    };

    const [member, allLedger] = await Promise.all([
      this.repo.findMemberByUserId(userId),
      this.repo.listWalletLedgerEntriesForUser(userId)
    ]);

    const nowIso = this.repo.now();
    const tierProgress: Array<{
      tier: string;
      claimValue: number;
      referralCount: number;
      completedGroups: number;
      remainingToNext: number;
      remainingDays: number;
      nextThreshold: number;
    }> = [];
    const voidedGroups: Array<{ tier: string; memberCount: number; startDate: string; deadline: string }> = [];

    // GATE-GYF-WINDOW-20260613: progress mirrors the credit engine — same-package
    // qualified directs grouped into 3-month windows. The open group shows the
    // remaining target and remaining days; expired partial groups are listed as
    // void history for monitoring and never credit.
    for (const tier of ELIGIBLE_TIERS) {
      const gyfDirects = await this.listQualifiedSamePackageGyfDirects(userId, tier);
      const groups = computeGetYorFiveGroups(gyfDirects, { asOf: nowIso });
      const completedGroups = groups.filter((g) => g.status === 'complete').length;
      const openGroup = groups.find((g) => g.status === 'open') ?? null;
      for (const voided of groups.filter((g) => g.status === 'void')) {
        voidedGroups.push({
          tier,
          memberCount: voided.memberUserIds.length,
          startDate: voided.startDate,
          deadline: voided.deadline
        });
      }
      tierProgress.push({
        tier,
        claimValue: CLAIM_VALUES[tier] ?? 0,
        referralCount: gyfDirects.length,
        completedGroups,
        remainingToNext: openGroup ? openGroup.remainingNeeded : 5,
        remainingDays: openGroup ? openGroup.remainingDays : 0,
        nextThreshold: (completedGroups + 1) * 5
      });
    }

    const gyfEntries = allLedger
      .filter((e) => e.entryType === 'get_five')
      .map((e) => ({
        id: e.id,
        sourceReference: e.sourceReference,
        creditAmount: e.creditAmount,
        balanceAfter: e.balanceAfter,
        status: e.status,
        occurredAt: e.occurredAt
      }));

    const totalEarned = gyfEntries.reduce((sum, e) => sum + e.creditAmount, 0);
    const completedGroupsTotal = tierProgress.reduce((sum, t) => sum + t.completedGroups, 0);

    return {
      moneyMode: this.repo.getMoneyMode(),
      memberPackageTier: member?.packageTier ?? 'Basic',
      tierProgress,
      voidedGroups,
      ledgerEntries: gyfEntries,
      totalEarned,
      completedGroupsTotal
    };
  }

  async isCompanyRootAccount(user: SessionUser): Promise<boolean> {
    const member = await this.repo.findMemberByUserId(user.id);
    const upper = member?.username?.toUpperCase() ?? '';
    return upper === 'YOR0001' || upper === 'YOR01';
  }

  async listAdminMembersForManagement(input: {
    query: string;
    page: number;
    pageSize: number;
    username?: string;
  }) {
    const pageSize = Math.min(Math.max(input.pageSize, 5), 100);
    const page = Math.max(input.page, 1);
    const query = input.query.trim();

    const [members, total] = await Promise.all([
      this.repo.listMembersFiltered(query, page, pageSize),
      this.repo.countMembersFiltered(query)
    ]);

    const userIds = members.map((m) => m.userId);
    const [networkMap, walletMap, directMap] = await Promise.all([
      this.repo.listNetworkAccountsByUserIds(userIds).then((rows) => new Map(rows.map((r) => [r.userId, r]))),
      this.repo.sumWalletMainBalancesByUserIds(userIds),
      this.repo.countDirectReferralsByUserIds(userIds)
    ]);

    const php = (v: number) =>
      `PHP ${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const totalPages = Math.ceil(total / pageSize);

    const rows = members.map((m) => {
      const net = networkMap.get(m.userId);
      const cdBalance = net ? Math.max(0, (net.cdAmount ?? 0) - (net.cdTotal ?? 0)) : 0;
      return {
        username: m.username,
        fullName: m.fullName,
        packageTier: m.packageTier,
        accountStatus: m.accountStatus as import('../../types/auth.js').MemberAccountStatus,
        stockist: (m.stockistLevel ?? 'none') !== 'none',
        sponsorCode: m.sponsorCode ?? '',
        directReferrals: directMap.get(m.userId) ?? 0,
        walletAvailable: php(walletMap.get(m.userId) ?? 0),
        cdBalance: php(cdBalance),
        lastActivity: net?.createdAt ?? m.createdAt,
        actions: ['view']
      };
    });

    const selectedUsername = input.username?.trim() || (query && members[0]?.username) || '';
    const selectedMember = selectedUsername
      ? members.find((m) => m.username.toUpperCase() === selectedUsername.toUpperCase()) ?? null
      : null;

    const selectedNet = selectedMember ? networkMap.get(selectedMember.userId) : null;
    const selectedCdBalance = selectedNet ? Math.max(0, (selectedNet.cdAmount ?? 0) - (selectedNet.cdTotal ?? 0)) : 0;

    return {
      moneyMode: this.repo.getMoneyMode(),
      query,
      page,
      pageSize,
      total,
      totalPages,
      rows,
      selectedMember: selectedMember
        ? {
            username: selectedMember.username,
            fullName: selectedMember.fullName,
            firstName: selectedMember.firstName,
            lastName: selectedMember.lastName,
            middleName: selectedMember.middleName,
            packageTier: selectedMember.packageTier,
            accountStatus: selectedMember.accountStatus as import('../../types/auth.js').MemberAccountStatus,
            stockist: (selectedMember.stockistLevel ?? 'none') !== 'none',
            referralCode: selectedMember.referralCode,
            sponsorCode: selectedMember.sponsorCode ?? '',
            email: '',
            phone: selectedMember.contactNumber ?? '',
            address: '',
            payoutOption: selectedMember.payoutMethod ?? '',
            payoutDetails: selectedMember.payoutDetails ?? '',
            directReferrals: directMap.get(selectedMember.userId) ?? 0,
            walletAvailable: php(walletMap.get(selectedMember.userId) ?? 0),
            walletPending: php(0),
            cdBalance: php(selectedCdBalance),
            lastActivity: selectedNet?.createdAt ?? selectedMember.createdAt,
            actions: ['view']
          }
        : null,
      actionNotes: [
        'Data is live from Supabase. Search by username, full name, or referral code.',
        'Profile editing is available via the individual member profile endpoints.'
      ]
    };
  }

  async buildMemberActivationCodeCenter(user: SessionUser) {
    const member = await this.requireMemberByUserId(user.id);
    const codes = await this.repo.listActivationCodesForUser(user.id);

    const inventory = codes
      .map((code) => mapCodeRow(code, member.username))
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));

    const groupedInventory = {
      registrationCodes: inventory.filter((item) => item.codeFamily === 'YOR CODES'),
      maintenanceCodes: inventory.filter((item) => item.codeFamily === 'YOR MAINTENANCE'),
      perfumeCodes: inventory.filter((item) => item.codeFamily === 'YOR PERFUME'),
      visionCodes: inventory.filter((item) => item.codeFamily === 'YOR VISION')
    };

    const recentEvents = await this.repo.listActivationCodeEventsForUser(user.id, 12);
    const counterpartyIds = Array.from(
      new Set(recentEvents.flatMap((event) => [event.toUserId, event.fromUserId]).filter((id): id is string => Boolean(id)))
    );
    const userById = new Map((await this.repo.findUsersByIds(counterpartyIds)).map((item) => [item.id, item]));

    const history = recentEvents.map((event) => ({
      id: event.id,
      code: event.code,
      action: event.action,
      counterparty:
        (event.toUserId ? userById.get(event.toUserId)?.displayName : null) ??
        (event.fromUserId ? userById.get(event.fromUserId)?.displayName : null) ??
        event.actorName,
      occurredAt: event.createdAt,
      status: event.action === 'consumed' ? 'used' : event.action
    }));

    // Transfer recipients resolve through search-first username lookup; the
    // full-member dropdown list is intentionally no longer shipped.
    const transferTargets: Array<{ username: string; fullName: string; packageTier: string }> = [];

    return {
      moneyMode: this.repo.getMoneyMode(),
      member: {
        username: member.username,
        packageTier: member.packageTier
      },
      inventory,
      groupedInventory,
      history,
      transferTargets,
      hints: [
        'Only released YOR CODES are registration-ready and copy-enabled.',
        'Maintenance, perfume, and vision codes stay visible in separate inventory groups and are excluded from registration.'
      ]
    };
  }

  async buildMemberDirectReferrals(userId: string) {
    const directs = await this.repo.listDirectsBySponsor(userId);
    const memberProfiles = await Promise.all(
      directs.map((n) => this.repo.findMemberByUserId(n.userId).catch(() => null))
    );
    return directs.map((network, i) => {
      const profile = memberProfiles[i];
      return {
        username: profile?.username ?? network.userId,
        name: profile?.fullName ?? '—',
        package: network.packageTier ?? '—',
        status: profile?.accountStatus ?? '—',
        placement: network.placementSide ?? '—'
      };
    });
  }

  // Salesmatch pairing traceability: each eligible pairing event in the member's
  // network, row by row — who triggered it, the gross PV on each leg (A / B), the
  // PV matched in that event, and the PV remaining on each leg afterward.
  async getMemberPairingEvents(userId: string, limit = 200) {
    const events = await this.repo.listPairingEventsForUser(userId, limit);
    return {
      moneyMode: this.repo.getMoneyMode(),
      events: events.map((e) => ({
        occurredAt: e.occurredAt,
        source: e.sourceUsername,
        leftVolume: e.leftVolume,
        rightVolume: e.rightVolume,
        matchedPoints: e.matchedPoints,
        leftRemaining: e.leftRemaining,
        rightRemaining: e.rightRemaining,
        salesmatchAmount: e.salesmatchAmount
      }))
    };
  }

  async buildAdminDashboardMetrics() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [members, networks, encashments] = await Promise.all([
      this.repo.listMembers(),
      this.repo.listNetworkAccounts(),
      this.repo.listEncashments({}, 10000)
    ]);

    const active = members.filter((m) => !m.isCompanyAccount);
    const weeklyActivations = active.filter((m) => m.createdAt >= weekAgo).length;
    const monthlyRegistrations = active.filter((m) => m.createdAt >= monthStart).length;
    const activeCdAccounts = networks.filter((n) => n.cdStatus > 0 || n.cdAmount > 0).length;
    const pendingEncashments = encashments.filter((e) => /pending|queued|requested|verification/i.test(e.status)).length;

    return [
      { label: 'Total Accounts', value: String(active.length), detail: 'Active member accounts', tone: 'good' as const },
      { label: 'Weekly Activations', value: String(weeklyActivations), detail: 'Last 7 days', tone: 'good' as const },
      { label: 'Monthly Registrations', value: String(monthlyRegistrations), detail: 'This calendar month', tone: 'good' as const },
      { label: 'Active CD Accounts', value: String(activeCdAccounts), detail: 'CD balance active', tone: 'good' as const },
      { label: 'Pending Encashments', value: String(pendingEncashments), detail: 'Awaiting processing', tone: 'warning' as const }
    ];
  }

  // GATE-GLOBAL-BONUS-3PCT-20260615: Originally named "global bonus" but reclassified
  // on 2026-06-15 to Lifestyle Rewards (lifestyle_rewards / lifestyle wallet) per
  // business rule clarification: 3% of company net product sales (unit_price on
  // repurchases not yet distributed) is split equally among all active members and
  // credited as Lifestyle Bonus — NOT Global Bonus. Called by the 10s drainer.
  // Net sales = SUM(unit_price) WHERE global_bonus_included = false. Idempotent via
  // global_bonus_included flag + processId on each ledger entry.
  async reconcileGlobalBonus(): Promise<{ distributed: number; perMember: number; memberCount: number }> {
    const pendingNetSales = await this.repo.sumPendingGlobalBonusNetSales();
    if (pendingNetSales <= 0) return { distributed: 0, perMember: 0, memberCount: 0 };

    const pool = Math.round(pendingNetSales * 0.03 * 100) / 100;
    if (pool <= 0) return { distributed: 0, perMember: 0, memberCount: 0 };

    const members = await this.repo.listMembers();
    const activeMembers = members.filter((m) => m.accountStatus === 'active');
    if (activeMembers.length === 0) return { distributed: 0, perMember: 0, memberCount: 0 };

    const perMember = Math.floor((pool / activeMembers.length) * 100) / 100;
    if (perMember <= 0) return { distributed: 0, perMember: 0, memberCount: 0 };

    // Mark the repurchases first (before posting) so a crash mid-posting doesn't
    // double-count on the next drainer tick. Ledger entries are idempotent via processId.
    await this.repo.markRepurchasesGlobalBonusIncluded();

    const now = this.repo.now();
    const processBase = `lifestyle-pool:${now.slice(0, 19)}`;
    await Promise.all(
      activeMembers.map((member) =>
        this.postLedgerIfNeeded({
          userId: member.userId,
          walletType: 'lifestyle',
          entryType: 'lifestyle_rewards',
          sourceReference: 'lifestyle-pool',
          creditAmount: perMember,
          processId: `${processBase}:${member.userId}`,
          notes: `Lifestyle Bonus — 3% of PHP ${pendingNetSales.toFixed(2)} net product sales ÷ ${activeMembers.length} members.`
        })
      )
    );

    return { distributed: pool, perMember, memberCount: activeMembers.length };
  }

  async listCashiers() {
    const users = await this.repo.listUsersByRole('cashier');
    return users
      .filter((u) => u.status === 'active')
      .map((u) => ({ id: u.id, displayName: u.displayName, email: u.email }));
  }

  async buildAdminActivationCodeCenter(actor?: { id: string; role: string }) {
    const [codes, members, cashierUsers] = await Promise.all([
      this.repo.listActivationCodes(),
      this.repo.listMembers(),
      this.repo.listUsersByRole('cashier')
    ]);
    const memberByUserId = new Map(members.map((item) => [item.userId, item]));
    // cashier email IS their login username (e.g. "yorcashier")
    const cashierByUserId = new Map(cashierUsers.map((u) => [u.id, u]));
    // GATE-CASHIER-CODES-20260613: cashier sees all codes whose cashierUserId matches
    // their account — this column is set once at generation and never changed, so the
    // cashier sees their full history: unreleased, transferred-pending, released, and
    // used codes alike. Admin/bod/superadmin see all codes.
    const visibleCodes = actor?.role === 'cashier'
      ? codes.filter((code) => code.cashierUserId === actor.id)
      : codes;
    const inventory = visibleCodes
      .map((code) => {
        const cashier = code.assignedUserId ? cashierByUserId.get(code.assignedUserId) : undefined;
        const assigned = cashier
          ? cashier.email
          : code.assignedUserId
            ? memberByUserId.get(code.assignedUserId)?.username ?? 'Unassigned'
            : 'Unassigned';
        const lastActivityAt = (
          [code.usedAt, code.settledAt, code.releasedAt, code.transferredAt, code.generatedAt]
            .filter((t): t is string => Boolean(t))
            .sort()
            .at(-1)
        ) ?? code.generatedAt;
        return {
          ...mapCodeRow(code, assigned === 'Unassigned' ? null : assigned),
          remarks: code.remarks,
          releasable: code.status === 'unreleased',
          lastActivityAt
        };
      })
      .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));

    return {
      moneyMode: this.repo.getMoneyMode(),
      inventory,
      groupedInventory: {
        registrationCodes: inventory.filter((item) => item.codeFamily === 'YOR CODES'),
        maintenanceCodes: inventory.filter((item) => item.codeFamily === 'YOR MAINTENANCE'),
        perfumeCodes: inventory.filter((item) => item.codeFamily === 'YOR PERFUME'),
        visionCodes: inventory.filter((item) => item.codeFamily === 'YOR VISION')
      },
      metrics: {
        totalCodes: inventory.length,
        availableCodes: inventory.filter((item) => item.status === 'available').length,
        unreleasedCodes: inventory.filter((item) => item.status === 'unreleased').length,
        usedCodes: inventory.filter((item) => item.status === 'used').length,
        lostCodes: 0,
        paidCodes: inventory.filter((item) => item.paymentStatus === 'paid' || item.paymentStatus === 'externally-paid').length
      },
      auditTrail: (await this.repo.listRecentActivationCodeEvents(20)).map((event) => ({
        actor: event.actorName,
        action: event.action,
        target: event.code,
        occurredAt: event.createdAt
      })),
      // Transfer recipients resolve through search-first username lookup.
      transferTargets: [] as Array<{ username: string; fullName: string; packageTier: string }>,
      hints: [
        'Generate, release, and transfer always append activation-code event history.',
        'Registration eligibility is controlled by the backend code-family and lifecycle flags, not by frontend labels.'
      ]
    };
  }

  // Returns all members with their stockist designation for the admin global bonus view.
  async buildGlobalBonusData() {
    const members = await this.repo.listMembers();
    const stockistLevelLabel: Record<StockistLevel, string> = {
      none: '—',
      mobile_kiosk: 'Mobile Kiosk',
      city_center: 'City Center',
      mega_center: 'Mega Center'
    };
    const entries = members
      .filter((m) => !m.isCompanyAccount)
      .map((m) => ({
        userId: m.userId,
        username: m.username,
        fullName: m.fullName,
        packageTier: m.packageTier,
        stockistLevel: m.stockistLevel ?? 'none',
        stockistLabel: stockistLevelLabel[m.stockistLevel ?? 'none'],
        portions: m.stockistLevel && m.stockistLevel !== 'none' ? 1 : 0
      }));
    const totalPortions = entries.reduce((sum, e) => sum + e.portions, 0);
    return {
      moneyMode: this.repo.getMoneyMode(),
      entries,
      totalPortions,
      notes: [
        'Each MOBILE KIOSK, CITY CENTER, and MEGA CENTER stockist qualifies for 1 portion of the annual global bonus pool.',
        'Portions are counted at distribution time — tag changes take effect in the next distribution cycle.'
      ]
    };
  }

  async setMemberStockistLevel(targetUsername: string, level: StockistLevel, actor: { role: string }) {
    if (!['admin', 'superadmin', 'bod'].includes(actor.role)) {
      throw new Error('Only admin, BOD, or superadmin can assign stockist levels.');
    }
    const member = await this.requireMemberByUsername(targetUsername);
    await this.repo.setStockistLevel(member.userId, level);
    return { username: member.username, stockistLevel: level };
  }

  private async findNextOpenBinarySlot(
    startUserId: string,
    maxDepth = 8
  ): Promise<{ parentUserId: string; placementSide: PlacementSide } | null> {
    let queue = [startUserId];
    for (let depth = 0; depth < maxDepth; depth++) {
      if (queue.length === 0) return null;
      const children = await this.repo.findPlacementChildrenBatch(queue);
      for (const parentUserId of queue) {
        const hasLeft = children.some(
          (c) => c.placementParentUserId === parentUserId && c.placementSide === 'left'
        );
        const hasRight = children.some(
          (c) => c.placementParentUserId === parentUserId && c.placementSide === 'right'
        );
        if (!hasLeft) return { parentUserId, placementSide: 'left' };
        if (!hasRight) return { parentUserId, placementSide: 'right' };
      }
      queue = children.map((c) => c.userId);
    }
    return null;
  }

  async buildMemberRegistrationReadiness(user: SessionUser) {
    const member = await this.requireMemberByUserId(user.id);
    const TIER_RANK: Record<string, number> = { Basic: 1, Classic: 2, Standard: 3, Business: 4, VIP: 5 };
    const allAvailableCodes = (await this.repo.listActivationCodesForUser(user.id)).filter(
      (code) => code.status === 'available'
    );
    const codes = allAvailableCodes.filter((code) => code.registrationEligible);
    const selfUpgradeCodes = allAvailableCodes.filter(
      (code) =>
        code.codeFamily === 'YOR CODES' &&
        (TIER_RANK[code.packageTier] ?? 0) > (TIER_RANK[member.packageTier] ?? 0)
    );
    const reservations = await this.repo.listPlacementReservationsForSponsor(user.id);
    const activeReservation = reservations
      .filter((item) => item.status === 'active' && item.expiresAt > this.repo.now())
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;

    const sponsorLeft = await this.repo.findPlacementChild(user.id, 'left');
    const sponsorRight = await this.repo.findPlacementChild(user.id, 'right');

    let fallbackRecommendation: { placementUsername: string; placementSide: string; note: string };
    if (!sponsorLeft) {
      fallbackRecommendation = {
        placementUsername: member.username,
        placementSide: 'left',
        note: 'Left slot under the sponsor root is open and ready for reservation.'
      };
    } else if (!sponsorRight) {
      fallbackRecommendation = {
        placementUsername: member.username,
        placementSide: 'right',
        note: 'Right slot under the sponsor root is open and ready for reservation.'
      };
    } else {
      const nextOpen = await this.findNextOpenBinarySlot(user.id);
      if (nextOpen) {
        const nextParent = await this.requireMemberByUserId(nextOpen.parentUserId);
        fallbackRecommendation = {
          placementUsername: nextParent.username,
          placementSide: nextOpen.placementSide,
          note: `Next open slot found at ${nextOpen.placementSide} under ${nextParent.username}.`
        };
      } else {
        fallbackRecommendation = {
          placementUsername: member.username,
          placementSide: 'left',
          note: 'Choose an open slot from the genealogy page when the sponsor root is already filled on both sides.'
        };
      }
    }

    return {
      moneyMode: this.repo.getMoneyMode(),
      sponsor: {
        username: member.username,
        fullName: member.fullName,
        referralCode: member.referralCode
      },
      placementPolicy: {
        mode: 'slot-reservation',
        recommendation: activeReservation
          ? {
              placementUsername: activeReservation.placementParentUsername,
              placementSide: activeReservation.placementSide,
              note: 'Active slot reservation is already attached to the share link below.'
            }
          : fallbackRecommendation
      },
      activeReservation: activeReservation
        ? {
            id: activeReservation.id,
            placementUsername: activeReservation.placementParentUsername,
            placementSide: activeReservation.placementSide,
            shareToken: activeReservation.shareToken,
            expiresAt: activeReservation.expiresAt,
            shareLink: this.buildShareLink(member.referralCode, activeReservation.shareToken)
          }
        : null,
      referralLink: activeReservation
        ? this.buildShareLink(member.referralCode, activeReservation.shareToken)
        : '',
      availableCodes: codes.map((code) => mapCodeRow(code, member.username)),
      currentPackageTier: member.packageTier,
      selfUpgradeCodes: selfUpgradeCodes.map((code) => mapCodeRow(code, member.username)),
      checklist: [
        'Choose the final placement slot before sharing the referral link.',
        'Share one released YOR CODE together with the placement-aware registration link.',
        'Public registration blocks when the slot token is missing, expired, or already occupied.'
      ]
    };
  }

  async createPlacementReservation(
    user: SessionUser,
    input: { placementParentUsername: string; placementSide: PlacementSide; expiresInHours?: number }
  ) {
    const sponsor = await this.requireMemberByUserId(user.id);
    const placementAddress = parsePlacementParentAddress(input.placementParentUsername);
    const placementParent = await this.requireMemberByUsername(placementAddress.memberUsername);
    const parentNetwork = await this.repo.findNetworkAccountByUserId(placementParent.userId);
    if (!parentNetwork || parentNetwork.registrationStatus !== 'active') {
      throw new Error('Placement parent is not available.');
    }
    const occupied = await this.repo.findPlacementChild(placementParent.userId, input.placementSide, placementAddress.shadowSide);
    if (occupied) {
      throw new Error(`Placement side ${input.placementSide.toUpperCase()} is already occupied under ${placementAddress.label}.`);
    }

    const reservation: ProductionPlacementReservation = {
      id: crypto.randomUUID(),
      sponsorUserId: sponsor.userId,
      referralCode: sponsor.referralCode,
      placementParentUserId: placementParent.userId,
      placementParentUsername: placementAddress.label,
      placementParentShadowSide: placementAddress.shadowSide,
      placementSide: input.placementSide,
      shareToken: randomToken(),
      status: 'active',
      expiresAt: new Date(Date.now() + (input.expiresInHours ?? 24) * 60 * 60 * 1000).toISOString(),
      createdAt: this.repo.now()
    };

    await this.repo.savePlacementReservation(reservation);

    return {
      moneyMode: this.repo.getMoneyMode(),
      status: 'completed' as const,
      reservation: {
        id: reservation.id,
        placementUsername: reservation.placementParentUsername,
        placementSide: reservation.placementSide,
        expiresAt: reservation.expiresAt,
        shareToken: reservation.shareToken,
        shareLink: this.buildShareLink(sponsor.referralCode, reservation.shareToken)
      }
    };
  }

  async updateMemberPayoutSettings(user: SessionUser, payload: { payoutOption: string; payoutDetails: string }) {
    const payoutMethod = payload.payoutOption.trim();
    if (!payoutMethod) {
      throw new Error('Select a valid payout method.');
    }
    const member = await this.requireMemberByUserId(user.id);
    member.payoutMethod = payoutMethod;
    member.payoutDetails = payload.payoutDetails.trim();
    await this.repo.saveMemberProfile(member);
    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'member-update-payout',
      status: 'completed' as const,
      reason: 'Payout settings updated.',
      detail: `Payout method set to ${payoutMethod}.`
    };
  }

  // Admin name change — persists the full name (and split parts) on the member
  // profile and keeps the app_users display name in sync.
  async changeMemberFullName(_actor: SessionUser, username: string, fullName: string) {
    const trimmed = fullName.trim();
    if (!trimmed) {
      throw new Error('Enter a full name.');
    }
    const member = await this.requireMemberByUsername(username);
    const parts = splitFullName(trimmed);
    member.fullName = trimmed;
    member.firstName = parts.firstName;
    member.lastName = parts.lastName;
    member.middleName = parts.middleName;
    member.normalizedFullName = normalizeFullName(trimmed);
    await this.repo.saveMemberProfile(member);

    const user = await this.repo.findUserById(member.userId);
    if (user) {
      user.displayName = trimmed;
      await this.repo.saveUser(user);
    }

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'admin-change-member-name',
      status: 'completed' as const,
      reason: `Updated name for ${member.username}.`,
      detail: `Full name set to ${trimmed}.`
    };
  }

  // Admin full-profile update — name parts, contact, payout, login email, password,
  // and an optional username change (uniqueness-checked). Address is not yet tracked
  // on the production profile shape and is left untouched here.
  async updateMemberProfileByUsername(
    _actor: SessionUser,
    payload: {
      username: string;
      firstName?: string;
      lastName?: string;
      middleName?: string;
      password?: string;
      payoutOption?: string;
      payoutDetails?: string;
      contactNumber?: string;
      email?: string;
      newUsername?: string;
    }
  ) {
    const member = await this.requireMemberByUsername(payload.username);

    const firstName = payload.firstName?.trim() || member.firstName;
    const lastName = payload.lastName?.trim() || member.lastName;
    const middleName = (payload.middleName ?? member.middleName).trim();
    member.firstName = firstName;
    member.lastName = lastName;
    member.middleName = middleName;
    const composed = [firstName, middleName, lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (composed) {
      member.fullName = composed;
      member.normalizedFullName = normalizeFullName(composed);
    }
    if (typeof payload.contactNumber === 'string' && payload.contactNumber.trim()) {
      member.contactNumber = payload.contactNumber.trim();
    }
    if (typeof payload.payoutOption === 'string' && payload.payoutOption.trim()) {
      member.payoutMethod = payload.payoutOption.trim();
    }
    if (typeof payload.payoutDetails === 'string' && payload.payoutDetails.trim()) {
      member.payoutDetails = payload.payoutDetails.trim();
    }

    const oldUsername = member.username;
    const nextUsername = payload.newUsername?.trim();
    const usernameChanged = Boolean(nextUsername && nextUsername !== member.username);
    if (usernameChanged) {
      const conflict = await this.repo.findUserByUsername(nextUsername!);
      if (conflict) {
        throw new Error('Username is already taken.');
      }
      member.username = nextUsername!;
      revokeUserSessions(member.userId);
    }

    await this.repo.saveMemberProfile(member);

    const user = await this.repo.findUserById(member.userId);
    if (user) {
      if (composed) {
        user.displayName = composed;
      }
      if (typeof payload.email === 'string' && payload.email.trim()) {
        user.email = payload.email.trim();
      } else if (usernameChanged && user.email.trim().toLowerCase() === `${oldUsername.toLowerCase()}@yor.local`) {
        // Migrate the auto-generated login email so the OLD username can no longer
        // resolve this account via the email-prefix login path (findAppUserByUsername
        // step 3). Only the system-generated `<username>@yor.local` is rewritten — a
        // member's real custom email is never touched.
        user.email = `${nextUsername!.toLowerCase()}@yor.local`;
      }
      if (typeof payload.password === 'string' && payload.password.trim()) {
        const bundle = createPasswordHashSync(payload.password);
        user.passwordHash = bundle.hash;
        user.passwordSalt = bundle.salt;
      }
      await this.repo.saveUser(user);
    }

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'admin-update-member-profile',
      status: 'completed' as const,
      reason: `Updated profile for ${member.username}.`,
      detail: nextUsername && nextUsername !== payload.username ? `Username changed to ${member.username}.` : 'Profile details saved.'
    };
  }

  async previewRegistration(viewer: SessionUser | null, input: ProductionRegistrationInput): Promise<ProductionRegistrationPreview> {
    const origin: RegistrationOrigin = input.origin === 'genealogy-slot' ? 'genealogy-slot' : 'referral-link';
    const sponsorResolution = await this.resolveSponsor(viewer, input, origin);
    const sponsor = sponsorResolution.member;
    const sponsorCodes = sponsor
      ? (await this.repo.listActivationCodesForUser(sponsor.userId)).filter((code) => code.registrationEligible && code.status === 'available')
      : [];

    const sponsorCodeRows = sponsorCodes.map((code) => mapCodeRow(code, sponsor?.username ?? null));
    const normalizedCode = (input.activationCode ?? '').trim().toUpperCase();
    const matchingCodeRecord = sponsorCodes.find((code) => code.code.toUpperCase() === normalizedCode) ?? null;
    const placement = await this.resolvePlacement(viewer, input, origin, sponsor);
    const fullName = (input.fullName ?? '').trim();
    const normalizedFullName = fullName ? normalizeFullName(fullName) : '';
    const duplicatePeople = normalizedFullName ? await this.repo.countMembersByNormalizedFullName(normalizedFullName) : 0;
    const usernameConflict = input.username?.trim() ? await this.repo.findUserByUsername(input.username.trim()) : null;

    const issues = [
      sponsor ? null : origin === 'genealogy-slot' ? 'Sponsor session was not resolved for genealogy encoding.' : 'Sponsor referral path was not resolved.',
      sponsorCodes.length > 0 ? null : 'Sponsor has no released registration code available.',
      normalizedCode ? null : 'Activation code is required.',
      matchingCodeRecord ? null : normalizedCode ? 'Activation code is not available for this sponsor path.' : null,
      placement.context ? null : placement.issue,
      fullName ? null : 'Full name is required.',
      duplicatePeople >= 3 ? 'This verified name already reached the three-account limit.' : null,
      usernameConflict ? 'Username is already taken.' : null
    ].filter((item): item is string => Boolean(item));

    return {
      moneyMode: this.repo.getMoneyMode(),
      origin,
      canProceed: issues.length === 0,
      sponsorResolutionMode: sponsorResolution.mode,
      sponsor: sponsor
        ? {
            username: sponsor.username,
            fullName: sponsor.fullName,
            referralCode: sponsor.referralCode,
            packageTier: sponsor.packageTier
          }
        : null,
      selectedPackage: matchingCodeRecord ? getPackageConfig(matchingCodeRecord.packageTier).packageTier : null,
      placementSide: placement.context?.placementSide ?? null,
      resolvedAccountType: matchingCodeRecord?.accountType ?? null,
      placementReservationId: placement.reservation?.id ?? input.placementReservationId ?? null,
      placementToken: placement.reservation?.shareToken ?? input.placementToken ?? null,
      matchingCode: matchingCodeRecord ? mapCodeRow(matchingCodeRecord, sponsor?.username ?? null) : null,
      placement: placement.context,
      availableCodes: sponsorCodeRows,
      issues,
      checklist: [
        'Use only sponsor-owned, released, and unused YOR CODES.',
        'Package tier and account type are locked from the consumed activation code.',
        origin === 'referral-link'
          ? 'Placement is auto-balanced to the lighter side under your sponsor. You may share a token link to override placement.'
          : 'The clicked genealogy slot stays locked and is revalidated immediately before final save.'
      ]
    };
  }

  async submitRegistration(viewer: SessionUser | null, input: ProductionRegistrationInput): Promise<ProductionRegistrationSubmitResponse> {
    const preview = await this.previewRegistration(viewer, input);
    if (!preview.canProceed || !preview.sponsor || !preview.matchingCode || !preview.placement) {
      throw new Error(preview.issues.join(' '));
    }

    const previewCode = preview.matchingCode;
    const sponsor = await this.requireMemberByUsername(preview.sponsor.username);
    const placementParent = await this.requireMemberByUsername(preview.placement.placementUsername);
    const selectedPackageTier = getPackageConfig(previewCode.packageTier).packageTier;
    const occupied = await this.repo.findPlacementChild(
      placementParent.userId,
      preview.placement.placementSide,
      preview.placement.placementParentShadowSide ?? null
    );
    if (occupied) {
      const placementLabel = preview.placement.placementParentShadowSide
        ? `${placementParent.username}-${preview.placement.placementParentShadowSide === 'left' ? 'L' : 'R'}`
        : placementParent.username;
      throw new Error(`Placement side ${preview.placement.placementSide.toUpperCase()} is already occupied under ${placementLabel}.`);
    }

    const [matchingCode] = (await this.repo.listActivationCodesForUser(sponsor.userId)).filter((code) => code.code === previewCode.code);
    if (!matchingCode || matchingCode.status !== 'available' || !matchingCode.registrationEligible) {
      throw new Error('Activation code is no longer available for this sponsor path.');
    }

    const finalUsername = (input.username ?? '').trim() || this.buildUsername(await this.repo.nextMemberSequence());
    if (await this.repo.findUserByUsername(finalUsername)) {
      throw new Error('Username is already taken.');
    }

    const loginEmail = (input.email ?? '').trim().toLowerCase() || `${finalUsername.toLowerCase()}@yor.local`;
    if (await this.repo.findUserByEmail(loginEmail)) {
      throw new Error('Email is already registered.');
    }

    const fullName = (input.fullName ?? '').trim();
    if ((await this.repo.countMembersByNormalizedFullName(normalizeFullName(fullName))) >= 3) {
      throw new Error('This verified name already reached the three-account limit.');
    }

    const passwordBundle = createPasswordHashSync(input.password ?? '');
    const createdAt = this.repo.now();
    const referralCode = await this.generateUniqueReferralCode();
    const userId = crypto.randomUUID();
    const parsedName = splitFullName(fullName);
    const user: ProductionAppUser = {
      id: userId,
      email: loginEmail,
      displayName: fullName,
      role: 'member',
      status: 'active',
      passwordHash: passwordBundle.hash,
      passwordSalt: passwordBundle.salt,
      createdAt
    };
    const profile: ProductionMemberProfile = {
      userId,
      username: finalUsername,
      referralCode,
      sponsorCode: sponsor.referralCode,
      packageTier: selectedPackageTier,
      accountStatus: 'active',
      fullName,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      middleName: parsedName.middleName,
      contactNumber: (input.phone ?? '').trim(),
      normalizedFullName: normalizeFullName(fullName),
      createdAt,
      payoutMethod: (input.payoutOption ?? '').trim() || undefined,
      payoutDetails: (input.payoutDetails ?? '').trim() || undefined
    };
    // CD obligation tracking (owner ruling 2026-06-12): any non-FS unpaid entry
    // carries a Commission Deduction obligation equal to the package price,
    // recovered at 100% of encashment net until cleared. FS carries no obligation
    // because FS never gains earning rights (it is not a debt state).
    const packagePrice = getPackageConfig(selectedPackageTier).price;
    const entryUnpaid = matchingCode.paymentStatus === 'unpaid';
    const carriesCdObligation = matchingCode.accountType !== 'FS' && entryUnpaid;
    const settledCdEntry = matchingCode.accountType === 'CD' && !entryUnpaid;
    const network: ProductionNetworkAccount = {
      userId,
      sponsorUserId: sponsor.userId,
      directReferrerUserId: sponsor.userId,
      placementParentUserId: placementParent.userId,
      placementParentShadowSide: preview.placement.placementParentShadowSide ?? null,
      placementSide: preview.placement.placementSide,
      currentAccountTypeCode: matchingCode.accountType === 'FS' ? 2 : 1,
      currentAccountType: matchingCode.accountType,
      packageTier: selectedPackageTier,
      activationCode: matchingCode.code,
      registrationStatus: 'active',
      leftPoints: 0,
      rightPoints: 0,
      cdStatus: carriesCdObligation ? CD_STATUS_OUTSTANDING : settledCdEntry ? CD_STATUS_SETTLED : CD_STATUS_NONE,
      cdAmount: carriesCdObligation || settledCdEntry ? packagePrice : 0,
      cdTotal: settledCdEntry ? packagePrice : 0,
      createdAt
    };

    await this.repo.saveUser(user);
    await this.repo.saveMemberProfile(profile);
    await this.repo.saveNetworkAccount(network);

    matchingCode.status = 'used';
    matchingCode.usedAt = createdAt;
    matchingCode.usedByUserId = userId;
    matchingCode.assignedUserId = userId;
    await this.repo.saveActivationCodes([matchingCode]);
    await this.repo.appendActivationCodeEvents([
      {
        id: crypto.randomUUID(),
        activationCodeId: matchingCode.id,
        code: matchingCode.code,
        action: 'consumed',
        actorUserId: userId,
        actorName: fullName,
        fromUserId: sponsor.userId,
        toUserId: userId,
        notes: `Consumed by ${finalUsername} during registration.`,
        createdAt
      }
    ]);

    // GATE-BIN-PV-PDCD-20260612: owner ruling — PD counts immediately, fully
    // settled CD accounts count after recovery, and FS never generates Direct
    // Referral or binary PV even when paid. Deferred DR/PV applies only to CD
    // entries, and the settlement trigger (settleActivationCode) reuses these
    // exact process keys so each posting happens at most once.
    // Reverts GATE-BIN-PV-FS-2026-06-12, which wrongly allowed paid FS entries.
    const entryState = this.codeEntryState(matchingCode, network);
    const drEligible = countsForDirectReferralSource(entryState);
    const pvEligible = countsForPairingSource(entryState);

    if (drEligible) {
      await this.postRegistrationDirectAndGetFive({
        sponsorUserId: sponsor.userId,
        newMemberUserId: userId,
        newMemberUsername: finalUsername,
        code: matchingCode,
        packageTier: selectedPackageTier
      });
    }

    let queuedProcessIds: string[] = [];
    if (pvEligible) {
      const queueItem = this.buildPlacementSalesQueueItem({
        newMemberUserId: userId,
        newMemberUsername: finalUsername,
        code: matchingCode,
        placementParentUserId: placementParent.userId,
        placementParentShadowSide: preview.placement.placementParentShadowSide ?? null,
        placementSide: preview.placement.placementSide,
        createdAt
      });
      await this.repo.enqueueCompensation(queueItem);
      queuedProcessIds = [queueItem.processId];
    }

    if (preview.placementReservationId) {
      const reservation = await this.repo.findPlacementReservationById(preview.placementReservationId);
      if (reservation && reservation.status === 'active') {
        reservation.status = 'consumed';
        await this.repo.savePlacementReservation(reservation);
      }
    }

    // GATE-SMB-INSTANT-20260615: PV propagation, SMB pairing, and binary cycle are
    // drained immediately AFTER the registration response (fire-and-forget in the
    // route handler), not synchronously here — blocking the request on the full
    // tree walk risks request timeouts. The route's post-response drain + the 10s
    // background drainer credit within ~1s of encode. Same calculation, just not
    // inside the committing request.

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'production-registration-submit',
      status: 'completed',
      reason: 'Production registration committed and downstream compensation queued.',
      detail:
        drEligible && pvEligible
          ? `Created ${finalUsername}, consumed ${matchingCode.code}, posted direct referral, and queued placement-based compensation workers.`
          : matchingCode.accountType === 'FS'
            ? `Created ${finalUsername}, consumed ${matchingCode.code}. FS entries never generate direct referral or binary PV.`
            : `Created ${finalUsername}, consumed ${matchingCode.code}. Direct referral and binary PV are deferred until the CD entry is settled.`,
      placementReservationId: preview.placementReservationId,
      queuedCompensation: queuedProcessIds,
      createdMember: {
        username: finalUsername,
        fullName,
        email: loginEmail,
        referralCode,
        sponsorUsername: sponsor.username,
        packageTier: selectedPackageTier,
        accountType: matchingCode.accountType,
        loginEmail
      }
    };
  }

  async processCompensationQueue(limit = 50) {
    // Single-flight: registration submits process the queue inline and the
    // admin route can trigger it too — concurrent runs would double-accumulate
    // leg volume. The lock serializes them in this process.
    return withMoneyLock('compensation-queue', () => this.processCompensationQueueLocked(limit));
  }

  // Reconciles shadow earnings (each shadow's own sub-legs pair → owner earns salesmatch,
  // transferred to main wallet tagged left/right_shadow_earning). Idempotent SQL function;
  // notifies any owner who was just paid so their dashboard ticks live.
  async reconcileShadowEarnings() {
    const paid = await withMoneyLock('shadow-reconcile', () => this.repo.reconcileShadowEarnings());
    for (const p of paid) {
      notifyUser(p.userId, { type: 'income', entryType: p.entryType, creditAmount: p.amount });
    }
    return paid;
  }

  // Scans every user whose accumulated leg volume has unmatched balance
  // (min(leftSales, rightSales) > matchedSales) and credits the delta.
  // Safe to run frequently — postLedgerIfNeeded is idempotent via processId.
  // Called by the 10s drainer and on-demand via POST /api/member/trigger-compensation.
  async reconcileSalesmatchAllEligible(): Promise<{ credited: number; users: string[] }> {
    return withMoneyLock('salesmatch-reconcile', async () => {
      const userIds = await this.repo.listUsersWithPendingSalesmatch();
      let credited = 0;
      const paid: string[] = [];
      for (const userId of userIds) {
        const amount = await this.reconcileSalesmatchForUserLocked(userId);
        if (amount > 0) {
          credited += amount;
          paid.push(userId);
          notifyUser(userId, { type: 'income', entryType: 'salesmatch', creditAmount: amount });
        }
      }
      return { credited, users: paid };
    });
  }

  async reconcileSalesmatchForUser(userId: string): Promise<number> {
    return withMoneyLock('salesmatch-reconcile', () => this.reconcileSalesmatchForUserLocked(userId));
  }

  // Core per-user salesmatch reconciliation. Must be called inside a money lock.
  // Uses processId keyed on (userId, matchedSales) so multiple calls for the same
  // matched amount are no-ops. A higher matched amount produces a new processId
  // and posts the delta — never duplicates what was already paid.
  private async reconcileSalesmatchForUserLocked(userId: string): Promise<number> {
    const [balance, network, profile] = await Promise.all([
      this.repo.getSalesmatchBalance(userId),
      this.repo.findNetworkAccountByUserId(userId),
      this.repo.findMemberByUserId(userId)
    ]);

    if (!balance || !network || !profile) return 0;

    // GATE-SMB-FS-RECIPIENT-20260615: a member earns salesmatch on their own matched
    // volume regardless of their OWN account type (FS/PD/CD). countsForPairingSource
    // (FS / CD-unpaid exclusion) gates whether a NEW member's PV feeds uplines as a
    // SOURCE — enforced at registration via pvEligible before any leg accumulates.
    // It must NOT gate whether the owner may RECEIVE pairing income. Per BIN-01,
    // eligibility is "qualified source volume", not recipient account type. Previously
    // VIP/Business owners (mapped to FS) accumulated both legs but never paired.

    const newMatchedSales = Math.min(balance.leftSales, balance.rightSales);
    const newMatchedPoints = Math.min(balance.leftPoints, balance.rightPoints);
    const salesmatchDelta = Math.max(0, Number((newMatchedSales - balance.matchedSales).toFixed(2)));
    if (salesmatchDelta <= 0) return 0;

    const pointsDelta = Math.max(0, newMatchedPoints - balance.matchedPoints);
    balance.matchedSales = newMatchedSales;
    balance.matchedPoints = newMatchedPoints;
    await this.repo.saveSalesmatchBalance(balance);

    const packageConfig = getPackageConfig(profile.packageTier);
    const nowIso = this.repo.now();
    const weekPaid = await this.repo.getPaidSalesmatchSince(userId, manilaWeekStartIso(nowIso));
    const monthPaid = await this.repo.getPaidSalesmatchSince(userId, manilaMonthStartIso(nowIso));
    const payable = Math.min(
      salesmatchDelta,
      Math.max(0, packageConfig.weeklySalesmatchCap - weekPaid),
      Math.max(0, packageConfig.monthlySalesmatchCap - monthPaid)
    );
    const forfeited = Number((salesmatchDelta - payable).toFixed(2));

    // processId encodes the exact new matched total → idempotent across retries
    const processId = `smb-reconcile:${userId}:${Math.round(newMatchedSales * 100)}`;

    if (payable > 0) {
      await this.postLedgerIfNeeded({
        userId,
        entryType: 'salesmatch',
        sourceReference: 'salesmatch-reconcile',
        creditAmount: payable,
        processId,
        notes: forfeited > 0
          ? `Salesmatch reconcile — PHP ${salesmatchDelta.toFixed(2)} matched (PHP ${forfeited.toFixed(2)} forfeited at package cap).`
          : `Salesmatch reconcile — PHP ${salesmatchDelta.toFixed(2)} matched.`
      });
    }

    // Binary cycle: A-position member of this user's left shadow earns their percent
    if (pointsDelta > 0) {
      const aRecipient = await this.repo.findPlacementChild(userId, 'left', 'left');
      if (aRecipient && aRecipient.registrationStatus === 'active') {
        const aProfile = await this.repo.findMemberByUserId(aRecipient.userId);
        const aConfig = aProfile ? getPackageConfig(aProfile.packageTier) : null;
        if (aProfile && aConfig && aProfile.packageTier !== 'Basic' && aConfig.binaryCyclePercent > 0) {
          const binaryCredit = Number(((salesmatchDelta * aConfig.binaryCyclePercent) / 100).toFixed(2));
          if (binaryCredit > 0) {
            await this.postLedgerIfNeeded({
              userId: aProfile.userId,
              entryType: 'binary_cycle',
              sourceReference: profile.username,
              creditAmount: binaryCredit,
              processId: `bc-reconcile:${aProfile.userId}:${userId}:${Math.round(newMatchedSales * 100)}`,
              notes: `Binary cycle from upline ${profile.username} salesmatch reconcile.`
            });
          }
        }
      }
    }

    await this.repo.recordPairingSnapshot({
      userId,
      snapshotDate: manilaDateKey(nowIso),
      matchedDelta: salesmatchDelta,
      paidDelta: payable,
      forfeitedDelta: forfeited
    });

    // GATE-SMB-INSTANT-20260615: volumes/remaining stored in PHP (SMB cash basis).
    await this.repo.recordPairingEvent({
      ownerUserId: userId,
      sourceUsername: 'reconcile',
      leftVolume: balance.leftSales,
      rightVolume: balance.rightSales,
      matchedPoints: pointsDelta,
      leftRemaining: Math.max(0, Number((balance.leftSales - balance.matchedSales).toFixed(2))),
      rightRemaining: Math.max(0, Number((balance.rightSales - balance.matchedSales).toFixed(2))),
      salesmatchAmount: salesmatchDelta
    });

    return payable;
  }

  private async processCompensationQueueLocked(limit: number) {
    const pending = await this.repo.listPendingCompensation(limit);
    const processed: string[] = [];

    for (const item of pending) {
      if (item.eventType !== 'placement-sales') {
        continue;
      }

      // At-most-once: mark processed before applying. Leg accumulation is not
      // idempotent, so a crash mid-walk must not replay the item (double pay);
      // an under-credited item is recoverable from this log line, a double
      // payout is not (AUD-01).
      await this.repo.markCompensationProcessed(item.id, this.repo.now());
      try {
        await this.applyPlacementSalesItem(item);
        processed.push(item.processId);
      } catch (error) {
        console.error(
          `COMPENSATION_ITEM_FAILED process_id=${item.processId} payload=${JSON.stringify(item.payload)} — credited partially or not at all; replay manually after review.`,
          error
        );
      }
    }

    return {
      moneyMode: this.repo.getMoneyMode(),
      processed
    };
  }

  private async applyPlacementSalesItem(item: ProductionCompensationQueueItem) {
    let currentParentUserId: string | null = item.payload.placementParentUserId;
    let currentSide: PlacementSide = item.payload.placementParentShadowSide ?? item.payload.placementSide;
    // GATE-BIN-CYCLE-UPLINE-A-20260614: Binary cycle is NOT paid on your own matched
    // volume. When any upline U executes a salesmatch pairing, the binary-cycle percent
    // flows ONE LEVEL DOWN to U's A-position member (first-left leg of U's left shadow),
    // computed from that A member's own package percent. No payout to U, no cascade.
    // This supersedes GATE-BIN-CYCLE-ONCE-20260613 (the prior once-per-event self-payout
    // model) — each pairing upline now pays its own distinct A, so no propagation guard
    // is needed.

    while (currentParentUserId) {
        const profile = await this.repo.findMemberByUserId(currentParentUserId);
        const network: ProductionNetworkAccount | null = await this.repo.findNetworkAccountByUserId(currentParentUserId);
        const existingBalance = await this.repo.getSalesmatchBalance(currentParentUserId);

        if (!profile || !network) {
          break;
        }

        const balance: ProductionSalesmatchBalance =
          existingBalance ?? {
            userId: currentParentUserId,
            leftSales: 0,
            rightSales: 0,
            matchedSales: 0,
            leftPoints: 0,
            rightPoints: 0,
            matchedPoints: 0,
            updatedAt: this.repo.now()
          };

        // Legs always accumulate (strong-leg carry, no flush-out)...
        if (currentSide === 'left') {
          balance.leftSales += item.payload.salesmatchValue;
          balance.leftPoints += item.payload.binaryPoints;
          network.leftPoints += item.payload.binaryPoints;
        } else {
          balance.rightSales += item.payload.salesmatchValue;
          balance.rightPoints += item.payload.binaryPoints;
          network.rightPoints += item.payload.binaryPoints;
        }
        balance.updatedAt = this.repo.now();

        // ...but match execution requires an eligible recipient. GATE-BIN-PAIR-20260612
        // (owner ruling): only PD / fully-settled CD accounts pair — FS and unpaid-CD
        // recipients hold volume until eligible (Nogatu instead lets unpaid-CD owners
        // receive; deviation recorded in the pending-decisions log). Nogatu parity:
        // pairing also unlocks only after one personally-sponsored qualified direct
        // is placed inside the recipient's binary subtree — spillover alone never
        // unlocks the first pairing payout (binaryEligibility.js).
        //
        // GATE-SHADOW-ACT-20260613: if this event carries a sibling-pair block and
        // we are at the blocked owner, accumulate the leg (already done above) but
        // skip match execution at this level so left-shadow and right-shadow PV
        // cannot pair each other for the owner's benefit.
        const isSiblingPairBlocked =
          item.payload.shadowPairBlockOwnerUserId != null &&
          item.payload.shadowPairBlockOwnerUserId === currentParentUserId;

        // GATE-SMB-FS-RECIPIENT-20260615: the owner earns salesmatch on their own
        // matched volume regardless of their OWN account type. The FS / CD-unpaid
        // exclusion (countsForPairingSource) applies to the SOURCE member's PV — already
        // enforced at registration via pvEligible before any leg accumulates here — and
        // must NOT block the recipient. Only the shadow sibling-pair block still gates
        // match execution at this level. Previously VIP/Business owners (FS) accumulated
        // both legs but never paired (BIN-01: eligibility = qualified source volume).
        //
        // GATE-PAIR-ELIGIB-REMOVE-20260615: the Nogatu-parity personal-direct unlock
        // gate (hasQualifiedPersonalDirectInSubtree) is absent from Yor BUSINESSRULE.md.
        // Any member with volume on both legs is now eligible.
        const unlocked = !isSiblingPairBlocked;

        if (!unlocked) {
          await this.repo.saveNetworkAccount(network);
          await this.repo.saveSalesmatchBalance(balance);
        } else {
          // GATE-PV-GROSS-20260614: leg points/sales are GROSS LIFETIME volume and are
          // NEVER reduced. Salesmatch + binary cycle pay on the INCREASE in matched volume
          // = min(grossLeft, grossRight) minus what was already matched. matched_* hold the
          // cumulative matched running total. This separates lifetime accumulated points
          // (shown in the genealogy tree) from matched points (consumed for payout).
          const newMatchedSales = Math.min(balance.leftSales, balance.rightSales);
          const newMatchedPoints = Math.min(balance.leftPoints, balance.rightPoints);
          const salesmatchDelta = Math.max(0, Number((newMatchedSales - balance.matchedSales).toFixed(2)));
          const pointsDelta = Math.max(0, newMatchedPoints - balance.matchedPoints);
          balance.matchedSales = newMatchedSales;
          balance.matchedPoints = newMatchedPoints;
          // Legs (network + balance) keep their gross totals — no subtraction.

          await this.repo.saveNetworkAccount(network);
          await this.repo.saveSalesmatchBalance(balance);

          if (salesmatchDelta > 0) {
            // GATE-SMB-CAP-20260612: weekly/monthly package caps apply to the
            // payout, not the match — over-cap matched volume is forfeited per
            // owner ruling (matched running total already advanced above).
            const packageConfig = getPackageConfig(profile.packageTier);
            const nowIso = this.repo.now();
            const weekPaid = await this.repo.getPaidSalesmatchSince(profile.userId, manilaWeekStartIso(nowIso));
            const monthPaid = await this.repo.getPaidSalesmatchSince(profile.userId, manilaMonthStartIso(nowIso));
            const payable = Math.min(
              salesmatchDelta,
              Math.max(0, packageConfig.weeklySalesmatchCap - weekPaid),
              Math.max(0, packageConfig.monthlySalesmatchCap - monthPaid)
            );
            const forfeited = Number((salesmatchDelta - payable).toFixed(2));

            if (payable > 0) {
              await this.postLedgerIfNeeded({
                userId: profile.userId,
                entryType: 'salesmatch',
                sourceReference: item.payload.createdMemberUsername,
                creditAmount: payable,
                processId: `${item.processId}:salesmatch:${profile.userId}:${balance.matchedSales}`,
                notes:
                  forfeited > 0
                    ? `Salesmatch delta from ${item.payload.createdMemberUsername} (PHP ${forfeited} forfeited at package cap).`
                    : `Salesmatch delta from ${item.payload.createdMemberUsername}.`
              });
            }

            // GATE-BIN-CYCLE-NOCAP-20260613: Binary Cycle has NO weekly/monthly cap.
            // It pays a flat percent of the FULL matched salesmatch movement
            // (salesmatchDelta), independent of the SMB payout cap above, and still
            // posts when the SMB payout is fully forfeited (payable === 0).
            //
            // GATE-BIN-CYCLE-UPLINE-A-20260614: the recipient is U's A-position member
            // (findPlacementChild(U, 'left', 'left') — the first-left leg of U's left
            // shadow), NOT U. The percent is the A member's own package binaryCyclePercent.
            // This is the only binary-cycle relationship: a member earns it solely from
            // the upline that placed them in the A slot, one level, never from their own
            // downline's pairing.
            if (item.payload.binaryCycleEligible ?? true) {
              const aRecipient = await this.repo.findPlacementChild(currentParentUserId, 'left', 'left');
              if (aRecipient && aRecipient.registrationStatus === 'active') {
                const aProfile = await this.repo.findMemberByUserId(aRecipient.userId);
                const aConfig = aProfile ? getPackageConfig(aProfile.packageTier) : null;
                if (aProfile && aConfig && aProfile.packageTier !== 'Basic' && aConfig.binaryCyclePercent > 0) {
                  const binaryCredit = Number(((salesmatchDelta * aConfig.binaryCyclePercent) / 100).toFixed(2));
                  if (binaryCredit > 0) {
                    await this.postLedgerIfNeeded({
                      userId: aProfile.userId,
                      entryType: 'binary_cycle',
                      sourceReference: profile.username,
                      creditAmount: binaryCredit,
                      processId: `${item.processId}:binary:${aProfile.userId}:${balance.matchedPoints}:${pointsDelta}`,
                      notes: `Binary cycle from upline ${profile.username} pairing.`
                    });
                  }
                }
              }
            }

            await this.repo.recordPairingSnapshot({
              userId: profile.userId,
              snapshotDate: manilaDateKey(nowIso),
              matchedDelta: salesmatchDelta,
              paidDelta: payable,
              forfeitedDelta: forfeited
            });

            // Per-event traceability: who triggered the pair, the gross leg PV cash
            // value (peso), points matched this event, and the peso remaining on each
            // leg after matching. GATE-SMB-INSTANT-20260615: volumes/remaining are stored
            // in PHP (the SMB cash basis = cash per PV) so the ledger reads as money;
            // matchedPoints stays a count.
            await this.repo.recordPairingEvent({
              ownerUserId: profile.userId,
              sourceUsername: item.payload.createdMemberUsername,
              leftVolume: balance.leftSales,
              rightVolume: balance.rightSales,
              matchedPoints: pointsDelta,
              leftRemaining: Math.max(0, Number((balance.leftSales - balance.matchedSales).toFixed(2))),
              rightRemaining: Math.max(0, Number((balance.rightSales - balance.matchedSales).toFixed(2))),
              salesmatchAmount: salesmatchDelta
            });
          }
        }

        // Live PV push: this ancestor's leg volume just changed from the new encode.
        notifyUser(currentParentUserId, {
          type: 'pv',
          leftPoints: network.leftPoints,
          rightPoints: network.rightPoints
        });

        currentSide = network.placementParentShadowSide ?? currentSide;
        currentParentUserId = network.placementParentUserId;
      }
  }

  async generateActivationCodes(
    actor: SessionUser,
    input: {
      quantity: number;
      packageTier?: string;
      assignedTo?: string;
      assignedToUserId?: string;
      accountType?: AccountType;
      codeFamily?: CodeFamily;
      remarks?: string;
    }
  ) {
    const codeFamily = (input.codeFamily ?? 'YOR CODES') as CodeFamily;
    const packageConfig = resolveActivationCodeTemplate(input.packageTier ?? 'Standard', codeFamily);
    // assignedToUserId (cashier UUID from dropdown) takes priority; fall back to member username lookup.
    let assignedUserId: string | null = null;
    let cashierUserId: string | null = null;
    if (input.assignedToUserId) {
      const cashier = await this.repo.findUserById(input.assignedToUserId);
      if (!cashier) throw new Error(`User with ID ${input.assignedToUserId} was not found.`);
      assignedUserId = cashier.id;
      if (cashier.role === 'cashier') {
        cashierUserId = cashier.id;
      }
    } else if (input.assignedTo) {
      const assignedMember = await this.requireMemberByUsername(input.assignedTo);
      assignedUserId = assignedMember.userId;
    }
    const quantity = Math.max(1, Math.min(100, Math.trunc(input.quantity || 1)));
    const createdAt = this.repo.now();
    const effectiveAccountType = input.accountType ?? packageConfig.accountType;
    const rows: ProductionActivationCode[] = [];
    const events: ProductionActivationCodeEvent[] = [];

    for (let index = 0; index < quantity; index += 1) {
      const seq = await this.repo.nextActivationCodeSequence();
      const code = buildActivationCodeValue(effectiveAccountType, packageConfig.packageTier, codeFamily, seq);
      const row: ProductionActivationCode = {
        id: crypto.randomUUID(),
        code,
        codeFamily,
        packageTier: packageConfig.packageTier,
        accountType: effectiveAccountType,
        status: 'unreleased',
        paymentStatus: effectiveAccountType === 'CD' ? 'unpaid' : 'paid',
        assignedUserId: assignedUserId,
        generatedByUserId: actor.id,
        generatedAt: createdAt,
        releasedAt: null,
        transferredAt: null,
        usedAt: null,
        usedByUserId: null,
        registrationEligible: (input.codeFamily ?? 'YOR CODES') === 'YOR CODES',
        lockedDirectReferralBonus: packageConfig.directReferralBonus,
        lockedSalesmatchValue: packageConfig.salesmatchValue,
        // GATE-BIN-PV-20260613: generated registration codes lock pairing BP from
        // the resolved salesmatch table (1 BP/PV = PHP 250 SMB), not from any
        // separate package catalog PV scale.
        lockedBinaryPoints: packageConfig.salesmatchBinaryPoints,
        lockedGetFiveAmount: packageConfig.getFiveAmount,
        processId: buildProcessId('code-generate', String(seq)),
        remarks: input.remarks?.trim() || 'Generated for production encoding flow.',
        settledAt: null,
        settledByUserId: null,
        pendingRecipientUserId: null,
        cashierUserId
      };
      rows.push(row);
      events.push({
        id: crypto.randomUUID(),
        activationCodeId: row.id,
        code: row.code,
        action: 'generated',
        actorUserId: actor.id,
        actorName: actor.name,
        fromUserId: null,
        toUserId: row.assignedUserId,
        notes: 'Activation code generated.',
        createdAt
      });
    }

    await this.repo.saveActivationCodes(rows);
    try {
      await this.repo.appendActivationCodeEvents(events);
    } catch {
      // non-fatal: event logging failure does not block code generation
    }

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'admin-generate-activation-codes',
      status: 'completed' as const,
      reason: `Generated ${rows.length} activation code(s).`,
      detail: `Generated ${rows.length} ${packageConfig.packageTier} code(s) in ${codeFamily}.`
    };
  }

  async releaseActivationCodes(actor: SessionUser, codes: string[]) {
    const fetched = await this.repo.findActivationCodesByCodes(codes);
    if (fetched.length === 0) {
      throw new Error('Select at least one activation code.');
    }
    // Skip codes that are already released or used — only process unreleased ones.
    const selected = fetched.filter((row) => row.status === 'unreleased');
    if (selected.length === 0) {
      return {
        moneyMode: this.repo.getMoneyMode(),
        action: 'admin-release-activation-code',
        status: 'completed' as const,
        reason: 'All selected codes are already released or used — nothing to release.'
      };
    }
    const createdAt = this.repo.now();
    selected.forEach((row) => {
      row.status = 'available';
      row.releasedAt = createdAt;
    });
    await this.repo.saveActivationCodes(selected);
    await this.repo.appendActivationCodeEvents(
      selected.map((row) => ({
        id: crypto.randomUUID(),
        activationCodeId: row.id,
        code: row.code,
        action: 'released',
        actorUserId: actor.id,
        actorName: actor.name,
        fromUserId: null,
        toUserId: row.assignedUserId,
        notes: 'Activation code released.',
        createdAt
      }))
    );

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'admin-release-activation-code',
      status: 'completed' as const,
      reason: `Released ${selected.length} activation code(s).${fetched.length > selected.length ? ` (${fetched.length - selected.length} skipped — already released or used)` : ''}`
    };
  }

  async transferActivationCodes(actor: SessionUser, targetUsername: string, codes: string[]) {
    const target = await this.requireMemberByUsername(targetUsername);
    const selected = await this.repo.findActivationCodesByCodes(codes);
    if (selected.length === 0) {
      throw new Error('Select at least one activation code.');
    }
    const createdAt = this.repo.now();
    selected.forEach((row) => {
      if (row.status === 'used' || row.status === 'disabled') {
        throw new Error(`${row.code} cannot be transferred.`);
      }
    });
    const previousAssignees = new Map(selected.map((row) => [row.code, row.assignedUserId]));
    selected.forEach((row) => {
      // Move ownership to the recipient. cashierUserId is never changed, so the
      // originating cashier keeps full inventory visibility regardless of who holds it now.
      row.assignedUserId = target.userId;
      row.pendingRecipientUserId = null;
      row.transferredAt = createdAt;
    });
    await this.repo.saveActivationCodes(selected);
    await this.repo.appendActivationCodeEvents(
      selected.map((row) => ({
        id: crypto.randomUUID(),
        activationCodeId: row.id,
        code: row.code,
        action: 'transferred',
        actorUserId: actor.id,
        actorName: actor.name,
        fromUserId: previousAssignees.get(row.code) ?? null,
        toUserId: target.userId,
        notes: `Activation code transferred to ${target.username}.`,
        createdAt
      }))
    );

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'admin-transfer-activation-code',
      status: 'completed' as const,
      reason: `Transferred ${selected.length} activation code(s) to ${target.username}.`
    };
  }

  async settleActivationCode(actor: SessionUser, codeValue: string, mode: 'paid' | 'externally-paid') {
    return withMoneyLock(`settle:${codeValue.trim().toUpperCase()}`, async () => {
      const code = await this.repo.findActivationCodeByCode(codeValue);
      if (!code) {
        throw new Error('Activation code not found.');
      }
      if (code.paymentStatus !== 'unpaid') {
        return {
          moneyMode: this.repo.getMoneyMode(),
          action: 'admin-settle-activation-code',
          status: 'completed' as const,
          reason: `${code.code} is already settled.`
        };
      }

      await this.applyCodeSettlement(code, mode, { actorUserId: actor.id, actorName: actor.name, note: `Payment settled (${mode}).` });

      return {
        moneyMode: this.repo.getMoneyMode(),
        action: 'admin-settle-activation-code',
        status: 'completed' as const,
        reason: `Settled ${code.code} (${mode}).`
      };
    });
  }

  // Shared settlement effects, used by the admin settle action and by CD
  // recovery completion during encashment. Fires the deferred DR and binary PV
  // for consumed, non-FS entries using the same process keys as registration,
  // so each posting happens at most once regardless of which path runs first.
  private async applyCodeSettlement(
    code: ProductionActivationCode,
    mode: 'paid' | 'externally-paid',
    audit: { actorUserId: string | null; actorName: string; note: string }
  ) {
    const settledAt = this.repo.now();
    code.paymentStatus = mode;
    code.settledAt = settledAt;
    code.settledByUserId = audit.actorUserId;
    await this.repo.saveActivationCodes([code]);
    await this.repo.appendActivationCodeEvents([
      {
        id: crypto.randomUUID(),
        activationCodeId: code.id,
        code: code.code,
        action: 'settled',
        actorUserId: audit.actorUserId,
        actorName: audit.actorName,
        fromUserId: null,
        toUserId: code.usedByUserId ?? code.assignedUserId,
        notes: audit.note,
        createdAt: settledAt
      }
    ]);

    // GATE-BIN-PV-PDCD-20260612: FS stays FS forever — settlement never grants
    // FS entries DR or binary PV rights.
    if (code.status !== 'used' || !code.usedByUserId || code.accountType === 'FS') {
      return;
    }

    const network = await this.repo.findNetworkAccountByUserId(code.usedByUserId);
    const member = await this.repo.findMemberByUserId(code.usedByUserId);
    if (!network || !member) {
      return;
    }

    // Mark the obligation settled before posting so qualified-direct counting
    // sees the new state (settled outside deduction keeps the recovery audit).
    network.cdStatus = CD_STATUS_SETTLED;
    network.cdTotal = Math.max(network.cdTotal, network.cdAmount);
    await this.repo.saveNetworkAccount(network);

    if (network.sponsorUserId) {
      await this.postRegistrationDirectAndGetFive({
        sponsorUserId: network.sponsorUserId,
        newMemberUserId: code.usedByUserId,
        newMemberUsername: member.username,
        code,
        packageTier: network.packageTier
      });
    }

    if (network.placementParentUserId) {
      await this.repo.enqueueCompensation(
        this.buildPlacementSalesQueueItem({
          newMemberUserId: code.usedByUserId,
          newMemberUsername: member.username,
          code,
          placementParentUserId: network.placementParentUserId,
          placementParentShadowSide: network.placementParentShadowSide ?? null,
          placementSide: network.placementSide ?? 'left',
          createdAt: settledAt
        })
      );
    }
  }

  // ENC-01 deduction stack: PHP 50 processing fee, 10% tax, 5% System Retainer,
  // then CD recovery at 100% of the remaining net until the obligation clears.
  // Submit only reserves the funds (gross ledger debit + pending row). CD
  // recovery and its settlement side effects fire at mark-paid, never before —
  // a rejected request must leave no money effect beyond the refunded debit.
  async submitEncashment(actor: SessionUser, requestedAmount: number) {
    return withMoneyLock(`encash:${actor.id}`, async () => {
      const amount = Number(Number(requestedAmount).toFixed(2));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Enter a valid encashment amount.');
      }
      const member = await this.repo.findMemberByUserId(actor.id);
      const network = await this.repo.findNetworkAccountByUserId(actor.id);
      if (!member || !network) {
        throw new Error('Member profile not found.');
      }

      // One open request per member: prevents double-reserving the CD
      // obligation and shrinks the race surface on the balance check.
      const existing = await this.repo.listEncashmentsForUser(actor.id);
      if (existing.some((row) => row.status === 'pending' || row.status === 'queued' || row.status === 'approved')) {
        throw new Error('You already have an encashment request under review. Wait for it to be settled first.');
      }

      const available = await this.repo.sumLedgerMainBalance(actor.id);
      if (amount > available) {
        throw new Error('Requested amount exceeds available balance.');
      }

      const requestId = crypto.randomUUID();
      const processingFee = 50;
      const tax = Number((amount * 0.1).toFixed(2));
      // GATE-RETAINER-EXEMPT-20260613: exempt accounts pay 0% system retainer
      const retainer = SYSTEM_RETAINER_EXEMPT_USER_IDS.has(actor.id) ? 0 : Number((amount * 0.05).toFixed(2));
      const postFixedNet = Math.max(0, Number((amount - processingFee - tax - retainer).toFixed(2)));
      const cdOutstanding = Math.max(0, Number((network.cdAmount - network.cdTotal).toFixed(2)));
      const cdDeduction = Math.min(cdOutstanding, postFixedNet);
      const totalDeductions = Number((processingFee + tax + retainer + cdDeduction).toFixed(2));
      const net = Number((amount - totalDeductions).toFixed(2));
      const processId = buildProcessId('encashment-submit', actor.id, requestId);
      const createdAt = this.repo.now();

      await this.repo.createEncashment({
        id: requestId,
        userId: actor.id,
        processId,
        grossAmount: amount,
        processingFee,
        taxAmount: tax,
        systemRetainer: retainer,
        cdDeduction,
        totalDeductions,
        netAmount: net,
        status: 'pending',
        payoutMethod: member.payoutMethod ?? null,
        payoutDetails: member.payoutDetails ?? null,
        reviewedByUserId: null,
        reviewedAt: null,
        paidAt: null,
        remarks: 'Member-submitted encashment request.',
        createdAt
      });
      await this.postLedgerIfNeeded({
        userId: actor.id,
        entryType: 'encashment',
        sourceReference: requestId,
        debitAmount: amount,
        processId: `${processId}:debit`,
        notes: `Encashment request ${requestId} (gross PHP ${amount}).`
      });

      return {
        moneyMode: this.repo.getMoneyMode(),
        action: 'member-wallet-encash',
        status: 'completed' as const,
        reason: 'Encashment request submitted for review.',
        detail: `Gross PHP ${amount}: fee ${processingFee}, tax ${tax}, retainer ${retainer}, CD recovery ${cdDeduction}, net PHP ${net}.`,
        encashment: {
          id: requestId,
          grossAmount: amount,
          processingFee,
          tax,
          systemRetainer: retainer,
          cdDeduction,
          totalDeductions,
          netReceivable: net,
          status: 'pending' as const,
          payoutSchedule: 'Tuesday encashment / Friday payout'
        }
      };
    });
  }

  async reviewEncashment(
    actor: SessionUser,
    encashmentId: string,
    action: 'approve' | 'reject' | 'mark-paid',
    remarks?: string
  ) {
    // Per-request lock serializes concurrent reviews (approve vs reject race);
    // the status is re-read inside the lock so the first transition wins.
    return withMoneyLock(`encash-review:${encashmentId}`, async () => {
      const row = await this.repo.findEncashmentById(encashmentId);
      if (!row) {
        throw new Error('Encashment request not found.');
      }
      const reviewedAt = this.repo.now();

      if (action === 'approve') {
        if (row.status !== 'pending' && row.status !== 'queued') {
          throw new Error(`Cannot approve an encashment in ${row.status} status.`);
        }
        row.status = 'approved';
      } else if (action === 'reject') {
        if (row.status !== 'pending' && row.status !== 'queued') {
          throw new Error(`Cannot reject an encashment in ${row.status} status.`);
        }
        row.status = 'rejected';
        // Compensating credit restores the gross debit — corrections are new
        // ledger rows, never edits (AUD-01 append-only rule). No CD recovery
        // or settlement was applied at submit, so nothing else to unwind.
        await this.postLedgerIfNeeded({
          userId: row.userId,
          entryType: 'adjustment',
          sourceReference: row.id,
          creditAmount: row.grossAmount,
          processId: `${row.processId}:refund`,
          notes: `Encashment ${row.id} rejected — gross amount restored.`
        });
      } else {
        // GATE-ENCASH-DIRECT-PAY-20260614: encashment no longer requires a
        // separate approve/queue step. Admin marks a pending request paid in one
        // action; the member-submitted breakdown is settled exactly as-is.
        if (row.status === 'paid') {
          throw new Error('This encashment is already paid.');
        }
        if (row.status === 'rejected') {
          throw new Error('A rejected encashment cannot be marked paid.');
        }
        row.status = 'paid';
        row.paidAt = reviewedAt;
        await this.applyEncashmentCdRecovery(row);
      }

      row.reviewedByUserId = actor.id;
      row.reviewedAt = reviewedAt;
      if (remarks?.trim()) {
        row.remarks = remarks.trim();
      }
      await this.repo.saveEncashment(row);

      return {
        moneyMode: this.repo.getMoneyMode(),
        action: 'admin-review-encashment',
        status: 'completed' as const,
        reason: `Encashment ${row.id} is now ${row.status}.`
      };
    });
  }

  // CD recovery is applied only when the encashment is actually paid out.
  // GATE-CD-SETTLE-20260612: clearing the obligation settles the originating
  // code, which fires the deferred DR and binary PV.
  private async applyEncashmentCdRecovery(row: ProductionEncashment) {
    if (row.cdDeduction <= 0) {
      return;
    }
    const network = await this.repo.findNetworkAccountByUserId(row.userId);
    if (!network) {
      return;
    }
    const outstanding = Math.max(0, Number((network.cdAmount - network.cdTotal).toFixed(2)));
    const recovered = Math.min(row.cdDeduction, outstanding);
    // If the obligation shrank between submit and payout (e.g. an admin
    // settled the code directly), the over-withheld remainder goes back.
    const overWithheld = Number((row.cdDeduction - recovered).toFixed(2));
    if (overWithheld > 0) {
      await this.postLedgerIfNeeded({
        userId: row.userId,
        entryType: 'adjustment',
        sourceReference: row.id,
        creditAmount: overWithheld,
        processId: `${row.processId}:cd-over-recovery-refund`,
        notes: `Encashment ${row.id}: CD obligation was already settled — over-withheld recovery restored.`
      });
    }
    if (recovered <= 0) {
      return;
    }
    network.cdTotal = Number((network.cdTotal + recovered).toFixed(2));
    if (network.cdTotal >= network.cdAmount) {
      network.cdStatus = CD_STATUS_SETTLED;
    }
    await this.repo.saveNetworkAccount(network);

    if (network.cdStatus === CD_STATUS_SETTLED && network.activationCode) {
      const originatingCode = await this.repo.findActivationCodeByCode(network.activationCode);
      if (originatingCode && originatingCode.paymentStatus === 'unpaid') {
        await this.applyCodeSettlement(originatingCode, 'paid', {
          actorUserId: null,
          actorName: 'System — CD recovery',
          note: `CD obligation cleared via paid encashment recovery (${row.id}).`
        });
      }
    }
  }

  async buildAdminEncashmentCenter() {
    const rows = await this.repo.listEncashments({}, 200);
    const memberNames = new Map<string, string>();
    for (const row of rows) {
      if (!memberNames.has(row.userId)) {
        const member = await this.repo.findMemberByUserId(row.userId);
        memberNames.set(row.userId, member ? `${member.fullName} (${member.username})` : row.userId);
      }
    }
    const peso = (value: number) =>
      `PHP ${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return {
      moneyMode: this.repo.getMoneyMode(),
      encashments: rows.map((row, index) => ({
        id: row.id,
        queueOrder: index + 1,
        member: memberNames.get(row.userId) ?? row.userId,
        gross: peso(row.grossAmount),
        fee: peso(row.processingFee),
        tax: peso(row.taxAmount),
        systemRetainer: peso(row.systemRetainer),
        cdDeduction: peso(row.cdDeduction),
        net: peso(row.netAmount),
        method: row.payoutMethod ?? '—',
        status: row.status,
        remarks: row.remarks
      })),
      totals: {
        gross: rows.reduce((sum, row) => sum + row.grossAmount, 0),
        net: rows.reduce((sum, row) => sum + row.netAmount, 0),
        awaitingReview: rows.filter((row) => row.status === 'pending' || row.status === 'queued').length
      },
      processNotes: [
        'Production encashments are ledger-backed with deterministic process keys.',
        'Approve moves a request to approved; mark-paid finalizes; reject restores the gross amount to the member wallet.'
      ]
    };
  }

  async buildMemberWalletData(userId: string, encashAmount?: number) {
    const [member, ledgerEntries, networkAccount] = await Promise.all([
      this.repo.findMemberByUserId(userId),
      this.repo.listWalletLedgerEntriesForUser(userId),
      this.repo.findNetworkAccountByUserId(userId)
    ]);

    if (!member) {
      throw new Error('Member profile not found.');
    }

    const cdBalance = networkAccount ? Math.max(0, networkAccount.cdAmount - networkAccount.cdTotal) : 0;

    // Sum balances per wallet type
    const mainBalance = ledgerEntries
      .filter(e => e.walletType === 'main')
      .reduce((sum, e) => sum + e.creditAmount - e.debitAmount, 0);
    const lifestyleBalance = ledgerEntries
      .filter(e => e.walletType === 'lifestyle')
      .reduce((sum, e) => sum + e.creditAmount - e.debitAmount, 0);

    // Sum credits per income type
    const incomeTotals = new Map<string, number>();
    for (const entry of ledgerEntries) {
      if (entry.creditAmount > 0) {
        incomeTotals.set(entry.entryType, (incomeTotals.get(entry.entryType) ?? 0) + entry.creditAmount);
      }
    }

    const INCOME_STREAM_META: Array<{ streamId: string; label: string; walletType: string; entryType: string }> = [
      { streamId: 'direct-referral', label: 'Direct Referral', walletType: 'main', entryType: 'direct_referral' },
      { streamId: 'salesmatch', label: 'Salesmatch Bonus', walletType: 'main', entryType: 'salesmatch' },
      { streamId: 'binary-cycle', label: 'Binary Cycle Bonus', walletType: 'main', entryType: 'binary_cycle' },
      { streamId: 'get-five', label: 'Get Yor Five Bonus', walletType: 'main', entryType: 'get_five' },
      { streamId: 'lifestyle-rewards', label: 'Lifestyle Rewards', walletType: 'lifestyle', entryType: 'lifestyle_rewards' },
      { streamId: 'unilevel', label: 'Unilevel Bonus', walletType: 'main', entryType: 'unilevel' },
      { streamId: 'global', label: 'Global Bonus', walletType: 'main', entryType: 'global_bonus' },
      { streamId: 'left-shadow-earning', label: 'Left Shadow Earning', walletType: 'main', entryType: 'left_shadow_earning' },
      { streamId: 'right-shadow-earning', label: 'Right Shadow Earning', walletType: 'main', entryType: 'right_shadow_earning' }
    ];

    const incomeBreakdown = INCOME_STREAM_META.map(m => ({
      streamId: m.streamId,
      label: m.label,
      walletType: m.walletType,
      amount: incomeTotals.get(m.entryType) ?? 0
    }));

    const incomeStreams = INCOME_STREAM_META.map(m => {
      const amount = incomeTotals.get(m.entryType) ?? 0;
      return {
        streamId: m.streamId,
        label: m.label,
        writeStatus: 'production' as const,
        simulatedGross: amount,
        simulatedNet: amount,
        capApplied: false,
        statusLabel: amount > 0 ? 'posted' : 'no activity',
        explanation: amount > 0
          ? `Production ledger: PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credited across ${ledgerEntries.filter(e => e.entryType === m.entryType).length} transaction(s).`
          : 'No transactions recorded yet for this income stream.'
      };
    });

    const wallets = [
      { type: 'main', label: 'Main Earnings Wallet', balance: mainBalance, threshold: 500 },
      { type: 'lifestyle', label: 'Lifestyle Rewards Wallet', balance: lifestyleBalance, threshold: 1000 },
      { type: 'product', label: 'Product Wallet / Purchase Credits', balance: 0, threshold: 0 },
      { type: 'pending', label: 'Pending Computed Income', balance: 0, threshold: 0 },
      { type: 'encashment', label: 'Approved Encashment Queue', balance: 0, threshold: 500 }
    ];

    const payoutPreviewAmount = encashAmount !== undefined && encashAmount > 0
      ? Math.min(mainBalance, encashAmount)
      : 0;
    const processingFee = payoutPreviewAmount > 0 ? 50 : 0;
    const maintenanceFee = 0;
    // GATE-RETAINER-EXEMPT-20260613: exempt accounts pay 0% system retainer
    const retainerExempt = SYSTEM_RETAINER_EXEMPT_USER_IDS.has(userId);
    const systemRetainer = retainerExempt ? 0 : payoutPreviewAmount * 0.05;
    const tax = payoutPreviewAmount * 0.10;
    const fee = processingFee + systemRetainer;
    // Mirrors submitEncashment: CD recovery applies to the net after the
    // fixed deductions, not to the gross.
    const previewPostFixedNet = Math.max(0, payoutPreviewAmount - processingFee - tax - systemRetainer);
    const cdDeduction = Math.min(cdBalance, previewPostFixedNet);
    const totalDeductions = fee + tax + cdDeduction;
    const netReceivable = Math.max(0, payoutPreviewAmount - totalDeductions);

    const ENTRY_TYPE_LABELS: Record<string, string> = {
      direct_referral: 'Direct Referral',
      salesmatch: 'Salesmatch Bonus',
      binary_cycle: 'Binary Cycle Bonus',
      get_five: 'Get Yor Five Bonus',
      lifestyle_rewards: 'Lifestyle Rewards',
      unilevel: 'Unilevel Bonus',
      global_bonus: 'Global Bonus',
      left_shadow_earning: 'Left Shadow Earning',
      right_shadow_earning: 'Right Shadow Earning'
    };

    const formatPhp = (v: number) =>
      `PHP ${Math.abs(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const transactions = ledgerEntries.map(entry => ({
      id: entry.id,
      date: entry.occurredAt,
      category: entry.entryType,
      label: ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType,
      source: entry.sourceReference,
      gross: entry.creditAmount > 0 ? formatPhp(entry.creditAmount) : `-${formatPhp(entry.debitAmount)}`,
      net: entry.creditAmount > 0 ? formatPhp(entry.creditAmount) : `-${formatPhp(entry.debitAmount)}`,
      status: entry.status,
      type: 'wallet' as const
    }));

    return {
      moneyMode: 'production' as const,
      packageTier: member.packageTier,
      wallets,
      entries: ledgerEntries,
      summary: {
        availableBalance: mainBalance,
        pendingBalance: 0,
        cdBalance,
        // Item 8: no GCash default — surface the member's actual saved payout
        // method + details (null when unset) so Account Details can fetch/display
        // and edit them. The payout method is chosen from a dropdown at
        // registration and on Account Details, never silently defaulted.
        payoutMethod: member.payoutMethod ?? null,
        payoutDetails: member.payoutDetails ?? null,
        payoutSchedule: 'Tuesday encashment / Friday payout'
      },
      incomeBreakdown,
      incomeStreams,
      preview: {
        requestedAmount: payoutPreviewAmount,
        processingFee,
        maintenanceFee,
        systemRetainer,
        tax,
        fee,
        cdDeduction,
        totalDeductions,
        netReceivable,
        sufficientBalance: payoutPreviewAmount <= mainBalance,
        retainerExempt,
        note: 'Preview mirrors the protected encashment breakdown; final submit applies deterministic process keys in the production ledger.'
      },
      ledger: ledgerEntries,
      transactions
    };
  }

  private async resolveSponsor(
    viewer: SessionUser | null,
    input: ProductionRegistrationInput,
    origin: RegistrationOrigin
  ): Promise<{ member: ProductionMemberProfile | null; mode: SponsorResolutionMode | null }> {
    if (origin === 'genealogy-slot') {
      if (!viewer) {
        return { member: null, mode: null };
      }
      return {
        member: await this.repo.findMemberByUserId(viewer.id),
        mode: 'signed-in-member'
      };
    }

    if (input.referralCode?.trim()) {
      return {
        member: await this.findMemberByReferralCodeOrUsername(input.referralCode),
        mode: 'referral-link'
      };
    }

    if (input.sponsorReferralCode?.trim()) {
      return {
        member: await this.findMemberByReferralCodeOrUsername(input.sponsorReferralCode),
        mode: 'manual-sponsor'
      };
    }

    return { member: null, mode: null };
  }

  private async resolvePlacement(
    viewer: SessionUser | null,
    input: ProductionRegistrationInput,
    origin: RegistrationOrigin,
    sponsor: ProductionMemberProfile | null
  ): Promise<{ context: ProductionPlacementContext | null; reservation: ProductionPlacementReservation | null; issue: string | null }> {
    if (origin === 'genealogy-slot') {
      if (!viewer || !input.placementParentUsername || !input.placementSide) {
        return { context: null, reservation: null, issue: 'Placement slot is required for genealogy encoding.' };
      }
      const placementAddress = parsePlacementParentAddress(input.placementParentUsername);
      const parent = await this.repo.findMemberByUsername(placementAddress.memberUsername);
      if (!parent) {
        return { context: null, reservation: null, issue: 'Placement parent was not found.' };
      }
      const occupied = await this.repo.findPlacementChild(parent.userId, input.placementSide, placementAddress.shadowSide);
      if (occupied) {
        return {
          context: null,
          reservation: null,
          issue: `Placement side ${input.placementSide.toUpperCase()} is already occupied under ${placementAddress.label}.`
        };
      }
      return {
        context: {
          placementUsername: parent.username,
          placementParentShadowSide: placementAddress.shadowSide,
          placementSide: input.placementSide,
          note: 'Placement stays locked to the selected genealogy slot.'
        },
        reservation: null,
        issue: null
      };
    }

    const reservation =
      (input.placementReservationId ? await this.repo.findPlacementReservationById(input.placementReservationId) : null) ??
      (input.placementToken ? await this.repo.findPlacementReservationByToken(input.placementToken) : null);

    if (!reservation || reservation.status !== 'active' || reservation.expiresAt <= this.repo.now()) {
      // Auto-balance: when no placement token, place under the sponsor using the lesser-points side.
      if (sponsor) {
        const sponsorNetwork = await this.repo.findNetworkAccountByUserId(sponsor.userId);
        const leftPoints = sponsorNetwork?.leftPoints ?? 0;
        const rightPoints = sponsorNetwork?.rightPoints ?? 0;
        const autoSide: PlacementSide = leftPoints <= rightPoints ? 'left' : 'right';
        const occupied = await this.repo.findPlacementChild(sponsor.userId, autoSide, null);
        if (!occupied) {
          return {
            context: {
              placementUsername: sponsor.username,
              placementParentShadowSide: null,
              placementSide: autoSide,
              note: `Auto-balanced placement: ${autoSide} leg (${autoSide === 'left' ? leftPoints : rightPoints} pts vs ${autoSide === 'left' ? rightPoints : leftPoints} pts).`
            },
            reservation: null,
            issue: null
          };
        }
      }
      return {
        context: null,
        reservation: null,
        issue: 'Placement selection is required before this referral link can be used.'
      };
    }

    if (sponsor && reservation.sponsorUserId !== sponsor.userId) {
      return {
        context: null,
        reservation,
        issue: 'Placement token does not belong to the resolved sponsor.'
      };
    }

    const reservationAddress = parsePlacementParentAddress(reservation.placementParentUsername);
    const occupied = await this.repo.findPlacementChild(
      reservation.placementParentUserId,
      reservation.placementSide,
      reservation.placementParentShadowSide ?? reservationAddress.shadowSide
    );
    if (occupied) {
      return {
        context: null,
        reservation,
        issue: `Placement side ${reservation.placementSide.toUpperCase()} is already occupied under ${reservation.placementParentUsername}.`
      };
    }

    return {
      context: {
        placementUsername: reservationAddress.memberUsername,
        placementParentShadowSide: reservation.placementParentShadowSide ?? reservationAddress.shadowSide,
        placementSide: reservation.placementSide,
        note: 'Placement is locked from the active sponsor-generated share link.'
      },
      reservation,
      issue: null
    };
  }

  // Entry state at registration time, derived from the consumed code plus the
  // freshly built network account (CD obligation fields).
  private codeEntryState(code: ProductionActivationCode, network: ProductionNetworkAccount): AccountStateInput {
    return {
      accountType: code.accountType,
      paymentStatus: code.paymentStatus,
      cdAmount: network.cdAmount,
      cdTotal: network.cdTotal,
      cdStatus: network.cdStatus
    };
  }

  // Effective state of an existing account, derived from its network row. An
  // outstanding CD obligation marks the entry payment as not yet settled.
  private networkAccountState(network: ProductionNetworkAccount): AccountStateInput {
    return {
      accountType: network.currentAccountType,
      paymentStatus: network.cdStatus === CD_STATUS_OUTSTANDING ? 'unpaid' : 'paid',
      cdAmount: network.cdAmount,
      cdTotal: network.cdTotal,
      cdStatus: network.cdStatus
    };
  }

  // Posts the sponsor Direct Referral and, when a same-package group of five
  // completes, the Get Yor Five bonus. Shared by registration (eligible entries)
  // and the settlement trigger (deferred entries) — process keys are identical
  // on both paths so each posting happens at most once.
  private async postRegistrationDirectAndGetFive(input: {
    sponsorUserId: string;
    newMemberUserId: string;
    newMemberUsername: string;
    code: ProductionActivationCode;
    packageTier: PackageTier;
  }) {
    const directProcessId = buildProcessId('registration-direct', input.sponsorUserId, input.newMemberUserId, input.code.code);
    await this.postLedgerIfNeeded({
      userId: input.sponsorUserId,
      entryType: 'direct_referral',
      sourceReference: input.newMemberUsername,
      creditAmount: input.code.lockedDirectReferralBonus,
      processId: directProcessId,
      notes: `Direct referral bonus from ${input.newMemberUsername}.`
    });

    // GATE-GYF-WINDOW-20260613 (owner sign-off item 5): credit only groups of five
    // qualified same-package directs that COMPLETED within their 3-month window.
    // Partial groups whose window has lapsed are voided (never credited). The
    // completed-group index keeps the process key unique and stable so each group
    // pays at most once (postLedgerIfNeeded dedup); re-running is a no-op.
    if (input.code.lockedGetFiveAmount > 0) {
      const gyfDirects = await this.listQualifiedSamePackageGyfDirects(input.sponsorUserId, input.packageTier);
      const groups = computeGetYorFiveGroups(gyfDirects, { asOf: this.repo.now() });
      for (const group of groups) {
        if (group.status !== 'complete' || group.index === null) {
          continue;
        }
        const getFiveProcessId = buildProcessId(
          'registration-get-five',
          input.sponsorUserId,
          input.packageTier.toUpperCase(),
          String(group.index)
        );
        await this.postLedgerIfNeeded({
          userId: input.sponsorUserId,
          entryType: 'get_five',
          sourceReference: `${input.packageTier} package group ${group.index}`,
          creditAmount: input.code.lockedGetFiveAmount,
          processId: getFiveProcessId,
          notes: `Get Yor Five bonus on completed same-package group ${group.index}.`
        });
      }
    }
  }

  // Qualified (PD / fully-settled CD) same-package directs of a sponsor as
  // GyfDirect records for the Get Yor Five 3-month window computation.
  private async listQualifiedSamePackageGyfDirects(
    sponsorUserId: string,
    packageTier: PackageTier
  ): Promise<GyfDirect[]> {
    const directs = await this.repo.listDirectsBySponsor(sponsorUserId);
    return directs
      .filter(
        (network) =>
          network.registrationStatus === 'active' &&
          network.packageTier === packageTier &&
          countsForDirectReferralSource(this.networkAccountState(network))
      )
      .map((network) => ({ memberUserId: network.userId, joinedAt: network.createdAt }));
  }

  private buildPlacementSalesQueueItem(input: {
    newMemberUserId: string;
    newMemberUsername: string;
    code: ProductionActivationCode;
    placementParentUserId: string;
    placementParentShadowSide: PlacementSide | null;
    placementSide: PlacementSide;
    createdAt: string;
  }): ProductionCompensationQueueItem {
    return {
      id: crypto.randomUUID(),
      processId: buildProcessId('registration-placement-sales', input.newMemberUserId, input.code.code),
      eventType: 'placement-sales',
      status: 'pending',
      payload: {
        placementParentUserId: input.placementParentUserId,
        placementParentShadowSide: input.placementParentShadowSide,
        placementSide: input.placementSide,
        salesmatchValue: input.code.lockedSalesmatchValue,
        binaryPoints: input.code.lockedBinaryPoints,
        createdMemberUserId: input.newMemberUserId,
        createdMemberUsername: input.newMemberUsername,
        activationCode: input.code.code,
        binaryCycleEligible: true
      },
      createdAt: input.createdAt,
      processedAt: null
    };
  }

  // Nogatu binaryEligibility parity: the first pairing payout unlocks only when
  // the member has personally sponsored at least one qualified (PD / settled-CD)
  // direct that is placed inside their own binary subtree.
  private async hasQualifiedPersonalDirectInSubtree(ownerUserId: string): Promise<boolean> {
    const directs = await this.repo.listDirectsBySponsor(ownerUserId);
    for (const direct of directs) {
      if (direct.registrationStatus !== 'active') {
        continue;
      }
      if (!countsForPairingSource(this.networkAccountState(direct))) {
        continue;
      }
      if (await this.isPlacedWithinSubtree(direct.userId, ownerUserId)) {
        return true;
      }
    }
    return false;
  }

  private async isPlacedWithinSubtree(nodeUserId: string, ancestorUserId: string): Promise<boolean> {
    const MAX_TREE_DEPTH = 200;
    let current = await this.repo.findNetworkAccountByUserId(nodeUserId);
    let depth = 0;
    while (current?.placementParentUserId && depth < MAX_TREE_DEPTH) {
      if (current.placementParentUserId === ancestorUserId) {
        return true;
      }
      current = await this.repo.findNetworkAccountByUserId(current.placementParentUserId);
      depth += 1;
    }
    return false;
  }

  private async postLedgerIfNeeded(input: {
    userId: string;
    entryType: ProductionWalletLedgerEntry['entryType'];
    sourceReference: string;
    creditAmount?: number;
    debitAmount?: number;
    walletType?: ProductionWalletLedgerEntry['walletType'];
    processId: string;
    notes: string;
  }) {
    if (await this.repo.hasWalletLedgerProcess(input.processId)) {
      return;
    }
    const creditAmount = input.creditAmount ?? 0;
    const debitAmount = input.debitAmount ?? 0;
    const balanceAfter = (await this.repo.sumLedgerMainBalance(input.userId)) + creditAmount - debitAmount;
    await this.repo.appendWalletLedgerEntry({
      id: crypto.randomUUID(),
      userId: input.userId,
      walletType: input.walletType ?? 'main',
      entryType: input.entryType,
      sourceReference: input.sourceReference,
      creditAmount,
      debitAmount,
      balanceAfter,
      processId: input.processId,
      notes: input.notes,
      occurredAt: this.repo.now(),
      status: 'posted'
    });
    // Push a live income event to any open dashboard for this member.
    notifyUser(input.userId, {
      type: 'income',
      entryType: input.entryType,
      creditAmount,
      debitAmount,
      balanceAfter,
      sourceReference: input.sourceReference
    });
  }

  private buildShareLink(referralCode: string, placementToken: string) {
    return buildRegistrationUrl({
      ref: referralCode,
      placementToken
    });
  }

  private async findMemberByReferralCodeOrUsername(code: string): Promise<ProductionMemberProfile | null> {
    const trimmed = code.trim();
    let member = await this.repo.findMemberByReferralCode(trimmed);
    if (member) {
      return member;
    }
    member = await this.repo.findMemberByReferralCode(trimmed.toUpperCase());
    if (member) {
      return member;
    }
    try {
      const decodedUsername = decodeReferralCode(trimmed).toUpperCase();
      if (decodedUsername) {
        member = await this.repo.findMemberByUsername(decodedUsername);
      }
    } catch {
      // Ignore decoding errors
    }
    return member;
  }

  private buildUsername(sequence: number) {
    return `YOR${String(sequence).padStart(4, '0')}`;
  }

  // GATE-REFCODE-RANDOM-20260614: referral codes are now a meaningful prefix + random
  // suffix (e.g. YORM-7F3A91) instead of the username-derivable YOR-MEMBER-NNNN. They are
  // resolved by direct referral_code lookup (no decode), so the suffix is non-derivable.
  // Legacy YOR-MEMBER-* and base32 links still resolve via findMemberByReferralCodeOrUsername.
  private async generateUniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `YORM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      if (!(await this.repo.findMemberByReferralCode(code))) {
        return code;
      }
    }
    // Collision-space exhausted (astronomically unlikely) — widen the suffix.
    return `YORM-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  }

  private async requireUserById(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new Error('User was not found.');
    }
    return user;
  }

  private async requireMemberByUserId(userId: string) {
    const member = await this.repo.findMemberByUserId(userId);
    if (!member) {
      throw new Error('Member profile was not found.');
    }
    return member;
  }

  private async requireMemberByUsername(username: string) {
    const trimmed = username.trim();
    let member = await this.repo.findMemberByUsername(trimmed);
    if (!member) {
      const normalizedAlias = normalizeProductionUsernameAlias(trimmed);
      if (normalizedAlias) {
        member = await this.repo.findMemberByUsername(normalizedAlias);
      }
    }
    if (!member) {
      throw new Error(`Member ${username} was not found.`);
    }
    return member;
  }
}

export function createInMemoryProductionEncodingRepository(seed?: {
  users?: ProductionAppUser[];
  members?: ProductionMemberProfile[];
  networkAccounts?: ProductionNetworkAccount[];
  shadowAccounts?: ProductionShadowAccount[];
  activationCodes?: ProductionActivationCode[];
  codeEvents?: ProductionActivationCodeEvent[];
  walletLedger?: ProductionWalletLedgerEntry[];
  salesmatchBalances?: ProductionSalesmatchBalance[];
  queue?: ProductionCompensationQueueItem[];
  reservations?: ProductionPlacementReservation[];
  activationCodeSequence?: number;
  memberSequence?: number;
  now?: string;
}): ProductionEncodingRepository {
  const state = {
    users: [...(seed?.users ?? [])],
    members: [...(seed?.members ?? [])],
    networkAccounts: [...(seed?.networkAccounts ?? [])],
    shadowAccounts: [...(seed?.shadowAccounts ?? [])],
    activationCodes: [...(seed?.activationCodes ?? [])],
    codeEvents: [...(seed?.codeEvents ?? [])],
    walletLedger: [...(seed?.walletLedger ?? [])],
    salesmatchBalances: [...(seed?.salesmatchBalances ?? [])],
    queue: [...(seed?.queue ?? [])],
    reservations: [...(seed?.reservations ?? [])],
    pairingSnapshots: [] as ProductionPairingSnapshot[],
    pairingEvents: [] as ProductionPairingEvent[],
    repurchases: [] as Array<{ userId: string; pvEarned: number; transactionDate: string; processKey: string }>,
    encashments: [] as ProductionEncashment[],
    activationCodeSequence: seed?.activationCodeSequence ?? 1000,
    memberSequence: seed?.memberSequence ?? 1000,
    now: seed?.now ?? '2026-06-08T09:00:00.000Z'
  };

  return {
    getMoneyMode: () => 'production',
    now: () => state.now,
    nextActivationCodeSequence: async () => {
      state.activationCodeSequence += 1;
      return state.activationCodeSequence;
    },
    nextMemberSequence: async () => {
      state.memberSequence += 1;
      return state.memberSequence;
    },
    findUserById: async (userId) => state.users.find((item) => item.id === userId) ?? null,
    findMemberByUserId: async (userId) => state.members.find((item) => item.userId === userId) ?? null,
    findMemberByUsername: async (username) =>
      state.members.find((item) => item.username.trim().toUpperCase() === username.trim().toUpperCase()) ?? null,
    findMemberByReferralCode: async (referralCode) =>
      state.members.find((item) => item.referralCode.trim().toUpperCase() === referralCode.trim().toUpperCase()) ?? null,
    findUserByUsername: async (username) => {
      const member = state.members.find((item) => item.username.trim().toUpperCase() === username.trim().toUpperCase());
      return member ? state.users.find((item) => item.id === member.userId) ?? null : null;
    },
    findUserByReferralCode: async (referralCode) => {
      const member = state.members.find(
        (item) => item.referralCode.trim().toUpperCase() === referralCode.trim().toUpperCase()
      );
      return member ? state.users.find((item) => item.id === member.userId) ?? null : null;
    },
    findUserByEmail: async (email) => state.users.find((item) => item.email === email) ?? null,
    countMembersByNormalizedFullName: async (normalizedFullName) =>
      state.members.filter((item) => item.normalizedFullName === normalizedFullName).length,
    listActivationCodes: async () => [...state.activationCodes],
    listActivationCodesForUser: async (userId) => state.activationCodes.filter((item) => item.assignedUserId === userId),
    saveActivationCodes: async (rows) => {
      for (const row of rows) {
        const index = state.activationCodes.findIndex((item) => item.id === row.id);
        if (index >= 0) {
          state.activationCodes[index] = { ...row };
        } else {
          state.activationCodes.push({ ...row });
        }
      }
    },
    appendActivationCodeEvents: async (events) => {
      state.codeEvents.push(...events.map((event) => ({ ...event })));
    },
    listActivationCodeEvents: async () => [...state.codeEvents],
    listMembers: async () => [...state.members],
    listUsers: async () => [...state.users],
    listUsersByRole: async (role) => state.users.filter((u) => u.role === role),
    listShadowAccounts: async () => [...state.shadowAccounts],
    listShadowAccountsForOwner: async (ownerUserId) =>
      state.shadowAccounts.filter((item) => item.ownerUserId === ownerUserId).sort((a, b) => a.placement.localeCompare(b.placement)),
    findShadowAccountByCode: async (shadowCode) =>
      state.shadowAccounts.find((item) => item.shadowCode.trim().toUpperCase() === shadowCode.trim().toUpperCase()) ?? null,
    saveShadowAccounts: async (rows) => {
      for (const row of rows) {
        const index = state.shadowAccounts.findIndex((item) => item.id === row.id);
        if (index >= 0) {
          state.shadowAccounts[index] = { ...row };
        } else {
          state.shadowAccounts.push({ ...row });
        }
      }
    },
    listWalletLedgerEntriesForUser: async (userId) => state.walletLedger.filter((item) => item.userId === userId),
    listRecentWalletLedger: async (limit) =>
      [...state.walletLedger].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit),
    appendWalletLedgerEntry: async (entry) => {
      state.walletLedger.push({ ...entry });
    },
    hasWalletLedgerProcess: async (processId) => state.walletLedger.some((item) => item.processId === processId),
    saveUser: async (user) => {
      const index = state.users.findIndex((item) => item.id === user.id);
      if (index >= 0) {
        state.users[index] = { ...user };
      } else {
        state.users.push({ ...user });
      }
    },
    saveMemberProfile: async (profile) => {
      const index = state.members.findIndex((item) => item.userId === profile.userId);
      if (index >= 0) {
        state.members[index] = { ...profile };
      } else {
        state.members.push({ ...profile });
      }
    },
    saveNetworkAccount: async (account) => {
      const index = state.networkAccounts.findIndex((item) => item.userId === account.userId);
      if (index >= 0) {
        state.networkAccounts[index] = { ...account };
      } else {
        state.networkAccounts.push({ ...account });
      }
    },
    findNetworkAccountByUserId: async (userId) => state.networkAccounts.find((item) => item.userId === userId) ?? null,
    findActivationCodeByCode: async (code) =>
      state.activationCodes.find((item) => item.code.trim().toUpperCase() === code.trim().toUpperCase()) ?? null,
    findActivationCodesByCodes: async (codes) => {
      const wanted = new Set(codes.map((code) => code.trim().toUpperCase()));
      return state.activationCodes.filter((item) => wanted.has(item.code.trim().toUpperCase()));
    },
    listMembersBySponsorCode: async (sponsorCode) => state.members.filter((item) => item.sponsorCode === sponsorCode),
    findUsersByIds: async (userIds) => {
      const wanted = new Set(userIds);
      return state.users.filter((item) => wanted.has(item.id));
    },
    listActivationCodeEventsForUser: async (userId, limit) =>
      state.codeEvents
        .filter((event) => event.fromUserId === userId || event.toUserId === userId || event.actorUserId === userId)
        .slice(-limit)
        .reverse(),
    listRecentActivationCodeEvents: async (limit) => [...state.codeEvents].slice(-limit).reverse(),
    listNetworkAccounts: async () => [...state.networkAccounts],
    listDirectsBySponsor: async (sponsorUserId) => state.networkAccounts.filter((item) => item.sponsorUserId === sponsorUserId),
    findPlacementChild: async (parentUserId, side, shadowSide) =>
      state.networkAccounts.find(
        (item) =>
          item.placementParentUserId === parentUserId &&
          item.placementSide === side &&
          item.registrationStatus === 'active' &&
          (shadowSide ? item.placementParentShadowSide === shadowSide : true)
      ) ?? null,
    findPlacementChildrenBatch: async (parentUserIds) =>
      parentUserIds.length === 0
        ? []
        : state.networkAccounts.filter(
            (item) =>
              item.registrationStatus === 'active' &&
              item.placementParentUserId != null &&
              item.placementParentShadowSide == null &&
              parentUserIds.includes(item.placementParentUserId)
          ),
    saveSalesmatchBalance: async (balance) => {
      const index = state.salesmatchBalances.findIndex((item) => item.userId === balance.userId);
      if (index >= 0) {
        state.salesmatchBalances[index] = { ...balance };
      } else {
        state.salesmatchBalances.push({ ...balance });
      }
    },
    getSalesmatchBalance: async (userId) => state.salesmatchBalances.find((item) => item.userId === userId) ?? null,
    listUsersWithPendingSalesmatch: async () =>
      state.salesmatchBalances
        .filter((b) => Math.min(b.leftSales, b.rightSales) > b.matchedSales)
        .map((b) => b.userId),
    getPaidSalesmatchSince: async (userId, sinceIso) =>
      state.walletLedger
        .filter((item) => item.userId === userId && item.entryType === 'salesmatch' && item.occurredAt >= sinceIso)
        .reduce((sum, item) => sum + item.creditAmount, 0),
    recordPairingSnapshot: async (input) => {
      const existing = state.pairingSnapshots.find(
        (item) => item.userId === input.userId && item.snapshotDate === input.snapshotDate
      );
      if (existing) {
        existing.matchedSales += input.matchedDelta;
        existing.paidSalesmatch += input.paidDelta;
        existing.forfeitedSalesmatch += input.forfeitedDelta;
      } else {
        state.pairingSnapshots.push({
          id: crypto.randomUUID(),
          userId: input.userId,
          snapshotDate: input.snapshotDate,
          matchedSales: input.matchedDelta,
          paidSalesmatch: input.paidDelta,
          forfeitedSalesmatch: input.forfeitedDelta
        });
      }
    },
    listPairingSnapshotsForUser: async (userId) => state.pairingSnapshots.filter((item) => item.userId === userId),
    recordPairingEvent: async (input) => {
      state.pairingEvents.push({
        id: crypto.randomUUID(),
        ownerUserId: input.ownerUserId,
        sourceUsername: input.sourceUsername,
        leftVolume: input.leftVolume,
        rightVolume: input.rightVolume,
        matchedPoints: input.matchedPoints,
        leftRemaining: input.leftRemaining,
        rightRemaining: input.rightRemaining,
        salesmatchAmount: input.salesmatchAmount,
        occurredAt: new Date().toISOString()
      });
    },
    listPairingEventsForUser: async (userId, limit) =>
      state.pairingEvents
        .filter((item) => item.ownerUserId === userId)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, limit),
    // Shadow reconciliation is a DB-side SQL function; the in-memory store (tests) is a no-op.
    reconcileShadowEarnings: async () => [],
    sumLedgerMainBalance: async (userId) =>
      state.walletLedger
        .filter((item) => item.userId === userId && item.walletType === 'main')
        .reduce((sum, item) => sum + item.creditAmount - item.debitAmount, 0),
    createEncashment: async (row) => {
      if (state.encashments.some((item) => item.processId === row.processId)) {
        return;
      }
      state.encashments.push({ ...row });
    },
    saveEncashment: async (row) => {
      const index = state.encashments.findIndex((item) => item.id === row.id);
      if (index >= 0) {
        state.encashments[index] = { ...row };
      } else {
        state.encashments.push({ ...row });
      }
    },
    findEncashmentById: async (encashmentId) => state.encashments.find((item) => item.id === encashmentId) ?? null,
    listEncashments: async (filter, limit) =>
      state.encashments.filter((item) => (filter.status ? item.status === filter.status : true)).slice(0, limit),
    listEncashmentsForUser: async (userId) => state.encashments.filter((item) => item.userId === userId),
    enqueueCompensation: async (item) => {
      if (!state.queue.some((row) => row.processId === item.processId)) {
        state.queue.push({ ...item });
      }
    },
    listPendingCompensation: async (limit) => state.queue.filter((item) => item.status === 'pending').slice(0, limit),
    markCompensationProcessed: async (queueId, processedAt) => {
      const item = state.queue.find((row) => row.id === queueId);
      if (item) {
        item.status = 'processed';
        item.processedAt = processedAt;
      }
    },
    savePlacementReservation: async (reservation) => {
      const index = state.reservations.findIndex((item) => item.id === reservation.id);
      if (index >= 0) {
        state.reservations[index] = { ...reservation };
      } else {
        state.reservations.push({ ...reservation });
      }
    },
    listPlacementReservationsForSponsor: async (sponsorUserId) => state.reservations.filter((item) => item.sponsorUserId === sponsorUserId),
    findPlacementReservationById: async (reservationId) => state.reservations.find((item) => item.id === reservationId) ?? null,
    findPlacementReservationByToken: async (token) => state.reservations.find((item) => item.shareToken === token) ?? null,
    listMembersFiltered: async (query, page, pageSize) => {
      const upper = query.toUpperCase();
      const filtered = query
        ? state.members.filter(
            (m) => m.username.toUpperCase().includes(upper) || m.fullName.toUpperCase().includes(upper) || m.referralCode.toUpperCase().includes(upper)
          )
        : state.members;
      const offset = (page - 1) * pageSize;
      return filtered.slice(offset, offset + pageSize);
    },
    countMembersFiltered: async (query) => {
      if (!query) return state.members.length;
      const upper = query.toUpperCase();
      return state.members.filter(
        (m) => m.username.toUpperCase().includes(upper) || m.fullName.toUpperCase().includes(upper) || m.referralCode.toUpperCase().includes(upper)
      ).length;
    },
    listNetworkAccountsByUserIds: async (userIds) => state.networkAccounts.filter((n) => userIds.includes(n.userId)),
    sumWalletMainBalancesByUserIds: async (userIds) => {
      const result = new Map<string, number>();
      for (const entry of state.walletLedger.filter((e) => userIds.includes(e.userId) && e.walletType === 'main')) {
        result.set(entry.userId, (result.get(entry.userId) ?? 0) + (entry.creditAmount ?? 0) - (entry.debitAmount ?? 0));
      }
      return result;
    },
    countDirectReferralsByUserIds: async (userIds) => {
      const result = new Map<string, number>();
      for (const n of state.networkAccounts.filter((n) => n.sponsorUserId && userIds.includes(n.sponsorUserId) && n.registrationStatus === 'active')) {
        if (n.sponsorUserId) {
          result.set(n.sponsorUserId, (result.get(n.sponsorUserId) ?? 0) + 1);
        }
      }
      return result;
    },

    insertRepurchase: async (row) => {
      // Idempotent on processKey so a replayed repurchase does not double-count PV.
      if (state.repurchases.some((r) => r.processKey === row.processKey)) return;
      state.repurchases.push({
        userId: row.userId,
        pvEarned: row.pvEarned,
        transactionDate: row.transactionDate,
        processKey: row.processKey
      });
    },

    sumRepurchasePvForUserInMonth: async (userId, yearMonthPrefix) =>
      state.repurchases
        .filter((r) => r.userId === userId && r.transactionDate.startsWith(yearMonthPrefix))
        .reduce((sum, r) => sum + Number(r.pvEarned ?? 0), 0),

    sumLifestyleCreditsForUserToday: async (userId, dayIso) => {
      const day = dayIso.slice(0, 10);
      return state.walletLedger
        .filter(
          (e) =>
            e.userId === userId &&
            e.walletType === 'lifestyle' &&
            e.entryType === 'lifestyle_rewards' &&
            e.occurredAt.slice(0, 10) === day
        )
        .reduce((sum, e) => sum + (e.creditAmount ?? 0), 0);
    },

    sumLifestyleCreditsForUserThisMonth: async (userId, yearMonthPrefix) => {
      return state.walletLedger
        .filter(
          (e) =>
            e.userId === userId &&
            e.walletType === 'lifestyle' &&
            e.entryType === 'lifestyle_rewards' &&
            e.occurredAt.startsWith(yearMonthPrefix)
        )
        .reduce((sum, e) => sum + (e.creditAmount ?? 0), 0);
    },

    setStockistLevel: async (userId, level) => {
      const member = state.members.find((m) => m.userId === userId);
      if (member) {
        member.stockistLevel = level;
      }
    },
    sumPendingGlobalBonusNetSales: async () => 0,
    markRepurchasesGlobalBonusIncluded: async () => {}
  };
}

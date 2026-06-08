import crypto from 'node:crypto';
import { packagePolicies } from '../compensation/mvp-service.js';
import { createPasswordHashSync } from '../auth/password.js';
import type { MoneyMode, SessionUser } from '../../types/auth.js';

export type PackageTier = 'Basic' | 'Classic' | 'Standard' | 'Business' | 'VIP';
export type CodeFamily = 'YOR CODES' | 'YOR MAINTENANCE' | 'YOR PERFUME' | 'YOR VISION';
export type AccountType = 'PD' | 'FS';
export type ActivationCodeStatus = 'unreleased' | 'available' | 'used' | 'disabled';
export type PaymentStatus = 'unpaid' | 'paid' | 'externally-paid';
export type PlacementSide = 'left' | 'right';
export type RegistrationOrigin = 'referral-link' | 'genealogy-slot';
export type SponsorResolutionMode = 'referral-link' | 'manual-sponsor' | 'signed-in-member';
export type QueueEventType = 'placement-sales';

export type PackageConfig = {
  packageTier: PackageTier;
  accountType: AccountType;
  directReferralBonus: number;
  salesmatchValue: number;
  binaryCyclePercent: number;
  getFiveAmount: number;
  binaryPoints: number;
};

const PACKAGE_CONFIGS = new Map<string, PackageConfig>(
  packagePolicies.map((policy) => {
    const packageTier = toPackageTier(policy.name);
    return [
      packageTier.toUpperCase(),
      {
        packageTier,
        accountType: packageTier === 'Business' || packageTier === 'VIP' ? 'FS' : 'PD',
        directReferralBonus: policy.directReferralBonus,
        salesmatchValue: policy.salesmatchValue,
        binaryCyclePercent: policy.binaryCyclePercent ?? 0,
        getFiveAmount: packageTier === 'Basic' ? 0 : policy.price,
        binaryPoints: policy.pv * 100
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
};

export type ProductionNetworkAccount = {
  userId: string;
  sponsorUserId: string | null;
  directReferrerUserId: string | null;
  placementParentUserId: string | null;
  placementSide: PlacementSide | null;
  currentAccountTypeCode: number;
  currentAccountType: AccountType;
  packageTier: PackageTier;
  activationCode: string | null;
  registrationStatus: 'pending' | 'active' | 'disabled';
  leftPoints: number;
  rightPoints: number;
  createdAt: string;
};

export type ProductionActivationCode = {
  id: string;
  code: string;
  codeFamily: CodeFamily;
  packageTier: PackageTier;
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
};

export type ProductionActivationCodeEvent = {
  id: string;
  activationCodeId: string;
  code: string;
  action: 'generated' | 'released' | 'transferred' | 'consumed';
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
  placementSide: PlacementSide;
  shareToken: string;
  status: 'active' | 'consumed' | 'expired';
  expiresAt: string;
  createdAt: string;
};

export type ProductionWalletLedgerEntry = {
  id: string;
  userId: string;
  walletType: 'main';
  entryType: 'direct_referral' | 'salesmatch' | 'binary_cycle' | 'get_five';
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

export type ProductionCompensationQueueItem = {
  id: string;
  processId: string;
  eventType: QueueEventType;
  status: 'pending' | 'processed';
  payload: {
    placementParentUserId: string;
    placementSide: PlacementSide;
    salesmatchValue: number;
    binaryPoints: number;
    createdMemberUserId: string;
    createdMemberUsername: string;
    activationCode: string;
  };
  createdAt: string;
  processedAt: string | null;
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
};

export type ProductionPlacementContext = {
  placementUsername: string;
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
    packageTier: PackageTier;
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
    packageTier: PackageTier;
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
  listWalletLedgerEntriesForUser(userId: string): Promise<ProductionWalletLedgerEntry[]>;
  appendWalletLedgerEntry(entry: ProductionWalletLedgerEntry): Promise<void>;
  hasWalletLedgerProcess(processId: string): Promise<boolean>;
  saveUser(user: ProductionAppUser): Promise<void>;
  saveMemberProfile(profile: ProductionMemberProfile): Promise<void>;
  saveNetworkAccount(account: ProductionNetworkAccount): Promise<void>;
  findNetworkAccountByUserId(userId: string): Promise<ProductionNetworkAccount | null>;
  findPlacementChild(parentUserId: string, side: PlacementSide): Promise<ProductionNetworkAccount | null>;
  saveSalesmatchBalance(balance: ProductionSalesmatchBalance): Promise<void>;
  getSalesmatchBalance(userId: string): Promise<ProductionSalesmatchBalance | null>;
  enqueueCompensation(item: ProductionCompensationQueueItem): Promise<void>;
  listPendingCompensation(limit: number): Promise<ProductionCompensationQueueItem[]>;
  markCompensationProcessed(queueId: string, processedAt: string): Promise<void>;
  savePlacementReservation(reservation: ProductionPlacementReservation): Promise<void>;
  listPlacementReservationsForSponsor(sponsorUserId: string): Promise<ProductionPlacementReservation[]>;
  findPlacementReservationById(reservationId: string): Promise<ProductionPlacementReservation | null>;
  findPlacementReservationByToken(token: string): Promise<ProductionPlacementReservation | null>;
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

function buildProcessId(scope: string, ...parts: string[]) {
  return [scope, ...parts].join(':');
}

function randomToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export class ProductionEncodingService {
  constructor(private readonly repo: ProductionEncodingRepository) {}

  async buildMemberActivationCodeCenter(user: SessionUser) {
    const member = await this.requireMemberByUserId(user.id);
    const codes = await this.repo.listActivationCodesForUser(user.id);
    const users = await this.repo.listUsers();
    const userById = new Map(users.map((item) => [item.id, item]));

    const inventory = codes
      .map((code) => mapCodeRow(code, member.username))
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));

    const groupedInventory = {
      registrationCodes: inventory.filter((item) => item.codeFamily === 'YOR CODES'),
      maintenanceCodes: inventory.filter((item) => item.codeFamily === 'YOR MAINTENANCE'),
      perfumeCodes: inventory.filter((item) => item.codeFamily === 'YOR PERFUME'),
      visionCodes: inventory.filter((item) => item.codeFamily === 'YOR VISION')
    };

    const history = (await this.repo.listActivationCodeEvents())
      .filter((event) => event.fromUserId === user.id || event.toUserId === user.id || event.actorUserId === user.id)
      .slice(-12)
      .reverse()
      .map((event) => ({
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

    const transferTargets = (await this.repo.listMembers())
      .filter((candidate) => candidate.userId !== user.id)
      .map((candidate) => ({
        username: candidate.username,
        fullName: candidate.fullName,
        packageTier: candidate.packageTier
      }));

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

  async buildAdminActivationCodeCenter() {
    const [codes, members] = await Promise.all([this.repo.listActivationCodes(), this.repo.listMembers()]);
    const memberByUserId = new Map(members.map((item) => [item.userId, item]));
    const inventory = codes
      .map((code) => {
        const assigned = code.assignedUserId ? memberByUserId.get(code.assignedUserId)?.username ?? 'Unassigned' : 'Unassigned';
        return {
          ...mapCodeRow(code, assigned === 'Unassigned' ? null : assigned),
          remarks: code.remarks,
          releasable: code.status === 'unreleased'
        };
      })
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));

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
      auditTrail: (await this.repo.listActivationCodeEvents()).slice(-20).reverse().map((event) => ({
        actor: event.actorName,
        action: event.action,
        target: event.code,
        occurredAt: event.createdAt
      })),
      transferTargets: members.map((candidate) => ({
        username: candidate.username,
        fullName: candidate.fullName,
        packageTier: candidate.packageTier
      })),
      hints: [
        'Generate, release, and transfer always append activation-code event history.',
        'Registration eligibility is controlled by the backend code-family and lifecycle flags, not by frontend labels.'
      ]
    };
  }

  async buildMemberRegistrationReadiness(user: SessionUser) {
    const member = await this.requireMemberByUserId(user.id);
    const codes = (await this.repo.listActivationCodesForUser(user.id))
      .filter((code) => code.registrationEligible && code.status === 'available');
    const reservations = await this.repo.listPlacementReservationsForSponsor(user.id);
    const activeReservation = reservations
      .filter((item) => item.status === 'active' && item.expiresAt > this.repo.now())
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;

    const sponsorLeft = await this.repo.findPlacementChild(user.id, 'left');
    const sponsorRight = await this.repo.findPlacementChild(user.id, 'right');
    const fallbackRecommendation =
      !sponsorLeft
        ? {
            placementUsername: member.username,
            placementSide: 'left',
            note: 'Left slot under the sponsor root is open and ready for reservation.'
          }
        : !sponsorRight
          ? {
              placementUsername: member.username,
              placementSide: 'right',
              note: 'Right slot under the sponsor root is open and ready for reservation.'
            }
          : {
              placementUsername: member.username,
              placementSide: 'left',
              note: 'Choose an open slot from the genealogy page when the sponsor root is already filled on both sides.'
            };

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
      referralLink: activeReservation ? this.buildShareLink(member.referralCode, activeReservation.shareToken) : '',
      availableCodes: codes.map((code) => mapCodeRow(code, member.username)),
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
    const placementParent = await this.requireMemberByUsername(input.placementParentUsername);
    const parentNetwork = await this.repo.findNetworkAccountByUserId(placementParent.userId);
    if (!parentNetwork || parentNetwork.registrationStatus !== 'active') {
      throw new Error('Placement parent is not available.');
    }
    const occupied = await this.repo.findPlacementChild(placementParent.userId, input.placementSide);
    if (occupied) {
      throw new Error(`Placement side ${input.placementSide.toUpperCase()} is already occupied under ${placementParent.username}.`);
    }

    const reservation: ProductionPlacementReservation = {
      id: crypto.randomUUID(),
      sponsorUserId: sponsor.userId,
      referralCode: sponsor.referralCode,
      placementParentUserId: placementParent.userId,
      placementParentUsername: placementParent.username,
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
      selectedPackage: matchingCodeRecord?.packageTier ?? null,
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
          ? 'A valid placement token must be attached to the public registration link before final submit.'
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
    const occupied = await this.repo.findPlacementChild(placementParent.userId, preview.placement.placementSide);
    if (occupied) {
      throw new Error(`Placement side ${preview.placement.placementSide.toUpperCase()} is already occupied under ${placementParent.username}.`);
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
    const referralCode = this.buildReferralCode(await this.repo.nextMemberSequence());
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
      packageTier: matchingCode.packageTier,
      accountStatus: 'active',
      fullName,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      middleName: parsedName.middleName,
      contactNumber: (input.phone ?? '').trim(),
      normalizedFullName: normalizeFullName(fullName),
      createdAt
    };
    const network: ProductionNetworkAccount = {
      userId,
      sponsorUserId: sponsor.userId,
      directReferrerUserId: sponsor.userId,
      placementParentUserId: placementParent.userId,
      placementSide: preview.placement.placementSide,
      currentAccountTypeCode: matchingCode.accountType === 'FS' ? 2 : 1,
      currentAccountType: matchingCode.accountType,
      packageTier: matchingCode.packageTier,
      activationCode: matchingCode.code,
      registrationStatus: 'active',
      leftPoints: 0,
      rightPoints: 0,
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

    const directProcessId = buildProcessId('registration-direct', sponsor.userId, userId, matchingCode.code);
    const getFiveProcessId = buildProcessId('registration-get-five', sponsor.userId, matchingCode.packageTier.toUpperCase());
    await this.postLedgerIfNeeded({
      userId: sponsor.userId,
      entryType: 'direct_referral',
      sourceReference: finalUsername,
      creditAmount: matchingCode.lockedDirectReferralBonus,
      processId: directProcessId,
      notes: `Direct referral bonus from ${finalUsername}.`
    });

    const qualifiedSamePackageDirects = await this.countQualifiedDirectsBySponsorAndPackage(sponsor.userId, matchingCode.packageTier);
    if (matchingCode.lockedGetFiveAmount > 0 && qualifiedSamePackageDirects % 5 === 0) {
      await this.postLedgerIfNeeded({
        userId: sponsor.userId,
        entryType: 'get_five',
        sourceReference: `${matchingCode.packageTier} package threshold`,
        creditAmount: matchingCode.lockedGetFiveAmount,
        processId: getFiveProcessId,
        notes: `Get Yor Five bonus on ${qualifiedSamePackageDirects} same-package directs.`
      });
    }

    const queueItem: ProductionCompensationQueueItem = {
      id: crypto.randomUUID(),
      processId: buildProcessId('registration-placement-sales', userId, matchingCode.code),
      eventType: 'placement-sales',
      status: 'pending',
      payload: {
        placementParentUserId: placementParent.userId,
        placementSide: preview.placement.placementSide,
        salesmatchValue: matchingCode.lockedSalesmatchValue,
        binaryPoints: matchingCode.lockedBinaryPoints,
        createdMemberUserId: userId,
        createdMemberUsername: finalUsername,
        activationCode: matchingCode.code
      },
      createdAt,
      processedAt: null
    };
    await this.repo.enqueueCompensation(queueItem);

    if (preview.placementReservationId) {
      const reservation = await this.repo.findPlacementReservationById(preview.placementReservationId);
      if (reservation && reservation.status === 'active') {
        reservation.status = 'consumed';
        await this.repo.savePlacementReservation(reservation);
      }
    }

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'production-registration-submit',
      status: 'completed',
      reason: 'Production registration committed and downstream compensation queued.',
      detail: `Created ${finalUsername}, consumed ${matchingCode.code}, posted direct referral, and queued placement-based compensation workers.`,
      placementReservationId: preview.placementReservationId,
      queuedCompensation: [queueItem.processId],
      createdMember: {
        username: finalUsername,
        fullName,
        email: loginEmail,
        referralCode,
        sponsorUsername: sponsor.username,
        packageTier: matchingCode.packageTier,
        accountType: matchingCode.accountType,
        loginEmail
      }
    };
  }

  async processCompensationQueue(limit = 50) {
    const pending = await this.repo.listPendingCompensation(limit);
    const processed: string[] = [];

    for (const item of pending) {
      if (item.eventType !== 'placement-sales') {
        continue;
      }

      let currentParentUserId: string | null = item.payload.placementParentUserId;
      let currentSide: PlacementSide = item.payload.placementSide;

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

        const matchedSalesBefore = Math.min(balance.leftSales, balance.rightSales);
        const matchedPointsBefore = Math.min(balance.leftPoints, balance.rightPoints);

        if (currentSide === 'left') {
          balance.leftSales += item.payload.salesmatchValue;
          balance.leftPoints += item.payload.binaryPoints;
          network.leftPoints += item.payload.binaryPoints;
        } else {
          balance.rightSales += item.payload.salesmatchValue;
          balance.rightPoints += item.payload.binaryPoints;
          network.rightPoints += item.payload.binaryPoints;
        }

        const matchedSalesAfter = Math.min(balance.leftSales, balance.rightSales);
        const matchedPointsAfter = Math.min(balance.leftPoints, balance.rightPoints);
        const salesmatchDelta = Math.max(0, matchedSalesAfter - matchedSalesBefore);
        const pointsDelta = Math.max(0, matchedPointsAfter - matchedPointsBefore);
        balance.matchedSales = matchedSalesAfter;
        balance.matchedPoints = matchedPointsAfter;
        balance.updatedAt = this.repo.now();

        await this.repo.saveNetworkAccount(network);
        await this.repo.saveSalesmatchBalance(balance);

        if (salesmatchDelta > 0) {
          await this.postLedgerIfNeeded({
            userId: profile.userId,
            entryType: 'salesmatch',
            sourceReference: item.payload.createdMemberUsername,
            creditAmount: salesmatchDelta,
            processId: `${item.processId}:salesmatch:${profile.userId}:${matchedSalesAfter}`,
            notes: `Salesmatch delta from ${item.payload.createdMemberUsername}.`
          });

          const packageConfig = getPackageConfig(profile.packageTier);
          if (packageConfig.binaryCyclePercent > 0 && profile.packageTier !== 'Basic') {
            const binaryCredit = Number(((salesmatchDelta * packageConfig.binaryCyclePercent) / 100).toFixed(2));
            await this.postLedgerIfNeeded({
              userId: profile.userId,
              entryType: 'binary_cycle',
              sourceReference: item.payload.createdMemberUsername,
              creditAmount: binaryCredit,
              processId: `${item.processId}:binary:${profile.userId}:${matchedPointsAfter}:${pointsDelta}`,
              notes: `Binary cycle delta from ${item.payload.createdMemberUsername}.`
            });
          }
        }

        currentSide = network.placementSide ?? currentSide;
        currentParentUserId = network.placementParentUserId;
      }

      await this.repo.markCompensationProcessed(item.id, this.repo.now());
      processed.push(item.processId);
    }

    return {
      moneyMode: this.repo.getMoneyMode(),
      processed
    };
  }

  async generateActivationCodes(
    actor: SessionUser,
    input: {
      quantity: number;
      packageTier?: string;
      assignedTo?: string;
      accountType?: AccountType;
      codeFamily?: CodeFamily;
      remarks?: string;
    }
  ) {
    const packageConfig = getPackageConfig(input.packageTier ?? 'Standard');
    const assignedMember = input.assignedTo ? await this.requireMemberByUsername(input.assignedTo) : null;
    const quantity = Math.max(1, Math.min(100, Math.trunc(input.quantity || 1)));
    const createdAt = this.repo.now();
    const rows: ProductionActivationCode[] = [];
    const events: ProductionActivationCodeEvent[] = [];

    for (let index = 0; index < quantity; index += 1) {
      const seq = await this.repo.nextActivationCodeSequence();
      const code = `YOR-ACT-${String(seq).padStart(8, '0')}`;
      const row: ProductionActivationCode = {
        id: crypto.randomUUID(),
        code,
        codeFamily: input.codeFamily ?? 'YOR CODES',
        packageTier: packageConfig.packageTier,
        accountType: input.accountType ?? packageConfig.accountType,
        status: 'unreleased',
        paymentStatus: 'unpaid',
        assignedUserId: assignedMember?.userId ?? null,
        generatedByUserId: actor.id,
        generatedAt: createdAt,
        releasedAt: null,
        transferredAt: null,
        usedAt: null,
        usedByUserId: null,
        registrationEligible: (input.codeFamily ?? 'YOR CODES') === 'YOR CODES',
        lockedDirectReferralBonus: packageConfig.directReferralBonus,
        lockedSalesmatchValue: packageConfig.salesmatchValue,
        lockedBinaryPoints: packageConfig.binaryPoints,
        lockedGetFiveAmount: packageConfig.getFiveAmount,
        processId: buildProcessId('code-generate', String(seq)),
        remarks: input.remarks?.trim() || 'Generated for production encoding flow.'
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
    await this.repo.appendActivationCodeEvents(events);

    return {
      moneyMode: this.repo.getMoneyMode(),
      action: 'admin-generate-activation-codes',
      status: 'completed' as const,
      reason: `Generated ${rows.length} activation code(s).`,
      detail: `Generated ${rows.length} ${packageConfig.packageTier} code(s) in ${input.codeFamily ?? 'YOR CODES'}.`
    };
  }

  async releaseActivationCodes(actor: SessionUser, codes: string[]) {
    const allCodes = await this.repo.listActivationCodes();
    const selected = allCodes.filter((row) => codes.includes(row.code));
    if (selected.length === 0) {
      throw new Error('Select at least one activation code.');
    }
    const createdAt = this.repo.now();
    selected.forEach((row) => {
      if (row.status !== 'unreleased') {
        throw new Error(`${row.code} is not in unreleased status.`);
      }
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
      reason: `Released ${selected.length} activation code(s).`
    };
  }

  async transferActivationCodes(actor: SessionUser, targetUsername: string, codes: string[]) {
    const target = await this.requireMemberByUsername(targetUsername);
    const allCodes = await this.repo.listActivationCodes();
    const selected = allCodes.filter((row) => codes.includes(row.code));
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
      row.assignedUserId = target.userId;
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
        member: await this.repo.findMemberByReferralCode(input.referralCode.trim()),
        mode: 'referral-link'
      };
    }

    if (input.sponsorReferralCode?.trim()) {
      return {
        member: await this.repo.findMemberByReferralCode(input.sponsorReferralCode.trim()),
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
      const parent = await this.repo.findMemberByUsername(input.placementParentUsername);
      if (!parent) {
        return { context: null, reservation: null, issue: 'Placement parent was not found.' };
      }
      const occupied = await this.repo.findPlacementChild(parent.userId, input.placementSide);
      if (occupied) {
        return {
          context: null,
          reservation: null,
          issue: `Placement side ${input.placementSide.toUpperCase()} is already occupied under ${parent.username}.`
        };
      }
      return {
        context: {
          placementUsername: parent.username,
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

    const occupied = await this.repo.findPlacementChild(reservation.placementParentUserId, reservation.placementSide);
    if (occupied) {
      return {
        context: null,
        reservation,
        issue: `Placement side ${reservation.placementSide.toUpperCase()} is already occupied under ${reservation.placementParentUsername}.`
      };
    }

    return {
      context: {
        placementUsername: reservation.placementParentUsername,
        placementSide: reservation.placementSide,
        note: 'Placement is locked from the active sponsor-generated share link.'
      },
      reservation,
      issue: null
    };
  }

  private async countQualifiedDirectsBySponsorAndPackage(sponsorUserId: string, packageTier: PackageTier) {
    const members = await this.repo.listMembers();
    const networks = await Promise.all(members.map((member) => this.repo.findNetworkAccountByUserId(member.userId)));
    return networks.filter(
      (network) =>
        network &&
        network.sponsorUserId === sponsorUserId &&
        network.registrationStatus === 'active' &&
        network.packageTier === packageTier
    ).length;
  }

  private async postLedgerIfNeeded(input: {
    userId: string;
    entryType: ProductionWalletLedgerEntry['entryType'];
    sourceReference: string;
    creditAmount: number;
    processId: string;
    notes: string;
  }) {
    if (await this.repo.hasWalletLedgerProcess(input.processId)) {
      return;
    }
    const previous = await this.repo.listWalletLedgerEntriesForUser(input.userId);
    const balanceAfter = previous.reduce((sum, row) => sum + row.creditAmount - row.debitAmount, 0) + input.creditAmount;
    await this.repo.appendWalletLedgerEntry({
      id: crypto.randomUUID(),
      userId: input.userId,
      walletType: 'main',
      entryType: input.entryType,
      sourceReference: input.sourceReference,
      creditAmount: input.creditAmount,
      debitAmount: 0,
      balanceAfter,
      processId: input.processId,
      notes: input.notes,
      occurredAt: this.repo.now(),
      status: 'posted'
    });
  }

  private buildShareLink(referralCode: string, placementToken: string) {
    return `https://yor.local/register?ref=${encodeURIComponent(referralCode)}&placementToken=${encodeURIComponent(placementToken)}`;
  }

  private buildUsername(sequence: number) {
    return `YOR${String(sequence).padStart(4, '0')}`;
  }

  private buildReferralCode(sequence: number) {
    return `YOR-MEMBER-${String(sequence).padStart(4, '0')}`;
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
    const member = await this.repo.findMemberByUsername(username);
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
    activationCodes: [...(seed?.activationCodes ?? [])],
    codeEvents: [...(seed?.codeEvents ?? [])],
    walletLedger: [...(seed?.walletLedger ?? [])],
    salesmatchBalances: [...(seed?.salesmatchBalances ?? [])],
    queue: [...(seed?.queue ?? [])],
    reservations: [...(seed?.reservations ?? [])],
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
    findMemberByUsername: async (username) => state.members.find((item) => item.username === username) ?? null,
    findMemberByReferralCode: async (referralCode) => state.members.find((item) => item.referralCode === referralCode) ?? null,
    findUserByUsername: async (username) => {
      const member = state.members.find((item) => item.username === username);
      return member ? state.users.find((item) => item.id === member.userId) ?? null : null;
    },
    findUserByReferralCode: async (referralCode) => {
      const member = state.members.find((item) => item.referralCode === referralCode);
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
    listWalletLedgerEntriesForUser: async (userId) => state.walletLedger.filter((item) => item.userId === userId),
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
    findPlacementChild: async (parentUserId, side) =>
      state.networkAccounts.find(
        (item) => item.placementParentUserId === parentUserId && item.placementSide === side && item.registrationStatus === 'active'
      ) ?? null,
    saveSalesmatchBalance: async (balance) => {
      const index = state.salesmatchBalances.findIndex((item) => item.userId === balance.userId);
      if (index >= 0) {
        state.salesmatchBalances[index] = { ...balance };
      } else {
        state.salesmatchBalances.push({ ...balance });
      }
    },
    getSalesmatchBalance: async (userId) => state.salesmatchBalances.find((item) => item.userId === userId) ?? null,
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
    findPlacementReservationByToken: async (token) => state.reservations.find((item) => item.shareToken === token) ?? null
  };
}

import crypto from 'node:crypto';
import { packagePolicies, PV_PESO_RATE } from '../compensation/mvp-service.js';
import { repeatPurchaseProductCatalog } from '../compensation/repurchase-product-catalog.js';
import { createPasswordHashSync } from '../auth/password.js';
import type { MoneyMode, SessionUser } from '../../types/auth.js';
import { encodeReferralCode, decodeReferralCode } from '../../lib/referral-utils.js';
import { buildRegistrationUrl } from '../../lib/frontend-origin.js';

export type PackageTier = 'Basic' | 'Classic' | 'Standard' | 'Business' | 'VIP';
export type CodeFamily = 'YOR CODES' | 'YOR MAINTENANCE' | 'YOR PERFUME' | 'YOR VISION';
export type AccountType = 'PD' | 'FS';
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

export type PackageConfig = {
  packageTier: PackageTier;
  accountType: AccountType;
  directReferralBonus: number;
  salesmatchValue: number;
  salesmatchBinaryPoints: number;
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
        salesmatchBinaryPoints: policy.salesmatchValue / PV_PESO_RATE,
        binaryCyclePercent: policy.binaryCyclePercent ?? 0,
        getFiveAmount: packageTier === 'Basic' ? 0 : policy.price,
        binaryPoints: policy.pv
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
  payoutMethod?: string;
  payoutDetails?: string;
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
  createdAt: string;
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
  entryType: 'direct_referral' | 'salesmatch' | 'binary_cycle' | 'get_five' | 'lifestyle_rewards' | 'unilevel' | 'global_bonus';
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
    placementParentShadowSide?: PlacementSide | null;
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
      label: string;
      activationStatus: 'inactive' | 'activated';
      registrationEnabled: boolean;
      walletEnabled: boolean;
      unilevelEnabled: boolean;
      binaryCycleEnabled: boolean;
      note: string;
    };
    right: {
      id: string;
      owner: string;
      placement: 'right';
      state: 'reserved_shadow' | 'activated_shadow';
      label: string;
      activationStatus: 'inactive' | 'activated';
      registrationEnabled: boolean;
      walletEnabled: boolean;
      unilevelEnabled: boolean;
      binaryCycleEnabled: boolean;
      note: string;
    };
  };
  accountStateLabel: 'PD' | 'FS' | 'CD - Paid';
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
  listWalletLedgerEntriesForUser(userId: string): Promise<ProductionWalletLedgerEntry[]>;
  appendWalletLedgerEntry(entry: ProductionWalletLedgerEntry): Promise<void>;
  hasWalletLedgerProcess(processId: string): Promise<boolean>;
  saveUser(user: ProductionAppUser): Promise<void>;
  saveMemberProfile(profile: ProductionMemberProfile): Promise<void>;
  saveNetworkAccount(account: ProductionNetworkAccount): Promise<void>;
  findNetworkAccountByUserId(userId: string): Promise<ProductionNetworkAccount | null>;
  findPlacementChild(parentUserId: string, side: PlacementSide, shadowSide?: PlacementSide | null): Promise<ProductionNetworkAccount | null>;
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

function randomToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export class ProductionEncodingService {
  constructor(private readonly repo: ProductionEncodingRepository) {}

  async buildScopedBinaryGenealogyCenter(user: SessionUser, rootUsername?: string) {
    const signedInMember = await this.requireMemberByUserId(user.id);
    const members = await this.repo.listMembers();
    const networks = await Promise.all(members.map((member) => this.repo.findNetworkAccountByUserId(member.userId)));
    const membersByUserId = new Map(members.map((member) => [member.userId, member]));
    const networksByUserId = new Map(
      networks.filter((network): network is ProductionNetworkAccount => Boolean(network)).map((network) => [network.userId, network])
    );
    const membersByUsername = new Map(members.map((member) => [member.username, member]));
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

    const toShadowSlot = <TPlacement extends PlacementSide>(owner: ProductionMemberProfile, placement: TPlacement) => ({
      id: `${owner.username}-${placement.toUpperCase()}-SHADOW`,
      owner: owner.username,
      placement,
      state: 'reserved_shadow' as const,
      label: `${owner.username} ${placement === 'left' ? 'Left' : 'Right'} Shadow`,
      activationStatus: 'inactive' as const,
      registrationEnabled: true,
      walletEnabled: false,
      unilevelEnabled: false,
      binaryCycleEnabled: false,
      note: `Reserved ${placement} shadow support under ${owner.username}.`
    });

    const toAccountStateLabel = (network: ProductionNetworkAccount | null): 'PD' | 'FS' | 'CD - Paid' => {
      if (!network) {
        return 'PD';
      }
      if (network.currentAccountType === 'FS') {
        return 'FS';
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
          left: toShadowSlot(member, 'left'),
          right: toShadowSlot(member, 'right')
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

  async isCompanyRootAccount(user: SessionUser): Promise<boolean> {
    const member = await this.repo.findMemberByUserId(user.id);
    const upper = member?.username?.toUpperCase() ?? '';
    return upper === 'YOR0001' || upper === 'YOR01';
  }

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

  async buildAdminActivationCodeCenter(actorRole?: string) {
    const [codes, members] = await Promise.all([this.repo.listActivationCodes(), this.repo.listMembers()]);
    const memberByUserId = new Map(members.map((item) => [item.userId, item]));
    const isLooseCode = (code: ProductionActivationCode) => code.status === 'unreleased' && !code.assignedUserId;
    const filteredCodes = (actorRole === 'cashier') ? codes : codes.filter(code => !isLooseCode(code));
    const inventory = filteredCodes
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
            shareLink: this.buildShareLink(encodeReferralCode(member.username), activeReservation.shareToken)
          }
        : null,
      referralLink: activeReservation
        ? this.buildShareLink(encodeReferralCode(member.username), activeReservation.shareToken)
        : '',
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
        shareLink: this.buildShareLink(encodeReferralCode(sponsor.username), reservation.shareToken)
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
    const getFiveProcessId = buildProcessId('registration-get-five', sponsor.userId, selectedPackageTier.toUpperCase());
    await this.postLedgerIfNeeded({
      userId: sponsor.userId,
      entryType: 'direct_referral',
      sourceReference: finalUsername,
      creditAmount: matchingCode.lockedDirectReferralBonus,
      processId: directProcessId,
      notes: `Direct referral bonus from ${finalUsername}.`
    });

    const qualifiedSamePackageDirects = await this.countQualifiedDirectsBySponsorAndPackage(sponsor.userId, selectedPackageTier);
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
        placementParentShadowSide: preview.placement.placementParentShadowSide ?? null,
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
        packageTier: selectedPackageTier,
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
      let currentSide: PlacementSide = item.payload.placementParentShadowSide ?? item.payload.placementSide;

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
        balance.matchedSales += salesmatchDelta;
        balance.matchedPoints += pointsDelta;
        balance.updatedAt = this.repo.now();

        // Reduce both legs by the matched amount — weak leg zeroes out, strong leg carries forward residual.
        if (salesmatchDelta > 0) {
          balance.leftSales -= salesmatchDelta;
          balance.rightSales -= salesmatchDelta;
          balance.leftPoints -= pointsDelta;
          balance.rightPoints -= pointsDelta;
          network.leftPoints = Math.max(0, network.leftPoints - pointsDelta);
          network.rightPoints = Math.max(0, network.rightPoints - pointsDelta);
        }

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

        currentSide = network.placementParentShadowSide ?? currentSide;
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
    const codeFamily = (input.codeFamily ?? 'YOR CODES') as CodeFamily;
    const packageConfig = resolveActivationCodeTemplate(input.packageTier ?? 'Standard', codeFamily);
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
        codeFamily,
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
      detail: `Generated ${rows.length} ${packageConfig.packageTier} code(s) in ${codeFamily}.`
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

  async buildMemberWalletData(userId: string, encashAmount?: number) {
    const [member, ledgerEntries] = await Promise.all([
      this.repo.findMemberByUserId(userId),
      this.repo.listWalletLedgerEntriesForUser(userId)
    ]);

    if (!member) {
      throw new Error('Member profile not found.');
    }

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
      { streamId: 'global', label: 'Global Bonus', walletType: 'main', entryType: 'global_bonus' }
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
    const systemRetainer = payoutPreviewAmount * 0.05;
    const tax = payoutPreviewAmount * 0.10;
    const fee = processingFee + systemRetainer;
    const cdDeduction = 0;
    const totalDeductions = fee + tax + cdDeduction;
    const netReceivable = Math.max(0, payoutPreviewAmount - totalDeductions);

    const ENTRY_TYPE_LABELS: Record<string, string> = {
      direct_referral: 'Direct Referral',
      salesmatch: 'Salesmatch Bonus',
      binary_cycle: 'Binary Cycle Bonus',
      get_five: 'Get Yor Five Bonus',
      lifestyle_rewards: 'Lifestyle Rewards',
      unilevel: 'Unilevel Bonus',
      global_bonus: 'Global Bonus'
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
        cdBalance: 0,
        payoutMethod: member.payoutMethod ?? 'GCash',
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

  private buildReferralCode(sequence: number) {
    return encodeReferralCode(this.buildUsername(sequence));
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
    findPlacementChild: async (parentUserId, side, shadowSide) =>
      state.networkAccounts.find(
        (item) =>
          item.placementParentUserId === parentUserId &&
          item.placementSide === side &&
          item.registrationStatus === 'active' &&
          (shadowSide ? item.placementParentShadowSide === shadowSide : true)
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

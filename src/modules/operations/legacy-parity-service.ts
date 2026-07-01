import type {
  AdminMemberManagementCenter,
  MemberAccountStatus,
  SessionUser
} from '../../types/auth.js';
import { buildGatedWriteResponse, getWalletLedger, getMoneyMode } from '../compensation/mvp-service.js';
import { findProductByCodeFamily } from '../compensation/repurchase-product-catalog.js';
import { getProductionEncodingService, isProductionMode } from '../production/runtime.js';
import { encodeReferralCode, decodeReferralCode } from '../../lib/referral-utils.js';
import { buildRegistrationUrl } from '../../lib/frontend-origin.js';
import {
  getHybridMemberForUser,
  listHybridActivationRows,
  listHybridAuditEvents,
  listHybridMembers,
  listHybridPairingRows,
  listHybridPayoutRows,
  listHybridWalletRows,
  type MemberRecord
} from './hybrid-operational-data.js';
import {
  applySandboxMaintenanceCode,
  buildSandboxAdminActivationMetrics,
  buildSandboxAdminEncashments,
  buildSandboxRegistrationPreview,
  commitSandboxRegistration,
  generateSandboxActivationCodes,
  getSandboxWalletSummary,
  isSandboxMode,
  approveSandboxEncashment,
  reviewSandboxActivationCodes,
  reviewSandboxEncashment,
  reassignSandboxActivationCodes,
  releaseSandboxActivationCodes,
  renameSandboxMember,
  resetSandboxState,
  submitSandboxEncashment,
  transferSandboxActivationCodes,
  updateSandboxMemberCredentials,
  updateSandboxMemberPayout,
  updateSandboxMemberProfile,
  updateSandboxMemberStatus,
  upgradeSandboxMemberWithCode,
  findSandboxMemberByCode
} from '../sandbox/dev-sandbox-store.js';

const currency = (value: number): string =>
  `PHP ${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

type PlacementSide = 'root' | 'left' | 'right';
type ShadowSlotState = 'reserved_shadow' | 'activated_shadow';
type PublicRegistrationOrigin = 'referral-link' | 'genealogy-slot';

type PublicRegistrationInput = {
  origin?: PublicRegistrationOrigin;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
  password?: string;
  activationCode?: string;
  referralCode?: string;
  placementParentUsername?: string;
  placementSide?: 'left' | 'right';
  payoutOption?: string;
  payoutDetails?: string;
};

type GenealogyShadowSlot = {
  id: string;
  owner: string;
  placement: Extract<PlacementSide, 'left' | 'right'>;
  state: ShadowSlotState;
  label: string;
  activationStatus: 'inactive' | 'activated';
  registrationEnabled: boolean;
  walletEnabled: boolean;
  unilevelEnabled: boolean;
  binaryCycleEnabled: boolean;
  note: string;
};

type GenealogyNode = {
  nodeId: string;
  username: string;
  fullName: string;
  referralCode: string;
  packageTier: string;
  placement: PlacementSide;
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
    left: GenealogyShadowSlot;
    right: GenealogyShadowSlot;
  };
  accountStateLabel: string;
  children: GenealogyNode[];
};

function accountStateLabel(member: MemberRecord): GenealogyNode['accountStateLabel'] {
  if (member.cdBalance > 0) {
    return 'CD - Paid';
  }

  if (member.packageTier === 'VIP' || member.packageTier === 'Business') {
    return 'FS';
  }

  return 'PD';
}

function currentMoneyMode() {
  return getMoneyMode();
}

function transactionIdFor(index: number, prefix: string): string {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

function activationInventoryFor(member: MemberRecord) {
  return listHybridActivationRows().map((row, index) => ({
    id: transactionIdFor(index, 'CODE'),
    code: row.code,
    codeFamily: row.codeFamily ?? 'YOR CODES',
    accountType: row.accountType,
    packageTier: row.packageTier,
    assignedTo: row.assignedTo ?? 'Unassigned',
    status: row.status,
    generatedAt: row.generatedAt,
    transferable: row.assignedTo === member.username && row.status === 'available',
    upgradable: row.assignedTo === member.username && row.status === 'available',
    visibility:
      row.assignedTo === member.username
        ? row.status === 'available'
          ? 'released-by-sponsor'
          : 'reserved-awaiting-release'
        : row.status === 'unreleased'
          ? 'unreleased-admin-pool'
          : row.status === 'available'
            ? 'released-to-network'
            : 'used-by-network'
  }));
}

function findMemberByCode(code: string) {
  if (isSandboxMode()) {
    return findSandboxMemberByCode(code) ?? null;
  }

  const normalized = code.trim().toUpperCase();
  let found = listHybridMembers().find((member) => member.username.toUpperCase() === normalized || member.referralCode.toUpperCase() === normalized) ?? null;
  if (found) {
    return found;
  }
  try {
    const decodedUsername = decodeReferralCode(normalized).toUpperCase();
    if (decodedUsername) {
      found = listHybridMembers().find((member) => member.username.toUpperCase() === decodedUsername) ?? null;
    }
  } catch {
    // Ignore decoding errors
  }
  return found;
}

function isRegistrationReadyCode(row: { packageTier: string; status: string; codeFamily?: string }) {
  return row.status === 'available' && row.codeFamily !== 'YOR MAINTENANCE' && row.codeFamily !== 'YOR PERFUME' && row.codeFamily !== 'YOR VISION';
}

function resolveRegistrationSponsor(viewer: SessionUser | null, input: PublicRegistrationInput) {
  if (input.origin === 'genealogy-slot' && viewer) {
    return getHybridMemberForUser(viewer);
  }

  return input.referralCode ? findMemberByCode(input.referralCode.trim()) : null;
}

function resolveSlotOpen(children: GenealogyNode[], side: Extract<PlacementSide, 'left' | 'right'>) {
  return !children.some((child) => child.placement === side);
}

function buildShadowSlot(member: MemberRecord, side: Extract<PlacementSide, 'left' | 'right'>): GenealogyShadowSlot {
  const isActivatedSupport = member.stockist && side === 'left';

  return {
    id: `${member.username}-${side.toUpperCase()}-SHADOW`,
    owner: member.username,
    placement: side,
    state: isActivatedSupport ? 'activated_shadow' : 'reserved_shadow',
    label: 'Shadow account',
    activationStatus: isActivatedSupport ? 'activated' : 'inactive',
    registrationEnabled: false,
    walletEnabled: false,
    unilevelEnabled: false,
    binaryCycleEnabled: isActivatedSupport,
    note: isActivatedSupport
      ? 'Activated shadow support is visible in the binary tree for placement traceability; final earning rights stay policy-gated.'
      : 'Inactive shadow account reserved for this open left/right placement. Registering here converts the slot into a normal member account.'
  };
}

function walletTransactionRows(member: MemberRecord) {
  if (isSandboxMode()) {
    return getSandboxWalletSummary({
      id: member.userId,
      name: member.fullName,
      email: member.email,
      role: 'member'
    }).transactions;
  }

  const payouts = listHybridPayoutRows();
  const ledger = listHybridWalletRows();

  return [
    ...ledger.map((row, index) => ({
      id: transactionIdFor(index, 'WALLET'),
      date: row.date,
      category: row.type,
      source: row.source,
      gross: row.credit === currency(0) ? row.debit : row.credit,
      net: row.balance,
      status: row.status,
      type: 'wallet' as const
    })),
    ...payouts
      .filter((row) => row.member === member.username)
      .map((row, index) => ({
        id: transactionIdFor(index, 'ENC'),
        date: `2026-05-${String(24 - index * 7).padStart(2, '0')}`,
        category: 'encashment',
        source: row.reference,
        gross: row.gross,
        net: row.net,
        status: row.status,
        type: 'encashment' as const
      }))
  ];
}

function buildWalletIncomeBreakdown(transactions: ReturnType<typeof walletTransactionRows>) {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== 'wallet') {
      continue;
    }

    const grossValue = Number(String(transaction.gross).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(grossValue) || grossValue <= 0) {
      continue;
    }

    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + grossValue);
  }

  return [
    { streamId: 'direct-referral', label: 'Direct Referral', walletType: 'main', amount: totals.get('direct_referral') ?? 0 },
    { streamId: 'salesmatch', label: 'Salesmatch Bonus', walletType: 'main', amount: totals.get('salesmatch') ?? 0 },
    { streamId: 'binary-cycle', label: 'Binary Cycle Bonus', walletType: 'main', amount: totals.get('binary_cycle') ?? 0 },
    { streamId: 'get-five', label: 'Get Yor Five Bonus', walletType: 'main', amount: totals.get('get_five') ?? 0 },
    { streamId: 'lifestyle-rewards', label: 'Lifestyle Rewards', walletType: 'lifestyle', amount: totals.get('lifestyle_rewards') ?? 0 },
    { streamId: 'unilevel', label: 'Unilevel Bonus', walletType: 'main', amount: totals.get('unilevel') ?? 0 },
    { streamId: 'global', label: 'Global Bonus', walletType: 'main', amount: totals.get('global') ?? 0 }
  ];
}

function buildMemberBinaryTree(rootMember: MemberRecord): GenealogyNode {
  const allMembers = listHybridMembers();

  const buildRealNode = (member: MemberRecord, placement: PlacementSide, depth: number, path: string[]): GenealogyNode => {
    const nodeId = member.username;
    const pathWithNode = [...path, nodeId];

    const shadowLeft = buildShadowNode(nodeId, 'left', depth + 1, pathWithNode);
    const shadowRight = buildShadowNode(nodeId, 'right', depth + 1, pathWithNode);

    return {
      nodeId,
      username: member.username,
      fullName: member.fullName,
      referralCode: member.referralCode,
      packageTier: member.packageTier,
      placement,
      status: member.accountStatus,
      depth,
      tracePath: pathWithNode.join(' > '),
      binaryPoints: Math.min(member.leftPoints, member.rightPoints),
      directReferrals: member.directReferrals,
      leftPoints: member.leftPoints,
      rightPoints: member.rightPoints,
      openSlots: {
        left: false,
        right: false
      },
      shadowSlots: {
        left: buildShadowSlot(member, 'left'),
        right: buildShadowSlot(member, 'right')
      },
      accountStateLabel: accountStateLabel(member),
      children: [shadowLeft, shadowRight]
    };
  };

  const buildShadowNode = (parentUsername: string, placement: 'left' | 'right', depth: number, path: string[]): GenealogyNode => {
    const nodeId = `${parentUsername}-${placement === 'left' ? 'L' : 'R'}`;
    const pathWithNode = [...path, nodeId];

    const findShadowChildMember = (childSide: 'left' | 'right') =>
      allMembers.find(
        (member) =>
          member.placement === childSide &&
          ((member.placementParentUsername === parentUsername &&
            member.placementParentShadowSide === placement) ||
            (member.placementParentUsername === nodeId && !member.placementParentShadowSide) ||
            (member.placementParentUsername === parentUsername && parentUsername.indexOf('-') === -1 && !member.placementParentShadowSide))
      );

    const leftChildMember = findShadowChildMember('left');
    const rightChildMember = findShadowChildMember('right');

    const children: GenealogyNode[] = [];
    if (leftChildMember) {
      children.push(buildRealNode(leftChildMember, 'left', depth + 1, pathWithNode));
    }
    if (rightChildMember) {
      children.push(buildRealNode(rightChildMember, 'right', depth + 1, pathWithNode));
    }

    return {
      nodeId,
      username: nodeId,
      fullName: `Binary Function Only`,
      referralCode: '',
      packageTier: 'Binary Function Only',
      placement,
      status: 'shadow',
      depth,
      tracePath: pathWithNode.join(' > '),
      binaryPoints: 0,
      directReferrals: 0,
      leftPoints: 0,
      rightPoints: 0,
      openSlots: {
        left: !leftChildMember,
        right: !rightChildMember
      },
      shadowSlots: {
        left: null as any,
        right: null as any
      },
      accountStateLabel: 'Binary Function Only',
      children
    };
  };

  return buildRealNode(rootMember, 'root', 0, []);
}

function flattenTree(root: GenealogyNode) {
  const nodes: Array<Omit<GenealogyNode, 'children'> & { parentNodeId: string | null; level: number }> = [];

  function walk(node: GenealogyNode, parentNodeId: string | null, level: number) {
    const { children, ...rest } = node;
    nodes.push({
      ...rest,
      parentNodeId,
      level
    });

    for (const child of children) {
      walk(child, node.nodeId, level + 1);
    }
  }

  walk(root, null, 0);
  return nodes;
}

function buildSponsorTree(rootMember: MemberRecord): GenealogyNode {
  const allMembers = listHybridMembers();

  const createNode = (member: MemberRecord, placement: PlacementSide, depth = 0, path: string[] = []): GenealogyNode => {
    const children = allMembers
      .filter((candidate) => candidate.sponsorCode === member.referralCode)
      .slice(0, 6)
      .map((candidate) => createNode(candidate, candidate.placement, depth + 1, [...path, member.username]));

    return {
      nodeId: member.username,
      username: member.username,
      fullName: member.fullName,
      referralCode: member.referralCode,
      packageTier: member.packageTier,
      placement,
      status: member.accountStatus,
      depth,
      tracePath: [...path, member.username].join(' > '),
      binaryPoints: Math.min(member.leftPoints, member.rightPoints),
      directReferrals: member.directReferrals,
      leftPoints: member.leftPoints,
      rightPoints: member.rightPoints,
      openSlots: {
        left: resolveSlotOpen(children, 'left'),
        right: resolveSlotOpen(children, 'right')
      },
      shadowSlots: {
        left: buildShadowSlot(member, 'left'),
        right: buildShadowSlot(member, 'right')
      },
      accountStateLabel: accountStateLabel(member),
      children
    };
  };

  return createNode(rootMember, 'root');
}

function recommendPlacement(root: GenealogyNode) {
  const queue = [root];

  while (queue.length) {
    const node = queue.shift()!;

    if (node.openSlots.left) {
      return {
        placementUsername: node.username,
        placementSide: 'left',
        note: 'Recommended slot uses the first open left shadow account found in the current binary tree preview.'
      };
    }

    if (node.openSlots.right) {
      return {
        placementUsername: node.username,
        placementSide: 'right',
        note: 'Recommended slot uses the first open right shadow account found in the current binary tree preview.'
      };
    }

    queue.push(...node.children);
  }

  return {
    placementUsername: root.username,
    placementSide: 'left',
    note: 'Tree is full in the seeded preview, so registration remains review-only until a valid slot is approved.'
  };
}

export function buildMemberActivationCodeCenter(user: SessionUser) {
  const member = getHybridMemberForUser(user);
  const inventory = activationInventoryFor(member);
  const history = inventory
    .filter((item) => item.assignedTo === member.username || item.status === 'used')
    .slice(0, 4)
    .map((item, index) => ({
      id: `HISTORY-${index + 1}`,
      code: item.code,
      action: item.assignedTo === member.username ? 'owned' : 'network-use',
      counterparty: item.assignedTo === member.username ? member.username : item.assignedTo,
      occurredAt: item.generatedAt,
      status: item.status
    }));

  return {
    moneyMode: currentMoneyMode(),
    member: {
      username: member.username,
      packageTier: member.packageTier
    },
    inventory,
    history,
    transferTargets: [],
    hints: [
      isSandboxMode()
        ? 'Transfer, upgrade, and maintenance flows now commit into the current runtime inventory immediately.'
        : 'Transfer, upgrade, and maintenance code flows are available for workflow testing while write release remains controlled.',
      'Code ownership, uniqueness, transfer history, and upgrade idempotency are required before live enablement.'
    ]
  };
}

export function findMemberProfileByCode(code: string) {
  const m = findMemberByCode(code);
  if (!m) return null;
  return {
    username: m.username,
    fullName: m.fullName,
    packageTier: m.packageTier
  };
}

export function buildMemberWalletDetail(user: SessionUser, amount?: number) {
  if (isSandboxMode()) {
    return getSandboxWalletSummary(user, amount);
  }

  const member = getHybridMemberForUser(user);
  const transactions = walletTransactionRows(member);
  const payoutPreviewAmount = amount !== undefined && amount > 0
    ? Math.min(member.walletAvailable, amount)
    : 0;
  const processingFee = payoutPreviewAmount > 0 ? 50 : 0;
  const maintenanceFee = 0;
  const systemRetainer = payoutPreviewAmount * 0.05;
  const tax = payoutPreviewAmount * 0.10;
  const fee = processingFee + systemRetainer;
  const cdDeduction = Math.min(member.cdBalance, payoutPreviewAmount);
  const totalDeductions = fee + tax + cdDeduction;
  const netReceivable = Math.max(0, payoutPreviewAmount - totalDeductions);

  return {
    moneyMode: currentMoneyMode(),
    summary: {
      availableBalance: member.walletAvailable,
      pendingBalance: member.walletPending,
      cdBalance: member.cdBalance,
      payoutMethod: 'GCash',
      payoutSchedule: 'Tuesday encashment / Friday payout'
    },
    incomeBreakdown: buildWalletIncomeBreakdown(transactions),
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
      sufficientBalance: payoutPreviewAmount <= member.walletAvailable,
      note: isSandboxMode()
        ? 'Preview mirrors the local sandbox breakdown and submit will write into the branch-only queue.'
        : 'Preview mirrors the protected encashment breakdown, but final submit runs in playground mode for Yor MVP demos.'
    },
    ledger: getWalletLedger(),
    transactions
  };
}

export function buildMemberTransactionCenter(user: SessionUser) {
  const member = getHybridMemberForUser(user);
  const rows = walletTransactionRows(member);

  return {
    moneyMode: currentMoneyMode(),
    transactions: rows,
    detailById: Object.fromEntries(
      rows.map((row, index) => [
        row.id,
        {
          id: row.id,
          source: row.source,
          category: row.category,
          date: row.date,
          gross: row.gross,
          net: row.net,
          status: row.status,
          support: {
            directReferrals: listHybridMembers()
              .filter((candidate) => candidate.sponsorCode === member.referralCode)
              .slice(0, 3)
              .map((candidate) => ({
                username: candidate.username,
                fullName: candidate.fullName,
                packageTier: candidate.packageTier
              })),
            pairing: listHybridPairingRows().slice(0, 2),
            notes: [
      'Yor MVP keeps supporting traces readable for members even when the final ledger is simulation-only.',
              index === 0 && isSandboxMode()
                ? 'This row came from the branch-local sandbox store and can be reset without touching production.'
                : null,
              index === 0
                ? 'Exact contributor replay is limited to seeded parity data in this prototype.'
                : 'Transaction drilldown keeps source context visible where the prototype has supporting evidence.'
            ].filter((note): note is string => Boolean(note))
          }
        }
      ])
    )
  };
}

export function buildMemberRegistrationReadiness(user: SessionUser) {
  const member = getHybridMemberForUser(user);
  const inventory = activationInventoryFor(member);
  const tree = buildMemberBinaryTree(member);
  const placementRecommendation = recommendPlacement(tree);
  const referralLink = buildRegistrationUrl({
    ref: encodeReferralCode(member.username),
    origin: 'referral-link'
  });

  return {
    moneyMode: currentMoneyMode(),
    sponsor: {
      username: member.username,
      fullName: member.fullName,
      referralCode: member.referralCode
    },
    placementPolicy: {
      mode: 'auto-balanced',
      recommendation: placementRecommendation
    },
    referralLink,
    availableCodes: inventory.filter((item) => item.assignedTo === member.username && isRegistrationReadyCode(item)),
    checklist: [
      'Share the referral link with one activation code at a time.',
      'Registration package and account type are derived from the consumed activation code.',
      'Check username uniqueness and member identity duplication',
      'Backend auto-balance and code consumption are rechecked at final save.',
      'Refresh sponsor income simulation after registration'
    ]
  };
}

export function buildBinaryGenealogyCenter(user: SessionUser) {
  const member = getHybridMemberForUser(user);
  const root = buildMemberBinaryTree(member);

  return {
    moneyMode: currentMoneyMode(),
    treeType: 'binary-placement',
    root,
    nodes: flattenTree(root),
    notes: [
      'Direct sponsor genealogy and binary placement remain separate so placement and referral logic do not get mixed.',
      isSandboxMode()
        ? 'Open slots are live in the local sandbox so registration writes can be tested end to end.'
        : 'Open slots are visible for registration planning, but slot-claim writes run in playground mode for Yor MVP demos.'
    ]
  };
}

export function buildScopedBinaryGenealogyCenter(user: SessionUser, rootUsername?: string) {
  const member = getHybridMemberForUser(user);
  const memberRoot = buildMemberBinaryTree(member);
  const accessibleUsernames = new Set(flattenTree(memberRoot).map((node) => node.username));
  const requestedRoot = rootUsername ? findMemberByCode(rootUsername) : null;
  const resolvedRoot = requestedRoot ?? member;
  const root = resolvedRoot.username === member.username ? memberRoot : buildMemberBinaryTree(resolvedRoot);

  return {
    moneyMode: currentMoneyMode(),
    treeType: 'binary-placement',
    root,
    nodes: flattenTree(root),
    notes: [
      'Direct sponsor genealogy and binary placement remain separate so placement and referral logic do not get mixed.',
      resolvedRoot.username === member.username
        ? 'Tree is centered on the signed-in member root.'
        : `Tree is centered on ${resolvedRoot.username} for placement review.`,
      isSandboxMode()
        ? 'Open slots are live in the local sandbox so registration writes can be tested end to end.'
        : 'Open slots are visible for registration planning, but slot-claim writes run in playground mode for Yor MVP demos.'
    ]
  };
}

export function buildSponsorGenealogyCenter(user: SessionUser) {
  const member = getHybridMemberForUser(user);
  const root = buildSponsorTree(member);

  return {
    moneyMode: currentMoneyMode(),
    treeType: 'sponsor',
    root,
    nodes: flattenTree(root),
    notes: [
      'Sponsor genealogy is separated from binary placement so direct referral and unilevel review do not drift into pairing logic.',
      'This preview is searchable and read-only in the MVP.'
    ]
  };
}

export function buildAdminActivationCodeCenter() {
  if (isSandboxMode()) {
    return buildSandboxAdminActivationMetrics();
  }

  const inventory = listHybridActivationRows().map((row, index) => ({
    id: transactionIdFor(index, 'ADMIN-CODE'),
    ...row,
    assignedTo: row.assignedTo ?? 'Unassigned',
    generatedAt: row.generatedAt,
    transferable: row.status !== 'used' && row.status !== 'lost',
    releasable: row.status === 'unreleased'
  }));

  return {
    moneyMode: currentMoneyMode(),
    inventory,
    metrics: {
      totalCodes: inventory.length,
      availableCodes: inventory.filter((item) => item.status === 'available').length,
      unreleasedCodes: inventory.filter((item) => item.status === 'unreleased').length,
      usedCodes: inventory.filter((item) => item.status === 'used').length,
      lostCodes: inventory.filter((item) => item.status === 'lost').length,
      paidCodes: inventory.filter((item) => item.paymentStatus === 'paid' || item.paymentStatus === 'externally-paid').length
    },
    auditTrail: listHybridAuditEvents().filter((event) => event.action.includes('playground') || event.action.includes('sandbox') || event.action.includes('login')),
    transferTargets: listHybridMembers().map((candidate) => ({
      username: candidate.username,
      fullName: candidate.fullName,
      packageTier: candidate.packageTier
    })),
    hints: [
      'Batch generation, release, settlement review, lost-code tagging, and reassignment follow the current protected admin code workflow.',
      isSandboxMode()
        ? 'Yor sandbox keeps code creation writable in this branch without touching production or reference data.'
        : 'Yor keeps all code-creating actions available in playground while uniqueness and audit tests are accepted.'
    ]
  };
}

function allowedMemberActions(member: MemberRecord): string[] {
  const actions = ['view-income', 'check-genealogy', 'update-account'];

  if (member.cdBalance > 0) {
    actions.push('cd-details');
  }

  if (member.accountStatus !== 'frozen') {
    actions.push('freeze');
  }

  if (member.accountStatus !== 'suspended') {
    actions.push('suspend');
  }

  if (member.accountStatus !== 'active') {
    actions.push('activate');
  }

  return actions;
}

function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    rows: rows.slice(start, start + pageSize)
  };
}

export function buildAdminMemberManagementCenter(input: {
  query?: string;
  username?: string;
  page?: number;
  pageSize?: number;
} = {}): AdminMemberManagementCenter {
  const query = input.query?.trim().toUpperCase() ?? '';
  const pageSize = Math.min(Math.max(Number(input.pageSize ?? 10), 5), 100);
  const page = Math.max(Number(input.page ?? 1), 1);
  const members = listHybridMembers();
  const filtered = query
    ? members.filter(
        (member) =>
          member.username.toUpperCase().includes(query) ||
          member.fullName.toUpperCase().includes(query) ||
          member.referralCode.toUpperCase().includes(query)
      )
    : members;
  const paginated = paginateRows(filtered, page, pageSize);
  const selectedUsername = input.username?.trim() || (query && filtered[0]?.username) || '';
  const selectedMember =
    members.find((member) => member.username.trim().toUpperCase() === selectedUsername.trim().toUpperCase()) ?? null;

  return {
    moneyMode: currentMoneyMode(),
    query,
    page: paginated.page,
    pageSize: paginated.pageSize,
    total: paginated.total,
    totalPages: paginated.totalPages,
    rows: paginated.rows.map((member) => ({
      username: member.username,
      fullName: member.fullName,
      packageTier: member.packageTier,
      accountStatus: member.accountStatus as MemberAccountStatus,
      stockist: member.stockist,
      sponsorCode: member.sponsorCode,
      directReferrals: member.directReferrals,
      walletAvailable: currency(member.walletAvailable),
      cdBalance: currency(member.cdBalance),
      lastActivity: member.lastActivity,
      actions: allowedMemberActions(member)
    })),
    selectedMember: selectedMember
      ? {
          username: selectedMember.username,
          fullName: selectedMember.fullName,
          firstName: selectedMember.firstName,
          lastName: selectedMember.lastName,
          middleName: selectedMember.middleName ?? '',
          packageTier: selectedMember.packageTier,
          accountStatus: selectedMember.accountStatus as MemberAccountStatus,
          stockist: selectedMember.stockist,
          referralCode: selectedMember.referralCode,
          sponsorCode: selectedMember.sponsorCode,
          email: selectedMember.email,
          phone: selectedMember.phone ?? '',
          address: selectedMember.address ?? '',
          payoutOption: selectedMember.payoutOption ?? 'GCash',
          payoutDetails: selectedMember.payoutDetails ?? '',
          directReferrals: selectedMember.directReferrals,
          walletAvailable: currency(selectedMember.walletAvailable),
          walletPending: currency(selectedMember.walletPending),
          cdBalance: currency(selectedMember.cdBalance),
          lastActivity: selectedMember.lastActivity,
          actions: allowedMemberActions(selectedMember)
        }
      : null,
    actionNotes: [
      'Search is username-first so office operators can work against large member counts without dropdown friction.',
      'Profile editing mirrors the Nogatu update-account workflow while staying inside the Yor sandbox runtime.',
      'Freeze and suspend update sandbox access state immediately and can be reset after QA.'
    ]
  };
}

export function buildAdminEncashmentCenter(_viewer?: SessionUser) {
  if (isSandboxMode()) {
    return buildSandboxAdminEncashments();
  }

  const encashments = listHybridPayoutRows().map((row, index) => ({
    id: row.reference,
    queueOrder: index + 1,
    member: row.member,
    gross: row.gross,
    fee: row.fee,
    tax: row.tax,
    cdDeduction: row.cdDeduction,
    net: row.net,
    method: row.method,
    payoutDetails: '—',
    status: row.status,
    remarks: row.remarks,
    requestedAt: row.createdAt,
    reviewedBy: null,
    reviewedAt: null,
    paidAt: null,
    processId: row.reference
  }));

  return {
    moneyMode: currentMoneyMode(),
    encashments,
    totals: {
      gross: encashments.reduce((sum, item) => sum + parseCurrency(item.gross), 0),
      net: encashments.reduce((sum, item) => sum + parseCurrency(item.net), 0),
      awaitingReview: encashments.filter((item) => /requested|queued|verification|review|pending/i.test(item.status)).length
    },
    processNotes: [
      'Queue follows the Tuesday encashment / Friday release schedule language used in the protected office.',
      'Gross, deductions, remarks, and payout method remain visible so admin and superadmin can edit, cancel, queue, or mark paid with context.'
    ]
  };
}

export function buildAdminGenealogyCenter(
  treeType: 'binary-placement' | 'sponsor' = 'binary-placement',
  rootUsername?: string
) {
  const rootMember = rootUsername ? findMemberByCode(rootUsername) : findMemberByCode('yor01');
  const fallbackRoot = listHybridMembers()[0];
  const resolvedRoot = rootMember ?? fallbackRoot;
  const rootUser: SessionUser = {
    id: resolvedRoot.userId,
    name: resolvedRoot.fullName,
    email: resolvedRoot.email,
    role: 'member'
  };

  return treeType === 'sponsor'
    ? buildSponsorGenealogyCenter(rootUser)
    : buildBinaryGenealogyCenter(rootUser);
}

export function buildPublicRegistrationPreview(viewer: SessionUser | null, input: PublicRegistrationInput) {
  const resolvedSponsor = resolveRegistrationSponsor(viewer, input);
  const resolvedOrigin: PublicRegistrationOrigin = input.origin === 'genealogy-slot' ? 'genealogy-slot' : 'referral-link';

  if (isSandboxMode()) {
    return buildSandboxRegistrationPreview({
      origin: resolvedOrigin,
      fullName: input.fullName,
      username: input.username,
      sponsorUsername: resolvedSponsor?.username,
      activationCode: input.activationCode,
      placementParentUsername: input.placementParentUsername,
      placementSide: input.placementSide
    });
  }

  const sponsorInventory = resolvedSponsor
    ? activationInventoryFor(resolvedSponsor).filter((item) => item.assignedTo === resolvedSponsor.username && isRegistrationReadyCode(item))
    : [];
  const binaryTree = resolvedSponsor
    ? buildMemberBinaryTree(resolvedSponsor)
    : null;
  const placement =
    resolvedOrigin === 'genealogy-slot' && input.placementParentUsername && input.placementSide
      ? {
          placementUsername: input.placementParentUsername.endsWith('-L') || input.placementParentUsername.endsWith('-R')
            ? input.placementParentUsername.slice(0, -2)
            : input.placementParentUsername,
          placementParentShadowSide: input.placementParentUsername.endsWith('-L')
            ? 'left'
            : input.placementParentUsername.endsWith('-R')
              ? 'right'
              : null,
          placementSide: input.placementSide,
          note: 'Placement stays locked to the selected genealogy slot.'
        }
      : binaryTree
        ? recommendPlacement(binaryTree)
        : null;
  const requestedCode = input.activationCode?.trim().toUpperCase() ?? '';
  const matchingCode = requestedCode
    ? sponsorInventory.find((item) => item.code.toUpperCase() === requestedCode) ?? null
    : null;
  const issues = [
    resolvedSponsor ? null : resolvedOrigin === 'genealogy-slot' ? 'Sponsor session was not resolved for genealogy encoding.' : 'Referral link was not resolved to an active sponsor.',
    sponsorInventory.length ? null : 'Sponsor has no released activation code available for this registration preview.',
    requestedCode ? null : 'Activation code is required.',
    matchingCode ? null : 'Activation code is not available for this sponsor.',
    placement ? null : resolvedOrigin === 'genealogy-slot' ? 'Placement slot is not available.' : 'No placement recommendation is available.'
  ].filter((item): item is string => Boolean(item));

  return {
    moneyMode: currentMoneyMode(),
    origin: resolvedOrigin,
    canProceed: issues.length === 0,
    sponsor: resolvedSponsor
      ? {
          username: resolvedSponsor.username,
          fullName: resolvedSponsor.fullName,
          referralCode: resolvedSponsor.referralCode,
          packageTier: resolvedSponsor.packageTier
        }
      : null,
    selectedPackage: matchingCode?.packageTier ?? null,
    placementSide: placement?.placementSide ?? input.placementSide ?? null,
    resolvedAccountType: matchingCode?.accountType ?? null,
    matchingCode,
    placement,
    availableCodes: sponsorInventory,
    issues,
    checklist: [
      'Use only sponsor-owned released and unused activation codes.',
      'Package tier and account type come from the selected activation code.',
      'Re-check the placement slot immediately before final save.',
      isSandboxMode()
        ? 'Sandbox registration will consume the sponsor-owned code and create a real branch-only login.'
        : 'Keep registration in playground until policy approval allows the code to be consumed.'
    ]
  };
}

export function buildPublicRegistrationSubmit(viewer: SessionUser | null, input: PublicRegistrationInput) {
  const resolvedSponsor = resolveRegistrationSponsor(viewer, input);
  const resolvedOrigin: PublicRegistrationOrigin = input.origin === 'genealogy-slot' ? 'genealogy-slot' : 'referral-link';

  if (isSandboxMode()) {
    return commitSandboxRegistration('Public Registration', {
      origin: resolvedOrigin,
      fullName: input.fullName ?? '',
      username: input.username,
      email: input.email ?? '',
      phone: input.phone,
      password: input.password ?? '',
      sponsorUsername: resolvedSponsor?.username,
      activationCode: input.activationCode,
      placementParentUsername: input.placementParentUsername,
      placementSide: input.placementSide,
      payoutOption: input.payoutOption,
      payoutDetails: input.payoutDetails
    });
  }

  const preview = buildPublicRegistrationPreview(viewer, input);

  if (!preview.canProceed) {
    return buildGatedParityAction(
      'public-registration-submit',
      `Registration accepted: ${preview.issues.join(' ')}`
    );
  }

  return buildGatedParityAction(
    'public-registration-submit',
    `Registration flow validated for sponsor ${preview.sponsor?.username}, package ${preview.selectedPackage}, account type ${preview.resolvedAccountType}, and code ${preview.matchingCode?.code}. Final code consumption and tree placement run in playground mode in this MVP.`
  );
}

export function buildGatedParityAction(action: string, detail?: string) {
  return {
    ...buildGatedWriteResponse(action),
    detail:
      detail ??
      (isSandboxMode()
        ? 'This workflow now commits into the branch-local sandbox runtime and can be reset after testing.'
        : 'This control is intentionally live in the UI so the operating flow can be tested, while protected playground rules still prevent final value movement.')
  };
}

export function runMemberTransferActivationCodes(user: SessionUser, payload: { targetUsername: string; codes: string[] }) {
  return isSandboxMode()
    ? transferSandboxActivationCodes(user, payload.targetUsername, payload.codes)
    : buildGatedParityAction('member-transfer-activation-code');
}

export function runMemberUpgradeActivationCode(user: SessionUser, payload: { code: string }) {
  return isSandboxMode()
    ? upgradeSandboxMemberWithCode(user, payload.code)
    : buildGatedParityAction('member-upgrade-with-activation-code');
}

export async function runMemberMaintenanceCode(
  user: SessionUser,
  payload: { code: string; transType: number }
): Promise<unknown> {
  void payload.transType;
  if (isSandboxMode()) {
    return applySandboxMaintenanceCode(user, payload.code);
  }

  if (!isProductionMode()) {
    return buildGatedParityAction('member-maintenance-code-use');
  }

  const svc = getProductionEncodingService();
  if (!svc) {
    return buildGatedParityAction('member-maintenance-code-use');
  }

  // Load the activation code from the repo via the service's internal repo accessor.
  // We call the public encoding service method which validates ownership + family.
  const codeValue = payload.code.trim().toUpperCase();
  const member = await svc.getMemberProfileForUser(user.id);
  if (!member) {
    throw new Error('Member profile not found.');
  }

  // Use repo directly for the code lookup — svc exposes this via findActivationCodeForUser.
  const code = await svc.findOwnedMaintenanceCode(user.id, codeValue);
  if (!code) {
    throw new Error('Maintenance or refill code not found, not assigned to your account, or already used.');
  }

  const product = findProductByCodeFamily(code.codeFamily);
  if (!product) {
    throw new Error(`No product catalog entry for code family: ${code.codeFamily}`);
  }

  // Consume the code + fire unilevel + lifestyle credits.
  const result = await svc.consumeMaintenanceCode(user.id, codeValue, product.sku, member.packageTier);

  return {
    moneyMode: 'production' as const,
    action: 'member-maintenance-code-use',
    status: 'completed' as const,
    reason: 'Maintenance code consumed. Lifestyle and unilevel rewards posted.',
    detail: `Code ${codeValue} consumed. Lifestyle credited: PHP ${result.lifestyle.credited}. Unilevel levels: ${result.unilevel.levelsCredited}.`,
    lifestyle: result.lifestyle,
    unilevel: result.unilevel
  };
}

export function runMemberEncashment(user: SessionUser, amount: number) {
  return isSandboxMode()
    ? submitSandboxEncashment(user, amount)
    : buildGatedParityAction('member-wallet-encash');
}

export function runAdminGenerateActivationCodes(
  user: SessionUser,
  payload: { quantity: number; packageTier?: string; assignedTo?: string; accountType?: string; remarks?: string; codeFamily?: string }
) {
  return isSandboxMode()
    ? generateSandboxActivationCodes(
        user,
        payload.quantity,
        payload.packageTier,
        payload.assignedTo,
        payload.accountType,
        payload.remarks,
        payload.codeFamily
      )
    : buildGatedParityAction('admin-generate-activation-codes');
}

export function runAdminReleaseActivationCodes(user: SessionUser, payload: { codes: string[] }) {
  return isSandboxMode()
    ? releaseSandboxActivationCodes(user, payload.codes)
    : buildGatedParityAction('admin-release-activation-code');
}

export function runAdminTransferActivationCodes(
  user: SessionUser,
  payload: { targetUsername: string; codes: string[] }
) {
  return isSandboxMode()
    ? reassignSandboxActivationCodes(user, payload.targetUsername, payload.codes)
    : buildGatedParityAction('admin-transfer-activation-code');
}

export function runAdminChangeMemberName(
  user: SessionUser,
  payload: { username: string; fullName: string }
) {
  return isSandboxMode()
    ? renameSandboxMember(user, payload.username, payload.fullName)
    : buildGatedParityAction('admin-change-member-name');
}

export function runAdminUpdateMemberProfile(
  user: SessionUser,
  payload: {
    username: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    password?: string;
    payoutOption?: string;
    payoutDetails?: string;
    address?: string;
    contactNumber?: string;
    email?: string;
    newUsername?: string;
  }
) {
  return isSandboxMode()
    ? updateSandboxMemberProfile(user, payload.username, payload)
    : buildGatedParityAction('admin-update-member-profile');
}

export function runMemberUpdateCredentials(
  user: SessionUser,
  payload: { email?: string; password?: string }
) {
  return isSandboxMode()
    ? updateSandboxMemberCredentials(user, payload)
    : buildGatedParityAction('member-update-credentials');
}

export function runMemberUpdatePayout(
  user: SessionUser,
  payload: { payoutOption: string; payoutDetails: string }
) {
  return isSandboxMode()
    ? updateSandboxMemberPayout(user, payload)
    : buildGatedParityAction('member-update-payout');
}

export function runAdminUpdateMemberStatus(
  user: SessionUser,
  payload: {
    username: string;
    status: MemberAccountStatus;
  }
) {
  return isSandboxMode()
    ? updateSandboxMemberStatus(user, payload.username, payload.status)
    : buildGatedParityAction('admin-update-member-status');
}

export function runAdminApproveEncashment(user: SessionUser, encashmentId: string) {
  return isSandboxMode()
    ? approveSandboxEncashment(user, encashmentId)
    : buildGatedParityAction('admin-approve-encashment');
}

export function runAdminReviewEncashment(
  user: SessionUser,
  encashmentId: string,
  payload: {
    action: 'queue' | 'mark-paid' | 'cancel' | 'edit';
    method?: string;
    fee?: number;
    tax?: number;
    cdDeduction?: number;
    remarks?: string;
  }
) {
  return isSandboxMode()
    ? reviewSandboxEncashment(user, encashmentId, payload)
    : buildGatedParityAction('admin-review-encashment');
}

export function runAdminReviewActivationCodes(
  user: SessionUser,
  payload: {
    codes: string[];
    action: 'mark-paid' | 'mark-external-paid' | 'mark-lost' | 'restore';
    remarks?: string;
  }
) {
  return isSandboxMode()
    ? reviewSandboxActivationCodes(user, payload)
    : buildGatedParityAction('admin-review-activation-code');
}

export function runAdminResetSandbox(user: SessionUser) {
  if (!isSandboxMode()) {
    return buildGatedParityAction('admin-reset-sandbox');
  }

  const state = resetSandboxState();
  return {
    moneyMode: 'sandbox' as const,
    action: 'admin-reset-sandbox',
    status: 'completed' as const,
    reason: 'Sandbox runtime reset committed.',
    detail: `Sandbox reset by ${user.name}. Restored ${state.members.length} members, ${state.activationRows.length} activation codes, and ${state.payoutRows.length} encashment rows.`
  };
}

function parseCurrency(value: string): number {
  return Number(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

export function formatCurrency(value: number): string {
  return currency(value);
}

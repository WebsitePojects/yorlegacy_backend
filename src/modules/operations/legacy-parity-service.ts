import type { SessionUser } from '../../types/auth.js';
import { buildGatedWriteResponse, getWalletLedger, getMoneyMode } from '../compensation/mvp-service.js';
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
  resetSandboxState,
  submitSandboxEncashment,
  transferSandboxActivationCodes,
  upgradeSandboxMemberWithCode
} from '../sandbox/dev-sandbox-store.js';

const currency = (value: number): string =>
  `PHP ${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

type PlacementSide = 'root' | 'left' | 'right';

type GenealogyNode = {
  nodeId: string;
  username: string;
  fullName: string;
  packageTier: string;
  placement: PlacementSide;
  status: string;
  binaryPoints: number;
  directReferrals: number;
  leftPoints: number;
  rightPoints: number;
  openSlots: {
    left: boolean;
    right: boolean;
  };
  accountStateLabel: 'PD' | 'FS' | 'CD - Paid';
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
    packageTier: row.packageTier,
    assignedTo: row.assignedTo,
    status: row.status,
    generatedAt: row.generatedAt,
    transferable: row.assignedTo === member.username && row.status === 'available',
    upgradable: row.assignedTo === member.username && row.status === 'available',
    visibility:
      row.assignedTo === member.username
        ? 'released-by-sponsor'
        : row.assignedTo === 'available'
          ? 'unreleased-admin-pool'
          : 'used-by-network'
  }));
}

function findMemberByCode(code: string) {
  return listHybridMembers().find((member) => member.username === code || member.referralCode === code) ?? null;
}

function resolveSlotOpen(children: GenealogyNode[], side: Extract<PlacementSide, 'left' | 'right'>) {
  return !children.some((child) => child.placement === side);
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

function buildMemberBinaryTree(rootMember: MemberRecord): GenealogyNode {
  const allMembers = listHybridMembers();
  const createNode = (member: MemberRecord, placement: PlacementSide): GenealogyNode => {
    const children = allMembers
      .filter((candidate) => candidate.placementParentUsername === member.username)
      .map((candidate) => createNode(candidate, candidate.placement));

    return {
    nodeId: member.username,
    username: member.username,
    fullName: member.fullName,
    packageTier: member.packageTier,
    placement,
    status: member.accountStatus,
    binaryPoints: Math.min(member.leftPoints, member.rightPoints),
    directReferrals: member.directReferrals,
    leftPoints: member.leftPoints,
    rightPoints: member.rightPoints,
    openSlots: {
      left: resolveSlotOpen(children, 'left'),
      right: resolveSlotOpen(children, 'right')
    },
    accountStateLabel: accountStateLabel(member),
    children
    };
  };

  return createNode(rootMember, 'root');
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

  const createNode = (member: MemberRecord, placement: PlacementSide): GenealogyNode => {
    const children = allMembers
      .filter((candidate) => candidate.sponsorCode === member.referralCode)
      .slice(0, 6)
      .map((candidate) => createNode(candidate, candidate.placement));

    return {
      nodeId: member.username,
      username: member.username,
      fullName: member.fullName,
      packageTier: member.packageTier,
      placement,
      status: member.accountStatus,
      binaryPoints: Math.min(member.leftPoints, member.rightPoints),
      directReferrals: member.directReferrals,
      leftPoints: member.leftPoints,
      rightPoints: member.rightPoints,
      openSlots: {
        left: resolveSlotOpen(children, 'left'),
        right: resolveSlotOpen(children, 'right')
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
        note: 'Recommended slot uses the first open left position found in the current binary tree preview.'
      };
    }

    if (node.openSlots.right) {
      return {
        placementUsername: node.username,
        placementSide: 'right',
        note: 'Recommended slot uses the first open right position found in the current binary tree preview.'
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
    transferTargets: listHybridMembers()
      .filter((candidate) => candidate.username !== member.username)
      .map((candidate) => ({
        username: candidate.username,
        fullName: candidate.fullName,
        packageTier: candidate.packageTier
      })),
    hints: [
      isSandboxMode()
        ? 'Transfer, upgrade, and maintenance flows now commit into the local sandbox inventory immediately.'
        : 'Transfer, upgrade, and maintenance code flows are available for workflow testing. Yor MVP keeps those write paths in playground mode.',
      'Code ownership, uniqueness, transfer history, and upgrade idempotency are required before live enablement.'
    ]
  };
}

export function buildMemberWalletDetail(user: SessionUser) {
  if (isSandboxMode()) {
    return getSandboxWalletSummary(user);
  }

  const member = getHybridMemberForUser(user);
  const transactions = walletTransactionRows(member);
  const payoutPreviewAmount = Math.min(5000, Math.floor(member.walletAvailable / 100) * 100);
  const fee = payoutPreviewAmount > 0 ? 100 : 0;
  const cdDeduction = Math.min(member.cdBalance, Math.max(0, payoutPreviewAmount * 0.05));
  const netReceivable = Math.max(0, payoutPreviewAmount - fee - cdDeduction);

  return {
    moneyMode: currentMoneyMode(),
    summary: {
      availableBalance: member.walletAvailable,
      pendingBalance: member.walletPending,
      cdBalance: member.cdBalance,
      payoutMethod: 'GCash',
      payoutSchedule: 'Tuesday encashment / Friday payout'
    },
    preview: {
      requestedAmount: payoutPreviewAmount,
      fee,
      cdDeduction,
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

  return {
    moneyMode: currentMoneyMode(),
    sponsor: {
      username: member.username,
      fullName: member.fullName,
      referralCode: member.referralCode
    },
    placementPolicy: {
      mode: 'guided-manual',
      recommendation: placementRecommendation
    },
    referralLink: `https://yor.local/register?ref=${member.referralCode}`,
    availableCodes: inventory.filter((item) => item.assignedTo === member.username && item.status === 'available'),
    checklist: [
      'Validate activation code ownership and package compatibility',
      'Check username uniqueness and member identity duplication',
      'Re-check placement availability before save',
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
    generatedAt: row.generatedAt,
    transferable: row.status === 'available',
    releasable: row.status === 'available'
  }));

  return {
    moneyMode: currentMoneyMode(),
    inventory,
    metrics: {
      totalCodes: inventory.length,
      availableCodes: inventory.filter((item) => item.status === 'available').length,
      usedCodes: inventory.filter((item) => item.status === 'used').length
    },
    auditTrail: listHybridAuditEvents().filter((event) => event.action.includes('playground') || event.action.includes('sandbox') || event.action.includes('login')),
    hints: [
      'Batch generation, release, and reassignment follow the current protected admin code workflow.',
      isSandboxMode()
        ? 'Yor sandbox keeps code creation writable in this branch without touching production or reference data.'
        : 'Yor keeps all code-creating actions available in playground while uniqueness and audit tests are accepted.'
    ]
  };
}

export function buildAdminEncashmentCenter() {
  if (isSandboxMode()) {
    return buildSandboxAdminEncashments();
  }

  const encashments = listHybridPayoutRows().map((row, index) => ({
    id: row.reference,
    queueOrder: index + 1,
    member: row.member,
    gross: row.gross,
    fee: row.fee,
    cdDeduction: row.cdDeduction,
    net: row.net,
    method: row.method,
    status: row.status
  }));

  return {
    moneyMode: currentMoneyMode(),
    encashments,
    totals: {
      gross: encashments.reduce((sum, item) => sum + parseCurrency(item.gross), 0),
      net: encashments.reduce((sum, item) => sum + parseCurrency(item.net), 0),
      awaitingReview: encashments.filter((item) => /verification|review/i.test(item.status)).length
    },
    processNotes: [
      'Queue follows the Tuesday encashment / Friday release schedule language used in the protected office.',
      'Approve and reject actions stay accepted until Yor payout rules are fully approved and tested.'
    ]
  };
}

export function buildAdminGenealogyCenter(
  treeType: 'binary-placement' | 'sponsor' = 'binary-placement',
  rootUsername?: string
) {
  const rootMember = rootUsername ? findMemberByCode(rootUsername) : findMemberByCode('YOR0001');
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

export function buildPublicRegistrationPreview(input: {
  sponsorCode?: string;
  packageTier?: string;
  preferredSide?: 'left' | 'right';
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
}) {
  if (isSandboxMode()) {
    return buildSandboxRegistrationPreview(input);
  }

  const sponsor = input.sponsorCode ? findMemberByCode(input.sponsorCode.trim()) : null;
  const sponsorInventory = sponsor
    ? activationInventoryFor(sponsor).filter((item) => item.assignedTo === sponsor.username && item.status === 'available')
    : [];
  const binaryTree = sponsor
    ? buildMemberBinaryTree(sponsor)
    : null;
  const placement = binaryTree ? recommendPlacement(binaryTree) : null;
  const matchingCode = sponsorInventory.find((item) => item.packageTier.toLowerCase() === String(input.packageTier ?? '').toLowerCase()) ?? sponsorInventory[0] ?? null;
  const issues = [
    sponsor ? null : 'Sponsor code was not resolved to an active member.',
    sponsorInventory.length ? null : 'Sponsor has no released activation code available for this registration preview.',
    placement ? null : 'No placement recommendation is available.'
  ].filter((item): item is string => Boolean(item));

  return {
    moneyMode: currentMoneyMode(),
    canProceed: issues.length === 0,
    sponsor: sponsor
      ? {
          username: sponsor.username,
          fullName: sponsor.fullName,
          referralCode: sponsor.referralCode,
          packageTier: sponsor.packageTier
        }
      : null,
    selectedPackage: input.packageTier ?? null,
    preferredSide: input.preferredSide ?? null,
    matchingCode,
    placement,
    availableCodes: sponsorInventory,
    issues,
    checklist: [
      'Use only sponsor-owned released codes for registration.',
      'Confirm the package tier matches the selected code.',
      'Re-check the placement slot immediately before final save.',
      isSandboxMode()
        ? 'Sandbox registration will consume the sponsor-owned code and create a real branch-only login.'
        : 'Keep registration in playground until policy approval allows the code to be consumed.'
    ]
  };
}

export function buildPublicRegistrationSubmit(input: {
  sponsorCode?: string;
  packageTier?: string;
  preferredSide?: 'left' | 'right';
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
}) {
  if (isSandboxMode()) {
    return commitSandboxRegistration('Public Registration', {
      fullName: input.fullName ?? '',
      email: input.email ?? '',
      phone: input.phone,
      password: input.password ?? '',
      sponsorCode: input.sponsorCode,
      packageTier: input.packageTier,
      preferredSide: input.preferredSide
    });
  }

  const preview = buildPublicRegistrationPreview(input);

  if (!preview.canProceed) {
    return buildGatedParityAction(
      'public-registration-submit',
      `Registration accepted: ${preview.issues.join(' ')}`
    );
  }

  return buildGatedParityAction(
    'public-registration-submit',
    `Registration flow validated for sponsor ${preview.sponsor?.username}, package ${preview.selectedPackage}, and code ${preview.matchingCode?.code}. Final code consumption and tree placement run in playground mode in this MVP.`
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

export function runMemberMaintenanceCode(user: SessionUser, payload: { code: string; transType: number }) {
  void payload.transType;
  return isSandboxMode()
    ? applySandboxMaintenanceCode(user, payload.code)
    : buildGatedParityAction('member-maintenance-code-use');
}

export function runMemberEncashment(user: SessionUser, amount: number) {
  return isSandboxMode()
    ? submitSandboxEncashment(user, amount)
    : buildGatedParityAction('member-wallet-encash');
}

export function runAdminGenerateActivationCodes(
  user: SessionUser,
  payload: { quantity: number; packageTier?: string; assignedTo?: string }
) {
  return isSandboxMode()
    ? generateSandboxActivationCodes(user, payload.quantity, payload.packageTier, payload.assignedTo)
    : buildGatedParityAction('admin-generate-activation-codes');
}

export function runAdminApproveEncashment(user: SessionUser, encashmentId: string) {
  return isSandboxMode()
    ? approveSandboxEncashment(user, encashmentId)
    : buildGatedParityAction('admin-approve-encashment');
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

import type {
  AppRole,
  AuditEvent,
  GatedAction,
  OperationalMetric,
  OperationalModule,
  OperationalQueue,
  ReportTable,
  SessionUser
} from '../../types/auth.js';
import {
  buildSandboxWalletRows,
  getSandboxMoneyMode,
  isSandboxMode,
  listSandboxActivationRows,
  listSandboxAuditEvents,
  listSandboxMembers,
  listSandboxPairingRows,
  listSandboxPayoutRows,
  type ActivationRow,
  type MemberRecord,
  type PairingRow,
  type PayoutRow
} from '../sandbox/dev-sandbox-store.js';
import { packagePolicies } from '../compensation/mvp-service.js';
import { isProductionMode } from '../production/runtime.js';

const STAFF_ROLES: AppRole[] = ['admin', 'cashier', 'bod', 'superadmin'];
const ADMIN_AND_SUPERADMIN_ROLES: AppRole[] = ['admin', 'bod', 'superadmin'];
const CASHIER_CODE_ROLES: AppRole[] = ['cashier', 'admin', 'bod', 'superadmin'];
const FINANCE_ROLES: AppRole[] = ['admin', 'bod', 'superadmin'];
const EXECUTIVE_ROLES: AppRole[] = ['admin', 'bod', 'superadmin'];
const ALL_OPS_ROLES: AppRole[] = ['admin', 'cashier', 'bod', 'superadmin'];
const OPERATIONAL_ADMIN_MODULE_IDS = new Set([
  'dashboard',
  'member-management',
  'account-details',
  'encashment-reports',
  'account-shadow-management',
  'account-genealogy',
  'finance-accounting',
  'cd-accounts',
  'voucher-management',
  'rankings',
  'leaderboard',
  'contact-messages',
  'news-posts',
  'change-password',
  'activation-codes'
]);
const OPERATIONAL_MEMBER_MODULE_IDS = new Set([
  'dashboard',
  'wallet',
  'account-details',
  'transactions',
  'direct-referrals',
  'salesmatch-bonus',
  'genealogy',
  'account-shadow-management',
  'activation-codes',
  'upgrade-registration',
  'global-bonus-eligibility'
]);

export type { MemberRecord } from '../sandbox/dev-sandbox-store.js';

type AdminScopeProfile = {
  accessScope?: string;
  officeTitle?: string;
};

const money = (value: number): string =>
  `PHP ${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

function packagePolicyForTier(packageTier: string) {
  return packagePolicies.find((policy) => policy.name.toLowerCase() === packageTier.toLowerCase()) ?? null;
}

const members: MemberRecord[] = [
  {
    userId: 'yor-member-demo',
    username: 'yor01',
    fullName: 'Yor Company01',
    firstName: 'Yor',
    lastName: 'Company01',
    email: 'yor01@yor.local',
    packageTier: 'Standard',
    accountStatus: 'active',
    referralCode: 'YOR-MEMBER-001',
    sponsorCode: 'YOR-MEMBER-000',
    placement: 'root',
    placementParentUsername: null,
    directReferrals: 5,
    leftPoints: 24000,
    rightPoints: 18000,
    walletAvailable: 15200.75,
    walletPending: 4300,
    cdBalance: 0,
    stockist: false,
    lastActivity: '2026-05-28'
  },
  {
    userId: 'yor-legacy-002',
    username: 'YOR0002',
    fullName: 'Alyssa Cruz',
    firstName: 'Alyssa',
    lastName: 'Cruz',
    email: 'alyssa.cruz@example.test',
    packageTier: 'Business',
    accountStatus: 'active',
    referralCode: 'YOR-MEMBER-002',
    sponsorCode: 'yor01-ref',
    placement: 'left',
    placementParentUsername: 'yor01',
    placementParentShadowSide: 'left',
    directReferrals: 3,
    leftPoints: 12000,
    rightPoints: 8000,
    walletAvailable: 8950,
    walletPending: 1500,
    cdBalance: 500,
    stockist: false,
    lastActivity: '2026-05-27'
  },
  {
    userId: 'yor-legacy-003',
    username: 'YOR0003',
    fullName: 'Marco Reyes',
    firstName: 'Marco',
    lastName: 'Reyes',
    email: 'marco.reyes@example.test',
    packageTier: 'VIP',
    accountStatus: 'active',
    referralCode: 'YOR-MEMBER-003',
    sponsorCode: 'yor01-ref',
    placement: 'right',
    placementParentUsername: 'yor01',
    placementParentShadowSide: 'right',
    directReferrals: 7,
    leftPoints: 18000,
    rightPoints: 21000,
    walletAvailable: 31420,
    walletPending: 6100,
    cdBalance: 0,
    stockist: true,
    lastActivity: '2026-05-26'
  },
  {
    userId: 'yor-legacy-004',
    username: 'YOR0004',
    fullName: 'Nica Santos',
    firstName: 'Nica',
    lastName: 'Santos',
    email: 'nica.santos@example.test',
    packageTier: 'Classic',
    accountStatus: 'pending',
    referralCode: 'YOR-MEMBER-004',
    sponsorCode: 'YOR-MEMBER-002',
    placement: 'left',
    placementParentUsername: 'YOR0002',
    placementParentShadowSide: 'left',
    directReferrals: 1,
    leftPoints: 2500,
    rightPoints: 1500,
    walletAvailable: 700,
    walletPending: 300,
    cdBalance: 0,
    stockist: false,
    lastActivity: '2026-05-25'
  },
  {
    userId: 'yor-legacy-005',
    username: 'YOR0005',
    fullName: 'Ramon Dela Cruz',
    firstName: 'Ramon',
    lastName: 'Dela Cruz',
    email: 'ramon.dc@example.test',
    packageTier: 'Basic',
    accountStatus: 'active',
    referralCode: 'YOR-MEMBER-005',
    sponsorCode: 'YOR-MEMBER-003',
    placement: 'right',
    placementParentUsername: 'YOR0003',
    placementParentShadowSide: 'right',
    directReferrals: 2,
    leftPoints: 3000,
    rightPoints: 4000,
    walletAvailable: 1850,
    walletPending: 250,
    cdBalance: 150,
    stockist: true,
    lastActivity: '2026-05-24'
  }
];

const walletRows = [
  {
    date: '2026-05-28',
    type: 'direct_referral',
    source: 'YOR-MEMBER-002',
    credit: money(5000),
    debit: money(0),
    balance: money(15200.75),
    status: 'posted'
  },
  {
    date: '2026-05-27',
    type: 'salesmatch',
    source: 'yor01 L/R match',
    credit: money(7500),
    debit: money(0),
    balance: money(10200.75),
    status: 'posted'
  },
  {
    date: '2026-05-24',
    type: 'encashment_fee',
    source: 'ENC-20260524-001',
    credit: money(0),
    debit: money(470),
    balance: money(6730),
    status: 'deducted'
  }
];

const pairingRows: PairingRow[] = [
  {
    week: '2026-W22',
    leftPoints: 24000,
    rightPoints: 18000,
    matchedPoints: 18000,
    salesmatch: money(15000),
    carryForward: '6,000 left pts'
  },
  {
    week: '2026-W21',
    leftPoints: 16000,
    rightPoints: 12000,
    matchedPoints: 12000,
    salesmatch: money(10000),
    carryForward: '4,000 left pts'
  }
];

const payoutRows: PayoutRow[] = [
  {
    reference: 'ENC-20260524-001',
    member: 'yor01',
    gross: money(8000),
    fee: money(450),
    tax: money(800),
    maintenanceFee: money(0),
    systemRetainer: money(400),
    cdDeduction: money(0),
    net: money(6750),
    status: 'paid',
    method: 'GCash',
    remarks: 'Paid during Friday release batch.',
    createdAt: '2026-05-24T08:00:00Z'
  },
  {
    reference: 'ENC-20260517-002',
    member: 'YOR0003',
    gross: money(12500),
    fee: money(675),
    tax: money(1250),
    maintenanceFee: money(0),
    systemRetainer: money(625),
    cdDeduction: money(500),
    net: money(10075),
    status: 'requested',
    method: 'Bank',
    remarks: 'Awaiting operator review and payout note.',
    createdAt: '2026-05-17T08:00:00Z'
  }
];

const activationRows: ActivationRow[] = [
  {
    code: 'PDSTYQ8M4K',
    accountType: 'PD',
    packageTier: 'Standard',
    assignedTo: 'yor01',
    status: 'used',
    paymentStatus: 'paid',
    remarks: 'Consumed in prior registration cycle.',
    generatedAt: '2026-05-20'
  },
  {
    code: 'FSBUP3N9XA',
    accountType: 'FS',
    packageTier: 'Business',
    assignedTo: 'YOR0002',
    status: 'used',
    paymentStatus: 'externally-paid',
    remarks: 'Settled member-to-member outside office.',
    generatedAt: '2026-05-21'
  },
  {
    code: 'PDSTK7V2LC',
    accountType: 'PD',
    packageTier: 'Standard',
    assignedTo: 'yor01',
    status: 'available',
    paymentStatus: 'paid',
    remarks: 'Paid and ready for release cycle.',
    generatedAt: '2026-05-28'
  },
  {
    code: 'FSBUZ6Q1RH',
    accountType: 'FS',
    packageTier: 'Business',
    assignedTo: null,
    status: 'unreleased',
    paymentStatus: 'unpaid',
    remarks: 'General code pool inventory.',
    generatedAt: '2026-05-28'
  }
];

const auditEvents: AuditEvent[] = [
  {
    actor: 'Yor Super Admin',
    action: 'login_verified',
    target: 'yoradmin@gmail.com',
    occurredAt: '2026-05-28T10:00:00Z'
  },
  {
    actor: 'System',
    action: 'cors_origin_allowed',
    target: 'http://localhost:5173/',
    occurredAt: '2026-05-28T09:50:00Z'
  },
  {
    actor: 'System',
    action: 'money_actions_playground',
    target: 'encashment/payout/code mutation',
    occurredAt: '2026-05-28T09:45:00Z'
  }
];

function currentMoneyMode() {
  if (isSandboxMode()) return getSandboxMoneyMode();
  if (isProductionMode()) return 'production' as const;
  return 'playground' as const;
}

function currentMembers() {
  return isSandboxMode() ? listSandboxMembers() : members;
}

function currentActivationRows() {
  return isSandboxMode() ? listSandboxActivationRows() : activationRows;
}

function currentPairingRows() {
  return isSandboxMode() ? listSandboxPairingRows() : pairingRows;
}

function currentPayoutRows() {
  return isSandboxMode() ? listSandboxPayoutRows() : payoutRows;
}

function currentAuditEvents() {
  return isSandboxMode() ? listSandboxAuditEvents() : auditEvents;
}

function currentWalletRows(memberUsername?: string) {
  return isSandboxMode() ? buildSandboxWalletRows(memberUsername) : walletRows;
}

function directMembersFor(member: MemberRecord) {
  return currentMembers().filter((candidate) => candidate.sponsorCode === member.referralCode);
}

function samePackageDirectCount(member: MemberRecord) {
  return directMembersFor(member).filter((candidate) => candidate.packageTier === member.packageTier).length;
}

function completedDirectGroups(member: MemberRecord) {
  return Math.floor(samePackageDirectCount(member) / 5);
}

function directsRemainingToNextGroup(member: MemberRecord) {
  const remainder = samePackageDirectCount(member) % 5;
  return remainder === 0 ? 0 : 5 - remainder;
}

function shadowRowsForMember(member: MemberRecord) {
  return [
    {
      owner: member.username,
      placement: 'left',
      state: member.stockist ? 'activated_shadow' : 'reserved_shadow',
      walletEnabled: 'no',
      unilevelEnabled: 'no',
      binaryCycleEnabled: 'no',
      note: member.stockist
        ? 'Shadow slot may carry upgraded PV for salesmatch support only. It is not a registration surface and never earns direct referral, unilevel, or binary cycle.'
        : 'Reserved shadow slot only. Registration happens in the open child slots below it, not on the shadow node itself.'
    },
    {
      owner: member.username,
      placement: 'right',
      state: 'reserved_shadow',
      walletEnabled: 'no',
      unilevelEnabled: 'no',
      binaryCycleEnabled: 'no',
      note: 'Inactive shadow slot shown for placement visibility. It does not open registration on the node itself.'
    }
  ];
}

function subtreeMembers(rootUsername: string, side: 'left' | 'right') {
  const all = currentMembers();
  const directRoot = all.find((member) => member.placementParentUsername === rootUsername && member.placement === side);

  if (!directRoot) {
    return [] as MemberRecord[];
  }

  const collected: MemberRecord[] = [];
  const queue = [directRoot.username];

  while (queue.length) {
    const parentUsername = queue.shift()!;
    const member = all.find((candidate) => candidate.username === parentUsername);

    if (member) {
      collected.push(member);
      all
        .filter((candidate) => candidate.placementParentUsername === member.username)
        .forEach((child) => queue.push(child.username));
    }
  }

  return collected;
}

const branchRuntimeNotes: GatedAction[] = [
  {
    label: 'Controlled runtime',
    reason: 'Office workflows are active for end-to-end testing in the current runtime without changing production or the legacy reference system.',
    requiredEvidence: 'Production sign-off, append-only ledger hardening, and release-grade approval workflow still remain separate.'
  },
  {
    label: 'Reset available',
    reason: 'You can re-run registration, code, and encashment workflows because the current runtime data can be restored to a clean seeded state.',
    requiredEvidence: 'Use the runtime reset control before a fresh QA pass or when test data becomes noisy.'
  }
];

function activationRowsForDisplay(rows: ActivationRow[]) {
  return rows.map((row) => ({
    ...row,
    assignedTo: row.assignedTo ?? 'Unassigned'
  }));
}

function table(title: string, rows: Array<Record<string, string | number>>): ReportTable {
  const first = rows[0] ?? {};

  return {
    title,
    columns: Object.keys(first).map((key) => ({
      key,
      label: key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase())
    })),
    rows
  };
}

function metric(
  label: string,
  value: string,
  detail?: string,
  tone: OperationalMetric['tone'] = 'neutral'
): OperationalMetric {
  return { label, value, detail, tone };
}

function memberDirectoryRows() {
  return currentMembers().map((member) => ({
    username: member.username,
    name: member.fullName,
    package: member.packageTier,
    status: member.accountStatus,
    sponsor: member.sponsorCode,
    directReferrals: member.directReferrals,
    wallet: money(member.walletAvailable),
    lastActivity: member.lastActivity
  }));
}

function genealogyRows() {
  return currentMembers().map((member) => ({
    username: member.username,
    sponsor: member.sponsorCode,
    placement: member.placement,
    package: member.packageTier,
    leftPoints: member.leftPoints,
    rightPoints: member.rightPoints,
    directReferrals: member.directReferrals
  }));
}

function incomeRows() {
  return currentMembers().map((member) => ({
    username: member.username,
    package: member.packageTier,
    directReferral: money(member.directReferrals * 1000),
    salesmatch: money(Math.min(member.leftPoints, member.rightPoints) * 0.5),
    pending: money(member.walletPending),
    cdBalance: money(member.cdBalance)
  }));
}

function simpleRows(label: string, status = currentMoneyMode()) {
  return [
    {
      area: label,
      status,
      moneyMode: currentMoneyMode(),
      evidence: 'Rule sign-off, process key, append-only ledger, duplicate-prevention tests'
    }
  ];
}

function memberMvpModule(
  id: string,
  label: string,
  group: string,
  description: string,
  rows = simpleRows(label)
): OperationalModule {
  return {
    id,
    label,
    path: `/member/${id}`,
    group,
    description,
    status: 'read-only',
    legacyReference: 'Yor MVP compensation prototype',
    permissions: ['member', ...STAFF_ROLES],
    metrics: [],
    table: table(label, rows),
    gatedActions: []
  };
}

function adminMvpModule(
  id: string,
  label: string,
  group: string,
  description: string,
  permissions: AppRole[] = ALL_OPS_ROLES,
  rows: Array<Record<string, string | number>> = simpleRows(label)
): OperationalModule {
  return {
    id,
    label,
    path: `/admin/${id}`,
    group,
    description,
    status: id.includes('payout') || id.includes('payment') || id.includes('wallet')
      ? (isSandboxMode() ? 'sandbox-write' : 'playground-write')
      : 'read-only',
    legacyReference: 'Yor MVP admin prototype',
    permissions,
    metrics: [],
    table: table(label, rows),
    gatedActions: isSandboxMode()
      ? []
      : id.includes('payout') || id.includes('payment') || id.includes('wallet')
        ? branchRuntimeNotes
        : []
  };
}

function adminModules(): OperationalModule[] {
  const memberRows = memberDirectoryRows();
  const treeRows = genealogyRows();
  const walletRowsForTables = currentWalletRows();
  const payoutRowsForTables = currentPayoutRows();
  const activationRowsForTables = currentActivationRows();
  const auditRows = currentAuditEvents();
  const allMembers = currentMembers();

  const modules: OperationalModule[] = [
    {
      id: 'dashboard',
      label: 'Operations Dashboard',
      path: '/admin/dashboard',
      group: 'Overview',
      description: isSandboxMode()
        ? 'Live snapshot for member volume, payout exposure, and current office operations.'
        : 'Live report snapshot for member volume, payout exposure, and approval-controlled office operations.',
      status: 'live-report',
      legacyReference: 'adminpanel/admin-dashboard.php',
      permissions: EXECUTIVE_ROLES,
      metrics: [
        metric('Total Accounts', String(allMembers.length), 'Hybrid parity seed'),
        metric(
          'Paid Accounts',
          String(allMembers.filter((member) => member.accountStatus === 'active' && member.cdBalance <= 0 && member.packageTier !== 'Business' && member.packageTier !== 'VIP').length)
        ),
        metric('Free Slot Accounts', String(allMembers.filter((member) => member.packageTier === 'Business' || member.packageTier === 'VIP').length)),
        metric('CD Accounts', String(allMembers.filter((member) => member.cdBalance > 0).length)),
        metric(
          'Pending Encashments',
          String(payoutRowsForTables.filter((row) => /requested|queued|verification|pending/i.test(row.status)).length),
          undefined,
          'warning'
        )
      ],
      table: table('Operational account snapshot', memberRows),
      gatedActions: isSandboxMode() ? [] : branchRuntimeNotes
    },
    {
      id: 'member-management',
      label: 'Member Management',
      path: '/admin/member-management',
      group: 'Accounts',
      description: 'Search, review, and update member profile names and contact-ready account details.',
      status: 'live-report',
      legacyReference: 'adminpanel/account-masterlist.php',
      permissions: ADMIN_AND_SUPERADMIN_ROLES,
      metrics: [metric('Accounts Indexed', String(allMembers.length)), metric('Pending Accounts', String(allMembers.filter((member) => member.accountStatus === 'pending').length), undefined, 'warning')],
      table: table('Members', memberRows),
      gatedActions: []
    },
    {
      id: 'account-details',
      label: 'Account Details',
      path: '/admin/account-details',
      group: 'Accounts',
      description: 'Search and update member profile names. Cashier can edit names only; admin can edit full profile.',
      status: isSandboxMode() ? 'sandbox-write' : 'playground-write',
      legacyReference: 'adminpanel/account-details.php',
      permissions: CASHIER_CODE_ROLES,
      metrics: [metric('Accounts Indexed', String(allMembers.length))],
      table: table('Account details', memberRows),
      gatedActions: []
    },
    {
      id: 'encashment-reports',
      label: 'Encashment Reports',
      path: '/admin/encashment-reports',
      group: 'Finance',
      description: 'Tuesday encashment / Friday payout report with net amounts and CD deductions visible.',
      status: isSandboxMode() ? 'sandbox-write' : 'playground-write',
      legacyReference: 'adminpanel/accounts-encashment.php',
      permissions: ADMIN_AND_SUPERADMIN_ROLES,
      metrics: [metric('Encashment Requests', String(payoutRowsForTables.length)), metric('Net Payable', money(payoutRowsForTables.reduce((sum, row) => sum + (typeof row.net === 'string' ? Number(String(row.net).replace(/[^0-9.-]/g, '')) || 0 : Number(row.net) || 0), 0)))],
      table: table('Encashments', payoutRowsForTables),
      gatedActions: isSandboxMode() ? [] : branchRuntimeNotes
    },
    adminMvpModule(
      'account-shadow-management',
      'Shadow Accounts',
      'Network',
      'Reserved and activated shadow-account visibility kept explicit while final earning policy remains gated.',
      ADMIN_AND_SUPERADMIN_ROLES,
      allMembers.flatMap((member) => shadowRowsForMember(member))
    ),
    {
      id: 'account-genealogy',
      label: 'Account Genealogy',
      path: '/admin/account-genealogy',
      group: 'Network',
      description: 'Search-first binary genealogy for left/right placement review, registration planning, and pairing traceability.',
      status: 'live-report',
      legacyReference: 'adminpanel/account-genealogy.php',
      permissions: EXECUTIVE_ROLES,
      metrics: [metric('Left Points', '59,500'), metric('Right Points', '52,500')],
      table: table('Binary placements', treeRows),
      gatedActions: []
    },
    adminMvpModule(
      'finance-accounting',
      'Finance Accounting',
      'Finance',
      'Wallet exposure, payout rows, CD deductions, and accounting review in the Nogatu admin accounting pattern.',
      ADMIN_AND_SUPERADMIN_ROLES,
      currentWalletRows().map((row) => ({
        date: row.date,
        type: row.type,
        source: row.source,
        credit: row.credit,
        debit: row.debit,
        balance: row.balance,
        status: row.status
      }))
    ),
    adminMvpModule(
      'cd-accounts',
      'CD Accounts',
      'Finance',
      'Credit-deduction account balances and settlement readiness carried from the legacy CD account workflow.',
      ADMIN_AND_SUPERADMIN_ROLES,
      allMembers.map((member) => ({
        username: member.username,
        package: member.packageTier,
        cdBalance: money(member.cdBalance),
        status: member.cdBalance > 0 ? 'still paying CD' : 'clear',
        lastActivity: member.lastActivity
      }))
    ),
    adminMvpModule(
      'voucher-management',
      'Voucher Management',
      'Vouchers',
      'Voucher inventory and release review aligned to Yor package and activation-code controls.',
      CASHIER_CODE_ROLES,
      activationRowsForTables.map((row) => ({
        code: row.code,
        accountType: row.accountType,
        package: row.packageTier,
        owner: row.assignedTo ?? 'Unassigned',
        status: row.status,
        generatedAt: row.generatedAt
      }))
    ),
    adminMvpModule(
      'rankings',
      'Rankings',
      'Compensation',
      'Rank and volume progress report based on direct referral, binary point, and package-level signals.',
      ADMIN_AND_SUPERADMIN_ROLES,
      allMembers.map((member) => ({
        username: member.username,
        package: member.packageTier,
        directReferrals: member.directReferrals,
        leftPoints: member.leftPoints,
        rightPoints: member.rightPoints,
        currentRank: member.packageTier === 'VIP' ? 'VIP builder' : 'building'
      }))
    ),
    adminMvpModule(
      'leaderboard',
      'Rank & Leaderboard',
      'Compensation',
      'Unilevel rank by lifetime total income and the all-member income leaderboard (company accounts excluded).',
      ADMIN_AND_SUPERADMIN_ROLES
    ),
    adminMvpModule(
      'global-bonus',
      'Global Bonus',
      'Compensation',
      'Global pool qualifier review; money writes stay evidence-gated until the Yor global-bonus policy is fully ported.',
      ADMIN_AND_SUPERADMIN_ROLES,
      allMembers.map((member) => ({
        username: member.username,
        package: member.packageTier,
        eligible: member.packageTier === 'VIP' ? 'candidate' : 'building qualification',
        basis: 'Yor 2% annual global sales pool reference / Nogatu qualifier port in progress'
      }))
    ),
    {
      id: 'get-five-reports',
      label: 'Get Yor Five Reports',
      path: '/admin/get-five-reports',
      group: 'Compensation',
      description: 'Five-direct qualification review aligned to the Yor compensation plan terminology.',
      status: 'read-only',
      legacyReference: 'adminpanel/accounts-redeem.php',
      permissions: EXECUTIVE_ROLES,
      metrics: [
        metric('Qualified Members', String(currentMembers().filter((candidate) => samePackageDirectCount(candidate) >= 5).length)),
        metric(
          'Claimable Groups',
          String(currentMembers().reduce((total, candidate) => total + completedDirectGroups(candidate), 0))
        )
      ],
      table: table(
        'Get Yor Five review',
        currentMembers().map((candidate) => ({
          username: candidate.username,
          package: candidate.packageTier,
          directSamePackage: samePackageDirectCount(candidate),
          completedGroups: completedDirectGroups(candidate),
          remainingToNextGroup: directsRemainingToNextGroup(candidate),
          status: samePackageDirectCount(candidate) >= 5 ? 'qualified' : 'building'
        }))
      ),
      gatedActions: []
    },
    {
      id: 'contact-messages',
      label: 'Contact Messages',
      path: '/admin/contact-messages',
      group: 'Content',
      description: 'Review and manage contact form submissions from the public site.',
      status: 'read-only' as const,
      legacyReference: 'adminpanel/contact-messages.php',
      permissions: ADMIN_AND_SUPERADMIN_ROLES,
      metrics: [metric('Total Messages', '0'), metric('Unread', '0', undefined, 'warning')],
      table: table('Contact Messages', []),
      gatedActions: []
    },
    {
      id: 'news-posts',
      label: 'News & Posts',
      path: '/admin/news-posts',
      group: 'Content',
      description: 'Manage news, announcements, memos, and promotions visible on the public site.',
      status: 'read-only' as const,
      legacyReference: 'adminpanel/news-posts.php',
      permissions: ADMIN_AND_SUPERADMIN_ROLES,
      metrics: [metric('Published Posts', '0'), metric('Drafts', '0')],
      table: table('Posts', []),
      gatedActions: []
    },
    {
      id: 'change-password',
      label: 'Change Password',
      path: '/admin/change-password',
      group: 'Settings',
      description: 'Update administrator account passwords.',
      status: 'read-only' as const,
      legacyReference: 'adminpanel/change-password.php',
      permissions: ADMIN_AND_SUPERADMIN_ROLES,
      metrics: [],
      table: table('Password Changes', []),
      gatedActions: []
    },
    {
      id: 'activation-codes',
      label: 'Manage Codes',
      path: '/admin/activation-codes',
      group: 'Codes',
      description: isSandboxMode()
        ? 'Generate general codes, release them, review settlement, and transfer sponsor-owned activation codes from one office control surface.'
        : 'Activation code inventory, payment review, and assignment report with approval-controlled generation.',
      status: isSandboxMode() ? 'sandbox-write' : 'playground-write',
      legacyReference: 'adminpanel/manage-codes.php, adminpanel/generate-codes.php',
      permissions: CASHIER_CODE_ROLES,
      metrics: [
        metric('Codes Tracked', String(activationRowsForTables.length)),
        metric('Released', String(activationRowsForTables.filter((row) => row.status === 'available').length)),
        metric('Awaiting Release', String(activationRowsForTables.filter((row) => row.status === 'unreleased').length), undefined, 'warning')
      ],
      table: table('Activation codes', activationRowsForDisplay(activationRowsForTables)),
      gatedActions: isSandboxMode() ? [] : branchRuntimeNotes
    }
  ];

  return modules.filter((module) => OPERATIONAL_ADMIN_MODULE_IDS.has(module.id));
}

function memberModules(member: MemberRecord): OperationalModule[] {
  const walletRowsForMember = currentWalletRows(member.username);
  const pairRows = currentPairingRows();
  const treeRows = genealogyRows();
  const memberRows = currentMembers();
  const activationRowsForMember = currentActivationRows();
  const memberPolicy = packagePolicyForTier(member.packageTier);
  const sameTierDirects = samePackageDirectCount(member);
  const completedGroups = completedDirectGroups(member);
  const directsRemaining = directsRemainingToNextGroup(member);
  const lifestyleTarget = memberPolicy?.lifestyleRepeatPurchase ?? 0;
  const lifestyleCurrent = lifestyleTarget ? Math.round(lifestyleTarget * 0.72) : 0;
  const lifestyleRate = lifestyleCurrent ? lifestyleCurrent * 0.01 : 0;
  const unilevelRows = [
    { level: '01', percent: '10%', requiredPV: '200 PV', potential: 'PHP 10,000', status: 'building' },
    { level: '02', percent: '8%', requiredPV: '200 PV', potential: 'PHP 100,000', status: 'building' },
    { level: '03', percent: '5%', requiredPV: '200 PV', potential: 'PHP 1,000,000', status: 'building' },
    { level: '04', percent: '5%', requiredPV: '200 PV', potential: 'PHP 10,000,000', status: 'locked' },
    { level: '05', percent: '3%', requiredPV: '200 PV', potential: 'PHP 100,000,000', status: 'locked' },
    { level: '06', percent: '3%', requiredPV: '200 PV', potential: 'PHP 1,000,000,000', status: 'locked' },
    { level: '07-10', percent: '2% / 1% / 1% / 1%', requiredPV: '200 PV', potential: 'PHP 10,000,000,000+', status: 'long-range' }
  ];
  const includeGlobalBonus = true;

  return ([
    {
      id: 'dashboard',
      label: 'Member Dashboard',
      path: '/member/dashboard',
      group: 'Overview',
      description: 'Personal account, wallet, package, and binary readiness snapshot.',
      status: 'live-report',
      legacyReference: 'ecom/mydashboard.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [
        metric('Available Wallet', money(member.walletAvailable)),
        metric('Pending Wallet', money(member.walletPending), 'Awaiting payout window', 'warning'),
        metric('Direct Referrals', String(member.directReferrals))
      ],
      table: table('Account snapshot', [
        {
          username: member.username,
          package: member.packageTier,
          sponsor: member.sponsorCode,
          leftPoints: member.leftPoints,
          rightPoints: member.rightPoints,
          status: member.accountStatus
        }
      ]),
      gatedActions: isSandboxMode() ? [] : branchRuntimeNotes
    },
    {
      id: 'wallet',
      label: 'E-Wallet',
      path: '/member/wallet',
      group: 'Finance',
      description: 'Wallet ledger with credits, deductions, fees, and balance-after values.',
      status: 'read-only',
      legacyReference: 'ecom/ewallet.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Available', money(member.walletAvailable)), metric('Pending', money(member.walletPending))],
      table: table('Wallet ledger', walletRowsForMember),
      gatedActions: isSandboxMode() ? [] : branchRuntimeNotes
    },
    {
      id: 'account-details',
      label: 'Account Details',
      path: '/member/account-details',
      group: 'Account',
      description: 'Personal profile, sponsor code, payout method, and live account state.',
      status: 'live-report',
      legacyReference: 'ecom/account-details.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Account Status', member.accountStatus), metric('Payout Method', 'GCash')],
      table: table('Profile', [
        {
          username: member.username,
          name: member.fullName,
          email: member.email,
          referralCode: member.referralCode,
          sponsorCode: member.sponsorCode,
          package: member.packageTier
        }
      ]),
      gatedActions: []
    },
    {
      id: 'transactions',
      label: 'Transactions',
      path: '/member/transactions',
      group: 'Finance',
      description: 'Wallet and encashment history in the same reporting pattern used across the protected Yor member office.',
      status: 'read-only',
      legacyReference: 'ecom/transactions-details.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Transactions', String(walletRowsForMember.length))],
      table: table('Transactions', walletRowsForMember),
      gatedActions: []
    },
    {
      id: 'direct-referrals',
      label: 'Direct Referrals',
      path: '/member/direct-referrals',
      group: 'Network',
      description: 'Direct sponsorship list kept separate from the binary placement tree.',
      status: 'live-report',
      legacyReference: 'ecom/mydirectreferrals.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Direct Referrals', String(member.directReferrals))],
      table: table(
        'Direct referrals',
        memberRows
          .filter((row) => row.sponsorCode === member.referralCode)
          .map((row) => ({
            username: row.username,
            name: row.fullName,
            package: row.packageTier,
            status: row.accountStatus,
            placement: row.placement
          }))
      ),
      gatedActions: []
    },
    {
      id: 'salesmatch-bonus',
      label: 'Salesmatch Bonus',
      path: '/member/salesmatch-bonus',
      group: 'Compensation',
      description: 'Left/right matching report with carry-forward visibility and seeded pairing references.',
      status: 'read-only',
      legacyReference: 'ecom/pairing-reports.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Current Left', String(member.leftPoints)), metric('Current Right', String(member.rightPoints))],
      table: table('Salesmatch snapshots', pairRows),
      gatedActions: []
    },
    {
      id: 'genealogy',
      label: 'Binary Tree',
      path: '/member/genealogy',
      group: 'Network',
      description: 'Binary placement tree used for registration planning and placement review.',
      status: 'live-report',
      legacyReference: 'ecom/genealogy.php, ecom/genealogy-tree.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Tree Nodes', String(memberRows.length))],
      table: table('Tree placements', treeRows),
      gatedActions: []
    },
    {
      id: 'account-shadow-management',
      label: 'Shadow Accounts',
      path: '/member/account-shadow-management',
      group: 'Network',
      description: 'Reserved and activated shadow-account visibility aligned to the transcript-style network explanation.',
      status: 'read-only',
      legacyReference: 'yor-shadow-account-transcript',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [
        metric('Shadow Slots', String(shadowRowsForMember(member).length)),
        metric('Activated Shadow PV', member.stockist ? 'Enabled' : 'Not yet')
      ],
      table: table('Shadow account states', shadowRowsForMember(member)),
      gatedActions: []
    },
    {
      id: 'get-five-bonus',
      label: 'Get Yor Five Bonus',
      path: '/member/get-five-bonus',
      group: 'Compensation',
      description: 'Progress toward the five-direct same-package milestone defined in the Yor compensation plan.',
      status: 'read-only',
      legacyReference: 'ecom/hifive-bonus.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [
        metric('Direct Same Package', String(sameTierDirects)),
        metric('Claimable Groups', String(completedGroups)),
        metric('Next Milestone', directsRemaining === 0 ? 'ready now' : `${directsRemaining} remaining`)
      ],
      table: table('Get Yor Five progress', [
        {
          package: member.packageTier,
          directSamePackage: sameTierDirects,
          completedGroups,
          remainingToNextGroup: directsRemaining,
          target: 5,
          status: sameTierDirects >= 5 ? 'qualified' : 'building'
        }
      ]),
      gatedActions: []
    },
    {
      id: 'get-yor-five',
      label: 'Get Yor Five',
      path: '/member/get-yor-five',
      group: 'Compensation',
      description: 'Full Get Yor Five progress — per-tier referral counts, completed groups, and wallet ledger entries.',
      status: 'live-report',
      legacyReference: 'ecom/hifive-bonus.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [
        metric('Direct Same Package', String(sameTierDirects)),
        metric('Completed Groups', String(completedGroups)),
        metric('Next Milestone', directsRemaining === 0 ? 'ready now' : `${directsRemaining} remaining`)
      ],
      table: table('Get Yor Five overview', [
        {
          package: member.packageTier,
          directSamePackage: sameTierDirects,
          completedGroups,
          remainingToNextGroup: directsRemaining,
          target: 5,
          status: sameTierDirects >= 5 ? 'qualified' : 'building'
        }
      ]),
      gatedActions: []
    },
    {
      id: 'activation-codes',
      label: 'Activation Codes',
      path: '/member/activation-codes',
      group: 'Codes',
      description: 'Owned and available activation code visibility.',
      status: 'read-only',
      legacyReference: 'ecom/myactivation-codes.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Owned Codes', String(activationRowsForMember.filter((row) => row.assignedTo === member.username).length))],
      table: table('Activation codes', activationRowsForDisplay(activationRowsForMember.filter((row) => row.assignedTo === member.username || row.assignedTo === null))),
      gatedActions: []
    },
    {
      id: 'support',
      label: 'Support',
      path: '/member/support',
      group: 'Support',
      description: 'Support contact and operational escalation surface.',
      status: 'live-report',
      legacyReference: 'ecom/support-contact.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Open Tickets', '0', undefined, 'good')],
      table: table('Support channels', [
        { channel: 'Operations', contact: 'admin@yor.local', purpose: 'Account and activation support' },
        { channel: 'Cashier', contact: 'cashier@yor.local', purpose: 'Encashment schedule questions' }
      ]),
      gatedActions: []
    },
    {
      id: 'upgrade-registration',
      label: 'Upgrade / Registration',
      path: '/member/upgrade-registration',
      group: 'Growth',
      description: isSandboxMode()
        ? 'Upgrade and new registration readiness with active code consumption and account creation in the current runtime.'
        : 'Upgrade and new registration readiness with approval-controlled writes.',
      status: isSandboxMode() ? 'sandbox-write' : 'playground-write',
      legacyReference: 'ecom/upgrade-account.php, ecom/new-account-registration.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Current Package', member.packageTier), metric('Upgrade Writes', isSandboxMode() ? 'Sandbox' : 'Playground', undefined, isSandboxMode() ? 'good' : 'warning')],
      table: table('Upgrade readiness', [
        { currentPackage: member.packageTier, nextPackage: 'Business', status: 'requires activation code and rule verification' }
      ]),
      gatedActions: isSandboxMode() ? [] : branchRuntimeNotes
    },
    {
      id: 'lifestyle-rewards',
      label: 'Lifestyle Rewards',
      path: '/member/lifestyle-rewards',
      group: 'Compensation',
      description: 'Repeat purchase reward progress, lifestyle-wallet threshold, and monthly target visibility.',
      status: 'read-only',
      legacyReference: 'yor-lifestyle-repeat-purchase',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [
        metric('Repeat Purchase', lifestyleTarget ? money(lifestyleCurrent) : 'Not eligible'),
        metric('Projected Credit', lifestyleTarget ? money(lifestyleRate) : 'Not eligible')
      ],
      table: table('Lifestyle rewards progress', [
        {
          package: member.packageTier,
          repeatPurchaseTarget: lifestyleTarget ? money(lifestyleTarget) : 'Not eligible',
          currentRepeatPurchase: lifestyleTarget ? money(lifestyleCurrent) : 'Not eligible',
          progressPercent: lifestyleTarget ? `${Math.min(100, Math.round((lifestyleCurrent / lifestyleTarget) * 100))}%` : '0%',
          projectedReward: lifestyleTarget ? money(lifestyleRate) : 'Not eligible',
          thresholdStatus: lifestyleTarget && lifestyleCurrent >= 1000 ? 'lifestyle wallet ready' : 'building threshold'
        }
      ]),
      gatedActions: []
    },
    {
      id: 'unilevel-rank-progress',
      label: 'Unilevel / Rank Progress',
      path: '/member/unilevel-rank-progress',
      group: 'Compensation',
      description: 'Ten-level public percentages, rank path visibility, and the 11 billion potential-income illustration.',
      status: 'read-only',
      legacyReference: 'yor-unilevel-rank',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Potential Income', 'PHP 11 Billion'), metric('Levels Visible', '10 Levels')],
      table: table('Unilevel rank ladder', unilevelRows),
      gatedActions: []
    },
    memberMvpModule('binary-cycle-bonus', 'Binary Cycle Bonus', 'Compensation', 'Cycle percentage simulations tied to salesmatch movement.')
  ] as OperationalModule[]).concat(
    includeGlobalBonus
      ? [
          {
            id: 'global-bonus-eligibility',
            label: 'Global Bonus Eligibility',
            path: '/member/global-bonus-eligibility',
            group: 'Compensation',
            description: 'Annual global bonus qualification, maintenance, and pool-basis visibility for every member.',
            status: 'read-only',
            legacyReference: 'yor-global-bonus',
            permissions: ['member', ...STAFF_ROLES],
            metrics: [
              metric('Eligibility', member.packageTier === 'VIP' ? 'Hall of Famer review' : 'Building qualification'),
              metric('Maintenance Window', 'Nogatu continuity port in progress')
            ],
            table: table('Global bonus eligibility', [
              {
                package: member.packageTier,
                qualification: member.packageTier === 'VIP' ? 'Hall of Famer review' : 'Below Hall of Famer tier',
                maintenance: 'Progress remains visible while Nogatu continuity rules are being wired',
                pool: '2% yearly global sales pool',
                status: member.packageTier === 'VIP' ? 'qualifying path visible' : 'visible but not yet qualified'
              }
            ]),
            gatedActions: []
          }
        ]
      : []
  ).filter((module) => OPERATIONAL_MEMBER_MODULE_IDS.has(module.id));
}

function effectiveOpsRole(user: SessionUser, profile?: AdminScopeProfile | null): AppRole {
  if (profile?.accessScope === 'cashier') {
    return 'cashier';
  }

  if (profile?.accessScope === 'bod') {
    return 'bod';
  }

  if (profile?.accessScope === 'superadmin') {
    return 'superadmin';
  }

  return user.role;
}

function canSeeModule(
  user: SessionUser,
  module: OperationalModule,
  profile?: AdminScopeProfile | null
): boolean {
  return module.permissions.includes(effectiveOpsRole(user, profile));
}

function currentMemberFor(user: SessionUser): MemberRecord {
  const activeMembers = currentMembers();
  return activeMembers.find((member) => member.userId === user.id || member.email === user.email) ?? activeMembers[0];
}

export function listHybridMembers(): MemberRecord[] {
  return currentMembers().map((member) => ({ ...member }));
}

export function listHybridWalletRows() {
  return currentWalletRows().map((row) => ({ ...row }));
}

export function listHybridPairingRows() {
  return currentPairingRows().map((row) => ({ ...row }));
}

export function listHybridPayoutRows() {
  return currentPayoutRows().map((row) => ({ ...row }));
}

export function listHybridActivationRows() {
  return currentActivationRows().map((row) => ({ ...row }));
}

export function listHybridAuditEvents(): AuditEvent[] {
  return currentAuditEvents().map((event) => ({ ...event }));
}

export function listOperationalCatalog() {
  const summary = ({ id, label, path, group, status, permissions }: OperationalModule) => ({
    id,
    label,
    path,
    group,
    status,
    permissions: [...permissions]
  });

  return {
    memberModules: memberModules(currentMembers()[0]).map(summary),
    adminModules: adminModules().map(summary)
  };
}

export function getHybridMemberForUser(user: SessionUser): MemberRecord {
  return { ...currentMemberFor(user) };
}

export function buildOpsOfficeSnapshot(
  user: SessionUser,
  profile: AdminScopeProfile | null
) {
  const activeMembers = currentMembers();
  const activePayoutRows = currentPayoutRows();
  const activeActivationRows = currentActivationRows();
  const activeAuditEvents = currentAuditEvents();
  const visibleModules = adminModules().filter((module) => canSeeModule(user, module, profile));
  const pendingEncashments = activePayoutRows.filter((row) => row.status.includes('verification') || row.status.includes('pending')).length;
  const queues: OperationalQueue[] = [
    { label: 'Pending account verification', count: activeMembers.filter((member) => member.accountStatus === 'pending').length, status: 'watch' },
    { label: 'Encashment review', count: pendingEncashments, status: pendingEncashments > 0 ? 'attention' : 'clear' },
    { label: 'Activation code inventory', count: activeActivationRows.filter((row) => row.status === 'available').length, status: 'watch' }
  ];

  return {
    user,
    profile: {
      accessScope: profile?.accessScope ?? user.role,
      officeTitle: profile?.officeTitle ?? (user.role === 'cashier' ? 'Cashier Office' : 'Operations Office')
    },
    metrics: [
      metric('Total Accounts', String(activeMembers.length), 'Hybrid parity seed'),
      metric(
        'Paid Accounts',
        String(activeMembers.filter((member) => member.accountStatus === 'active' && member.cdBalance <= 0 && member.packageTier !== 'Business' && member.packageTier !== 'VIP').length)
      ),
      metric('Free Slot Accounts', String(activeMembers.filter((member) => member.packageTier === 'Business' || member.packageTier === 'VIP').length)),
      metric('CD Accounts', String(activeMembers.filter((member) => member.cdBalance > 0).length)),
    ],
    modules: visibleModules,
    queues,
    auditEvents: activeAuditEvents,
    gatedActions: isSandboxMode() ? [] : branchRuntimeNotes,
    notices: []
  };
}

export function buildMemberOfficeSnapshot(
  user: SessionUser,
  profile: {
    referralCode?: string;
    sponsorCode?: string;
    packageTier?: string;
    accountStatus?: string;
    username?: string;
    fullName?: string;
    payoutMethod?: string;
    payoutDetails?: string;
  } | null
) {
  const member = currentMemberFor(user);
  const pick = <T>(value: T | undefined, fallback: T) => (value !== undefined ? value : fallback);
  const mergedMember = {
    ...member,
    referralCode: pick(profile?.referralCode, member.referralCode),
    sponsorCode: pick(profile?.sponsorCode, member.sponsorCode),
    packageTier: pick(profile?.packageTier, member.packageTier),
    accountStatus: pick(profile?.accountStatus, member.accountStatus),
    username: pick(profile?.username, member.username),
    fullName: pick(profile?.fullName, member.fullName)
  };

  return {
    user,
    profile: {
      packageTier: mergedMember.packageTier,
      referralCode: mergedMember.referralCode,
      sponsorCode: mergedMember.sponsorCode,
      accountStatus: mergedMember.accountStatus,
      username: mergedMember.username,
      fullName: mergedMember.fullName,
      payoutMethod: profile?.payoutMethod ?? '',
      payoutDetails: profile?.payoutDetails ?? ''
    },
    wallet: {
      availableBalance: money(mergedMember.walletAvailable),
      pendingBalance: money(mergedMember.walletPending),
      payoutSchedule: 'Tuesday encashment / Friday payout'
    },
    metrics: [
      metric('Left Points', String(mergedMember.leftPoints)),
      metric('Right Points', String(mergedMember.rightPoints)),
      metric('Direct Referrals', String(mergedMember.directReferrals)),
    ],
    modules: memberModules(mergedMember).filter((module) => canSeeModule(user, module)),
    gatedActions: isSandboxMode() ? [] : branchRuntimeNotes,
    alerts: []
  };
}

export function getOpsModule(user: SessionUser, moduleId: string): OperationalModule | null {
  const module = adminModules().find((candidate) => candidate.id === moduleId);
  return module && canSeeModule(user, module) ? module : null;
}

export function getOpsModuleForProfile(
  user: SessionUser,
  moduleId: string,
  profile: AdminScopeProfile | null
): OperationalModule | null {
  const module = adminModules().find((candidate) => candidate.id === moduleId);
  return module && canSeeModule(user, module, profile) ? module : null;
}

export function getMemberModule(user: SessionUser, moduleId: string): OperationalModule | null {
  const member = currentMemberFor(user);
  const module = memberModules(member).find((candidate) => candidate.id === moduleId);
  return module && canSeeModule(user, module) ? module : null;
}

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

const STAFF_ROLES: AppRole[] = ['admin', 'cashier', 'bod', 'superadmin'];
const FINANCE_ROLES: AppRole[] = ['admin', 'cashier', 'superadmin'];
const EXECUTIVE_ROLES: AppRole[] = ['admin', 'bod', 'superadmin'];
const ALL_OPS_ROLES: AppRole[] = ['admin', 'cashier', 'bod', 'superadmin'];

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
    username: 'YOR0001',
    fullName: 'Yor Member',
    email: 'member@yor.local',
    packageTier: 'Standard',
    accountStatus: 'active',
    referralCode: 'YOR-MEMBER-001',
    sponsorCode: 'YOR-SPONSOR-001',
    placement: 'root',
    placementParentUsername: null,
    directReferrals: 5,
    leftPoints: 24000,
    rightPoints: 18000,
    walletAvailable: 15200.75,
    walletPending: 4300,
    cdBalance: 0,
    lastActivity: '2026-05-28'
  },
  {
    userId: 'yor-legacy-002',
    username: 'YOR0002',
    fullName: 'Alyssa Cruz',
    email: 'alyssa.cruz@example.test',
    packageTier: 'Business',
    accountStatus: 'active',
    referralCode: 'YOR-ALYSSA',
    sponsorCode: 'YOR-MEMBER-001',
    placement: 'left',
    placementParentUsername: 'YOR0001',
    directReferrals: 3,
    leftPoints: 12000,
    rightPoints: 8000,
    walletAvailable: 8950,
    walletPending: 1500,
    cdBalance: 500,
    lastActivity: '2026-05-27'
  },
  {
    userId: 'yor-legacy-003',
    username: 'YOR0003',
    fullName: 'Marco Reyes',
    email: 'marco.reyes@example.test',
    packageTier: 'VIP',
    accountStatus: 'active',
    referralCode: 'YOR-MARCO',
    sponsorCode: 'YOR-MEMBER-001',
    placement: 'right',
    placementParentUsername: 'YOR0001',
    directReferrals: 7,
    leftPoints: 18000,
    rightPoints: 21000,
    walletAvailable: 31420,
    walletPending: 6100,
    cdBalance: 0,
    lastActivity: '2026-05-26'
  },
  {
    userId: 'yor-legacy-004',
    username: 'YOR0004',
    fullName: 'Nica Santos',
    email: 'nica.santos@example.test',
    packageTier: 'Classic',
    accountStatus: 'pending',
    referralCode: 'YOR-NICA',
    sponsorCode: 'YOR-ALYSSA',
    placement: 'left',
    placementParentUsername: 'YOR0002',
    directReferrals: 1,
    leftPoints: 2500,
    rightPoints: 1500,
    walletAvailable: 700,
    walletPending: 300,
    cdBalance: 0,
    lastActivity: '2026-05-25'
  },
  {
    userId: 'yor-legacy-005',
    username: 'YOR0005',
    fullName: 'Ramon Dela Cruz',
    email: 'ramon.dc@example.test',
    packageTier: 'Basic',
    accountStatus: 'active',
    referralCode: 'YOR-RAMON',
    sponsorCode: 'YOR-MARCO',
    placement: 'right',
    placementParentUsername: 'YOR0003',
    directReferrals: 2,
    leftPoints: 3000,
    rightPoints: 4000,
    walletAvailable: 1850,
    walletPending: 250,
    cdBalance: 150,
    lastActivity: '2026-05-24'
  }
];

const walletRows = [
  {
    date: '2026-05-28',
    type: 'direct_referral',
    source: 'YOR-ALYSSA',
    credit: money(5000),
    debit: money(0),
    balance: money(15200.75),
    status: 'posted'
  },
  {
    date: '2026-05-27',
    type: 'salesmatch',
    source: 'YOR0001 L/R match',
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
    debit: money(100),
    balance: money(2700.75),
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
    member: 'YOR0001',
    gross: money(8000),
    fee: money(100),
    cdDeduction: money(0),
    net: money(7900),
    status: 'released Friday',
    method: 'GCash',
    createdAt: '2026-05-24T08:00:00Z'
  },
  {
    reference: 'ENC-20260517-002',
    member: 'YOR0003',
    gross: money(12500),
    fee: money(100),
    cdDeduction: money(500),
    net: money(11900),
    status: 'for verification',
    method: 'Bank',
    createdAt: '2026-05-17T08:00:00Z'
  }
];

const activationRows: ActivationRow[] = [
  {
    code: 'YOR-ACT-1001',
    packageTier: 'Standard',
    assignedTo: 'YOR0001',
    status: 'used',
    generatedAt: '2026-05-20'
  },
  {
    code: 'YOR-ACT-1002',
    packageTier: 'Business',
    assignedTo: 'YOR0002',
    status: 'used',
    generatedAt: '2026-05-21'
  },
  {
    code: 'YOR-ACT-1003',
    packageTier: 'Standard',
    assignedTo: 'YOR0001',
    status: 'available',
    generatedAt: '2026-05-28'
  },
  {
    code: 'YOR-ACT-1004',
    packageTier: 'Business',
    assignedTo: 'YOR0003',
    status: 'available',
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
  return isSandboxMode() ? getSandboxMoneyMode() : 'playground';
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
    label: 'Branch-local mutable runtime',
    reason: 'Writes in this office update the local sandbox store immediately and never touch production or the legacy reference system.',
    requiredEvidence: 'Production sign-off, append-only ledger hardening, and release-grade approval workflow still remain separate.'
  },
  {
    label: 'Safe to reset',
    reason: 'You can break flows, consume codes, queue encashments, and rebuild state because this branch now has its own resettable data file.',
    requiredEvidence: 'Use the sandbox reset control before a fresh QA pass or when test data becomes noisy.'
  }
];

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
    metrics: [metric('Money Mode', currentMoneyMode(), isSandboxMode() ? 'Branch-local sandbox runtime' : 'No value-changing write enabled', 'good')],
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
    metrics: [metric('Money Mode', currentMoneyMode(), isSandboxMode() ? 'Writable in local sandbox runtime' : 'Requires evidence before writes', 'good')],
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

  return [
    {
      id: 'dashboard',
      label: 'Operations Dashboard',
      path: '/admin/dashboard',
      group: 'Overview',
      description: isSandboxMode()
        ? 'Live snapshot for member volume, payout exposure, and branch-local sandbox operations.'
        : 'Live report snapshot for member volume, payout exposure, and protected playground operations.',
      status: 'live-report',
      legacyReference: 'adminpanel/admin-dashboard.php',
      permissions: ALL_OPS_ROLES,
      metrics: [
        metric('Total Accounts', String(allMembers.length), 'Hybrid parity seed'),
        metric('Active Accounts', String(allMembers.filter((member) => member.accountStatus === 'active').length)),
        metric('Pending Encashments', String(payoutRowsForTables.filter((row) => row.status.includes('verification')).length), undefined, 'warning')
      ],
      table: table('Operational account snapshot', memberRows),
      gatedActions: isSandboxMode() ? [] : branchRuntimeNotes
    },
    {
      id: 'member-management',
      label: 'Member Management',
      path: '/admin/member-management',
      group: 'Accounts',
      description: 'Searchable member list aligned to the current office flow, with Yor package naming.',
      status: 'live-report',
      legacyReference: 'adminpanel/account-masterlist.php',
      permissions: EXECUTIVE_ROLES,
      metrics: [metric('Accounts Indexed', String(allMembers.length)), metric('Pending Accounts', String(allMembers.filter((member) => member.accountStatus === 'pending').length), undefined, 'warning')],
      table: table('Members', memberRows),
      gatedActions: []
    },
    {
      id: 'sponsor-tree',
      label: 'Sponsor Tree',
      path: '/admin/sponsor-tree',
      group: 'Network',
      description: 'Direct sponsorship structure stays separate from binary placement for cleaner operations and reporting.',
      status: 'live-report',
      legacyReference: 'adminpanel/account-genealogy.php',
      permissions: EXECUTIVE_ROLES,
      metrics: [metric('Direct Lines', String(allMembers.length - 1)), metric('Qualified Sponsors', '2')],
      table: table('Sponsor placements', treeRows.map((row) => ({
        username: row.username,
        sponsor: row.sponsor,
        package: row.package,
        directReferrals: row.directReferrals
      }))),
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
      permissions: FINANCE_ROLES,
      metrics: [metric('Encashment Requests', String(payoutRowsForTables.length)), metric('Net Payable', money(payoutRowsForTables.reduce((sum, row) => sum + (typeof row.net === 'string' ? Number(String(row.net).replace(/[^0-9.-]/g, '')) || 0 : Number(row.net) || 0), 0)))],
      table: table('Encashments', payoutRowsForTables),
      gatedActions: isSandboxMode() ? [] : branchRuntimeNotes
    },
    {
      id: 'binary-placement-tree',
      label: 'Binary Placement Tree',
      path: '/admin/binary-placement-tree',
      group: 'Network',
      description: 'Binary tree for left/right placement review, registration planning, and pairing visibility.',
      status: 'live-report',
      legacyReference: 'adminpanel/account-genealogy.php',
      permissions: EXECUTIVE_ROLES,
      metrics: [metric('Left Points', '59,500'), metric('Right Points', '52,500')],
      table: table('Binary placements', treeRows),
      gatedActions: []
    },
    {
      id: 'get-five-reports',
      label: 'Get Yor Five Reports',
      path: '/admin/get-five-reports',
      group: 'Compensation',
      description: 'Five-direct qualification review aligned to the Yor compensation plan terminology.',
      status: 'read-only',
      legacyReference: 'adminpanel/accounts-redeem.php',
      permissions: ALL_OPS_ROLES,
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
      id: 'activation-codes',
      label: 'Activation Code Management',
      path: '/admin/activation-codes',
      group: 'Codes',
      description: isSandboxMode()
        ? 'Activation code inventory and assignment report with branch-local generation enabled.'
        : 'Activation code inventory and assignment report; generation runs in protected playground mode.',
      status: isSandboxMode() ? 'sandbox-write' : 'playground-write',
      legacyReference: 'adminpanel/manage-codes.php, adminpanel/generate-codes.php',
      permissions: FINANCE_ROLES,
      metrics: [
        metric('Codes Tracked', String(activationRowsForTables.length)),
        metric('Available', String(activationRowsForTables.filter((row) => row.status === 'available').length))
      ],
      table: table('Activation codes', activationRowsForTables),
      gatedActions: isSandboxMode() ? [] : branchRuntimeNotes
    },
    {
      id: 'audit-status',
      label: 'Audit And Status',
      path: '/admin/audit-status',
      group: 'Security',
      description: 'Auth, role, and operational safety event stream for smoke verification.',
      status: 'live-report',
      legacyReference: 'Yor operational hardening layer',
      permissions: ALL_OPS_ROLES,
      metrics: [metric('Audit Events', String(auditRows.length)), metric('Money Writes', currentMoneyMode(), isSandboxMode() ? 'Branch-local mutable runtime' : undefined, 'good')],
      table: table(
        'Audit trail',
        auditRows.map((event) => ({
          occurredAt: event.occurredAt,
          actor: event.actor,
          action: event.action,
          target: event.target
        }))
      ),
      gatedActions: []
    },
    adminMvpModule('account-shadow-management', 'Account / Shadow Account Management', 'Accounts', 'Review main, reserved shadow, activated shadow, and converted full account states.'),
    adminMvpModule('payment-verification', 'Payment Verification', 'Finance', 'Review activation and package payment proof before any account value changes.', FINANCE_ROLES),
    adminMvpModule('package-rule-matrix', 'Package And Rule Matrix', 'Compensation', 'Read-only package, PV, cap, threshold, and unresolved-rule matrix.'),
    adminMvpModule('direct-referral-reports', 'Direct Referral Reports', 'Compensation', 'Direct sponsor bonus simulation and eligibility trace.'),
    adminMvpModule('salesmatch-reports', 'Salesmatch Reports', 'Compensation', 'Binary matching, strong-leg carryover, and cap simulation trace.'),
    adminMvpModule('binary-cycle-reports', 'Binary Cycle Reports', 'Compensation', 'Percentage-based cycle simulation tied to salesmatch events.'),
    {
      id: 'lifestyle-rewards-reports',
      label: 'Lifestyle Rewards Reports',
      path: '/admin/lifestyle-rewards-reports',
      group: 'Compensation',
      description: 'Repeat purchase reward monitoring, 3% lifestyle-rate preview, and threshold visibility by package.',
      status: 'read-only',
      legacyReference: 'yor-lifestyle-repeat-purchase',
      permissions: ALL_OPS_ROLES,
      metrics: [metric('Tracked Packages', '4'), metric('Reward Rate', '3% public rule')],
      table: table(
        'Lifestyle reward monitor',
        currentMembers().map((candidate) => {
          const policy = packagePolicyForTier(candidate.packageTier);
          const target = policy?.lifestyleRepeatPurchase ?? 0;
          const currentRepeat = target ? Math.round(target * 0.72) : 0;
          return {
            username: candidate.username,
            package: candidate.packageTier,
            repeatPurchaseTarget: target ? money(target) : 'Not eligible',
            currentRepeatPurchase: target ? money(currentRepeat) : 'Not eligible',
            progressPercent: target ? `${Math.min(100, Math.round((currentRepeat / target) * 100))}%` : '0%',
            projectedReward: target ? money(currentRepeat * 0.03) : 'Not eligible'
          };
        })
      ),
      gatedActions: []
    },
    {
      id: 'unilevel-rank-reports',
      label: 'Unilevel / Rank Reports',
      path: '/admin/unilevel-rank-reports',
      group: 'Compensation',
      description: 'Ten-level unilevel monitoring with the public 11 billion illustration and rank oversight.',
      status: 'read-only',
      legacyReference: 'yor-unilevel-rank',
      permissions: ALL_OPS_ROLES,
      metrics: [metric('Potential Income', 'PHP 11 Billion'), metric('Visible Levels', '10')],
      table: table('Unilevel rank monitor', [
        { level: '01', percent: '10%', potential: 'PHP 10,000', note: '200 PV foundation level' },
        { level: '02', percent: '8%', potential: 'PHP 100,000', note: '200 PV growth level' },
        { level: '03', percent: '5%', potential: 'PHP 1,000,000', note: '200 PV builder level' },
        { level: '10', percent: '1%', potential: 'PHP 10,000,000,000', note: 'Long-range legacy level' }
      ]),
      gatedActions: []
    },
    {
      id: 'global-bonus-pool',
      label: 'Global Bonus Pool',
      path: '/admin/global-bonus-pool',
      group: 'Compensation',
      description: 'VIP-only eligibility review for the annual 2% global sales pool and maintenance window.',
      status: 'read-only',
      legacyReference: 'yor-global-bonus',
      permissions: ALL_OPS_ROLES,
      metrics: [metric('Eligible Accounts', String(currentMembers().filter((candidate) => candidate.packageTier === 'VIP').length)), metric('Pool Rule', '2% yearly')],
      table: table(
        'Global bonus qualifiers',
        currentMembers()
          .filter((candidate) => candidate.packageTier === 'VIP')
          .map((candidate) => ({
            username: candidate.username,
            package: candidate.packageTier,
            maintenance: '6-month active account maintenance',
            qualifierPath: 'Hall of Famer / top global qualifiers',
            status: 'eligible to monitor'
          }))
      ),
      gatedActions: []
    },
    adminMvpModule('wallet-ledger', 'Wallet Ledger', 'Finance', 'Append-only wallet ledger and adjustment audit surface.', FINANCE_ROLES, walletRowsForTables),
    adminMvpModule('system-health', 'System Health', 'Security', 'Health, logging, backup, and operational readiness surface.')
  ];
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
  const lifestyleRate = lifestyleCurrent ? lifestyleCurrent * 0.03 : 0;
  const unilevelRows = [
    { level: '01', percent: '10%', requiredPV: '200 PV', potential: 'PHP 10,000', status: 'building' },
    { level: '02', percent: '8%', requiredPV: '200 PV', potential: 'PHP 100,000', status: 'building' },
    { level: '03', percent: '5%', requiredPV: '200 PV', potential: 'PHP 1,000,000', status: 'building' },
    { level: '04', percent: '5%', requiredPV: '200 PV', potential: 'PHP 10,000,000', status: 'locked' },
    { level: '05', percent: '3%', requiredPV: '200 PV', potential: 'PHP 100,000,000', status: 'locked' },
    { level: '06', percent: '3%', requiredPV: '200 PV', potential: 'PHP 1,000,000,000', status: 'locked' },
    { level: '07-10', percent: '2% / 1% / 1% / 1%', requiredPV: '200 PV', potential: 'PHP 10,000,000,000+', status: 'long-range' }
  ];
  const includeGlobalBonus = member.packageTier === 'VIP';

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
      id: 'activation-codes',
      label: 'Activation Codes',
      path: '/member/activation-codes',
      group: 'Codes',
      description: 'Owned and available activation code visibility.',
      status: 'read-only',
      legacyReference: 'ecom/myactivation-codes.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Owned Codes', String(activationRowsForMember.filter((row) => row.assignedTo === member.username).length))],
      table: table('Activation codes', activationRowsForMember.filter((row) => row.assignedTo === member.username || row.assignedTo === 'available')),
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
        ? 'Upgrade and new registration readiness with branch-local code consumption and account creation.'
        : 'Upgrade and new registration readiness; writes remain in protected playground mode.',
      status: isSandboxMode() ? 'sandbox-write' : 'playground-write',
      legacyReference: 'ecom/upgrade-account.php, ecom/new-account-registration.php',
      permissions: ['member', ...STAFF_ROLES],
      metrics: [metric('Current Package', member.packageTier), metric('Upgrade Writes', isSandboxMode() ? 'Sandbox' : 'Playground', undefined, isSandboxMode() ? 'good' : 'warning')],
      table: table('Upgrade readiness', [
        { currentPackage: member.packageTier, nextPackage: 'Business', status: 'requires activation code and rule verification' }
      ]),
      gatedActions: isSandboxMode() ? [] : branchRuntimeNotes
    },
    memberMvpModule('product-orders', 'Direct Selling / Product Orders', 'Products', 'Product purchases, refill orders, retail margin, and repeat purchase readiness.'),
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
        metric('3% Reward', lifestyleTarget ? money(lifestyleRate) : 'Not eligible')
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
            description: 'Annual global bonus qualifier review reserved for VIP accounts and hall-of-fame paths.',
            status: 'read-only',
            legacyReference: 'yor-global-bonus',
            permissions: ['member', ...STAFF_ROLES],
            metrics: [metric('Eligibility', 'VIP qualified'), metric('Maintenance Window', '6 months active')],
            table: table('Global bonus eligibility', [
              {
                package: member.packageTier,
                qualification: 'VIP',
                maintenance: '6-month active account maintenance',
                pool: '2% yearly global sales pool',
                status: 'eligible to monitor'
              }
            ]),
            gatedActions: []
          }
        ]
      : []
  );
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
      metric('Wallet Exposure', money(activeMembers.reduce((sum, member) => sum + member.walletAvailable + member.walletPending, 0))),
      metric('Visible Modules', String(visibleModules.length)),
      metric('Money Writes', currentMoneyMode(), isSandboxMode() ? 'Branch-local mutable runtime' : 'Reports-first safety mode', 'good')
    ],
    modules: visibleModules,
    queues,
    auditEvents: activeAuditEvents,
    gatedActions: isSandboxMode() ? [] : branchRuntimeNotes,
    notices: [
      isSandboxMode()
        ? 'Reports and value-changing actions now write into the local sandbox runtime for branch-only testing.'
        : 'Reports are operationally wired and role-filtered; value-changing actions remain disabled until documented rule tests pass.',
      'Hybrid data mirrors the legacy operational reference while Yor-specific package names and public compensation surfaces take priority.'
    ]
  };
}

export function buildMemberOfficeSnapshot(
  user: SessionUser,
  profile: { referralCode?: string; sponsorCode?: string; packageTier?: string; accountStatus?: string } | null
) {
  const member = currentMemberFor(user);
  const mergedMember = {
    ...member,
    referralCode: profile?.referralCode ?? member.referralCode,
    sponsorCode: profile?.sponsorCode ?? member.sponsorCode,
    packageTier: profile?.packageTier ?? member.packageTier,
    accountStatus: profile?.accountStatus ?? member.accountStatus
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
      payoutMethod: 'GCash'
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
      metric('Money Writes', currentMoneyMode(), isSandboxMode() ? 'Branch-local mutable runtime' : 'Reports-first safety mode', 'good')
    ],
    modules: memberModules(mergedMember).filter((module) => canSeeModule(user, module)),
    gatedActions: isSandboxMode() ? [] : branchRuntimeNotes,
    alerts: [
      'Wallet, pairing, referral, and encashment reports are visible for verification.',
      isSandboxMode()
        ? 'Sandbox writes are enabled in this branch so registration, code, wallet, and approval flows can be exercised end to end.'
        : 'Requests that release, deduct, or create value are available in playground while compensation evidence and tests pass.'
    ]
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

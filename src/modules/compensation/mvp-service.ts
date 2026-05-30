import type {
  CompensationPolicy,
  EarningStreamPolicy,
  IncomeSimulationResult,
  PackagePolicy,
  ShadowAccount,
  TreeNode,
  WalletLedgerEntry
} from '../../types/compensation.js';
import type { SessionUser } from '../../types/auth.js';
import { getSupabasePublicClient } from '../../lib/supabase.js';
import {
  buildSandboxAdminEncashments,
  getSandboxMoneyMode,
  getSandboxWalletSummary,
  isSandboxMode,
  listSandboxMembers
} from '../sandbox/dev-sandbox-store.js';

export const moneyMode = isSandboxMode() ? getSandboxMoneyMode() : ('playground' as const);

export function getMoneyMode() {
  return moneyMode;
}

const sourceReferences = [
  'docs/YOR International Compensation Plan.pdf',
  'docs/yor_international.pdf',
  'docs/reference/yor-compensation-and-credit-layer.md',
  'docs/reference/yor-legacy-operations-parity.md'
];

export const packagePolicies: PackagePolicy[] = [
  {
    code: 'CLASSIC',
    name: 'Classic',
    price: 1998,
    pv: 5,
    directSellingPrice: 350,
    directReferralBonus: 200,
    salesmatchValue: 250,
    weeklySalesmatchCap: 5000,
    monthlySalesmatchCap: 20000
  },
  {
    code: 'BASIC',
    name: 'Basic',
    price: 5998,
    pv: 10,
    directSellingPrice: 320,
    directReferralBonus: 1000,
    salesmatchValue: 500,
    weeklySalesmatchCap: 20000,
    monthlySalesmatchCap: 80000,
    binaryCyclePercent: 2,
    lifestyleDailyCap: 1000,
    lifestyleMonthlyCap: 30000,
    lifestyleRepeatPurchase: 1000
  },
  {
    code: 'STANDARD',
    name: 'Standard',
    price: 25998,
    pv: 50,
    directSellingPrice: 300,
    directReferralBonus: 5000,
    salesmatchValue: 2500,
    weeklySalesmatchCap: 60000,
    monthlySalesmatchCap: 240000,
    binaryCyclePercent: 3,
    lifestyleDailyCap: 2000,
    lifestyleMonthlyCap: 60000,
    lifestyleRepeatPurchase: 2000
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    price: 50998,
    pv: 100,
    directSellingPrice: 280,
    directReferralBonus: 7000,
    salesmatchValue: 5000,
    weeklySalesmatchCap: 120000,
    monthlySalesmatchCap: 480000,
    binaryCyclePercent: 4,
    lifestyleDailyCap: 3000,
    lifestyleMonthlyCap: 90000,
    lifestyleRepeatPurchase: 3000
  },
  {
    code: 'VIP',
    name: 'VIP',
    price: 159998,
    pv: 300,
    directSellingPrice: 250,
    directReferralBonus: 15000,
    salesmatchValue: 15000,
    weeklySalesmatchCap: 300000,
    monthlySalesmatchCap: 1200000,
    binaryCyclePercent: 5,
    lifestyleDailyCap: 5000,
    lifestyleMonthlyCap: 150000,
    lifestyleRepeatPurchase: 5000
  }
];

export const earningStreams: EarningStreamPolicy[] = [
  {
    id: 'direct-selling',
    label: 'Direct Selling',
    source: 'Product sales and package-based product pricing',
    basis: 'SRP PHP 500 less member package buying price',
    writeStatus: moneyMode,
    unresolved: ['Admin-configurable product pricing and inventory/payment verification remain pending.']
  },
  {
    id: 'direct-referral',
    label: 'Direct Referral',
    source: 'Direct sponsor relationship',
    basis: 'Yor package referral table, with legacy sponsor-reference parity for operational fallback',
    writeStatus: moneyMode,
    unresolved: ['Final per-person vs per-account rule for shadow accounts requires approval.']
  },
  {
    id: 'salesmatch',
    label: 'Salesmatch Bonus',
    source: 'Binary placement left/right volume',
    basis: 'Package match value, strong-leg retention, weekly/monthly caps',
    writeStatus: moneyMode,
    unresolved: ['Standard cap discrepancy in transcript vs presentation must be signed off.']
  },
  {
    id: 'binary-cycle',
    label: 'Binary Cycle Bonus',
    source: 'Salesmatch event movement across placement tree',
    basis: 'Classic 2%, Standard 3%, Business 4%, VIP 5%',
    writeStatus: moneyMode,
    unresolved: ['Receiver-vs-earner package basis and shadow-account participation require approval.']
  },
  {
    id: 'get-five',
    label: 'Get Yor Five Bonus',
    source: 'Five same-package direct signups',
    basis: 'Classic, Standard, Business, and VIP package-price milestone reward',
    writeStatus: moneyMode,
    unresolved: ['Three-month reset and repeatability need final written rule.']
  },
  {
    id: 'lifestyle-rewards',
    label: 'Lifestyle Rewards',
    source: 'Repeat purchase product movement',
    basis: '3% public rule, separate lifestyle wallet, package caps',
    writeStatus: moneyMode,
    unresolved: ['PDF notes a possible 1% system calculation conflict.']
  },
  {
    id: 'unilevel',
    label: 'Unilevel Bonus / Rank',
    source: 'Direct sponsor genealogy',
    basis: '10 levels: 10%, 8%, 5%, 5%, 3%, 3%, 2%, 1%, 1%, 1%',
    writeStatus: moneyMode,
    unresolved: ['Rank basis is unresolved: total income in deck vs accumulated unilevel income in transcript.']
  },
  {
    id: 'global',
    label: 'Global Bonus',
    source: 'Yearly global sales pool',
    basis: '2% yearly pool, HOF/center qualifiers, six-month maintenance',
    writeStatus: moneyMode,
    unresolved: ['Distribution formula, close date, and maintenance continuity require approval.']
  }
];

type PackageCode = PackagePolicy['code'];

type CompensationPolicyRow = {
  id: string;
  source_references: string[] | null;
  unresolved_decisions: string[] | null;
};

type EarningStreamPolicyRow = {
  stream_key: string;
  label: string;
  basis: string;
  write_status: 'playground' | 'sandbox';
  unresolved_decisions: string[] | null;
};

type PackageCatalogRow = {
  package_code: PackageCode;
  package_name: string;
  package_price: number;
  pv: number;
  direct_referral_bonus: number;
};

const simulations: Record<string, IncomeSimulationResult> = {
  'direct-selling': simulation('direct-selling', 1800, 'Product margin preview', [
    'Member package: Standard',
    'Assumed three perfume sales at SRP PHP 500',
    'Standard member price PHP 300 creates PHP 200 gross margin per bottle'
  ]),
  'direct-referral': simulation('direct-referral', 5000, 'Qualified direct referral preview', [
    'Direct sponsor relation comes from sponsor_code / drefid parity',
    'Source package: Standard',
    'Yor Standard referral value: PHP 5,000'
  ]),
  salesmatch: simulation('salesmatch', 15000, 'Matched binary volume preview', [
    'Left points: 24,000',
    'Right points: 18,000',
    'Weak side matched; 6,000 left points carry forward',
    'Weekly cap checked before simulated ledger posting'
  ]),
  'binary-cycle': simulation('binary-cycle', 750, 'Cycle percentage preview', [
    'Salesmatch event basis: PHP 15,000',
    'Receiver package: VIP',
    'VIP binary cycle percent: 5%'
  ]),
  'get-five': simulation('get-five', 25998, 'Same-package direct milestone preview', [
    'Direct same-package Standard recruits: 5',
    'Reward basis uses Standard package price pending final approval',
    'Process key prevents reusing the same five recruits'
  ]),
  'lifestyle-rewards': simulation('lifestyle-rewards', 900, 'Repeat-purchase lifestyle preview', [
    'Repeat purchase pool: PHP 30,000',
    'Public lifestyle rate: 3%',
    'Separate lifestyle wallet threshold remains PHP 1,000'
  ]),
  unilevel: simulation('unilevel', 4200, 'Ten-level unilevel preview', [
    'Sponsor genealogy is separate from binary placement',
    'Levels 1-4 contain qualified repeat purchase volume',
    'Percentages follow Yor public table'
  ]),
  global: simulation('global', 12000, 'Annual pool eligibility preview', [
    'Yearly pool basis: 2% of approved global net sales',
    'Member has HOF path marker but final qualifier snapshot is pending',
    'Distribution remains admin-review only'
  ])
};

function simulation(streamId: string, amount: number, statusLabel: string, trace: string[]): IncomeSimulationResult {
  const stream = earningStreams.find((candidate) => candidate.id === streamId)!;

  return {
    streamId,
    label: stream.label,
    writeStatus: moneyMode,
    simulatedGross: amount,
    simulatedNet: amount,
    capApplied: false,
    statusLabel,
    explanation: isSandboxMode()
      ? `${stream.label} remains simulation-first, while operational sandbox writes are available on wallet, registration, code, and approval flows.`
      : `${stream.label} is available in playground mode so the operating workflow can be tested end to end while policy evidence remains visible.`,
    calculationTrace: trace,
    requiredEvidence: [
      'Final written business rule',
      'Deterministic process key',
      'Append-only wallet ledger entry',
      'Duplicate-prevention test',
      'Admin approval and audit trail'
    ]
  };
}

async function getSupabaseCompensationPolicy(): Promise<CompensationPolicy | null> {
  const supabase = getSupabasePublicClient();

  if (!supabase) {
    return null;
  }

  const { data: policyRow, error: policyError } = await supabase
    .from('compensation_policies')
    .select('id,source_references,unresolved_decisions')
    .eq('policy_key', 'yor-mvp-gated-simulation')
    .eq('is_active', true)
    .maybeSingle<CompensationPolicyRow>();

  if (policyError || !policyRow) {
    return null;
  }

  const { data: streamRows, error: streamsError } = await supabase
    .from('earning_stream_policies')
    .select('stream_key,label,basis,write_status,unresolved_decisions')
    .eq('policy_id', policyRow.id)
    .order('sort_order', { ascending: true })
    .returns<EarningStreamPolicyRow[]>();

  const { data: packageRows, error: packagesError } = await supabase
    .from('package_catalog')
    .select('package_code,package_name,package_price,pv,direct_referral_bonus')
    .order('display_order', { ascending: true })
    .returns<PackageCatalogRow[]>();

  if (streamsError || !streamRows || packagesError || !packageRows) {
    return null;
  }

  const packages = packagePolicies.map((policy) => ({ ...policy }));

  const streamFallbackById = new Map(earningStreams.map((stream) => [stream.id, stream]));
  const streams = streamRows.map((row) => {
    const fallback = streamFallbackById.get(row.stream_key);

    return {
      id: row.stream_key,
      label: row.label,
      source: fallback?.source ?? 'Yor policy data',
      basis: row.basis,
      writeStatus: moneyMode,
      unresolved: row.unresolved_decisions ?? fallback?.unresolved ?? []
    };
  });

  return {
    mode: moneyMode,
    sourceReferences: policyRow.source_references ?? sourceReferences,
    packages,
    streams,
    unilevelPercentages: [10, 8, 5, 5, 3, 3, 2, 1, 1, 1],
    globalBonusPoolPercent: 2,
    walletTypes: ['main', 'lifestyle', 'product', 'pending', 'encashment'],
    payoutSchedule: 'Tuesday encashment / Friday payout',
    unresolvedDecisions: policyRow.unresolved_decisions ?? [...new Set(streams.flatMap((stream) => stream.unresolved))]
  };
}

export async function getCompensationPolicy(): Promise<CompensationPolicy> {
  const supabasePolicy = await getSupabaseCompensationPolicy();

  if (supabasePolicy) {
    return supabasePolicy;
  }

  return {
    mode: moneyMode,
    sourceReferences,
    packages: packagePolicies,
    streams: earningStreams,
    unilevelPercentages: [10, 8, 5, 5, 3, 3, 2, 1, 1, 1],
    globalBonusPoolPercent: 2,
    walletTypes: ['main', 'lifestyle', 'product', 'pending', 'encashment'],
    payoutSchedule: 'Tuesday encashment / Friday payout',
    unresolvedDecisions: [...new Set(earningStreams.flatMap((stream) => stream.unresolved))]
  };
}

export async function listEarningStreams() {
  const policy = await getCompensationPolicy();

  return {
    mode: moneyMode,
    streams: policy.streams
  };
}

export function getIncomeSimulation(streamId: string): IncomeSimulationResult | null {
  return simulations[streamId] ?? null;
}

export function listIncomeSimulations(): IncomeSimulationResult[] {
  return earningStreams.map((stream) => simulations[stream.id]);
}

export function buildMemberMvpDashboard(user: SessionUser) {
  return {
    user,
    moneyMode,
    packageTier: 'Standard',
    payoutSchedule: 'Tuesday encashment / Friday payout',
    incomeStreams: listIncomeSimulations(),
    notices: [
      isSandboxMode()
        ? 'Income streams stay simulation-first, but wallet, code, registration, and encashment writes now persist in the local sandbox runtime.'
        : 'All income values are simulated until the final rulebook is approved.',
      'Sponsor genealogy and binary placement are tracked separately to protect direct referral and salesmatch parity.'
    ]
  };
}

export function buildWallets() {
  if (isSandboxMode()) {
    const member = listSandboxMembers()[0];
    const walletSummary = getSandboxWalletSummary({
      id: member.userId,
      name: member.fullName,
      email: member.email,
      role: 'member'
    });

    return {
      moneyMode,
      wallets: [
        { type: 'main', label: 'Main Earnings Wallet', balance: walletSummary.summary.availableBalance, threshold: 500 },
        { type: 'lifestyle', label: 'Lifestyle Rewards Wallet', balance: 0, threshold: 1000 },
        { type: 'product', label: 'Product Wallet / Purchase Credits', balance: 0, threshold: 0 },
        { type: 'pending', label: 'Pending Computed Income', balance: walletSummary.summary.pendingBalance, threshold: 0 },
        { type: 'encashment', label: 'Approved Encashment Queue', balance: 0, threshold: 500 }
      ],
      entries: walletSummary.ledger
    };
  }

  const wallets = [
    { type: 'main', label: 'Main Earnings Wallet', balance: 15200.75, threshold: 500 },
    { type: 'lifestyle', label: 'Lifestyle Rewards Wallet', balance: 900, threshold: 1000 },
    { type: 'product', label: 'Product Wallet / Purchase Credits', balance: 2500, threshold: 0 },
    { type: 'pending', label: 'Pending Computed Income', balance: 4300, threshold: 0 },
    { type: 'encashment', label: 'Approved Encashment Queue', balance: 7900, threshold: 500 }
  ];

  return {
    moneyMode,
    wallets,
    entries: getWalletLedger()
  };
}

export function getWalletLedger(): WalletLedgerEntry[] {
  return [
    ledger('WL-001', 'main', 'direct_referral', 'YOR-ALYSSA', 5000, 0, 15200.75, 'simulated-posted'),
    ledger('WL-002', 'main', 'salesmatch', 'YOR0001 L/R match', 7500, 0, 10200.75, 'simulated-posted'),
    ledger('WL-003', 'lifestyle', 'lifestyle_rewards', 'Repeat purchase pool', 900, 0, 900, 'threshold-pending'),
    ledger('WL-004', 'encashment', 'encashment_fee', 'ENC-20260524-001', 0, 100, 7900, 'simulated-deducted')
  ];
}

function ledger(
  id: string,
  walletType: string,
  entryType: string,
  sourceReference: string,
  creditAmount: number,
  debitAmount: number,
  balanceAfter: number,
  status: string
): WalletLedgerEntry {
  return {
    id,
    walletType,
    entryType,
    sourceReference,
    creditAmount,
    debitAmount,
    balanceAfter,
    status,
    processId: `mvp-${id.toLowerCase()}`
  };
}

export function buildGenealogy(kind: 'sponsor' | 'binary-placement') {
  const sponsorTree: TreeNode = {
    id: 'YOR0001',
    label: 'Yor Member',
    packageTier: 'Standard',
    status: 'active',
    children: [
      { id: 'YOR0002', label: 'Alyssa Cruz', packageTier: 'Business', status: 'active' },
      { id: 'YOR0003', label: 'Marco Reyes', packageTier: 'VIP', status: 'active' },
      { id: 'YOR0004', label: 'Nica Santos', packageTier: 'Classic', status: 'pending' }
    ]
  };

  const binaryTree: TreeNode = {
    id: 'YOR0001',
    label: 'Yor Member',
    packageTier: 'Standard',
    status: 'active',
    children: [
      {
        id: 'YOR0002',
        label: 'Left Leg - Alyssa Cruz',
        packageTier: 'Business',
        status: 'active',
        children: [{ id: 'SHADOW-L', label: 'Reserved left shadow', packageTier: 'None', status: 'reserved_shadow' }]
      },
      {
        id: 'YOR0003',
        label: 'Right Leg - Marco Reyes',
        packageTier: 'VIP',
        status: 'active',
        children: [{ id: 'SHADOW-R', label: 'Activated right shadow', packageTier: 'Classic', status: 'activated_shadow' }]
      }
    ]
  };

  return {
    moneyMode,
    treeType: kind,
    root: kind === 'sponsor' ? sponsorTree : binaryTree,
    notes: kind === 'sponsor'
      ? ['Direct referral credit uses direct sponsor genealogy, not binary placement.']
      : ['Salesmatch and binary cycle simulations use placement tree visibility with shadow-account restrictions.']
  };
}

export function buildShadowAccounts(): { moneyMode: typeof moneyMode; accounts: ShadowAccount[] } {
  return {
    moneyMode,
    accounts: [
      {
        id: 'SHADOW-L',
        owner: 'YOR0001',
        state: 'reserved_shadow',
        placement: 'left',
        walletEnabled: false,
        unilevelEnabled: false,
        binaryCycleEnabled: false,
        note: 'Reserved for placement only; no PV, wallet, unilevel, or payout.'
      },
      {
        id: 'SHADOW-R',
        owner: 'YOR0001',
        state: 'activated_shadow',
        placement: 'right',
        walletEnabled: false,
        unilevelEnabled: false,
        binaryCycleEnabled: false,
        note: isSandboxMode()
          ? 'Activated for binary support in the sandbox branch; final earning policy still requires business approval.'
          : 'Activated for binary support in playground mode; final earning policy still requires business approval.'
      },
      {
        id: 'YOR0001-FULL',
        owner: 'YOR0001',
        state: 'converted_full',
        placement: 'left',
        walletEnabled: true,
        unilevelEnabled: true,
        binaryCycleEnabled: true,
        note: 'Converted full accounts can earn only after explicit qualification and audit evidence.'
      }
    ]
  };
}

export function buildAdminMvpDashboard(user: SessionUser) {
  const sandboxEncashments = isSandboxMode() ? buildSandboxAdminEncashments() : null;

  return {
    user,
    moneyMode,
    queues: [
      { label: 'Rule confirmations pending', count: [...new Set(earningStreams.flatMap((stream) => stream.unresolved))].length, status: 'attention' },
      { label: isSandboxMode() ? 'Sandbox payout queue' : 'Simulated payout reviews', count: sandboxEncashments?.totals.awaitingReview ?? 2, status: 'watch' },
      { label: isSandboxMode() ? 'Sandbox write surfaces' : 'Playground write checks', count: 3, status: 'clear' }
    ],
    modules: [
      'member-management',
      'sponsor-tree',
      'binary-placement-tree',
      'package-rule-matrix',
      'get-five-reports',
      'wallet-ledger',
      'encashment-reports',
      'audit-status',
      'system-health'
    ]
  };
}

export function buildAdminMembers() {
  if (isSandboxMode()) {
    return {
      moneyMode,
      members: listSandboxMembers().map((member) => ({
        username: member.username,
        name: member.fullName,
        packageTier: member.packageTier,
        status: member.accountStatus,
        shadowAccounts: 0
      }))
    };
  }

  return {
    moneyMode,
    members: [
      { username: 'YOR0001', name: 'Yor Member', packageTier: 'Standard', status: 'active', shadowAccounts: 2 },
      { username: 'YOR0002', name: 'Alyssa Cruz', packageTier: 'Business', status: 'active', shadowAccounts: 0 },
      { username: 'YOR0003', name: 'Marco Reyes', packageTier: 'VIP', status: 'active', shadowAccounts: 0 },
      { username: 'YOR0004', name: 'Nica Santos', packageTier: 'Classic', status: 'pending', shadowAccounts: 0 }
    ]
  };
}

export function buildAdminPayouts() {
  if (isSandboxMode()) {
    return {
      moneyMode,
      payouts: buildSandboxAdminEncashments().encashments.map((row) => ({
        id: row.id,
        member: row.member,
        gross: row.gross,
        deductions: row.cdDeduction,
        net: row.net,
        status: row.status
      }))
    };
  }

  return {
    moneyMode,
    payouts: [
      { id: 'ENC-20260524-001', member: 'YOR0001', gross: 8000, deductions: 100, net: 7900, status: isSandboxMode() ? 'sandbox approved' : 'playground approved' },
      { id: 'ENC-20260517-002', member: 'YOR0003', gross: 12500, deductions: 600, net: 11900, status: 'finance review' }
    ]
  };
}

export function buildGatedWriteResponse(action: string) {
  return {
    moneyMode,
    action,
    status: 'applied',
    reason: isSandboxMode()
      ? 'Sandbox mode committed this workflow into the branch-local runtime.'
      : 'Playground mode accepted this workflow for end-to-end testing. Final production value movement still requires policy sign-off, process keys, ledger tests, and admin approval evidence.'
  };
}

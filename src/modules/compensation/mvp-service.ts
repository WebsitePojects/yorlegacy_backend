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

const currency = (value: number): string =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

export function getMoneyMode() {
  return moneyMode;
}

// 1 PV = PHP 250 SMB. Binary Points credited from a salesmatch event = salesmatch value / PV_PESO_RATE.
export const PV_PESO_RATE = 250;

const sourceReferences = [
  'BUSINESSRULE.md',
  'docs/YOR International Compensation Plan.pdf',
  'docs/yor_international.pdf',
  'docs/reference/yor-compensation-and-credit-layer.md',
  'docs/reference/yor-legacy-operations-parity.md'
];

export const packagePolicies: PackagePolicy[] = [
  {
    code: 'BASIC',
    name: 'Basic',
    price: 1998,
    pv: 1,
    directSellingPrice: 350,
    directReferralBonus: 200,
    salesmatchValue: 250,
    salesmatchBinaryPoints: 250 / PV_PESO_RATE,
    weeklySalesmatchCap: 5000,
    monthlySalesmatchCap: 20000
  },
  {
    code: 'CLASSIC',
    name: 'Classic',
    price: 5998,
    pv: 2,
    directSellingPrice: 320,
    directReferralBonus: 1000,
    salesmatchValue: 500,
    salesmatchBinaryPoints: 500 / PV_PESO_RATE,
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
    pv: 10,
    directSellingPrice: 300,
    directReferralBonus: 5000,
    salesmatchValue: 2500,
    salesmatchBinaryPoints: 2500 / PV_PESO_RATE,
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
    pv: 20,
    directSellingPrice: 280,
    directReferralBonus: 7000,
    salesmatchValue: 5000,
    salesmatchBinaryPoints: 5000 / PV_PESO_RATE,
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
    pv: 60,
    directSellingPrice: 250,
    directReferralBonus: 15000,
    salesmatchValue: 15000,
    salesmatchBinaryPoints: 15000 / PV_PESO_RATE,
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
    id: 'direct-referral',
    label: 'Direct Referral',
    source: 'Direct sponsor relationship',
    basis: 'Yor package referral table across new registrations and qualified package upgrades, always tied to direct sponsor truth',
    writeStatus: moneyMode,
    unresolved: []
  },
  {
    id: 'salesmatch',
    label: 'Salesmatch Bonus',
    source: 'Binary placement left/right volume',
    basis: 'Package match value, strong-leg retention, weekly/monthly caps',
    writeStatus: moneyMode,
    unresolved: ['Production deployment still requires append-only ledgers, deterministic process keys, and duplicate-prevention guards beyond the current runtime.']
  },
  {
    id: 'binary-cycle',
    label: 'Binary Cycle Bonus',
    source: 'Binary placement salesmatch movement on the earner account',
    basis: 'Classic 2%, Standard 3%, Business 4%, and VIP 5% applied to the earner salesmatch basis; shadow accounts remain excluded while spillover may still qualify through placement truth',
    writeStatus: moneyMode,
    unresolved: ['Production deployment still requires append-only ledgers, deterministic process keys, duplicate-prevention proof, and final live database rollout evidence.']
  },
  {
    id: 'get-five',
    label: 'Get Yor Five Bonus',
    source: 'Five same-package direct signups',
    basis: 'Classic PHP 5,998, Standard PHP 25,998, Business PHP 50,998, and VIP PHP 159,998 reward amounts; Basic is excluded',
    writeStatus: moneyMode,
    unresolved: ['Finance must still confirm the reward funding source.']
  },
  {
    id: 'lifestyle-rewards',
    label: 'Lifestyle Rewards',
    source: 'Repeat purchase product movement',
    basis: 'Repeat-purchase stream based on product repurchase price. Perfume PHP 500 per purchase; Refill PHP 150 per purchase via separate YOR REFILL code. Credited to the separate lifestyle wallet with package daily/monthly caps.',
    writeStatus: moneyMode,
    unresolved: ['Production posting cadence and cadence confirmation still pending.']
  },
  {
    id: 'unilevel',
    label: 'Unilevel Bonus / Rank',
    source: 'Direct sponsor genealogy',
    basis: '10 sponsor levels with 200 PV monthly maintenance from product repurchases and Nogatu-style repeat-purchase rank race logic',
    // GATE-UNI-20260612: production posting stays disabled until the rank/maintenance
    // engine receives finance sign-off; figures shown are simulations.
    writeStatus: moneyMode,
    unresolved: [
      'Pending finance sign-off — calculations shown are simulations, no wallet posting occurs.',
      'Separate production, staging, and dev ledger environments remain a deployment prerequisite.'
    ]
  },
  {
    id: 'global',
    label: 'Global Bonus',
    source: 'Yearly global sales pool',
    basis: '2% yearly global sales pool with Nogatu-style annual pool distribution adapted to Yor qualifier tiers and maintenance continuity',
    // GATE-GLO-20260612: production posting stays disabled until the qualifier and
    // yearly closeout engine receives finance sign-off; figures shown are simulations.
    writeStatus: moneyMode,
    unresolved: [
      'Pending finance sign-off — calculations shown are simulations, no wallet posting occurs.',
      'Final Yor qualifier-tier mapping still needs full engineering port confirmation from the Nogatu reference logic.'
    ]
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
  'direct-referral': simulation('direct-referral', 5000, 'Qualified direct referral preview', [
    'Direct sponsor relation comes from sponsor_code / drefid parity',
    'Source package: Standard',
    'Yor Standard referral value: PHP 5,000',
    'The same sponsor-truth rule also applies to qualified package upgrades'
  ]),
  salesmatch: simulation('salesmatch', 15000, 'Matched binary volume preview', [
    'Left points: 24,000',
    'Right points: 18,000',
    'Weak side matched; 6,000 left points carry forward',
    'Salesmatch event: PHP 15,000 = 60 BP credited (1 PV = PHP 250 SMB; 15,000 ÷ 250)',
    'Weekly cap checked before simulated ledger posting'
  ]),
  'binary-cycle': simulation('binary-cycle', 750, 'Cycle percentage preview', [
    'Salesmatch event basis: PHP 15,000 = 60 BP (1 PV = PHP 250 SMB)',
    'Placement-based binary cycle follows the earner salesmatch event',
    'Earner package: VIP',
    'VIP binary cycle percent: 5%'
  ]),
  'get-five': simulation('get-five', 25998, 'Same-package direct milestone preview', [
    'Direct same-package Standard recruits: 5',
    'Approved Standard reward amount: PHP 25,998',
    'Process key prevents reusing the same five recruits'
  ]),
  'lifestyle-rewards': simulation('lifestyle-rewards', 300, 'Repeat-purchase lifestyle preview', [
    'Repeat purchase product total: PHP 30,000',
    'Perfume PHP 500 per purchase; Refill PHP 150 per purchase (YOR REFILL code)',
    'Lifestyle reward credited: PHP 300',
    'Separate lifestyle wallet threshold remains PHP 1,000'
  ]),
  unilevel: simulation('unilevel', 4200, 'Ten-level unilevel preview', [
    'Sponsor genealogy is separate from binary placement',
    'Unilevel requires 200 PV monthly maintenance from product repurchases',
    'Rank progression follows repeat-purchase accumulation across sponsor depth'
  ]),
  global: simulation('global', 12000, 'Annual pool eligibility preview', [
    'Yearly pool basis: 2% of approved global net sales',
    'Global bonus remains visible in the member office as a qualification stream',
    'Distribution follows the Nogatu annual pool port adjusted to Yor qualifiers'
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
      ? `${stream.label} follows the approved rulebook in the current runtime while production-grade ledgers and process keys are being finished.`
      : `${stream.label} is available in review mode so the operating workflow can be tested end to end while production controls are completed.`,
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
  const streams = streamRows
    .filter((row) => row.stream_key !== 'direct-selling')
    .map((row) => {
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
        ? 'The seven internal earning streams now follow the approved rulebook in the current runtime.'
        : 'The earning streams are rule-aligned here while production ledger controls are still being completed.',
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
    { type: 'lifestyle', label: 'Lifestyle Rewards Wallet', balance: 300, threshold: 1000 },
    { type: 'product', label: 'Product Wallet / Purchase Credits', balance: 2500, threshold: 0 },
    { type: 'pending', label: 'Pending Computed Income', balance: 4300, threshold: 0 },
    { type: 'encashment', label: 'Approved Encashment Queue', balance: 6730, threshold: 500 }
  ];

  return {
    moneyMode,
    wallets,
    entries: getWalletLedger()
  };
}

export function getWalletLedger(): WalletLedgerEntry[] {
  return [
    ledger('WL-001', 'main', 'direct_referral', 'YOR-MEMBER-002', 5000, 0, 15200.75, 'simulated-posted'),
    ledger('WL-002', 'main', 'salesmatch', 'yor01 L/R match', 7500, 0, 10200.75, 'simulated-posted'),
    ledger('WL-003', 'lifestyle', 'lifestyle_rewards', 'Repeat purchase pool', 300, 0, 300, 'threshold-pending'),
    ledger('WL-004', 'encashment', 'encashment_fee', 'ENC-20260524-001', 0, 470, 6730, 'simulated-deducted')
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
    id: 'yor01',
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
    id: 'yor01',
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

export function buildShadowAccounts(ownerUsername = 'yor01'): { moneyMode: typeof moneyMode; owner: string; accounts: ShadowAccount[] } {
  const normalizedOwner = ownerUsername.trim().toUpperCase() || 'YOR01';
  const stockistOwners = new Set(['YOR0003', 'YOR0005']);
  const isStockistOwner = stockistOwners.has(normalizedOwner);

  return {
    moneyMode,
    owner: normalizedOwner,
    accounts: [
      {
        id: `${normalizedOwner}-L`,
        owner: normalizedOwner,
        state: isStockistOwner ? 'activated_shadow' : 'reserved_shadow',
        placement: 'left',
        walletEnabled: false,
        unilevelEnabled: false,
        binaryCycleEnabled: false,
        note: isStockistOwner
          ? 'Activated for binary PV and salesmatch support only; still no wallet, direct referral, unilevel, or binary cycle rights.'
          : 'Reserved for placement only; the shadow node itself is not a registration surface.'
      },
      {
        id: `${normalizedOwner}-R`,
        owner: normalizedOwner,
        state: 'reserved_shadow',
        placement: 'right',
        walletEnabled: false,
        unilevelEnabled: false,
        binaryCycleEnabled: false,
        note: 'Reserved shadow account. Child open slots below this node can be filled, but the node itself stays non-earning.'
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
      { label: isSandboxMode() ? 'Runtime payout queue' : 'Payout reviews', count: sandboxEncashments?.totals.awaitingReview ?? 2, status: 'watch' },
      { label: isSandboxMode() ? 'Runtime write surfaces' : 'Review-mode write checks', count: 3, status: 'clear' }
    ],
    modules: [
      'member-management',
      'account-genealogy',
      'package-rule-matrix',
      'get-five-reports',
      'get-five-package-claims',
      'cd-accounts',
      'voucher-management',
      'rankings',
      'global-bonus',
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
      { username: 'yor01', name: 'Yor Company01', packageTier: 'Standard', status: 'active', shadowAccounts: 2 },
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
        deductions: currency(
          Number(String(row.fee).replace(/[^0-9.-]/g, '')) +
          Number(String(row.tax).replace(/[^0-9.-]/g, '')) +
          Number(String(row.cdDeduction).replace(/[^0-9.-]/g, ''))
        ),
        net: row.net,
        status: row.status
      }))
    };
  }

  return {
    moneyMode,
    payouts: [
      { id: 'ENC-20260524-001', member: 'yor01', gross: 8000, deductions: 100, net: 7900, status: isSandboxMode() ? 'sandbox approved' : 'playground approved' },
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
      ? 'Current runtime committed this workflow successfully.'
      : 'Review mode accepted this workflow for end-to-end testing. Final production value movement still requires policy sign-off, process keys, ledger tests, and admin approval evidence.'
  };
}

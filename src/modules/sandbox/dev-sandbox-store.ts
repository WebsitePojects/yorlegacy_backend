import crypto from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';
import { createPasswordHashSync } from '../auth/password.js';
import type { AuditEvent, SessionUser } from '../../types/auth.js';

export type MemberRecord = {
  userId: string;
  username: string;
  fullName: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phone?: string;
  address?: string;
  packageTier: string;
  accountStatus: string;
  referralCode: string;
  sponsorCode: string;
  placement: 'left' | 'right' | 'root';
  placementParentUsername: string | null;
  directReferrals: number;
  leftPoints: number;
  rightPoints: number;
  walletAvailable: number;
  walletPending: number;
  cdBalance: number;
  stockist: boolean;
  payoutOption?: string;
  payoutDetails?: string;
  lastActivity: string;
};

export type ActivationRow = {
  code: string;
  accountType: 'PD' | 'CD' | 'FS';
  packageTier: string;
  assignedTo: string | null;
  status: 'unreleased' | 'available' | 'used' | 'lost';
  paymentStatus: 'unpaid' | 'paid' | 'externally-paid';
  remarks?: string;
  generatedAt: string;
};

export type PairingRow = {
  week: string;
  leftPoints: number;
  rightPoints: number;
  matchedPoints: number;
  salesmatch: string;
  carryForward: string;
};

export type PayoutRow = {
  reference: string;
  member: string;
  gross: string;
  fee: string;
  tax: string;
  cdDeduction: string;
  net: string;
  status: string;
  method: string;
  remarks: string;
  createdAt: string;
};

export type SandboxWalletLedgerEntry = {
  id: string;
  memberUsername: string;
  walletType: string;
  entryType: string;
  sourceReference: string;
  creditAmount: number;
  debitAmount: number;
  balanceAfter: number;
  status: string;
  occurredAt: string;
  processId: string;
};

type SandboxUserRecord = SessionUser & {
  passwordHash: string;
  passwordSalt: string;
  status: 'active' | 'pending' | 'frozen' | 'suspended';
};

type SandboxAdminProfile = {
  userId: string;
  accessScope: string;
  officeTitle: string;
};

type SandboxState = {
  runtimeMode: 'sandbox';
  metadata: {
    version: number;
    lastResetAt: string;
    lastMutationAt: string;
  };
  users: SandboxUserRecord[];
  adminProfiles: SandboxAdminProfile[];
  members: MemberRecord[];
  activationRows: ActivationRow[];
  pairingRows: PairingRow[];
  payoutRows: PayoutRow[];
  walletLedgerEntries: SandboxWalletLedgerEntry[];
  auditEvents: AuditEvent[];
};

type SandboxStateInput = Partial<SandboxState> & {
  metadata?: Partial<SandboxState['metadata']>;
};

const currency = (value: number): string =>
  `PHP ${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const sandboxDataFile = path.resolve(process.cwd(), env.YOR_SANDBOX_DATA_FILE);
const sandboxPackagePolicies = [
  { code: 'BASIC', name: 'Basic', pv: 5, directReferralBonus: 200 },
  { code: 'CLASSIC', name: 'Classic', pv: 10, directReferralBonus: 1000 },
  { code: 'STANDARD', name: 'Standard', pv: 50, directReferralBonus: 5000 },
  { code: 'BUSINESS', name: 'Business', pv: 100, directReferralBonus: 7000 },
  { code: 'VIP', name: 'VIP', pv: 300, directReferralBonus: 15000 }
] as const;
const seededUserSalts = {
  member: 'ba43c72b000c8a310deced20454ebeb2',
  admin: 'ca2e6d6a23f52dbc1de66ef9e105091a',
  cashier: '7d85fda79bc1f818d8d50f804f79ac1e',
  bod: '89163257b38b2ef817bdbf4c149ce163',
  superadmin: '1ce26b792208c87bc68727308f18d209'
} as const;
let cachedSeedState: SandboxState | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function createSeedPasswordHashSync(password: string, salt: string) {
  return {
    salt,
    hash: crypto.scryptSync(password, salt, 64).toString('hex')
  };
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseCurrency(value: string): number {
  return Number(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

function composeFullName(firstName: string, lastName: string, middleName?: string): string {
  return [firstName.trim(), middleName?.trim(), lastName.trim()].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function splitFullName(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: '',
      middleName: '',
      lastName: ''
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      middleName: '',
      lastName: ''
    };
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      middleName: '',
      lastName: parts[1]
    };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts.at(-1) ?? ''
  };
}

function buildSeedUsers(): SandboxUserRecord[] {
  const memberPassword = createSeedPasswordHashSync(
    env.DEMO_MEMBER_PASSWORD,
    seededUserSalts.member
  );
  const adminPassword = createSeedPasswordHashSync(
    env.DEMO_ADMIN_PASSWORD,
    seededUserSalts.admin
  );
  const cashierPassword = createSeedPasswordHashSync(
    env.DEMO_CASHIER_PASSWORD,
    seededUserSalts.cashier
  );
  const bodPassword = createSeedPasswordHashSync(env.DEMO_BOD_PASSWORD, seededUserSalts.bod);
  const superadminPassword = createSeedPasswordHashSync(
    env.DEMO_SUPERADMIN_PASSWORD,
    seededUserSalts.superadmin
  );

  return [
    {
      id: 'yor-member-demo',
      role: 'member',
      name: env.DEMO_MEMBER_NAME,
      email: env.DEMO_MEMBER_EMAIL.toLowerCase(),
      passwordHash: memberPassword.hash,
      passwordSalt: memberPassword.salt,
      status: 'active'
    },
    {
      id: 'yor-admin-demo',
      role: 'admin',
      name: env.DEMO_ADMIN_NAME,
      email: env.DEMO_ADMIN_EMAIL.toLowerCase(),
      passwordHash: adminPassword.hash,
      passwordSalt: adminPassword.salt,
      status: 'active'
    },
    {
      id: 'yor-cashier-demo',
      role: 'cashier',
      name: env.DEMO_CASHIER_NAME,
      email: env.DEMO_CASHIER_EMAIL.toLowerCase(),
      passwordHash: cashierPassword.hash,
      passwordSalt: cashierPassword.salt,
      status: 'active'
    },
    {
      id: 'yor-bod-demo',
      role: 'bod',
      name: env.DEMO_BOD_NAME,
      email: env.DEMO_BOD_EMAIL.toLowerCase(),
      passwordHash: bodPassword.hash,
      passwordSalt: bodPassword.salt,
      status: 'active'
    },
    {
      id: 'yor-superadmin-demo',
      role: 'superadmin',
      name: env.DEMO_SUPERADMIN_NAME,
      email: env.DEMO_SUPERADMIN_EMAIL.toLowerCase(),
      passwordHash: superadminPassword.hash,
      passwordSalt: superadminPassword.salt,
      status: 'active'
    }
  ];
}

function buildSeedState(): SandboxState {
  if (cachedSeedState) {
    return JSON.parse(JSON.stringify(cachedSeedState)) as SandboxState;
  }

  const timestamp = nowIso();
  const seedState: SandboxState = {
    runtimeMode: 'sandbox',
    metadata: {
      version: 1,
      lastResetAt: timestamp,
      lastMutationAt: timestamp
    },
    users: buildSeedUsers(),
    adminProfiles: [
      { userId: 'yor-admin-demo', accessScope: 'admin', officeTitle: 'Admin Office' },
      { userId: 'yor-cashier-demo', accessScope: 'cashier', officeTitle: 'Cashier Office' },
      { userId: 'yor-bod-demo', accessScope: 'bod', officeTitle: 'Board Office' },
      { userId: 'yor-superadmin-demo', accessScope: 'superadmin', officeTitle: 'Super Admin Office' }
    ],
    members: [
      {
        userId: 'yor-member-demo',
        username: 'YOR0001',
        fullName: 'Yor Member',
        firstName: 'Yor',
        lastName: 'Member',
        middleName: '',
        email: 'member@yor.local',
        phone: '+63 900 000 0001',
        address: 'Makati City, Metro Manila',
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
        stockist: false,
        payoutOption: 'GCash',
        payoutDetails: '09170000001',
        lastActivity: '2026-05-28'
      },
      {
        userId: 'yor-legacy-002',
        username: 'YOR0002',
        fullName: 'Alyssa Cruz',
        firstName: 'Alyssa',
        lastName: 'Cruz',
        middleName: '',
        email: 'alyssa.cruz@example.test',
        phone: '+63 917 100 2002',
        address: 'Quezon City, Metro Manila',
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
        stockist: false,
        payoutOption: 'Bank Deposit',
        payoutDetails: 'Alyssa Cruz / BDO ****1202',
        lastActivity: '2026-05-27'
      },
      {
        userId: 'yor-legacy-003',
        username: 'YOR0003',
        fullName: 'Marco Reyes',
        firstName: 'Marco',
        lastName: 'Reyes',
        middleName: '',
        email: 'marco.reyes@example.test',
        phone: '+63 917 100 2003',
        address: 'Pasig City, Metro Manila',
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
        stockist: true,
        payoutOption: 'GCash',
        payoutDetails: '09171234567',
        lastActivity: '2026-05-26'
      },
      {
        userId: 'yor-legacy-004',
        username: 'YOR0004',
        fullName: 'Nica Santos',
        firstName: 'Nica',
        lastName: 'Santos',
        middleName: '',
        email: 'nica.santos@example.test',
        phone: '+63 917 100 2004',
        address: 'Marikina City, Metro Manila',
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
        stockist: false,
        payoutOption: 'Pickup',
        payoutDetails: 'Cash',
        lastActivity: '2026-05-25'
      },
      {
        userId: 'yor-legacy-005',
        username: 'YOR0005',
        fullName: 'Ramon Dela Cruz',
        firstName: 'Ramon',
        lastName: 'Dela Cruz',
        middleName: '',
        email: 'ramon.dc@example.test',
        phone: '+63 917 100 2005',
        address: 'Antipolo City, Rizal',
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
        stockist: true,
        payoutOption: 'Remittance Center',
        payoutDetails: 'Cebuana / Ramon Dela Cruz',
        lastActivity: '2026-05-24'
      }
    ],
    activationRows: [
      { code: 'PDSTYQ8M4K', accountType: 'PD', packageTier: 'Standard', assignedTo: 'YOR0001', status: 'used', paymentStatus: 'paid', remarks: 'Consumed in prior registration cycle.', generatedAt: '2026-05-20' },
      { code: 'FSBUP3N9XA', accountType: 'FS', packageTier: 'Business', assignedTo: 'YOR0002', status: 'used', paymentStatus: 'externally-paid', remarks: 'Settled member-to-member outside office.', generatedAt: '2026-05-21' },
      { code: 'PDSTK7V2LC', accountType: 'PD', packageTier: 'Standard', assignedTo: 'YOR0001', status: 'available', paymentStatus: 'paid', remarks: 'Paid and ready for release cycle.', generatedAt: '2026-05-28' },
      { code: 'FSBUZ6Q1RH', accountType: 'FS', packageTier: 'Business', assignedTo: 'YOR0003', status: 'available', paymentStatus: 'externally-paid', remarks: 'Stockist walk-in settlement verified by admin.', generatedAt: '2026-05-28' },
      { code: 'PDBA5D8WJ2', accountType: 'PD', packageTier: 'Basic', assignedTo: 'YOR0001', status: 'available', paymentStatus: 'unpaid', remarks: 'Awaiting package settlement.', generatedAt: '2026-05-28' },
      { code: 'PDCLV4T9QB', accountType: 'PD', packageTier: 'Classic', assignedTo: 'YOR0001', status: 'available', paymentStatus: 'paid', remarks: 'Ready for direct sponsor release.', generatedAt: '2026-05-28' },
      { code: 'FSBUH7M2KC', accountType: 'FS', packageTier: 'Business', assignedTo: null, status: 'unreleased', paymentStatus: 'unpaid', remarks: 'General code pool inventory.', generatedAt: '2026-05-28' },
      { code: 'FSVI8X4R2M', accountType: 'FS', packageTier: 'VIP', assignedTo: 'YOR0001', status: 'available', paymentStatus: 'paid', remarks: 'High-tier stockist sale cleared.', generatedAt: '2026-05-28' }
    ],
    pairingRows: [
      {
        week: '2026-W22',
        leftPoints: 24000,
        rightPoints: 18000,
        matchedPoints: 18000,
        salesmatch: currency(15000),
        carryForward: '6,000 left pts'
      },
      {
        week: '2026-W21',
        leftPoints: 16000,
        rightPoints: 12000,
        matchedPoints: 12000,
        salesmatch: currency(10000),
        carryForward: '4,000 left pts'
      }
    ],
    payoutRows: [
      {
        reference: 'ENC-20260524-001',
        member: 'YOR0001',
        gross: currency(8000),
        fee: currency(100),
        tax: currency(0),
        cdDeduction: currency(0),
        net: currency(7900),
        status: 'paid',
        method: 'GCash',
        remarks: 'Paid during Friday release batch.',
        createdAt: '2026-05-24T08:00:00Z'
      },
      {
        reference: 'ENC-20260517-002',
        member: 'YOR0003',
        gross: currency(12500),
        fee: currency(100),
        tax: currency(0),
        cdDeduction: currency(500),
        net: currency(11900),
        status: 'requested',
        method: 'Bank',
        remarks: 'Awaiting operator review and payout note.',
        createdAt: '2026-05-17T08:00:00Z'
      }
    ],
    walletLedgerEntries: [
      {
        id: 'WL-001',
        memberUsername: 'YOR0001',
        walletType: 'main',
        entryType: 'direct_referral',
        sourceReference: 'YOR-ALYSSA',
        creditAmount: 5000,
        debitAmount: 0,
        balanceAfter: 15200.75,
        status: 'posted',
        occurredAt: '2026-05-28T08:00:00Z',
        processId: 'sandbox-wl-001'
      },
      {
        id: 'WL-002',
        memberUsername: 'YOR0001',
        walletType: 'main',
        entryType: 'salesmatch',
        sourceReference: 'YOR0001 L/R match',
        creditAmount: 7500,
        debitAmount: 0,
        balanceAfter: 10200.75,
        status: 'posted',
        occurredAt: '2026-05-27T08:00:00Z',
        processId: 'sandbox-wl-002'
      },
      {
        id: 'WL-003',
        memberUsername: 'YOR0001',
        walletType: 'encashment',
        entryType: 'encashment_fee',
        sourceReference: 'ENC-20260524-001',
        creditAmount: 0,
        debitAmount: 100,
        balanceAfter: 7900,
        status: 'deducted',
        occurredAt: '2026-05-24T08:00:00Z',
        processId: 'sandbox-wl-003'
      }
    ],
    auditEvents: [
      {
        actor: 'Yor Super Admin',
        action: 'login_verified',
        target: 'yoradmin@gmail.com',
        occurredAt: '2026-05-28T10:00:00Z'
      },
      {
        actor: 'System',
        action: 'sandbox_runtime_enabled',
        target: 'dev-only mutable store',
        occurredAt: timestamp
      }
    ]
  };

  cachedSeedState = seedState;
  return JSON.parse(JSON.stringify(seedState)) as SandboxState;
}

function ensureSandboxStateFile(): void {
  if (!existsSync(sandboxDataFile)) {
    mkdirSync(path.dirname(sandboxDataFile), { recursive: true });
    writeFileSync(sandboxDataFile, JSON.stringify(buildSeedState(), null, 2), 'utf8');
  }
}

function mergeSeededRows<T extends Record<string, unknown>>(
  seedRows: T[],
  stateRows: unknown,
  key: keyof T
): T[] {
  const existingRows = Array.isArray(stateRows) ? (stateRows as T[]) : [];
  const merged = [...existingRows];
  const seen = new Set(existingRows.map((row) => String(row[key] ?? '')));

  for (const seedRow of seedRows) {
    const seedKey = String(seedRow[key] ?? '');

    if (!seen.has(seedKey)) {
      merged.push(seedRow);
      seen.add(seedKey);
    }
  }

  return merged;
}

function normalizeMemberRecord(member: MemberRecord): MemberRecord {
  const names = splitFullName(member.fullName);
  const firstName = member.firstName?.trim() || names.firstName;
  const lastName = member.lastName?.trim() || names.lastName;
  const middleName = member.middleName?.trim() || names.middleName || '';

  return {
    ...member,
    firstName,
    lastName,
    middleName,
    fullName: composeFullName(firstName, lastName, middleName),
    stockist: Boolean(member.stockist),
    payoutOption: member.payoutOption?.trim() || 'GCash',
    payoutDetails: member.payoutDetails?.trim() || member.phone?.trim() || ''
  };
}

function normalizeSandboxState(input: SandboxStateInput): SandboxState {
  const seed = buildSeedState();
  const activationInput = Array.isArray(input.activationRows) ? input.activationRows : seed.activationRows;
  const normalizedActivationRows = activationInput.map((row) => {
    const activationRow = row as ActivationRow;
    const assignedTo = typeof activationRow.assignedTo === 'string' && activationRow.assignedTo.trim()
      ? activationRow.assignedTo
      : null;

    return {
      ...activationRow,
      accountType: accountTypePrefix(activationRow.accountType),
      assignedTo,
      paymentStatus:
        activationRow.paymentStatus === 'paid' || activationRow.paymentStatus === 'externally-paid'
          ? activationRow.paymentStatus
          : 'unpaid',
      remarks: activationRow.remarks?.trim() || ''
    };
  }) as ActivationRow[];
  const payoutInput = Array.isArray(input.payoutRows) ? input.payoutRows : seed.payoutRows;
  const normalizedPayoutRows = payoutInput.map((row) => ({
    ...row,
    tax: typeof row.tax === 'string' ? row.tax : currency(0),
    remarks: typeof row.remarks === 'string' ? row.remarks : ''
  })) as PayoutRow[];

  return {
    runtimeMode: 'sandbox',
    metadata: {
      version: typeof input.metadata?.version === 'number' ? input.metadata.version : seed.metadata.version,
      lastResetAt:
        typeof input.metadata?.lastResetAt === 'string' ? input.metadata.lastResetAt : seed.metadata.lastResetAt,
      lastMutationAt:
        typeof input.metadata?.lastMutationAt === 'string'
          ? input.metadata.lastMutationAt
          : seed.metadata.lastMutationAt
    },
    users: mergeSeededRows(seed.users, input.users, 'id'),
    adminProfiles: mergeSeededRows(seed.adminProfiles, input.adminProfiles, 'userId'),
    members: (Array.isArray(input.members) ? input.members : seed.members).map((member) =>
      normalizeMemberRecord(member as MemberRecord)
    ),
    activationRows: normalizedActivationRows,
    pairingRows: Array.isArray(input.pairingRows) ? input.pairingRows : seed.pairingRows,
    payoutRows: normalizedPayoutRows,
    walletLedgerEntries: Array.isArray(input.walletLedgerEntries) ? input.walletLedgerEntries : seed.walletLedgerEntries,
    auditEvents: Array.isArray(input.auditEvents) ? input.auditEvents : seed.auditEvents
  };
}

function readState(): SandboxState {
  ensureSandboxStateFile();
  const rawJson = readFileSync(sandboxDataFile, 'utf8');
  const rawState = JSON.parse(rawJson) as SandboxStateInput;
  const state = normalizeSandboxState(rawState);
  const normalizedJson = JSON.stringify(state, null, 2);

  if (normalizedJson !== rawJson) {
    writeFileSync(sandboxDataFile, normalizedJson, 'utf8');
  }

  return state;
}

function writeState(state: SandboxState): void {
  state.metadata.lastMutationAt = nowIso();
  writeFileSync(sandboxDataFile, JSON.stringify(state, null, 2), 'utf8');
}

export function isSandboxMode(): boolean {
  return env.YOR_RUNTIME_MODE === 'sandbox';
}

export function getSandboxMoneyMode(): 'sandbox' {
  return 'sandbox';
}

export function readSandboxState(): SandboxState {
  return readState();
}

export function updateSandboxState<T>(mutator: (state: SandboxState) => T): T {
  const state = readState();
  const result = mutator(state);
  writeState(state);
  return result;
}

export function resetSandboxState(): SandboxState {
  const state = buildSeedState();
  writeState(state);
  return state;
}

export function listSandboxMembers(): MemberRecord[] {
  return readState().members.map((member) => ({ ...member }));
}

export function listSandboxActivationRows(): ActivationRow[] {
  return readState().activationRows.map((row) => ({ ...row }));
}

export function listSandboxPairingRows(): PairingRow[] {
  return readState().pairingRows.map((row) => ({ ...row }));
}

export function listSandboxPayoutRows(): PayoutRow[] {
  return readState().payoutRows.map((row) => ({ ...row }));
}

export function listSandboxAuditEvents(): AuditEvent[] {
  return readState().auditEvents.map((event) => ({ ...event }));
}

export function listSandboxWalletLedger(memberUsername?: string): SandboxWalletLedgerEntry[] {
  const rows = readState().walletLedgerEntries;
  return rows
    .filter((entry) => !memberUsername || entry.memberUsername === memberUsername)
    .map((entry) => ({ ...entry }));
}

export function findSandboxUserByEmail(email: string): SandboxUserRecord | null {
  const normalizedEmail = email.trim().toLowerCase();
  return readState().users.find((user) => user.email === normalizedEmail) ?? null;
}

export function findSandboxMemberProfileByUserId(userId: string): MemberRecord | null {
  return readState().members.find((member) => member.userId === userId) ?? null;
}

export function findSandboxAdminProfileByUserId(userId: string): SandboxAdminProfile | null {
  return readState().adminProfiles.find((profile) => profile.userId === userId) ?? null;
}

export function findSandboxMemberByCode(code: string): MemberRecord | null {
  return readState().members.find((member) => member.username === code || member.referralCode === code) ?? null;
}

export function findSandboxMemberByUsername(username: string): MemberRecord | null {
  return readState().members.find((member) => member.username === username) ?? null;
}

function nextNumericId(values: string[], prefix: string): string {
  const max = values.reduce((current, value) => {
    const match = value.match(/(\d+)$/);
    const numeric = match ? Number(match[1]) : 0;
    return Math.max(current, numeric);
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function nextUsername(members: MemberRecord[]): string {
  return nextNumericId(members.map((member) => member.username), 'YOR');
}

function accountTypePrefix(value?: string): ActivationRow['accountType'] {
  const normalized = String(value ?? 'PD').trim().toUpperCase();
  return normalized === 'CD' || normalized === 'FS' ? normalized : 'PD';
}

function packageCodePrefix(packageTier: string): string {
  const normalized = packageTier.trim().toUpperCase();
  const known: Record<string, string> = {
    CLASSIC: 'CL',
    BASIC: 'BA',
    STANDARD: 'ST',
    BUSINESS: 'BU',
    VIP: 'VI'
  };

  return known[normalized] ?? normalized.replace(/[^A-Z]/g, '').slice(0, 2).padEnd(2, 'X');
}

function nextActivationCode(codes: ActivationRow[], packageTier: string, accountType: ActivationRow['accountType']): string {
  const prefix = `${accountType}${packageCodePrefix(packageTier)}`;
  const existingCodes = new Set(codes.map((row) => row.code));
  let candidate = '';

  do {
    candidate = `${prefix}${crypto.randomBytes(4).toString('base64url').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 7)}`;
  } while (existingCodes.has(candidate) || candidate.length < 8);

  return candidate;
}

function nextEncashmentReference(rows: PayoutRow[]): string {
  const count = rows.length + 1;
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `ENC-${stamp}-${String(count).padStart(3, '0')}`;
}

function nextLedgerId(entries: SandboxWalletLedgerEntry[]): string {
  const max = entries.reduce((current, entry) => {
    const numeric = Number(entry.id.replace(/[^0-9]/g, '')) || 0;
    return Math.max(current, numeric);
  }, 0);
  return `WL-${String(max + 1).padStart(3, '0')}`;
}

function addAuditEvent(state: SandboxState, actor: string, action: string, target: string): void {
  state.auditEvents.unshift({
    actor,
    action,
    target,
    occurredAt: nowIso()
  });
}

function createLedgerEntry(
  state: SandboxState,
  memberUsername: string,
  entryType: string,
  sourceReference: string,
  creditAmount: number,
  debitAmount: number,
  balanceAfter: number,
  status: string
): SandboxWalletLedgerEntry {
  return {
    id: nextLedgerId(state.walletLedgerEntries),
    memberUsername,
    walletType: creditAmount > 0 ? 'main' : 'encashment',
    entryType,
    sourceReference,
    creditAmount,
    debitAmount,
    balanceAfter,
    status,
    occurredAt: nowIso(),
    processId: `sandbox-${entryType}-${Date.now()}`
  };
}

function packageRank(packageTier: string): number {
  return sandboxPackagePolicies.findIndex((policy) => policy.code === packageTier.toUpperCase());
}

function resolvePackagePolicy(packageTier: string) {
  return sandboxPackagePolicies.find((policy) => policy.code === packageTier.toUpperCase()) ?? sandboxPackagePolicies[2];
}

function propagateBinaryPoints(state: SandboxState, placementParentUsername: string, placement: 'left' | 'right', points: number): void {
  let currentParentUsername: string | null = placementParentUsername;
  let currentPlacement: 'left' | 'right' = placement;

  while (currentParentUsername) {
    const parent = state.members.find((member) => member.username === currentParentUsername);

    if (!parent) {
      break;
    }

    if (currentPlacement === 'left') {
      parent.leftPoints += points;
    } else {
      parent.rightPoints += points;
    }

    currentPlacement = parent.placement === 'root' ? currentPlacement : parent.placement;
    currentParentUsername = parent.placementParentUsername;
  }
}

export function transferSandboxActivationCodes(actor: SessionUser, targetUsername: string, codes: string[]) {
  return updateSandboxState((state) => {
    const member = state.members.find((entry) => entry.userId === actor.id || entry.email === actor.email);
    const target = state.members.find((entry) => entry.username === targetUsername);

    if (!member) {
      throw new Error('Sandbox member profile not found.');
    }

    if (!target) {
      throw new Error('Target member not found.');
    }

    if (!codes.length) {
      throw new Error('Select at least one activation code.');
    }

    for (const codeValue of codes) {
      const code = state.activationRows.find((row) => row.code === codeValue);

      if (!code || code.assignedTo !== member.username || code.status !== 'available') {
        throw new Error(`Activation code ${codeValue} is not transferable.`);
      }

      code.assignedTo = target.username;
      code.remarks = code.remarks?.trim()
        ? `${code.remarks} Transfer:${member.username}->${target.username}.`
        : `Transfer:${member.username}->${target.username}.`;
    }

    addAuditEvent(state, actor.name, 'activation_code_transfer', `${member.username} -> ${target.username}`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'member-transfer-activation-code',
      status: 'completed' as const,
      reason: 'Sandbox inventory write committed.',
      detail: `Transferred ${codes.length} code(s) to ${target.username}.`
    };
  });
}

export function reassignSandboxActivationCodes(actor: SessionUser, targetUsername: string, codes: string[]) {
  return updateSandboxState((state) => {
    const target = state.members.find((entry) => entry.username === targetUsername);

    if (!target) {
      throw new Error('Target member not found.');
    }

    if (!codes.length) {
      throw new Error('Select at least one activation code.');
    }

    for (const codeValue of codes) {
      const code = state.activationRows.find((row) => row.code === codeValue);

      if (!code || code.status === 'used' || code.status === 'lost') {
        throw new Error(`Activation code ${codeValue} is not transferable.`);
      }

      code.assignedTo = target.username;
      code.remarks = code.remarks?.trim()
        ? `${code.remarks} Transfer:${actor.name}->${target.username}.`
        : `Transfer:${actor.name}->${target.username}.`;
    }

    addAuditEvent(state, actor.name, 'admin_activation_code_transfer', `${codes.length} code(s) -> ${target.username}`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'admin-transfer-activation-code',
      status: 'completed' as const,
      reason: 'Sandbox inventory reassignment committed.',
      detail: `Transferred ${codes.length} code(s) to ${target.username}.`
    };
  });
}

export function releaseSandboxActivationCodes(actor: SessionUser, codes: string[]) {
  return updateSandboxState((state) => {
    if (!codes.length) {
      throw new Error('Select at least one activation code.');
    }

    let releasedCount = 0;

    for (const codeValue of codes) {
      const code = state.activationRows.find((row) => row.code === codeValue);

      if (!code || code.status === 'used' || code.status === 'lost') {
        throw new Error(`Activation code ${codeValue} cannot be released.`);
      }

      if (code.status === 'unreleased') {
        code.status = 'available';
        releasedCount += 1;
      }
    }

    addAuditEvent(state, actor.name, 'activation_code_release', `${releasedCount} code(s) released`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'admin-release-activation-code',
      status: 'completed' as const,
      reason: 'Sandbox code release committed.',
      detail:
        releasedCount > 0
          ? `Released ${releasedCount} code(s) and marked them ready for member use.`
          : 'The selected codes were already released.'
    };
  });
}

export function upgradeSandboxMemberWithCode(actor: SessionUser, codeValue: string) {
  return updateSandboxState((state) => {
    const member = state.members.find((entry) => entry.userId === actor.id || entry.email === actor.email);
    const code = state.activationRows.find((row) => row.code === codeValue);

    if (!member || !code || code.assignedTo !== member.username || code.status !== 'available') {
      throw new Error('The selected activation code is not available for this member.');
    }

    if (packageRank(code.packageTier) <= packageRank(member.packageTier)) {
      throw new Error('Use a higher-tier activation code for upgrade.');
    }

    member.packageTier = code.packageTier;
    member.accountStatus = 'active';
    member.lastActivity = todayDate();
    code.status = 'used';
    code.remarks = code.remarks?.trim()
      ? `${code.remarks} Upgrade used by ${member.username}.`
      : `Upgrade used by ${member.username}.`;

    addAuditEvent(state, actor.name, 'member_upgrade_committed', `${member.username} -> ${code.packageTier}`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'member-upgrade-with-activation-code',
      status: 'completed' as const,
      reason: 'Sandbox upgrade committed.',
      detail: `${member.username} is now upgraded to ${code.packageTier}.`
    };
  });
}

export function applySandboxMaintenanceCode(actor: SessionUser, codeValue: string) {
  return updateSandboxState((state) => {
    const member = state.members.find((entry) => entry.userId === actor.id || entry.email === actor.email);
    const code = state.activationRows.find((row) => row.code === codeValue);

    if (!member || !code || code.assignedTo !== member.username || code.status !== 'available') {
      throw new Error('The maintenance code is not available for this member.');
    }

    code.status = 'used';
    member.accountStatus = 'active';
    member.lastActivity = todayDate();
    code.remarks = code.remarks?.trim()
      ? `${code.remarks} Maintenance used by ${member.username}.`
      : `Maintenance used by ${member.username}.`;

    addAuditEvent(state, actor.name, 'maintenance_code_committed', `${member.username} / ${code.code}`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'member-maintenance-code-use',
      status: 'completed' as const,
      reason: 'Sandbox maintenance write committed.',
      detail: `Maintenance code ${code.code} was consumed for ${member.username}.`
    };
  });
}

export function submitSandboxEncashment(actor: SessionUser, amount: number) {
  return updateSandboxState((state) => {
    const member = state.members.find((entry) => entry.userId === actor.id || entry.email === actor.email);

    if (!member) {
      throw new Error('Sandbox member profile not found.');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Enter a valid encashment amount.');
    }

    if (amount > member.walletAvailable) {
      throw new Error('Requested amount exceeds available wallet balance.');
    }

    const fee = 100;
    const tax = 0;
    const cdDeduction = Math.min(member.cdBalance, Math.max(0, amount * 0.05));
    const net = Math.max(0, amount - fee - tax - cdDeduction);
    const reference = nextEncashmentReference(state.payoutRows);

    member.walletAvailable -= amount;
    member.cdBalance = Math.max(0, member.cdBalance - cdDeduction);
    member.lastActivity = todayDate();

    const ledgerEntry = createLedgerEntry(
      state,
      member.username,
      'encashment_request',
      reference,
      0,
      amount,
      member.walletAvailable,
      'queued'
    );

    state.walletLedgerEntries.unshift(ledgerEntry);
    state.payoutRows.unshift({
      reference,
      member: member.username,
      gross: currency(amount),
      fee: currency(fee),
      tax: currency(tax),
      cdDeduction: currency(cdDeduction),
      net: currency(net),
      status: 'requested',
      method: 'GCash',
      remarks: 'Member-submitted encashment request.',
      createdAt: nowIso()
    });

    addAuditEvent(state, actor.name, 'encashment_requested', reference);

    return {
      moneyMode: 'sandbox' as const,
      action: 'member-wallet-encash',
      status: 'completed' as const,
      reason: 'Sandbox encashment committed.',
      detail: `Queued ${reference} for ${currency(amount)} gross / ${currency(net)} net.`
    };
  });
}

export function generateSandboxActivationCodes(
  actor: SessionUser,
  quantity: number,
  packageTier = 'Standard',
  assignedTo?: string,
  accountType?: string
) {
  return updateSandboxState((state) => {
    const count = Math.max(1, Math.min(50, Math.floor(quantity)));
    const normalizedOwner = assignedTo?.trim().toUpperCase() ?? '';
    const owner = normalizedOwner ? state.members.find((member) => member.username === normalizedOwner) : null;
    const codeAccountType = accountTypePrefix(accountType);

    if (normalizedOwner && !owner) {
      throw new Error('Assigned member was not found.');
    }

    for (let index = 0; index < count; index += 1) {
      state.activationRows.unshift({
        code: nextActivationCode(state.activationRows, packageTier, codeAccountType),
        accountType: codeAccountType,
        packageTier,
        assignedTo: owner?.username ?? null,
        status: 'unreleased',
        paymentStatus: 'unpaid',
        remarks: owner ? `Tagged to ${owner.username} at generation.` : 'General code pool inventory.',
        generatedAt: todayDate()
      });
    }

    addAuditEvent(state, actor.name, 'activation_batch_generated', `${count} x ${codeAccountType} ${packageTier} -> ${owner?.username ?? 'unassigned pool'}`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'admin-generate-activation-codes',
      status: 'completed' as const,
      reason: 'Sandbox code batch committed.',
      detail: owner
        ? `Generated ${count} ${codeAccountType} ${packageTier} code(s) for ${owner.username}.`
        : `Generated ${count} ${codeAccountType} ${packageTier} code(s) into the unassigned pool.`
    };
  });
}

export function approveSandboxEncashment(actor: SessionUser, encashmentId: string) {
  return updateSandboxState((state) => {
    const row = state.payoutRows.find((entry) => entry.reference === encashmentId);

    if (!row) {
      throw new Error('Encashment queue item not found.');
    }

    row.status = 'paid';
    row.remarks = row.remarks?.trim()
      ? `${row.remarks} Paid by ${actor.name}.`
      : `Paid by ${actor.name}.`;
    addAuditEvent(state, actor.name, 'encashment_paid', encashmentId);

    return {
      moneyMode: 'sandbox' as const,
      action: 'admin-approve-encashment',
      status: 'completed' as const,
      reason: 'Sandbox encashment paid-state committed.',
      detail: `${encashmentId} is now marked paid.`
    };
  });
}

export function reviewSandboxEncashment(
  actor: SessionUser,
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
  return updateSandboxState((state) => {
    const row = state.payoutRows.find((entry) => entry.reference === encashmentId);

    if (!row) {
      throw new Error('Encashment queue item not found.');
    }

    const gross = parseCurrency(row.gross);
    const nextFee = Number.isFinite(payload.fee) ? Math.max(0, Number(payload.fee)) : parseCurrency(row.fee);
    const nextTax = Number.isFinite(payload.tax) ? Math.max(0, Number(payload.tax)) : parseCurrency(row.tax);
    const nextCd = Number.isFinite(payload.cdDeduction)
      ? Math.max(0, Number(payload.cdDeduction))
      : parseCurrency(row.cdDeduction);
    const nextNet = Math.max(0, gross - nextFee - nextTax - nextCd);

    if (payload.action === 'edit') {
      row.fee = currency(nextFee);
      row.tax = currency(nextTax);
      row.cdDeduction = currency(nextCd);
      row.net = currency(nextNet);
      row.method = payload.method?.trim() || row.method;
      row.remarks = payload.remarks?.trim() || row.remarks || 'Edited by admin.';
      addAuditEvent(state, actor.name, 'encashment_edited', encashmentId);
      return {
        moneyMode: 'sandbox' as const,
        action: 'admin-review-encashment',
        status: 'completed' as const,
        reason: 'Sandbox encashment edit committed.',
        detail: `${encashmentId} was updated to ${row.net} net.`
      };
    }

    if (payload.action === 'queue') {
      row.status = 'queued';
      row.method = payload.method?.trim() || row.method;
      row.remarks = payload.remarks?.trim() || row.remarks || 'Queued for Friday release.';
      addAuditEvent(state, actor.name, 'encashment_queued', encashmentId);
      return {
        moneyMode: 'sandbox' as const,
        action: 'admin-review-encashment',
        status: 'completed' as const,
        reason: 'Sandbox encashment queue-state committed.',
        detail: `${encashmentId} is now queued for payout review.`
      };
    }

    if (payload.action === 'cancel') {
      row.status = 'cancelled';
      row.remarks = payload.remarks?.trim() || row.remarks || 'Cancelled by admin.';
      addAuditEvent(state, actor.name, 'encashment_cancelled', encashmentId);
      return {
        moneyMode: 'sandbox' as const,
        action: 'admin-review-encashment',
        status: 'completed' as const,
        reason: 'Sandbox encashment cancellation committed.',
        detail: `${encashmentId} is now cancelled.`
      };
    }

    row.status = 'paid';
    row.method = payload.method?.trim() || row.method;
    row.remarks = payload.remarks?.trim() || row.remarks || `Paid by ${actor.name}.`;
    addAuditEvent(state, actor.name, 'encashment_paid', encashmentId);
    return {
      moneyMode: 'sandbox' as const,
      action: 'admin-review-encashment',
      status: 'completed' as const,
      reason: 'Sandbox encashment paid-state committed.',
      detail: `${encashmentId} is now marked paid.`
    };
  });
}

export function reviewSandboxActivationCodes(
  actor: SessionUser,
  payload: {
    codes: string[];
    action: 'mark-paid' | 'mark-external-paid' | 'mark-lost' | 'restore';
    remarks?: string;
  }
) {
  return updateSandboxState((state) => {
    if (!payload.codes.length) {
      throw new Error('Select at least one activation code.');
    }

    let changed = 0;

    for (const codeValue of payload.codes) {
      const code = state.activationRows.find((row) => row.code === codeValue);

      if (!code) {
        throw new Error(`Activation code ${codeValue} was not found.`);
      }

      if (payload.action === 'mark-lost') {
        if (code.status === 'used') {
          throw new Error(`Activation code ${codeValue} is already used.`);
        }

        code.status = 'lost';
        code.remarks = payload.remarks?.trim() || code.remarks || 'Lost code flagged by admin.';
        changed += 1;
        continue;
      }

      if (payload.action === 'restore') {
        if (code.status === 'lost') {
          code.status = 'unreleased';
          code.remarks = payload.remarks?.trim() || code.remarks || 'Lost flag cleared by admin.';
          changed += 1;
        }
        continue;
      }

      code.paymentStatus = payload.action === 'mark-external-paid' ? 'externally-paid' : 'paid';
      code.remarks = payload.remarks?.trim() || code.remarks || 'Settlement note added by admin.';
      changed += 1;
    }

    addAuditEvent(state, actor.name, `activation_code_${payload.action}`, `${changed} code(s)`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'admin-review-activation-code',
      status: 'completed' as const,
      reason: 'Sandbox activation-code review committed.',
      detail: `${payload.action} applied to ${changed} code(s).`
    };
  });
}

export function buildSandboxRegistrationPreview(input: {
  sponsorCode?: string;
  packageTier?: string;
  preferredSide?: 'left' | 'right';
}) {
  const sponsor = input.sponsorCode ? findSandboxMemberByCode(input.sponsorCode.trim()) : null;
  const sponsorInventory = sponsor
    ? listSandboxActivationRows().filter((item) => item.assignedTo === sponsor.username && item.status === 'available')
    : [];
  const matchingCode =
    sponsorInventory.find((item) => item.packageTier.toLowerCase() === String(input.packageTier ?? '').toLowerCase()) ??
    sponsorInventory[0] ??
    null;
  const members = listSandboxMembers();
  const placement = sponsor
    ? {
        placementUsername: sponsor.username,
        placementSide: input.preferredSide ?? 'left',
        note: 'Sandbox registration uses the selected sponsor root unless you override with a different operational placement path later.'
      }
    : null;
  const issues = [
    sponsor ? null : 'Sponsor code was not resolved to an active member.',
    sponsorInventory.length ? null : 'Sponsor has no released activation code available for this registration preview.',
    matchingCode ? null : 'No matching activation code was found for the selected package.',
    placement ? null : 'No placement recommendation is available.'
  ].filter((item): item is string => Boolean(item));

  return {
    moneyMode: 'sandbox' as const,
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
      'Password and email become live sandbox login credentials.',
      `Current sandbox member count: ${members.length}`
    ]
  };
}

export function commitSandboxRegistration(actor: string, input: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  sponsorCode?: string;
  packageTier?: string;
  preferredSide?: 'left' | 'right';
}) {
  return updateSandboxState((state) => {
    const preview = buildSandboxRegistrationPreview(input);

    if (!preview.canProceed || !preview.sponsor || !preview.matchingCode || !preview.placement) {
      throw new Error(preview.issues[0] ?? 'Registration preview is not ready.');
    }

    if (!input.fullName.trim()) {
      throw new Error('Full name is required.');
    }

    if (!input.email.trim()) {
      throw new Error('Email is required.');
    }

    if (input.password.trim().length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    if (state.users.some((user) => user.email === normalizedEmail)) {
      throw new Error('Email already exists in the sandbox.');
    }

    const sponsor = state.members.find((member) => member.username === preview.sponsor!.username)!;
    const code = state.activationRows.find((row) => row.code === preview.matchingCode!.code)!;
    const policy = resolvePackagePolicy(String(input.packageTier ?? preview.selectedPackage ?? 'standard'));
    const username = nextUsername(state.members);
    const userId = `sandbox-${username.toLowerCase()}`;
    const passwordHash = createPasswordHashSync(input.password);
    const referralCode = `${username}-REF`;
    const preferredSide = input.preferredSide ?? 'left';
    const parsedName = splitFullName(input.fullName.trim());

    code.assignedTo = username;
    code.status = 'used';
    code.remarks = code.remarks?.trim()
      ? `${code.remarks} Registered ${username}.`
      : `Registered ${username}.`;

    sponsor.directReferrals += 1;
    sponsor.walletAvailable += policy.directReferralBonus;
    sponsor.lastActivity = todayDate();

    const sponsorLedger = createLedgerEntry(
      state,
      sponsor.username,
      'direct_referral',
      username,
      policy.directReferralBonus,
      0,
      sponsor.walletAvailable,
      'posted'
    );
    state.walletLedgerEntries.unshift(sponsorLedger);

    state.users.push({
      id: userId,
      name: input.fullName.trim(),
      email: normalizedEmail,
      role: 'member',
      passwordHash: passwordHash.hash,
      passwordSalt: passwordHash.salt,
      status: 'active'
    });

    state.members.push({
      userId,
      username,
      fullName: composeFullName(parsedName.firstName, parsedName.lastName, parsedName.middleName),
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      middleName: parsedName.middleName,
      email: normalizedEmail,
      phone: input.phone?.trim() || undefined,
      address: '',
      packageTier: policy.name,
      accountStatus: 'active',
      referralCode,
      sponsorCode: sponsor.referralCode,
      placement: preferredSide,
      placementParentUsername: preview.placement.placementUsername,
      directReferrals: 0,
      leftPoints: 0,
      rightPoints: 0,
      walletAvailable: 0,
      walletPending: 0,
      cdBalance: 0,
      stockist: false,
      payoutOption: 'GCash',
      payoutDetails: input.phone?.trim() || '',
      lastActivity: todayDate()
    });

    propagateBinaryPoints(state, preview.placement.placementUsername, preferredSide, policy.pv * 100);
    addAuditEvent(state, actor, 'member_registration_committed', `${username} under ${sponsor.username}`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'public-registration-submit',
      status: 'completed' as const,
      reason: 'Sandbox registration committed.',
      detail: `Created ${username} under sponsor ${sponsor.username} using code ${code.code}.`,
      createdMember: {
        username,
        fullName: input.fullName.trim(),
        email: normalizedEmail,
        referralCode,
        sponsorUsername: sponsor.username,
        loginEmail: normalizedEmail
      }
    };
  });
}

export function buildSandboxWalletRows(memberUsername?: string) {
  return listSandboxWalletLedger(memberUsername).map((entry) => ({
    date: entry.occurredAt.slice(0, 10),
    type: entry.entryType,
    source: entry.sourceReference,
    credit: currency(entry.creditAmount),
    debit: currency(entry.debitAmount),
    balance: currency(entry.balanceAfter),
    status: entry.status
  }));
}

export function getSandboxWalletSummary(user: SessionUser) {
  const member = readState().members.find((entry) => entry.userId === user.id || entry.email === user.email);

  if (!member) {
    throw new Error('Sandbox member profile not found.');
  }

  return {
    moneyMode: 'sandbox' as const,
    summary: {
      availableBalance: member.walletAvailable,
      pendingBalance: member.walletPending,
      cdBalance: member.cdBalance,
      payoutMethod: 'GCash',
      payoutSchedule: 'Tuesday encashment / Friday payout'
    },
    preview: {
      requestedAmount: Math.min(5000, Math.floor(member.walletAvailable / 100) * 100),
      fee: 100,
      cdDeduction: Math.min(member.cdBalance, Math.max(0, Math.min(5000, Math.floor(member.walletAvailable / 100) * 100) * 0.05)),
      netReceivable: Math.max(
        0,
        Math.min(5000, Math.floor(member.walletAvailable / 100) * 100) -
          100 -
          Math.min(member.cdBalance, Math.max(0, Math.min(5000, Math.floor(member.walletAvailable / 100) * 100) * 0.05))
      ),
      sufficientBalance: member.walletAvailable > 0,
      note: 'Sandbox encashment writes commit immediately into the local dev queue and ledger.'
    },
    ledger: listSandboxWalletLedger(member.username).map((entry) => ({
      id: entry.id,
      walletType: entry.walletType,
      entryType: entry.entryType,
      sourceReference: entry.sourceReference,
      creditAmount: entry.creditAmount,
      debitAmount: entry.debitAmount,
      balanceAfter: entry.balanceAfter,
      status: entry.status,
      processId: entry.processId
    })),
    transactions: [
      ...buildSandboxWalletRows(member.username).map((row, index) => ({
        id: `WALLET-${String(index + 1).padStart(3, '0')}`,
        date: row.date,
        category: row.type,
        source: row.source,
        gross: row.credit === currency(0) ? row.debit : row.credit,
        net: row.balance,
        status: row.status,
        type: 'wallet' as const
      })),
      ...listSandboxPayoutRows()
        .filter((row) => row.member === member.username)
        .map((row, index) => ({
          id: `ENC-${String(index + 1).padStart(3, '0')}`,
          date: row.createdAt.slice(0, 10),
          category: 'encashment',
          source: row.reference,
          gross: row.gross,
          net: row.net,
          status: row.status,
          type: 'encashment' as const
        }))
    ]
  };
}

export function buildSandboxAdminActivationMetrics() {
  const state = readState();
  return {
    moneyMode: 'sandbox' as const,
    inventory: state.activationRows.map((row, index) => ({
      id: `ADMIN-CODE-${String(index + 1).padStart(3, '0')}`,
      ...row,
      assignedTo: row.assignedTo ?? 'Unassigned',
      transferable: row.status !== 'used' && row.status !== 'lost',
      releasable: row.status === 'unreleased'
    })),
    metrics: {
      totalCodes: state.activationRows.length,
      availableCodes: state.activationRows.filter((row) => row.status === 'available').length,
      unreleasedCodes: state.activationRows.filter((row) => row.status === 'unreleased').length,
      usedCodes: state.activationRows.filter((row) => row.status === 'used').length,
      lostCodes: state.activationRows.filter((row) => row.status === 'lost').length,
      paidCodes: state.activationRows.filter((row) => row.paymentStatus === 'paid' || row.paymentStatus === 'externally-paid').length
    },
    auditTrail: state.auditEvents.slice(0, 10),
    transferTargets: state.members.map((member) => ({
      username: member.username,
      fullName: member.fullName,
      packageTier: member.packageTier
    })),
    hints: [
      'Generated codes enter the sandbox inventory as unreleased and must be released before registration use.',
      'Transfer can be done before or after release, but used codes stay locked.'
    ]
  };
}

export function renameSandboxMember(actor: SessionUser, username: string, fullName: string) {
  return updateSandboxState((state) => {
    const member = state.members.find((entry) => entry.username === username);

    if (!member) {
      throw new Error('Member not found.');
    }

    const nextFullName = fullName.trim();

    if (nextFullName.length < 3) {
      throw new Error('Enter the full member name.');
    }

    const nextNameParts = splitFullName(nextFullName);
    member.fullName = nextFullName;
    member.firstName = nextNameParts.firstName;
    member.lastName = nextNameParts.lastName;
    member.middleName = nextNameParts.middleName;
    const linkedUser = state.users.find((entry) => entry.id === member.userId);

    if (linkedUser) {
      linkedUser.name = nextFullName;
    }

    addAuditEvent(state, actor.name, 'member_name_updated', `${username} -> ${nextFullName}`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'admin-change-member-name',
      status: 'completed' as const,
      reason: 'Sandbox member profile updated.',
      detail: `${username} is now recorded as ${nextFullName}.`
    };
  });
}

export function updateSandboxMemberProfile(
  actor: SessionUser,
  username: string,
  payload: {
    firstName: string;
    lastName: string;
    middleName?: string;
    password?: string;
    payoutOption?: string;
    payoutDetails?: string;
    address?: string;
    contactNumber?: string;
  }
) {
  return updateSandboxState((state) => {
    const member = state.members.find((entry) => entry.username === username);

    if (!member) {
      throw new Error('Member not found.');
    }

    const firstName = payload.firstName.trim();
    const lastName = payload.lastName.trim();
    const middleName = payload.middleName?.trim() ?? '';

    if (firstName.length < 2 || lastName.length < 2) {
      throw new Error('Enter a valid first and last name.');
    }

    member.firstName = firstName;
    member.lastName = lastName;
    member.middleName = middleName;
    member.fullName = composeFullName(firstName, lastName, middleName);
    member.payoutOption = payload.payoutOption?.trim() || member.payoutOption || 'GCash';
    member.payoutDetails = payload.payoutDetails?.trim() || '';
    member.address = payload.address?.trim() || '';
    member.phone = payload.contactNumber?.trim() || undefined;
    member.lastActivity = todayDate();

    const linkedUser = state.users.find((entry) => entry.id === member.userId);

    if (linkedUser) {
      linkedUser.name = member.fullName;

      if (payload.password && payload.password.trim().length >= 6) {
        const passwordHash = createPasswordHashSync(payload.password.trim());
        linkedUser.passwordHash = passwordHash.hash;
        linkedUser.passwordSalt = passwordHash.salt;
      }
    }

    addAuditEvent(state, actor.name, 'member_profile_updated', `${username} -> ${member.fullName}`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'admin-update-member-profile',
      status: 'completed' as const,
      reason: 'Sandbox member profile updated.',
      detail: `${username} profile details were updated.`
    };
  });
}

export function updateSandboxMemberStatus(
  actor: SessionUser,
  username: string,
  nextStatus: 'active' | 'pending' | 'frozen' | 'suspended'
) {
  return updateSandboxState((state) => {
    const member = state.members.find((entry) => entry.username === username);

    if (!member) {
      throw new Error('Member not found.');
    }

    member.accountStatus = nextStatus;
    member.lastActivity = todayDate();

    const linkedUser = state.users.find((entry) => entry.id === member.userId);

    if (linkedUser) {
      linkedUser.status = nextStatus;
    }

    addAuditEvent(state, actor.name, 'member_status_updated', `${username} -> ${nextStatus}`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'admin-update-member-status',
      status: 'completed' as const,
      reason: 'Sandbox member status updated.',
      detail: `${username} is now ${nextStatus}.`
    };
  });
}

export function buildSandboxAdminEncashments() {
  const rows = readState().payoutRows;
  return {
    moneyMode: 'sandbox' as const,
    encashments: rows.map((row, index) => ({
      id: row.reference,
      queueOrder: index + 1,
      member: row.member,
      gross: row.gross,
      fee: row.fee,
      tax: row.tax,
      cdDeduction: row.cdDeduction,
      net: row.net,
      method: row.method,
      status: row.status,
      remarks: row.remarks
    })),
    totals: {
      gross: rows.reduce((sum, row) => sum + parseCurrency(row.gross), 0),
      net: rows.reduce((sum, row) => sum + parseCurrency(row.net), 0),
      awaitingReview: rows.filter((row) => /requested|pending|verification|review|queued/i.test(row.status)).length
    },
    processNotes: [
      'Sandbox encashments are committed to the local dev queue immediately, but office state changes still stay branch-local.',
      'Gross, fee, tax, CD deduction, net, and remarks remain visible so admin and superadmin can audit before marking paid.'
    ]
  };
}

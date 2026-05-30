import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';
import { createPasswordHashSync } from '../auth/password.js';
import type { AuditEvent, SessionUser } from '../../types/auth.js';

export type MemberRecord = {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
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
  lastActivity: string;
};

export type ActivationRow = {
  code: string;
  packageTier: string;
  assignedTo: string;
  status: 'available' | 'used';
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
  cdDeduction: string;
  net: string;
  status: string;
  method: string;
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
  status: 'active' | 'pending';
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

const currency = (value: number): string =>
  `PHP ${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const sandboxDataFile = path.resolve(process.cwd(), env.YOR_SANDBOX_DATA_FILE);
const sandboxPackagePolicies = [
  { code: 'CLASSIC', name: 'Classic', pv: 5, directReferralBonus: 200 },
  { code: 'BASIC', name: 'Basic', pv: 10, directReferralBonus: 1000 },
  { code: 'STANDARD', name: 'Standard', pv: 50, directReferralBonus: 5000 },
  { code: 'BUSINESS', name: 'Business', pv: 100, directReferralBonus: 7000 },
  { code: 'VIP', name: 'VIP', pv: 300, directReferralBonus: 15000 }
] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseCurrency(value: string): number {
  return Number(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

function buildSeedUsers(): SandboxUserRecord[] {
  const memberPassword = createPasswordHashSync(env.DEMO_MEMBER_PASSWORD);
  const adminPassword = createPasswordHashSync(env.DEMO_ADMIN_PASSWORD);
  const cashierPassword = createPasswordHashSync(env.DEMO_CASHIER_PASSWORD);
  const bodPassword = createPasswordHashSync(env.DEMO_BOD_PASSWORD);
  const superadminPassword = createPasswordHashSync(env.DEMO_SUPERADMIN_PASSWORD);

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
  const timestamp = nowIso();

  return {
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
        email: 'member@yor.local',
        phone: '+63 900 000 0001',
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
    ],
    activationRows: [
      { code: 'YOR-ACT-1001', packageTier: 'Standard', assignedTo: 'YOR0001', status: 'used', generatedAt: '2026-05-20' },
      { code: 'YOR-ACT-1002', packageTier: 'Business', assignedTo: 'YOR0002', status: 'used', generatedAt: '2026-05-21' },
      { code: 'YOR-ACT-1003', packageTier: 'Standard', assignedTo: 'YOR0001', status: 'available', generatedAt: '2026-05-28' },
      { code: 'YOR-ACT-1004', packageTier: 'Business', assignedTo: 'YOR0003', status: 'available', generatedAt: '2026-05-28' },
      { code: 'YOR-ACT-1005', packageTier: 'Basic', assignedTo: 'YOR0001', status: 'available', generatedAt: '2026-05-28' },
      { code: 'YOR-ACT-1006', packageTier: 'Classic', assignedTo: 'YOR0001', status: 'available', generatedAt: '2026-05-28' },
      { code: 'YOR-ACT-1007', packageTier: 'Business', assignedTo: 'YOR0001', status: 'available', generatedAt: '2026-05-28' },
      { code: 'YOR-ACT-1008', packageTier: 'VIP', assignedTo: 'YOR0001', status: 'available', generatedAt: '2026-05-28' }
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
        cdDeduction: currency(0),
        net: currency(7900),
        status: 'released Friday',
        method: 'GCash',
        createdAt: '2026-05-24T08:00:00Z'
      },
      {
        reference: 'ENC-20260517-002',
        member: 'YOR0003',
        gross: currency(12500),
        fee: currency(100),
        cdDeduction: currency(500),
        net: currency(11900),
        status: 'for verification',
        method: 'Bank',
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
}

function ensureSandboxStateFile(): void {
  if (!existsSync(sandboxDataFile)) {
    mkdirSync(path.dirname(sandboxDataFile), { recursive: true });
    writeFileSync(sandboxDataFile, JSON.stringify(buildSeedState(), null, 2), 'utf8');
  }
}

function readState(): SandboxState {
  ensureSandboxStateFile();
  return JSON.parse(readFileSync(sandboxDataFile, 'utf8')) as SandboxState;
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

function nextActivationCode(codes: ActivationRow[]): string {
  const max = codes.reduce((current, row) => {
    const numeric = Number(row.code.replace(/[^0-9]/g, '')) || 0;
    return Math.max(current, numeric);
  }, 1000);
  return `YOR-ACT-${String(max + 1).padStart(4, '0')}`;
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
    const cdDeduction = Math.min(member.cdBalance, Math.max(0, amount * 0.05));
    const net = Math.max(0, amount - fee - cdDeduction);
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
      cdDeduction: currency(cdDeduction),
      net: currency(net),
      status: 'pending Tuesday queue',
      method: 'GCash',
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
  assignedTo = 'YOR0001'
) {
  return updateSandboxState((state) => {
    const count = Math.max(1, Math.min(50, Math.floor(quantity)));
    const owner = state.members.find((member) => member.username === assignedTo);

    if (!owner) {
      throw new Error('Assigned member was not found.');
    }

    for (let index = 0; index < count; index += 1) {
      state.activationRows.unshift({
        code: nextActivationCode(state.activationRows),
        packageTier,
        assignedTo: owner.username,
        status: 'available',
        generatedAt: todayDate()
      });
    }

    addAuditEvent(state, actor.name, 'activation_batch_generated', `${count} x ${packageTier} -> ${owner.username}`);

    return {
      moneyMode: 'sandbox' as const,
      action: 'admin-generate-activation-codes',
      status: 'completed' as const,
      reason: 'Sandbox code batch committed.',
      detail: `Generated ${count} ${packageTier} code(s) for ${owner.username}.`
    };
  });
}

export function approveSandboxEncashment(actor: SessionUser, encashmentId: string) {
  return updateSandboxState((state) => {
    const row = state.payoutRows.find((entry) => entry.reference === encashmentId);

    if (!row) {
      throw new Error('Encashment queue item not found.');
    }

    row.status = 'approved for Friday release';
    addAuditEvent(state, actor.name, 'encashment_approved', encashmentId);

    return {
      moneyMode: 'sandbox' as const,
      action: 'admin-approve-encashment',
      status: 'completed' as const,
      reason: 'Sandbox encashment approval committed.',
      detail: `${encashmentId} is approved for Friday release.`
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

    code.assignedTo = username;
    code.status = 'used';

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
      fullName: input.fullName.trim(),
      email: normalizedEmail,
      phone: input.phone?.trim() || undefined,
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
      transferable: row.status === 'available',
      releasable: row.status === 'available'
    })),
    metrics: {
      totalCodes: state.activationRows.length,
      availableCodes: state.activationRows.filter((row) => row.status === 'available').length,
      usedCodes: state.activationRows.filter((row) => row.status === 'used').length
    },
    auditTrail: state.auditEvents.slice(0, 10),
    hints: [
      'Generated codes are written into the local sandbox inventory immediately.',
      'Assign new batches to a sponsor account when you want to test more registrations.'
    ]
  };
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
      cdDeduction: row.cdDeduction,
      net: row.net,
      method: row.method,
      status: row.status
    })),
    totals: {
      gross: rows.reduce((sum, row) => sum + parseCurrency(row.gross), 0),
      net: rows.reduce((sum, row) => sum + parseCurrency(row.net), 0),
      awaitingReview: rows.filter((row) => /pending|verification|review/i.test(row.status)).length
    },
    processNotes: [
      'Sandbox encashments are committed to the local dev queue immediately.',
      'Approval changes only affect this branch runtime and can be reset without touching production data.'
    ]
  };
}

import { describe, expect, it } from 'vitest';
import {
  ProductionEncodingService,
  createInMemoryProductionEncodingRepository,
  normalizeFullName,
  type ProductionActivationCode,
  type ProductionAppUser,
  type ProductionMemberProfile,
  type ProductionNetworkAccount
} from './encoding-service.js';

function seedUser(id: string, name: string, email: string, role: ProductionAppUser['role'] = 'member'): ProductionAppUser {
  return {
    id,
    email,
    displayName: name,
    role,
    status: 'active',
    passwordHash: 'hash',
    passwordSalt: 'salt',
    createdAt: '2026-06-08T09:00:00.000Z'
  };
}

function seedMember(
  userId: string,
  username: string,
  referralCode: string,
  packageTier: ProductionMemberProfile['packageTier'],
  fullName: string,
  sponsorCode: string | null = null
): ProductionMemberProfile {
  return {
    userId,
    username,
    referralCode,
    sponsorCode,
    packageTier,
    accountStatus: 'active',
    fullName,
    firstName: fullName.split(' ')[0] ?? fullName,
    lastName: fullName.split(' ').slice(1).join(' '),
    middleName: '',
    contactNumber: '+63 900 000 0000',
    normalizedFullName: normalizeFullName(fullName),
    createdAt: '2026-06-08T09:00:00.000Z'
  };
}

function seedNetwork(
  userId: string,
  packageTier: ProductionNetworkAccount['packageTier'],
  sponsorUserId: string | null,
  placementParentUserId: string | null,
  placementSide: ProductionNetworkAccount['placementSide'],
  placementParentShadowSide: ProductionNetworkAccount['placementParentShadowSide'] = null
): ProductionNetworkAccount {
  return {
    userId,
    sponsorUserId,
    directReferrerUserId: sponsorUserId,
    placementParentUserId,
    placementParentShadowSide,
    placementSide,
    currentAccountTypeCode: packageTier === 'Business' || packageTier === 'VIP' ? 2 : 1,
    currentAccountType: packageTier === 'Business' || packageTier === 'VIP' ? 'FS' : 'PD',
    packageTier,
    activationCode: null,
    registrationStatus: 'active',
    leftPoints: 0,
    rightPoints: 0,
    cdStatus: 0,
    createdAt: '2026-06-08T09:00:00.000Z'
  };
}

function seedCode(overrides: Partial<ProductionActivationCode> = {}): ProductionActivationCode {
  return {
    id: overrides.id ?? 'code-1',
    code: overrides.code ?? 'YOR-ACT-00001001',
    codeFamily: overrides.codeFamily ?? 'YOR CODES',
    packageTier: overrides.packageTier ?? 'Standard',
    accountType: overrides.accountType ?? 'PD',
    status: overrides.status ?? 'available',
    paymentStatus: overrides.paymentStatus ?? 'paid',
    assignedUserId: overrides.assignedUserId ?? 'sponsor-user',
    generatedByUserId: overrides.generatedByUserId ?? 'admin-user',
    generatedAt: overrides.generatedAt ?? '2026-06-08T09:00:00.000Z',
    releasedAt: overrides.releasedAt ?? '2026-06-08T09:10:00.000Z',
    transferredAt: overrides.transferredAt ?? null,
    usedAt: overrides.usedAt ?? null,
    usedByUserId: overrides.usedByUserId ?? null,
    registrationEligible: overrides.registrationEligible ?? true,
    lockedDirectReferralBonus: overrides.lockedDirectReferralBonus ?? 5000,
    lockedSalesmatchValue: overrides.lockedSalesmatchValue ?? 2500,
    lockedBinaryPoints: overrides.lockedBinaryPoints ?? 50,
    lockedGetFiveAmount: overrides.lockedGetFiveAmount ?? 25998,
    processId: overrides.processId ?? 'seed:code:1',
    remarks: overrides.remarks ?? ''
  };
}

describe('ProductionEncodingService', () => {
  it('generates, releases, and transfers codes with append-only event history', async () => {
    const repo = createInMemoryProductionEncodingRepository({
      users: [
        seedUser('admin-user', 'Admin', 'admin@yor.local', 'admin'),
        seedUser('member-a', 'Sponsor A', 'a@yor.local'),
        seedUser('member-b', 'Sponsor B', 'b@yor.local')
      ],
      members: [
        seedMember('member-a', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Sponsor A'),
        seedMember('member-b', 'YOR0002', 'YOR-MEMBER-0002', 'VIP', 'Sponsor B')
      ],
      networkAccounts: [
        seedNetwork('member-a', 'Standard', null, null, null),
        seedNetwork('member-b', 'VIP', null, null, null)
      ]
    });
    const service = new ProductionEncodingService(repo);

    const generated = await service.generateActivationCodes(
      { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' },
      { quantity: 1, packageTier: 'VIP', assignedTo: 'YOR0001' }
    );
    expect(generated.status).toBe('completed');

    const codeCenterAfterGenerate = await service.buildAdminActivationCodeCenter();
    const generatedCode = codeCenterAfterGenerate.inventory[0];
    expect(generatedCode.status).toBe('unreleased');

    await service.releaseActivationCodes(
      { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' },
      [generatedCode.code]
    );
    await service.transferActivationCodes(
      { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' },
      'YOR0002',
      [generatedCode.code]
    );

    const codeCenterAfterTransfer = await service.buildAdminActivationCodeCenter();
    const transferred = codeCenterAfterTransfer.inventory.find((item) => item.code === generatedCode.code);
    expect(transferred).toMatchObject({
      assignedTo: 'YOR0002',
      status: 'available'
    });
    expect(codeCenterAfterTransfer.auditTrail.map((item) => item.action)).toEqual(
      expect.arrayContaining(['generated', 'released', 'transferred'])
    );
  });

  it('accepts maintenance-family product labels when generating activation codes', async () => {
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('admin-user', 'Admin', 'admin@yor.local', 'admin')]
    });
    const service = new ProductionEncodingService(repo);

    const generated = await service.generateActivationCodes(
      { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' },
      {
        quantity: 1,
        packageTier: 'Yor Perfume - Hugo Boss',
        codeFamily: 'YOR MAINTENANCE'
      }
    );

    expect(generated.status).toBe('completed');

    const storedCode = (await repo.listActivationCodes())[0];
    expect(storedCode).toMatchObject({
      codeFamily: 'YOR MAINTENANCE',
      packageTier: 'Yor Perfume - Hugo Boss',
      registrationEligible: false,
      lockedDirectReferralBonus: 0,
      lockedSalesmatchValue: 0,
      lockedBinaryPoints: 0,
      lockedGetFiveAmount: 0
    });

    const codeCenter = await service.buildAdminActivationCodeCenter();
    const generatedCode = codeCenter.inventory[0];

    expect(generatedCode).toMatchObject({
      codeFamily: 'YOR MAINTENANCE',
      packageTier: 'Yor Perfume - Hugo Boss',
      registrationEligible: false
    });
  });

  it('requires a placement reservation for public registration and processes direct, salesmatch, and binary-cycle deltas', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Sponsor Member');
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('admin-user', 'Admin', 'admin@yor.local', 'admin'), sponsorUser],
      members: [sponsorMember],
      networkAccounts: [seedNetwork('sponsor-user', 'Standard', null, null, null)],
      activationCodes: [seedCode()],
      salesmatchBalances: [
        {
          userId: 'sponsor-user',
          leftSales: 0,
          rightSales: 2500,
          matchedSales: 0,
          leftPoints: 0,
          rightPoints: 50,
          matchedPoints: 0,
          updatedAt: '2026-06-08T09:00:00.000Z'
        }
      ]
    });
    const service = new ProductionEncodingService(repo);

    const blockedPreview = await service.previewRegistration(null, {
      origin: 'referral-link',
      fullName: 'New Prospect',
      username: 'YOR1001',
      phone: '+63 999 111 1111',
      password: 'Password123!',
      referralCode: 'YOR-MEMBER-0001',
      activationCode: 'YOR-ACT-00001001'
    });
    expect(blockedPreview.canProceed).toBe(false);
    expect(blockedPreview.issues).toContain('Placement selection is required before this referral link can be used.');

    const reservation = await service.createPlacementReservation(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      { placementParentUsername: 'YOR0001', placementSide: 'left' }
    );

    const preview = await service.previewRegistration(null, {
      origin: 'referral-link',
      fullName: 'New Prospect',
      username: 'YOR1001',
      phone: '+63 999 111 1111',
      password: 'Password123!',
      referralCode: 'YOR-MEMBER-0001',
      activationCode: 'YOR-ACT-00001001',
      placementToken: reservation.reservation.shareToken
    });
    expect(preview.canProceed).toBe(true);
    expect(preview.placement?.placementSide).toBe('left');

    const submit = await service.submitRegistration(null, {
      origin: 'referral-link',
      fullName: 'New Prospect',
      username: 'YOR1001',
      phone: '+63 999 111 1111',
      password: 'Password123!',
      referralCode: 'YOR-MEMBER-0001',
      activationCode: 'YOR-ACT-00001001',
      placementToken: reservation.reservation.shareToken,
      placementReservationId: preview.placementReservationId ?? undefined
    });
    expect(submit.createdMember.username).toBe('YOR1001');

    const sponsorLedgerAfterSubmit = await repo.listWalletLedgerEntriesForUser('sponsor-user');
    expect(sponsorLedgerAfterSubmit.find((entry) => entry.entryType === 'direct_referral')?.creditAmount).toBe(5000);

    await service.processCompensationQueue();
    const sponsorLedgerAfterQueue = await repo.listWalletLedgerEntriesForUser('sponsor-user');
    expect(sponsorLedgerAfterQueue.find((entry) => entry.entryType === 'salesmatch')?.creditAmount).toBe(2500);
    expect(sponsorLedgerAfterQueue.find((entry) => entry.entryType === 'binary_cycle')?.creditAmount).toBe(75);
  });

  it('posts Get Yor Five on the fifth same-package direct registration', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Sponsor Member');
    const existingUsers = Array.from({ length: 4 }, (_, index) => seedUser(`existing-${index}`, `Existing ${index}`, `existing${index}@yor.local`));
    const existingMembers = Array.from({ length: 4 }, (_, index) =>
      seedMember(
        `existing-${index}`,
        `YOR${String(index + 2).padStart(4, '0')}`,
        `YOR-MEMBER-${String(index + 2).padStart(4, '0')}`,
        'Standard',
        `Existing ${index}`,
        'YOR-MEMBER-0001'
      )
    );
    const existingNetworks = Array.from({ length: 4 }, (_, index) =>
      seedNetwork(`existing-${index}`, 'Standard', 'sponsor-user', 'sponsor-user', index % 2 === 0 ? 'left' : 'right')
    );
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser, ...existingUsers],
      members: [sponsorMember, ...existingMembers],
      networkAccounts: [seedNetwork('sponsor-user', 'Standard', null, null, null), ...existingNetworks],
      activationCodes: [seedCode({ code: 'YOR-ACT-00001002' })]
    });
    const service = new ProductionEncodingService(repo);

    const reservation = await service.createPlacementReservation(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      { placementParentUsername: 'YOR0002', placementSide: 'left' }
    );

    await service.submitRegistration(null, {
      origin: 'referral-link',
      fullName: 'Fifth Direct',
      username: 'YOR2001',
      phone: '+63 999 222 2222',
      password: 'Password123!',
      referralCode: 'YOR-MEMBER-0001',
      activationCode: 'YOR-ACT-00001002',
      placementToken: reservation.reservation.shareToken
    });

    const ledger = await repo.listWalletLedgerEntriesForUser('sponsor-user');
    expect(ledger.find((entry) => entry.entryType === 'get_five')?.creditAmount).toBe(25998);
  });

  it('rebuilds the live binary tree with the newly encoded member in the selected slot', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const leftUser = seedUser('left-user', 'Left Branch', 'left@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Sponsor Member');
    const leftMember = seedMember('left-user', 'YOR0002', 'YOR-MEMBER-0002', 'Business', 'Left Branch', 'YOR-MEMBER-0001');
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser, leftUser],
      members: [sponsorMember, leftMember],
      networkAccounts: [
        seedNetwork('sponsor-user', 'Standard', null, null, null),
        seedNetwork('left-user', 'Business', 'sponsor-user', 'sponsor-user', 'left', 'left')
      ],
      activationCodes: [seedCode({ code: 'YOR-ACT-00001003' })]
    });
    const service = new ProductionEncodingService(repo);

    await service.submitRegistration(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Placed Prospect',
        username: 'YOR3001',
        phone: '+63 999 333 3333',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00001003',
        placementParentUsername: 'YOR0002',
        placementSide: 'right'
      }
    );

    const tree = await service.buildScopedBinaryGenealogyCenter(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      'YOR0002'
    );

    expect(tree.root.username).toBe('YOR0002');
    expect(tree.root.children.find((child) => child.placement === 'right')?.username).toBe('YOR0002-R');
    expect(
      tree.root.children
        .find((child) => child.placement === 'right')
        ?.children.find((child) => child.username === 'YOR3001')?.placement
    ).toBe('right');
  });

  it('accepts shadow-derived placement labels and still encodes under the real member slot', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const shadowRootUser = seedUser('shadow-root-user', 'Shadow Root', 'shadow@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Sponsor Member');
    const shadowRootMember = seedMember('shadow-root-user', 'YOR0002', 'YOR-MEMBER-0002', 'Business', 'Shadow Root', 'YOR-MEMBER-0001');
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser, shadowRootUser],
      members: [sponsorMember, shadowRootMember],
      networkAccounts: [
        seedNetwork('sponsor-user', 'Standard', null, null, null),
        seedNetwork('shadow-root-user', 'Business', 'sponsor-user', 'sponsor-user', 'left', 'left')
      ],
      activationCodes: [seedCode({ code: 'YOR-ACT-00001004' })]
    });
    const service = new ProductionEncodingService(repo);

    const submit = await service.submitRegistration(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Shadow Slot Prospect',
        username: 'YOR3002',
        phone: '+63 999 444 4444',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00001004',
        placementParentUsername: 'YOR0002-L',
        placementSide: 'right'
      }
    );

    expect(submit.createdMember.username).toBe('YOR3002');

    const tree = await service.buildScopedBinaryGenealogyCenter(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      'YOR0002'
    );

    const leftShadow = tree.root.children.find((child) => child.placement === 'left');
    expect(leftShadow?.username).toBe('YOR0002-L');
    expect(leftShadow?.children.find((child) => child.username === 'YOR3002')?.placement).toBe('right');
  });
});

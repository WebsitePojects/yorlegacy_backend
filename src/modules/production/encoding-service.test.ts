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
    cdAmount: 0,
    cdTotal: 0,
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
    remarks: overrides.remarks ?? '',
    settledAt: overrides.settledAt ?? null,
    settledByUserId: overrides.settledByUserId ?? null,
    pendingRecipientUserId: overrides.pendingRecipientUserId ?? null,
    cashierUserId: overrides.cashierUserId ?? null
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
    expect(generatedCode.code).toBe('FSVI001001');

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

  it('generates product (maintenance-point) codes from the normalized product catalog', async () => {
    // Product codes are normalized to Perfume / Eyedrops / Perfume Refill (no brand
    // variants like "Hugo Boss"). Every product code is a unilevel maintenance point
    // (20 repurchase PV) and never a registration/earning code.
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('admin-user', 'Admin', 'admin@yor.local', 'admin')]
    });
    const service = new ProductionEncodingService(repo);

    const generated = await service.generateActivationCodes(
      { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' },
      {
        quantity: 1,
        packageTier: 'Yor Perfume',
        codeFamily: 'YOR MAINTENANCE'
      }
    );

    expect(generated.status).toBe('completed');

    const storedCode = (await repo.listActivationCodes())[0];
    expect(storedCode).toMatchObject({
      code: 'PDYM001001',
      codeFamily: 'YOR MAINTENANCE',
      packageTier: 'Yor Perfume',
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
      packageTier: 'Yor Perfume',
      registrationEligible: false
    });
  });

  it('treats generated PD codes as paid while keeping CD unpaid until settlement', async () => {
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('admin-user', 'Admin', 'admin@yor.local', 'admin')]
    });
    const service = new ProductionEncodingService(repo);
    const actor = { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' as const };

    await service.generateActivationCodes(actor, {
      quantity: 1,
      packageTier: 'Basic',
      accountType: 'PD'
    });
    await service.generateActivationCodes(actor, {
      quantity: 1,
      packageTier: 'Classic',
      accountType: 'CD'
    });

    const codes = await repo.listActivationCodes();
    const pdCode = codes.find((item) => item.accountType === 'PD');
    const cdCode = codes.find((item) => item.accountType === 'CD');

    expect(pdCode?.paymentStatus).toBe('paid');
    expect(cdCode?.paymentStatus).toBe('unpaid');
  });

  it('auto-balances public registration when no token is provided and processes direct, salesmatch, and binary-cycle deltas', async () => {
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

    const autoBalancePreview = await service.previewRegistration(null, {
      origin: 'referral-link',
      fullName: 'New Prospect',
      username: 'YOR1001',
      phone: '+63 999 111 1111',
      password: 'Password123!',
      referralCode: 'YOR-MEMBER-0001',
      activationCode: 'YOR-ACT-00001001'
    });
    // No placement token → auto-balance picks lighter side (left when equal)
    expect(autoBalancePreview.canProceed).toBe(true);
    expect(autoBalancePreview.placement?.placementSide).toBe('left');

    // Placed at the sponsor's left-shadow-left slot so the new member becomes the
    // sponsor's A-position holder (GATE-BIN-CYCLE-UPLINE-A-20260614).
    const reservation = await service.createPlacementReservation(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      { placementParentUsername: 'YOR0001-L', placementSide: 'left' }
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
    // GATE-BIN-CYCLE-UPLINE-A-20260614: the sponsor no longer self-earns binary cycle.
    // It flows to the sponsor's A (the member just placed at its left-shadow-left slot),
    // computed from that A member's own package percent (Standard 3% of 2500 = 75).
    expect(sponsorLedgerAfterQueue.find((entry) => entry.entryType === 'binary_cycle')).toBeUndefined();
    const aMember = await repo.findMemberByUsername('YOR1001');
    const aLedger = await repo.listWalletLedgerEntriesForUser(aMember!.userId);
    expect(aLedger.find((entry) => entry.entryType === 'binary_cycle')?.creditAmount).toBe(75);
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

  // GATE-GYF-WINDOW-20260613 (owner item 5): groups of five qualified same-package
  // directs must complete within a 3-month window. Four Classic directs join in
  // early January; the fifth's join date (= repo.now()) decides whether the group
  // completes in-window or the January group voids.
  const seedClassicGyfScenario = async (fifthJoinIso: string) => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Classic', 'Sponsor Member');
    const janDates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'];
    const existingUsers = Array.from({ length: 4 }, (_, i) => seedUser(`existing-${i}`, `Existing ${i}`, `existing${i}@yor.local`));
    const existingMembers = Array.from({ length: 4 }, (_, i) =>
      seedMember(
        `existing-${i}`,
        `YOR${String(i + 2).padStart(4, '0')}`,
        `YOR-MEMBER-${String(i + 2).padStart(4, '0')}`,
        'Classic',
        `Existing ${i}`,
        'YOR-MEMBER-0001'
      )
    );
    const existingNetworks = Array.from({ length: 4 }, (_, i) => ({
      ...seedNetwork(`existing-${i}`, 'Classic', 'sponsor-user', 'sponsor-user', i % 2 === 0 ? 'left' : 'right'),
      createdAt: `${janDates[i]}T09:00:00.000Z`
    }));
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser, ...existingUsers],
      members: [sponsorMember, ...existingMembers],
      networkAccounts: [seedNetwork('sponsor-user', 'Classic', null, null, null), ...existingNetworks],
      activationCodes: [
        seedCode({
          code: 'YOR-ACT-00001002',
          packageTier: 'Classic',
          accountType: 'PD',
          paymentStatus: 'paid',
          lockedDirectReferralBonus: 1000,
          lockedSalesmatchValue: 500,
          lockedBinaryPoints: 2,
          lockedGetFiveAmount: 5998
        })
      ],
      now: fifthJoinIso
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
    return { service, repo };
  };

  it('credits one Get Yor Five group when the fifth same-package direct completes the 3-month window', async () => {
    // Jan 1-4 directs + fifth on Mar 1 — all within the Jan 1 -> Apr 1 window.
    const { service, repo } = await seedClassicGyfScenario('2026-03-01T09:00:00.000Z');
    const ledger = await repo.listWalletLedgerEntriesForUser('sponsor-user');
    const getFive = ledger.filter((entry) => entry.entryType === 'get_five');
    expect(getFive).toHaveLength(1);
    expect(getFive[0].creditAmount).toBe(5998);

    const data = await service.getMemberGetYorFiveData('sponsor-user');
    const classic = data.tierProgress.find((t) => t.tier === 'Classic');
    expect(classic?.completedGroups).toBe(1);
    expect(data.voidedGroups).toHaveLength(0);
  });

  it('voids the partial group, posts no credit, and surfaces it when the window lapses', async () => {
    // Jan 1-4 directs + fifth on May 1 — past the Jan 1 -> Apr 1 window.
    const { service, repo } = await seedClassicGyfScenario('2026-05-01T09:00:00.000Z');
    const ledger = await repo.listWalletLedgerEntriesForUser('sponsor-user');
    expect(ledger.filter((entry) => entry.entryType === 'get_five')).toHaveLength(0);

    const data = await service.getMemberGetYorFiveData('sponsor-user');
    const classic = data.tierProgress.find((t) => t.tier === 'Classic');
    expect(classic?.completedGroups).toBe(0);
    expect(classic?.remainingToNext).toBe(4); // open group of one (the late fifth) needs four more
    expect(classic?.remainingDays).toBeGreaterThan(0);
    expect(data.voidedGroups).toHaveLength(1);
    expect(data.voidedGroups[0]).toMatchObject({ tier: 'Classic', memberCount: 4 });
  });

  it('wallet summary returns the saved payout method and details, with no GCash default (item 8)', async () => {
    const user = seedUser('payout-m1', 'Member One', 'payoutm1@yor.local');
    const member = {
      ...seedMember('payout-m1', 'PAYOUTM1', 'YOR-MEMBER-9001', 'Classic', 'Member One'),
      payoutMethod: 'Metro Bank',
      payoutDetails: '4417441939015'
    };
    const repo = createInMemoryProductionEncodingRepository({
      users: [user],
      members: [member],
      networkAccounts: [seedNetwork('payout-m1', 'Classic', null, null, null)]
    });
    const service = new ProductionEncodingService(repo);
    const data = await service.buildMemberWalletData('payout-m1');
    expect(data.summary.payoutMethod).toBe('Metro Bank');
    expect(data.summary.payoutDetails).toBe('4417441939015');
  });

  it('wallet summary payout method/details are null (not GCash) when unset (item 8)', async () => {
    const user = seedUser('payout-m2', 'Member Two', 'payoutm2@yor.local');
    const member = seedMember('payout-m2', 'PAYOUTM2', 'YOR-MEMBER-9002', 'Classic', 'Member Two');
    const repo = createInMemoryProductionEncodingRepository({
      users: [user],
      members: [member],
      networkAccounts: [seedNetwork('payout-m2', 'Classic', null, null, null)]
    });
    const service = new ProductionEncodingService(repo);
    const data = await service.buildMemberWalletData('payout-m2');
    expect(data.summary.payoutMethod).toBeNull();
    expect(data.summary.payoutDetails).toBeNull();
  });

  it('computes member rank from lifetime gross wallet credits (item 8)', async () => {
    const user = seedUser('rank-m1', 'Ranker One', 'rank1@yor.local');
    const member = seedMember('rank-m1', 'RANKM1', 'YOR-MEMBER-9101', 'VIP', 'Ranker One');
    const repo = createInMemoryProductionEncodingRepository({
      users: [user],
      members: [member],
      networkAccounts: [seedNetwork('rank-m1', 'VIP', null, null, null)],
      walletLedger: [
        // GATE-RANK-UNILEVEL-20260615: only UNILEVEL income gates rank. Total income here
        // is 160k (100k direct referral + 60k unilevel), but rank reads the 60k unilevel only.
        { id: 'r1', userId: 'rank-m1', walletType: 'main', entryType: 'direct_referral', sourceReference: 'x', creditAmount: 100000, debitAmount: 0, balanceAfter: 100000, processId: 'r:1', notes: '', occurredAt: '2026-06-01T00:00:00.000Z', status: 'posted' },
        { id: 'r2', userId: 'rank-m1', walletType: 'main', entryType: 'unilevel', sourceReference: 'y', creditAmount: 60000, debitAmount: 0, balanceAfter: 160000, processId: 'r:2', notes: '', occurredAt: '2026-06-02T00:00:00.000Z', status: 'posted' },
        { id: 'r3', userId: 'rank-m1', walletType: 'main', entryType: 'encashment', sourceReference: 'z', creditAmount: 0, debitAmount: 50000, balanceAfter: 110000, processId: 'r:3', notes: '', occurredAt: '2026-06-03T00:00:00.000Z', status: 'posted' }
      ]
    });
    const service = new ProductionEncodingService(repo);
    const rank = await service.getMemberRank('rank-m1');
    // unilevel income = 60000 -> Manager (NOT Bronze, despite 160k total income)
    expect(rank.unilevelIncome).toBe(60000);
    expect(rank.rankName).toBe('Manager');
    expect(rank.level).toBe(1);
    expect(rank.nextRankName).toBe('Bronze Director');
  });

  it('leaderboard ranks true members by income and excludes company-tagged accounts (item 8)', async () => {
    // Rank tier is gated by unilevel income (GATE-RANK-UNILEVEL-20260615), so seed
    // unilevel credits to drive the rank names asserted below.
    const mkLedger = (userId: string, amount: number) => ({
      id: `l-${userId}`, userId, walletType: 'main' as const, entryType: 'unilevel' as const,
      sourceReference: 'x', creditAmount: amount, debitAmount: 0, balanceAfter: amount,
      processId: `p:${userId}`, notes: '', occurredAt: '2026-06-01T00:00:00.000Z', status: 'posted' as const
    });
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('lb1', 'A', 'a@yor.local'), seedUser('lb2', 'B', 'b@yor.local'), seedUser('lb3', 'C', 'c@yor.local')],
      members: [
        seedMember('lb1', 'LB1', 'YOR-MEMBER-9201', 'Standard', 'Member A'),
        seedMember('lb2', 'LB2', 'YOR-MEMBER-9202', 'Classic', 'Member B'),
        // Company-tagged whale — must be excluded despite the highest income.
        { ...seedMember('lb3', 'Yorintl', 'YOR-MEMBER-9203', 'VIP', 'Company Account'), isCompanyAccount: true, isLeaderboardExcluded: true }
      ],
      networkAccounts: [
        seedNetwork('lb1', 'Standard', null, null, null),
        seedNetwork('lb2', 'Classic', null, null, null),
        seedNetwork('lb3', 'VIP', null, null, null)
      ],
      walletLedger: [mkLedger('lb1', 300000), mkLedger('lb2', 60000), mkLedger('lb3', 5000000)]
    });
    const service = new ProductionEncodingService(repo);
    const board = await service.getLeaderboard();
    expect(board.entries.map((e) => e.username)).toEqual(['LB1', 'LB2']); // lb3 excluded
    expect(board.entries[0]).toMatchObject({ position: 1, username: 'LB1', totalIncome: 300000, rankName: 'Silver Director' });
    expect(board.entries[1]).toMatchObject({ position: 2, username: 'LB2', totalIncome: 60000, rankName: 'Manager' });
  });

  it('unilevel credits the sponsor bloodline up to 10 levels at the published percentages (item 8)', async () => {
    // Sponsor chain: C -> B -> A -> root (via network.sponsorUserId).
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('uni-root', 'Root', 'root@yor.local'), seedUser('uni-a', 'A', 'a@yor.local'), seedUser('uni-b', 'B', 'b@yor.local'), seedUser('uni-c', 'C', 'c@yor.local')],
      networkAccounts: [
        seedNetwork('uni-root', 'VIP', null, null, null),
        seedNetwork('uni-a', 'VIP', 'uni-root', null, null),
        seedNetwork('uni-b', 'VIP', 'uni-a', null, null),
        seedNetwork('uni-c', 'VIP', 'uni-b', null, null)
      ]
    });
    const service = new ProductionEncodingService(repo);
    const res = await service.applyRepurchaseUnilevel({ repurchasingUserId: 'uni-c', repurchasePv: 500, repurchaseRef: 'rp-1', sourceLabel: 'C · Perfume' });
    expect(res.levelsCredited).toBe(3); // B(L1), A(L2), root(L3); root has no sponsor
    expect(res.totalCredited).toBe(115); // 50 + 40 + 25

    const bUni = await service.getMemberUnilevelData('uni-b');
    expect(bUni.totalEarned).toBe(50); // L1 10% of 500
    expect(bUni.byLevel[0]).toMatchObject({ level: 1, percent: 10, amount: 50, count: 1 });

    const aLedger = await repo.listWalletLedgerEntriesForUser('uni-a');
    expect(aLedger.find((e) => e.entryType === 'unilevel')?.creditAmount).toBe(40); // L2 8%
    const rootLedger = await repo.listWalletLedgerEntriesForUser('uni-root');
    expect(rootLedger.find((e) => e.entryType === 'unilevel')?.creditAmount).toBe(25); // L3 5%

    // Re-running the same repurchase event must not double-credit.
    await service.applyRepurchaseUnilevel({ repurchasingUserId: 'uni-c', repurchasePv: 500, repurchaseRef: 'rp-1', sourceLabel: 'C · Perfume' });
    const bUniAgain = await service.getMemberUnilevelData('uni-b');
    expect(bUniAgain.totalEarned).toBe(50);
  });

  it('creditUnilevelForRepurchase resolves repurchase PV from the catalog (item 8)', async () => {
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('uni-s', 'Sponsor', 's@yor.local'), seedUser('uni-m', 'Buyer', 'm@yor.local')],
      members: [seedMember('uni-m', 'BUYERM', 'YOR-MEMBER-9301', 'VIP', 'Buyer M', 'YOR-MEMBER-9300')],
      networkAccounts: [seedNetwork('uni-s', 'VIP', null, null, null), seedNetwork('uni-m', 'VIP', 'uni-s', null, null)]
    });
    const service = new ProductionEncodingService(repo);
    const res = await service.creditUnilevelForRepurchase({ repurchasingUserId: 'uni-m', sku: 'YOR-REFILL-HUGO-BOSS', repurchaseRef: 'rp-2' });
    // All products (perfume, eyedrops, perfume refill) carry 20 repurchase PV (official
    // Yor Unilevel Bonus plan). Unilevel pays a % of repurchase PV, not the peso price.
    expect(res.repurchasePv).toBe(20);
    const sLedger = await repo.listWalletLedgerEntriesForUser('uni-s');
    expect(sLedger.find((e) => e.entryType === 'unilevel')?.creditAmount).toBe(2); // L1 10% of 20 PV
  });

  it('FS registration posts no direct referral and queues no binary PV, even when paid', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Sponsor Member');
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser],
      members: [sponsorMember],
      networkAccounts: [seedNetwork('sponsor-user', 'Standard', null, null, null)],
      activationCodes: [
        seedCode({
          code: 'YOR-ACT-00009001',
          packageTier: 'Business',
          accountType: 'FS',
          paymentStatus: 'paid',
          lockedDirectReferralBonus: 7000,
          lockedSalesmatchValue: 5000,
          lockedBinaryPoints: 20,
          lockedGetFiveAmount: 50998
        })
      ]
    });
    const service = new ProductionEncodingService(repo);

    const submit = await service.submitRegistration(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Free Slot Prospect',
        username: 'YOR9001',
        phone: '+63 999 555 5555',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00009001',
        placementParentUsername: 'YOR0001',
        placementSide: 'left'
      }
    );

    expect(submit.queuedCompensation).toEqual([]);
    expect(submit.detail).toContain('FS entries never generate');

    const sponsorLedger = await repo.listWalletLedgerEntriesForUser('sponsor-user');
    expect(sponsorLedger.find((entry) => entry.entryType === 'direct_referral')).toBeUndefined();

    const createdUser = await repo.findUserByUsername('YOR9001');
    const createdNetwork = await repo.findNetworkAccountByUserId(createdUser!.id);
    expect(createdNetwork).toMatchObject({ currentAccountType: 'FS', cdAmount: 0, cdTotal: 0, cdStatus: 0 });
  });

  it('CD unpaid registration defers DR and PV and records the CD obligation', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Sponsor Member');
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser],
      members: [sponsorMember],
      networkAccounts: [seedNetwork('sponsor-user', 'Standard', null, null, null)],
      activationCodes: [
        seedCode({
          code: 'YOR-ACT-00009002',
          packageTier: 'Standard',
          accountType: 'CD',
          paymentStatus: 'unpaid'
        })
      ]
    });
    const service = new ProductionEncodingService(repo);

    const submit = await service.submitRegistration(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Credit Prospect',
        username: 'YOR9002',
        phone: '+63 999 666 6666',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00009002',
        placementParentUsername: 'YOR0001',
        placementSide: 'right'
      }
    );

    expect(submit.queuedCompensation).toEqual([]);
    expect(submit.detail).toContain('deferred until the CD entry is settled');

    const sponsorLedger = await repo.listWalletLedgerEntriesForUser('sponsor-user');
    expect(sponsorLedger.find((entry) => entry.entryType === 'direct_referral')).toBeUndefined();

    const createdUser = await repo.findUserByUsername('YOR9002');
    const createdNetwork = await repo.findNetworkAccountByUserId(createdUser!.id);
    expect(createdNetwork).toMatchObject({ currentAccountType: 'CD', cdAmount: 25998, cdTotal: 0, cdStatus: 1 });
  });

  it('settling a used CD code fires the deferred DR and queues PV exactly once', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Sponsor Member');
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser, seedUser('admin-user', 'Admin', 'admin@yor.local', 'admin')],
      members: [sponsorMember],
      networkAccounts: [seedNetwork('sponsor-user', 'Standard', null, null, null)],
      activationCodes: [
        seedCode({
          code: 'YOR-ACT-00009003',
          packageTier: 'Standard',
          accountType: 'CD',
          paymentStatus: 'unpaid'
        })
      ]
    });
    const service = new ProductionEncodingService(repo);
    const admin = { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' as const };

    await service.submitRegistration(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Credit Prospect',
        username: 'YOR9003',
        phone: '+63 999 777 7777',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00009003',
        placementParentUsername: 'YOR0001',
        placementSide: 'left'
      }
    );
    expect((await repo.listWalletLedgerEntriesForUser('sponsor-user')).length).toBe(0);

    const settle = await service.settleActivationCode(admin, 'YOR-ACT-00009003', 'paid');
    expect(settle.status).toBe('completed');

    const ledger = await repo.listWalletLedgerEntriesForUser('sponsor-user');
    const drEntries = ledger.filter((entry) => entry.entryType === 'direct_referral');
    expect(drEntries).toHaveLength(1);
    expect(drEntries[0].creditAmount).toBe(5000);

    const queue = await repo.listPendingCompensation(10);
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.salesmatchValue).toBe(2500);

    const createdUser = await repo.findUserByUsername('YOR9003');
    const createdNetwork = await repo.findNetworkAccountByUserId(createdUser!.id);
    expect(createdNetwork).toMatchObject({ cdStatus: 2, cdTotal: 25998 });

    const replay = await service.settleActivationCode(admin, 'YOR-ACT-00009003', 'paid');
    expect(replay.reason).toContain('already settled');
    expect((await repo.listWalletLedgerEntriesForUser('sponsor-user')).filter((entry) => entry.entryType === 'direct_referral')).toHaveLength(1);
    expect(await repo.listPendingCompensation(10)).toHaveLength(1);
  });

  it('settling an FS code flips payment status but never fires DR or PV', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Sponsor Member');
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser, seedUser('admin-user', 'Admin', 'admin@yor.local', 'admin')],
      members: [sponsorMember],
      networkAccounts: [seedNetwork('sponsor-user', 'Standard', null, null, null)],
      activationCodes: [
        seedCode({
          code: 'YOR-ACT-00009004',
          packageTier: 'Business',
          accountType: 'FS',
          paymentStatus: 'unpaid'
        })
      ]
    });
    const service = new ProductionEncodingService(repo);
    const admin = { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' as const };

    await service.submitRegistration(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Free Slot Prospect',
        username: 'YOR9004',
        phone: '+63 999 888 8888',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00009004',
        placementParentUsername: 'YOR0001',
        placementSide: 'right'
      }
    );

    await service.settleActivationCode(admin, 'YOR-ACT-00009004', 'externally-paid');

    const code = await repo.findActivationCodeByCode('YOR-ACT-00009004');
    expect(code?.paymentStatus).toBe('externally-paid');
    expect((await repo.listWalletLedgerEntriesForUser('sponsor-user')).filter((entry) => entry.entryType === 'direct_referral')).toHaveLength(0);
    expect(await repo.listPendingCompensation(10)).toHaveLength(0);
  });

  it('settling an unused available code only flips payment status', async () => {
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('admin-user', 'Admin', 'admin@yor.local', 'admin')],
      activationCodes: [seedCode({ code: 'YOR-ACT-00009005', paymentStatus: 'unpaid' })]
    });
    const service = new ProductionEncodingService(repo);

    const settle = await service.settleActivationCode(
      { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' },
      'YOR-ACT-00009005',
      'paid'
    );
    expect(settle.status).toBe('completed');

    const code = await repo.findActivationCodeByCode('YOR-ACT-00009005');
    expect(code?.paymentStatus).toBe('paid');
    expect(await repo.listPendingCompensation(10)).toHaveLength(0);
  });

  it('an eligible (PD) upline earns salesmatch on spillover volume — no personal-direct unlock gate', async () => {
    const uplineUser = seedUser('upline-user', 'Upline', 'upline@yor.local');
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const uplineMember = seedMember('upline-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Upline Member');
    const sponsorMember = seedMember('sponsor-user', 'YOR0002', 'YOR-MEMBER-0002', 'Standard', 'Sponsor Member');
    const repo = createInMemoryProductionEncodingRepository({
      users: [uplineUser, sponsorUser],
      members: [uplineMember, sponsorMember],
      networkAccounts: [
        seedNetwork('upline-user', 'Standard', null, null, null),
        // Sponsor sits outside the upline's binary subtree.
        seedNetwork('sponsor-user', 'Standard', null, null, null)
      ],
      activationCodes: [seedCode({ code: 'YOR-ACT-00009006', assignedUserId: 'sponsor-user' })],
      salesmatchBalances: [
        {
          userId: 'upline-user',
          leftSales: 2500,
          rightSales: 0,
          matchedSales: 0,
          leftPoints: 10,
          rightPoints: 0,
          matchedPoints: 0,
          updatedAt: '2026-06-08T09:00:00.000Z'
        }
      ]
    });
    const service = new ProductionEncodingService(repo);

    // Spillover: sponsored by sponsor-user, but placed under upline-user's right leg.
    await service.submitRegistration(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Spillover Prospect',
        username: 'YOR9006',
        phone: '+63 999 100 0001',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00009006',
        placementParentUsername: 'YOR0001',
        placementSide: 'right'
      }
    );
    await service.processCompensationQueue();

    // GATE-PAIR-ELIGIB-REMOVE-20260615: the Nogatu personal-direct unlock gate is gone.
    // A PD upline with volume on both legs earns salesmatch even when the matching
    // volume arrived via spillover (sponsored by someone else).
    const uplineLedger = await repo.listWalletLedgerEntriesForUser('upline-user');
    const smb = uplineLedger.filter((entry) => entry.entryType === 'salesmatch');
    expect(smb).toHaveLength(1);
    expect(smb[0].creditAmount).toBe(2500); // min(2500,2500) matched, Standard cap 60000

    const balance = await repo.getSalesmatchBalance('upline-user');
    expect(balance).toMatchObject({ leftSales: 2500, rightSales: 2500, matchedSales: 2500 });
  });

  it('an FS upline never earns salesmatch while volume passes through to higher uplines', async () => {
    const grandUser = seedUser('grand-user', 'Grand', 'grand@yor.local');
    const fsUser = seedUser('fs-user', 'Free Slot', 'fs@yor.local');
    const grandMember = seedMember('grand-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Grand Member');
    const fsMember = seedMember('fs-user', 'YOR0002', 'YOR-MEMBER-0002', 'Business', 'Free Slot Member', 'YOR-MEMBER-0001');
    const repo = createInMemoryProductionEncodingRepository({
      users: [grandUser, fsUser],
      members: [grandMember, fsMember],
      networkAccounts: [
        seedNetwork('grand-user', 'Standard', null, null, null),
        seedNetwork('fs-user', 'Business', 'grand-user', 'grand-user', 'left')
      ],
      activationCodes: [seedCode({ code: 'YOR-ACT-00009007', assignedUserId: 'grand-user' })],
      salesmatchBalances: [
        {
          userId: 'grand-user',
          leftSales: 0,
          rightSales: 2500,
          matchedSales: 0,
          leftPoints: 0,
          rightPoints: 10,
          matchedPoints: 0,
          updatedAt: '2026-06-08T09:00:00.000Z'
        }
      ]
    });
    const service = new ProductionEncodingService(repo);

    // Sponsored by grand-user (unlock direct), placed under the FS node's left slot.
    await service.submitRegistration(
      { id: 'grand-user', name: 'Grand', email: 'grand@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Deep Prospect',
        username: 'YOR9007',
        phone: '+63 999 100 0002',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00009007',
        placementParentUsername: 'YOR0002',
        placementSide: 'left'
      }
    );
    await service.processCompensationQueue();

    const fsLedger = await repo.listWalletLedgerEntriesForUser('fs-user');
    expect(fsLedger).toHaveLength(0);

    const grandLedger = await repo.listWalletLedgerEntriesForUser('grand-user');
    const salesmatch = grandLedger.filter((entry) => entry.entryType === 'salesmatch');
    expect(salesmatch).toHaveLength(1);
    expect(salesmatch[0].creditAmount).toBe(2500);
  });

  it('caps weekly salesmatch payout at the package cap, forfeits the excess, and computes binary cycle on the FULL matched salesmatch (uncapped, item 3)', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Classic', 'Sponsor Member');
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser],
      members: [sponsorMember],
      networkAccounts: [seedNetwork('sponsor-user', 'Classic', null, null, null)],
      activationCodes: [
        seedCode({
          code: 'YOR-ACT-00009008',
          packageTier: 'Classic',
          accountType: 'PD',
          paymentStatus: 'paid',
          lockedDirectReferralBonus: 1000,
          lockedSalesmatchValue: 500,
          lockedBinaryPoints: 2,
          lockedGetFiveAmount: 5998
        })
      ],
      salesmatchBalances: [
        {
          userId: 'sponsor-user',
          leftSales: 0,
          rightSales: 500,
          matchedSales: 0,
          leftPoints: 0,
          rightPoints: 2,
          matchedPoints: 0,
          updatedAt: '2026-06-08T09:00:00.000Z'
        }
      ],
      // Classic weekly cap is PHP 20,000 — PHP 19,800 already paid this week.
      walletLedger: [
        {
          id: 'seed-ledger-1',
          userId: 'sponsor-user',
          walletType: 'main',
          entryType: 'salesmatch',
          sourceReference: 'prior-pairings',
          creditAmount: 19800,
          debitAmount: 0,
          balanceAfter: 19800,
          processId: 'seed:salesmatch:prior',
          notes: 'Prior pairing payouts this week.',
          occurredAt: '2026-06-08T08:00:00.000Z',
          status: 'posted'
        }
      ]
    });
    const service = new ProductionEncodingService(repo);

    await service.submitRegistration(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Capped Prospect',
        username: 'YOR9008',
        phone: '+63 999 100 0003',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00009008',
        placementParentUsername: 'YOR0001-L',
        placementSide: 'left'
      }
    );
    await service.processCompensationQueue();

    const ledger = await repo.listWalletLedgerEntriesForUser('sponsor-user');
    const salesmatch = ledger.filter((entry) => entry.entryType === 'salesmatch' && entry.processId !== 'seed:salesmatch:prior');
    expect(salesmatch).toHaveLength(1);
    expect(salesmatch[0].creditAmount).toBe(200);
    expect(salesmatch[0].notes).toContain('forfeited at package cap');

    // GATE-BIN-CYCLE-UPLINE-A-20260614: the sponsor does not self-earn binary cycle;
    // it flows to its A (the placed member YOR9008). GATE-BIN-CYCLE-NOCAP-20260613:
    // uncapped — 2% of the FULL matched 500 (= 10), not the SMB-capped 200.
    expect(ledger.filter((entry) => entry.entryType === 'binary_cycle')).toHaveLength(0);
    const aMember = await repo.findMemberByUsername('YOR9008');
    const aLedger = await repo.listWalletLedgerEntriesForUser(aMember!.userId);
    const binaryCycle = aLedger.filter((entry) => entry.entryType === 'binary_cycle');
    expect(binaryCycle).toHaveLength(1);
    expect(binaryCycle[0].creditAmount).toBe(10);

    const snapshots = await repo.listPairingSnapshotsForUser('sponsor-user');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ matchedSales: 500, paidSalesmatch: 200, forfeitedSalesmatch: 300 });
  });

  it('a member already at the weekly SMB cap earns zero salesmatch but still earns uncapped binary cycle while legs consume', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Classic', 'Sponsor Member');
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser],
      members: [sponsorMember],
      networkAccounts: [seedNetwork('sponsor-user', 'Classic', null, null, null)],
      activationCodes: [
        seedCode({
          code: 'YOR-ACT-00009009',
          packageTier: 'Classic',
          accountType: 'PD',
          paymentStatus: 'paid',
          lockedSalesmatchValue: 500,
          lockedBinaryPoints: 2
        })
      ],
      salesmatchBalances: [
        {
          userId: 'sponsor-user',
          leftSales: 0,
          rightSales: 500,
          matchedSales: 0,
          leftPoints: 0,
          rightPoints: 2,
          matchedPoints: 0,
          updatedAt: '2026-06-08T09:00:00.000Z'
        }
      ],
      walletLedger: [
        {
          id: 'seed-ledger-2',
          userId: 'sponsor-user',
          walletType: 'main',
          entryType: 'salesmatch',
          sourceReference: 'prior-pairings',
          creditAmount: 20000,
          debitAmount: 0,
          balanceAfter: 20000,
          processId: 'seed:salesmatch:cap',
          notes: 'Weekly cap reached.',
          occurredAt: '2026-06-08T08:00:00.000Z',
          status: 'posted'
        }
      ]
    });
    const service = new ProductionEncodingService(repo);

    await service.submitRegistration(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Over Cap Prospect',
        username: 'YOR9009',
        phone: '+63 999 100 0004',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00009009',
        placementParentUsername: 'YOR0001-L',
        placementSide: 'left'
      }
    );
    await service.processCompensationQueue();

    const ledger = await repo.listWalletLedgerEntriesForUser('sponsor-user');
    expect(ledger.filter((entry) => entry.entryType === 'salesmatch' && entry.processId !== 'seed:salesmatch:cap')).toHaveLength(0);
    // GATE-BIN-CYCLE-UPLINE-A-20260614: sponsor does not self-earn; the cycle flows to
    // its A (YOR9009). GATE-BIN-CYCLE-NOCAP-20260613: SMB payout fully capped (payable 0)
    // but binary cycle is uncapped — 2% of the FULL matched 500 (= 10) still posts.
    expect(ledger.filter((entry) => entry.entryType === 'binary_cycle')).toHaveLength(0);
    const aMember = await repo.findMemberByUsername('YOR9009');
    const aLedger = await repo.listWalletLedgerEntriesForUser(aMember!.userId);
    const binaryCycle = aLedger.filter((entry) => entry.entryType === 'binary_cycle');
    expect(binaryCycle).toHaveLength(1);
    expect(binaryCycle[0].creditAmount).toBe(10);

    // GATE-PV-GROSS-20260614: legs hold GROSS lifetime volume (not reduced on match);
    // matchedSales is the cumulative matched running total.
    const balance = await repo.getSalesmatchBalance('sponsor-user');
    expect(balance).toMatchObject({ leftSales: 500, rightSales: 500, matchedSales: 500 });

    const snapshots = await repo.listPairingSnapshotsForUser('sponsor-user');
    expect(snapshots[0]).toMatchObject({ matchedSales: 500, paidSalesmatch: 0, forfeitedSalesmatch: 500 });
  });

  it('submitEncashment debits the ledger with the full deduction stack and rejects over-balance requests', async () => {
    const memberUser = seedUser('member-user', 'Member', 'member@yor.local');
    const memberProfile = seedMember('member-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Member One');
    const repo = createInMemoryProductionEncodingRepository({
      users: [memberUser],
      members: [memberProfile],
      networkAccounts: [seedNetwork('member-user', 'Standard', null, null, null)],
      walletLedger: [
        {
          id: 'seed-ledger-3',
          userId: 'member-user',
          walletType: 'main',
          entryType: 'direct_referral',
          sourceReference: 'seed',
          creditAmount: 10000,
          debitAmount: 0,
          balanceAfter: 10000,
          processId: 'seed:dr:1',
          notes: 'Seed balance.',
          occurredAt: '2026-06-08T08:00:00.000Z',
          status: 'posted'
        }
      ]
    });
    const service = new ProductionEncodingService(repo);
    const actor = { id: 'member-user', name: 'Member', email: 'member@yor.local', role: 'member' as const };

    await expect(service.submitEncashment(actor, 99999)).rejects.toThrow(/exceeds available/i);

    const result = await service.submitEncashment(actor, 1000);
    expect(result.encashment).toMatchObject({
      grossAmount: 1000,
      processingFee: 50,
      tax: 100,
      systemRetainer: 50,
      cdDeduction: 0,
      totalDeductions: 200,
      netReceivable: 800,
      status: 'pending'
    });

    expect(await repo.sumLedgerMainBalance('member-user')).toBe(9000);
    const requests = await repo.listEncashmentsForUser('member-user');
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe('pending');
  });

  it('CD member encashment recovers 100% of the post-deduction net and settles the obligation when cleared', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Sponsor Member');
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser],
      members: [sponsorMember],
      networkAccounts: [seedNetwork('sponsor-user', 'Standard', null, null, null)],
      activationCodes: [
        seedCode({
          code: 'YOR-ACT-00009010',
          packageTier: 'Classic',
          accountType: 'CD',
          paymentStatus: 'unpaid',
          lockedDirectReferralBonus: 1000,
          lockedSalesmatchValue: 500,
          lockedBinaryPoints: 2
        })
      ]
    });
    const service = new ProductionEncodingService(repo);

    await service.submitRegistration(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Credit Member',
        username: 'YOR9010',
        phone: '+63 999 100 0005',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00009010',
        placementParentUsername: 'YOR0001',
        placementSide: 'left'
      }
    );

    const cdUser = await repo.findUserByUsername('YOR9010');
    // Fund the CD member enough to clear the Classic obligation (5998) in one recovery.
    await repo.appendWalletLedgerEntry({
      id: 'seed-ledger-4',
      userId: cdUser!.id,
      walletType: 'main',
      entryType: 'direct_referral',
      sourceReference: 'seed',
      creditAmount: 10000,
      debitAmount: 0,
      balanceAfter: 10000,
      processId: 'seed:dr:2',
      notes: 'Seed balance.',
      occurredAt: '2026-06-08T08:00:00.000Z',
      status: 'posted'
    });

    const cdActor = { id: cdUser!.id, name: 'Credit Member', email: cdUser!.email, role: 'member' as const };
    const result = await service.submitEncashment(cdActor, 8000);
    // Gross 8000 - fee 50 - tax 800 - retainer 400 = 6750 post-fixed net;
    // CD outstanding 5998 fully withheld, member nets 752.
    expect(result.encashment).toMatchObject({ cdDeduction: 5998, netReceivable: 752 });

    // No money effects beyond the reserved debit until the payout is real:
    // CD obligation untouched, no DR, no PV, code still unpaid.
    expect(await repo.findNetworkAccountByUserId(cdUser!.id)).toMatchObject({ cdStatus: 1, cdTotal: 0 });
    expect((await repo.listWalletLedgerEntriesForUser('sponsor-user')).filter((entry) => entry.entryType === 'direct_referral')).toHaveLength(0);
    expect(await repo.listPendingCompensation(10)).toHaveLength(0);
    expect((await repo.findActivationCodeByCode('YOR-ACT-00009010'))?.paymentStatus).toBe('unpaid');

    // Approve + mark-paid applies the recovery and fires the deferred DR/PV.
    const sponsorActor = { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'admin' as const };
    const [request] = await repo.listEncashmentsForUser(cdUser!.id);
    await service.reviewEncashment(sponsorActor, request.id, 'approve');
    await service.reviewEncashment(sponsorActor, request.id, 'mark-paid');

    const network = await repo.findNetworkAccountByUserId(cdUser!.id);
    expect(network).toMatchObject({ cdStatus: 2, cdTotal: 5998 });

    const sponsorLedger = await repo.listWalletLedgerEntriesForUser('sponsor-user');
    expect(sponsorLedger.filter((entry) => entry.entryType === 'direct_referral')).toHaveLength(1);
    expect(await repo.listPendingCompensation(10)).toHaveLength(1);

    const code = await repo.findActivationCodeByCode('YOR-ACT-00009010');
    expect(code?.paymentStatus).toBe('paid');
  });

  it('a rejected CD encashment leaves no settlement effects and restores the gross', async () => {
    const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
    const sponsorMember = seedMember('sponsor-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Sponsor Member');
    const repo = createInMemoryProductionEncodingRepository({
      users: [sponsorUser],
      members: [sponsorMember],
      networkAccounts: [seedNetwork('sponsor-user', 'Standard', null, null, null)],
      activationCodes: [
        seedCode({
          code: 'YOR-ACT-00009011',
          packageTier: 'Classic',
          accountType: 'CD',
          paymentStatus: 'unpaid',
          lockedDirectReferralBonus: 1000,
          lockedSalesmatchValue: 500,
          lockedBinaryPoints: 2
        })
      ]
    });
    const service = new ProductionEncodingService(repo);

    await service.submitRegistration(
      { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
      {
        origin: 'genealogy-slot',
        fullName: 'Reject Path Member',
        username: 'YOR9011',
        phone: '+63 999 100 0006',
        password: 'Password123!',
        activationCode: 'YOR-ACT-00009011',
        placementParentUsername: 'YOR0001',
        placementSide: 'left'
      }
    );
    const cdUser = await repo.findUserByUsername('YOR9011');
    await repo.appendWalletLedgerEntry({
      id: 'seed-ledger-6',
      userId: cdUser!.id,
      walletType: 'main',
      entryType: 'direct_referral',
      sourceReference: 'seed',
      creditAmount: 10000,
      debitAmount: 0,
      balanceAfter: 10000,
      processId: 'seed:dr:4',
      notes: 'Seed balance.',
      occurredAt: '2026-06-08T08:00:00.000Z',
      status: 'posted'
    });

    const cdActor = { id: cdUser!.id, name: 'Reject Path Member', email: cdUser!.email, role: 'member' as const };
    await service.submitEncashment(cdActor, 8000);
    expect(await repo.sumLedgerMainBalance(cdUser!.id)).toBe(2000);

    const adminActor = { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'admin' as const };
    const [request] = await repo.listEncashmentsForUser(cdUser!.id);
    await service.reviewEncashment(adminActor, request.id, 'reject', 'Payout details incomplete.');

    // Gross restored; CD untouched; no DR; no PV; code still unpaid.
    expect(await repo.sumLedgerMainBalance(cdUser!.id)).toBe(10000);
    expect(await repo.findNetworkAccountByUserId(cdUser!.id)).toMatchObject({ cdStatus: 1, cdTotal: 0 });
    expect((await repo.listWalletLedgerEntriesForUser('sponsor-user')).filter((entry) => entry.entryType === 'direct_referral')).toHaveLength(0);
    expect(await repo.listPendingCompensation(10)).toHaveLength(0);
    expect((await repo.findActivationCodeByCode('YOR-ACT-00009011'))?.paymentStatus).toBe('unpaid');
  });

  it('reviewEncashment transitions approve -> mark-paid and reject restores the gross amount', async () => {
    const memberUser = seedUser('member-user', 'Member', 'member@yor.local');
    const memberProfile = seedMember('member-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Member One');
    const adminUser = seedUser('admin-user', 'Admin', 'admin@yor.local', 'admin');
    const repo = createInMemoryProductionEncodingRepository({
      users: [memberUser, adminUser],
      members: [memberProfile],
      networkAccounts: [seedNetwork('member-user', 'Standard', null, null, null)],
      walletLedger: [
        {
          id: 'seed-ledger-5',
          userId: 'member-user',
          walletType: 'main',
          entryType: 'direct_referral',
          sourceReference: 'seed',
          creditAmount: 5000,
          debitAmount: 0,
          balanceAfter: 5000,
          processId: 'seed:dr:3',
          notes: 'Seed balance.',
          occurredAt: '2026-06-08T08:00:00.000Z',
          status: 'posted'
        }
      ]
    });
    const service = new ProductionEncodingService(repo);
    const memberActor = { id: 'member-user', name: 'Member', email: 'member@yor.local', role: 'member' as const };
    const adminActor = { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' as const };

    await service.submitEncashment(memberActor, 1000);
    // One open request per member: a second submit while pending is blocked.
    await expect(service.submitEncashment(memberActor, 500)).rejects.toThrow(/already have an encashment/i);

    const [first] = await repo.listEncashmentsForUser('member-user');
    await service.reviewEncashment(adminActor, first.id, 'approve');
    expect((await repo.findEncashmentById(first.id))?.status).toBe('approved');
    await expect(service.reviewEncashment(adminActor, first.id, 'approve')).rejects.toThrow(/cannot approve/i);
    await service.reviewEncashment(adminActor, first.id, 'mark-paid');
    expect((await repo.findEncashmentById(first.id))?.status).toBe('paid');

    await service.submitEncashment(memberActor, 2000);
    const second = (await repo.listEncashmentsForUser('member-user')).find((row) => row.status === 'pending');
    const balanceBeforeReject = await repo.sumLedgerMainBalance('member-user');
    await service.reviewEncashment(adminActor, second!.id, 'reject', 'Payout details incomplete.');
    expect((await repo.findEncashmentById(second!.id))?.status).toBe('rejected');
    expect(await repo.sumLedgerMainBalance('member-user')).toBe(balanceBeforeReject + 2000);
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

  it('builds the member shadow center from live shadow rows and exposes paid unused codes for activation', async () => {
    const ownerUser = seedUser('owner-user', 'Owner', 'owner@yor.local');
    const repo = createInMemoryProductionEncodingRepository({
      users: [ownerUser],
      members: [seedMember('owner-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Owner Member')],
      networkAccounts: [seedNetwork('owner-user', 'Standard', null, null, null)],
      shadowAccounts: [
        {
          id: 'shadow-left-row',
          ownerUserId: 'owner-user',
          shadowCode: 'YOR0001-L',
          state: 'activated_shadow',
          placement: 'left',
          walletEnabled: false,
          unilevelEnabled: false,
          binaryCycleEnabled: false,
          note: 'Activated shadow support only.',
          packageTier: 'Classic',
          accountType: 'FS',
          activationCode: 'FSCL001001',
          pvValue: 2,
          salesmatchValue: 500,
          activatedAt: '2026-06-13T08:00:00.000Z',
          lastUpgradedAt: '2026-06-13T08:00:00.000Z',
          createdAt: '2026-06-13T07:00:00.000Z',
          updatedAt: '2026-06-13T08:00:00.000Z'
        }
      ],
      activationCodes: [
        seedCode({
          id: 'available-shadow-code',
          code: 'FSBU001002',
          packageTier: 'Business',
          accountType: 'FS',
          assignedUserId: 'owner-user',
          status: 'available',
          paymentStatus: 'paid',
          lockedSalesmatchValue: 5000,
          lockedBinaryPoints: 20
        }),
        seedCode({
          id: 'used-shadow-code',
          code: 'PDBA001003',
          packageTier: 'Basic',
          accountType: 'PD',
          assignedUserId: 'owner-user',
          status: 'used',
          paymentStatus: 'paid',
          lockedSalesmatchValue: 250,
          lockedBinaryPoints: 1
        })
      ]
    });
    const service = new ProductionEncodingService(repo);

    const center = await service.buildMemberShadowAccountCenter(
      { id: 'owner-user', name: 'Owner', email: 'owner@yor.local', role: 'member' }
    );

    expect(center.owner).toBe('YOR0001');
    expect(center.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shadowCode: 'YOR0001-L',
          state: 'activated_shadow',
          packageTier: 'Classic',
          accountType: 'FS',
          activationCode: 'FSCL001001',
          pvValue: 2,
          salesmatchValue: 500
        }),
        expect.objectContaining({
          shadowCode: 'YOR0001-R'
        })
      ])
    );
    expect(center.availableCodes.map((item) => item.code)).toEqual(['FSBU001002']);
  });

  it('activates a specific shadow slot with a member-owned code and suppresses binary cycle on the shadow-generated pair', async () => {
    const ownerUser = seedUser('owner-user', 'Owner', 'owner@yor.local');
    const directUser = seedUser('direct-user', 'Direct Left', 'direct@yor.local');
    const repo = createInMemoryProductionEncodingRepository({
      users: [ownerUser, directUser],
      members: [
        seedMember('owner-user', 'YOR0001', 'YOR-MEMBER-0001', 'Standard', 'Owner Member'),
        seedMember('direct-user', 'YOR0002', 'YOR-MEMBER-0002', 'Basic', 'Direct Left', 'YOR-MEMBER-0001')
      ],
      networkAccounts: [
        seedNetwork('owner-user', 'Standard', null, null, null),
        seedNetwork('direct-user', 'Basic', 'owner-user', 'owner-user', 'left', 'left')
      ],
      activationCodes: [
        seedCode({
          id: 'shadow-left-code',
          code: 'FSBU001010',
          packageTier: 'Business',
          accountType: 'FS',
          assignedUserId: 'owner-user',
          status: 'available',
          paymentStatus: 'paid',
          lockedSalesmatchValue: 5000,
          lockedBinaryPoints: 20
        }),
        seedCode({
          id: 'shadow-right-code',
          code: 'PDBA001011',
          packageTier: 'Basic',
          accountType: 'PD',
          assignedUserId: 'owner-user',
          status: 'available',
          paymentStatus: 'paid',
          lockedSalesmatchValue: 5000,
          lockedBinaryPoints: 20
        })
      ],
      shadowAccounts: [
        {
          id: 'shadow-left-row',
          ownerUserId: 'owner-user',
          shadowCode: 'YOR0001-L',
          state: 'reserved_shadow',
          placement: 'left',
          walletEnabled: false,
          unilevelEnabled: false,
          binaryCycleEnabled: false,
          note: 'Reserved.',
          packageTier: null,
          accountType: null,
          activationCode: null,
          pvValue: 0,
          salesmatchValue: 0,
          activatedAt: null,
          lastUpgradedAt: null,
          createdAt: '2026-06-13T07:00:00.000Z',
          updatedAt: '2026-06-13T07:00:00.000Z'
        },
        {
          id: 'shadow-right-row',
          ownerUserId: 'owner-user',
          shadowCode: 'YOR0001-R',
          state: 'reserved_shadow',
          placement: 'right',
          walletEnabled: false,
          unilevelEnabled: false,
          binaryCycleEnabled: false,
          note: 'Reserved.',
          packageTier: null,
          accountType: null,
          activationCode: null,
          pvValue: 0,
          salesmatchValue: 0,
          activatedAt: null,
          lastUpgradedAt: null,
          createdAt: '2026-06-13T07:00:00.000Z',
          updatedAt: '2026-06-13T07:00:00.000Z'
        }
      ]
    });
    const service = new ProductionEncodingService(repo);
    const actor = { id: 'owner-user', name: 'Owner', email: 'owner@yor.local', role: 'member' as const };

    await service.activateShadowAccount(actor, {
      shadowCode: 'YOR0001-L',
      code: 'FSBU001010'
    });
    await service.processCompensationQueue();

    await service.activateShadowAccount(actor, {
      shadowCode: 'YOR0001-R',
      code: 'PDBA001011'
    });
    await service.processCompensationQueue();

    const shadowRows = await repo.listShadowAccountsForOwner('owner-user');
    expect(shadowRows.find((item) => item.shadowCode === 'YOR0001-L')).toMatchObject({
      state: 'activated_shadow',
      packageTier: 'Business',
      activationCode: 'FSBU001010',
      pvValue: 20,
      salesmatchValue: 5000
    });
    expect(shadowRows.find((item) => item.shadowCode === 'YOR0001-R')).toMatchObject({
      state: 'activated_shadow',
      packageTier: 'Basic',
      activationCode: 'PDBA001011',
      pvValue: 20,
      salesmatchValue: 5000
    });

    // GATE-SHADOW-ACT-20260613: the owner's own left-shadow and right-shadow PV must NOT
    // pair each other at the owner level — a shadow only earns SMB from valid pairing
    // activity UNDER its own network, then transfers to the owner's main wallet (handled
    // by reconcileShadowEarnings, not the inline queue). So activating both sibling shadows
    // with no downline under them yields no inline salesmatch and no binary cycle.
    const ownerLedger = await repo.listWalletLedgerEntriesForUser('owner-user');
    expect(ownerLedger.filter((entry) => entry.entryType === 'salesmatch').map((entry) => entry.creditAmount)).toEqual([]);
    expect(ownerLedger.filter((entry) => entry.entryType === 'binary_cycle')).toHaveLength(0);

    const consumedCodes = await repo.findActivationCodesByCodes(['FSBU001010', 'PDBA001011']);
    expect(consumedCodes.every((item) => item.status === 'used')).toBe(true);
  });
});

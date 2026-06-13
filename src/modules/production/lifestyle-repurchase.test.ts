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

function seedUser(id: string, name: string, email: string): ProductionAppUser {
  return {
    id,
    email,
    displayName: name,
    role: 'member',
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
  sponsorUserId: string | null
): ProductionNetworkAccount {
  return {
    userId,
    sponsorUserId,
    directReferrerUserId: sponsorUserId,
    placementParentUserId: null,
    placementParentShadowSide: null,
    placementSide: 'left',
    currentAccountTypeCode: 1,
    currentAccountType: 'PD',
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

function seedMaintenanceCode(
  id: string,
  code: string,
  assignedUserId: string,
  codeFamily: 'YOR MAINTENANCE' | 'YOR REFILL' = 'YOR MAINTENANCE'
): ProductionActivationCode {
  return {
    id,
    code,
    codeFamily,
    packageTier: 'Standard',
    accountType: 'PD',
    status: 'available',
    paymentStatus: 'paid',
    assignedUserId,
    generatedByUserId: 'admin-user',
    generatedAt: '2026-06-08T09:00:00.000Z',
    releasedAt: '2026-06-08T09:10:00.000Z',
    transferredAt: null,
    usedAt: null,
    usedByUserId: null,
    registrationEligible: false,
    lockedDirectReferralBonus: 0,
    lockedSalesmatchValue: 0,
    lockedBinaryPoints: 0,
    lockedGetFiveAmount: 0,
    processId: `seed:maint:${id}`,
    remarks: '',
    settledAt: null,
    settledByUserId: null
  };
}

describe('Lifestyle Rewards — applyRepurchaseLifestyle', () => {
  it('credits 1% of perfume price (PHP 5.00) to the lifestyle wallet', async () => {
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('m1', 'Member One', 'm1@yor.local')],
      members: [seedMember('m1', 'member1', 'YOR-MEMBER-0001', 'Classic', 'Member One')],
      networkAccounts: [seedNetwork('m1', 'Classic', null)]
    });
    const svc = new ProductionEncodingService(repo);

    const result = await svc.applyRepurchaseLifestyle({
      memberUserId: 'm1',
      sku: 'YOR-PERFUME-HUGO-BOSS',
      repurchaseRef: 'repurchase-CODE001-2026-06-13',
      memberPackageTier: 'Classic'
    });

    expect(result.credited).toBe(5);
    expect(result.cappedOut).toBe(false);

    const ledger = await repo.listWalletLedgerEntriesForUser('m1');
    const lifestyleEntry = ledger.find((e) => e.entryType === 'lifestyle_rewards');
    expect(lifestyleEntry).toBeDefined();
    expect(lifestyleEntry?.walletType).toBe('lifestyle');
    expect(lifestyleEntry?.creditAmount).toBe(5);
  });

  it('credits 1% of refill price (PHP 1.50) for refill SKU', async () => {
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('m1', 'Member One', 'm1@yor.local')],
      members: [seedMember('m1', 'member1', 'YOR-MEMBER-0001', 'Standard', 'Member One')],
      networkAccounts: [seedNetwork('m1', 'Standard', null)]
    });
    const svc = new ProductionEncodingService(repo);

    const result = await svc.applyRepurchaseLifestyle({
      memberUserId: 'm1',
      sku: 'YOR-REFILL-HUGO-BOSS',
      repurchaseRef: 'repurchase-REFILL001-2026-06-13',
      memberPackageTier: 'Standard'
    });

    expect(result.credited).toBe(1.5);
    expect(result.cappedOut).toBe(false);
  });

  it('returns cappedOut when daily cap is already reached', async () => {
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('m1', 'Member One', 'm1@yor.local')],
      members: [seedMember('m1', 'member1', 'YOR-MEMBER-0001', 'Classic', 'Member One')],
      networkAccounts: [seedNetwork('m1', 'Classic', null)]
    });
    const svc = new ProductionEncodingService(repo);

    // Fill up the Classic daily cap (PHP 1,000) by crediting 200 perfume purchases
    for (let i = 0; i < 200; i++) {
      await svc.applyRepurchaseLifestyle({
        memberUserId: 'm1',
        sku: 'YOR-PERFUME-HUGO-BOSS',
        repurchaseRef: `repurchase-FILL-${i}-2026-06-13`,
        memberPackageTier: 'Classic'
      });
    }

    // 201st purchase should be capped out
    const result = await svc.applyRepurchaseLifestyle({
      memberUserId: 'm1',
      sku: 'YOR-PERFUME-HUGO-BOSS',
      repurchaseRef: 'repurchase-CAPPED-2026-06-13',
      memberPackageTier: 'Classic'
    });

    expect(result.cappedOut).toBe(true);
    expect(result.credited).toBe(0);
    expect(result.reason).toContain('Daily lifestyle cap');
  });

  it('is idempotent — re-submitting same repurchaseRef does not double-credit', async () => {
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('m1', 'Member One', 'm1@yor.local')],
      members: [seedMember('m1', 'member1', 'YOR-MEMBER-0001', 'VIP', 'Member One')],
      networkAccounts: [seedNetwork('m1', 'VIP', null)]
    });
    const svc = new ProductionEncodingService(repo);

    const ref = 'repurchase-IDEMPOTENT-2026-06-13';
    await svc.applyRepurchaseLifestyle({ memberUserId: 'm1', sku: 'YOR-PERFUME-HUGO-BOSS', repurchaseRef: ref, memberPackageTier: 'VIP' });
    await svc.applyRepurchaseLifestyle({ memberUserId: 'm1', sku: 'YOR-PERFUME-HUGO-BOSS', repurchaseRef: ref, memberPackageTier: 'VIP' });

    const ledger = await repo.listWalletLedgerEntriesForUser('m1');
    const entries = ledger.filter((e) => e.entryType === 'lifestyle_rewards');
    expect(entries).toHaveLength(1);
    expect(entries[0].creditAmount).toBe(5);
  });

  it('Basic package is not eligible — returns no credit', async () => {
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('m1', 'Member One', 'm1@yor.local')],
      members: [seedMember('m1', 'member1', 'YOR-MEMBER-0001', 'Basic', 'Member One')],
      networkAccounts: [seedNetwork('m1', 'Basic', null)]
    });
    const svc = new ProductionEncodingService(repo);

    const result = await svc.applyRepurchaseLifestyle({
      memberUserId: 'm1',
      sku: 'YOR-PERFUME-HUGO-BOSS',
      repurchaseRef: 'repurchase-BASIC-2026-06-13',
      memberPackageTier: 'Basic'
    });

    expect(result.credited).toBe(0);
    expect(result.cappedOut).toBe(false);
  });
});

describe('submitProductRepurchase — combined lifestyle + unilevel trigger', () => {
  it('credits lifestyle to purchaser and unilevel up 3-level sponsor chain', async () => {
    const grandpaUser = seedUser('gp', 'Grandpa', 'gp@yor.local');
    const parentUser  = seedUser('pa', 'Parent', 'pa@yor.local');
    const memberUser  = seedUser('mb', 'Member', 'mb@yor.local');

    const grandpaMember = seedMember('gp', 'grandpa1', 'YOR-MEMBER-0001', 'VIP',      'Grandpa',  null);
    const parentMember  = seedMember('pa', 'parent1',  'YOR-MEMBER-0002', 'Standard', 'Parent',   'YOR-MEMBER-0001');
    const memberMember  = seedMember('mb', 'member1',  'YOR-MEMBER-0003', 'Classic',  'Member',   'YOR-MEMBER-0002');

    const grandpaNetwork = { ...seedNetwork('gp', 'VIP',      null),  sponsorUserId: null };
    const parentNetwork  = { ...seedNetwork('pa', 'Standard', 'gp'),  sponsorUserId: 'gp'  };
    const memberNetwork  = { ...seedNetwork('mb', 'Classic',  'pa'),  sponsorUserId: 'pa'  };

    const repo = createInMemoryProductionEncodingRepository({
      users: [grandpaUser, parentUser, memberUser],
      members: [grandpaMember, parentMember, memberMember],
      networkAccounts: [grandpaNetwork, parentNetwork, memberNetwork]
    });
    const svc = new ProductionEncodingService(repo);

    const result = await svc.submitProductRepurchase({
      memberUserId: 'mb',
      activationCodeValue: 'YOR-MAINT-0001',
      sku: 'YOR-PERFUME-HUGO-BOSS',
      memberPackageTier: 'Classic'
    });

    // Lifestyle goes to the buyer
    expect(result.lifestyle.credited).toBe(5);

    // Unilevel: L1 = parent (10% of 500 = 50), L2 = grandpa (8% of 500 = 40)
    expect(result.unilevel.levelsCredited).toBe(2);
    expect(result.unilevel.totalCredited).toBeCloseTo(90, 1);

    // Confirm lifestyle wallet entry is on the BUYER not the sponsor
    const buyerLedger = await repo.listWalletLedgerEntriesForUser('mb');
    expect(buyerLedger.some((e) => e.entryType === 'lifestyle_rewards')).toBe(true);

    const parentLedger = await repo.listWalletLedgerEntriesForUser('pa');
    expect(parentLedger.some((e) => e.entryType === 'unilevel')).toBe(true);
  });
});

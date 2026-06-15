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
    settledByUserId: null,
    pendingRecipientUserId: null,
    cashierUserId: null
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

describe('submitProductRepurchase — lifestyle inline, unilevel deferred to monthly batch', () => {
  it('credits lifestyle to the buyer immediately and defers unilevel (monthly)', async () => {
    const parentUser  = seedUser('pa', 'Parent', 'pa@yor.local');
    const memberUser  = seedUser('mb', 'Member', 'mb@yor.local');
    const parentMember = seedMember('pa', 'parent1', 'YOR-MEMBER-0002', 'Standard', 'Parent', null);
    const memberMember = seedMember('mb', 'member1', 'YOR-MEMBER-0003', 'Classic',  'Member', 'YOR-MEMBER-0002');
    const parentNetwork = { ...seedNetwork('pa', 'Standard', null), sponsorUserId: null };
    const memberNetwork = { ...seedNetwork('mb', 'Classic',  'pa'),  sponsorUserId: 'pa' };

    const repo = createInMemoryProductionEncodingRepository({
      users: [parentUser, memberUser],
      members: [parentMember, memberMember],
      networkAccounts: [parentNetwork, memberNetwork]
    });
    const svc = new ProductionEncodingService(repo);

    const result = await svc.submitProductRepurchase({
      memberUserId: 'mb',
      activationCodeValue: 'YOR-MAINT-0001',
      sku: 'YOR-PERFUME-HUGO-BOSS',
      memberPackageTier: 'Classic'
    });

    // Lifestyle posts inline to the buyer (1% of SRP 500 = 5).
    expect(result.lifestyle.credited).toBe(5);
    const buyerLedger = await repo.listWalletLedgerEntriesForUser('mb');
    expect(buyerLedger.some((e) => e.entryType === 'lifestyle_rewards')).toBe(true);

    // Unilevel is NOT credited inline anymore — it is settled by the monthly batch.
    expect(result.unilevel.levelsCredited).toBe(0);
    const parentLedgerInline = await repo.listWalletLedgerEntriesForUser('pa');
    expect(parentLedgerInline.some((e) => e.entryType === 'unilevel')).toBe(false);
  });
});

describe('reconcileMonthlyUnilevel — sponsor-tree monthly batch with 200-PV maintenance', () => {
  it('pays maintained earners a % of downline repurchase PV, and pays nothing to a non-maintaining earner', async () => {
    // Sponsor (bloodline) chain: buyer -> parent -> grandpa. Grandpa is NOT maintained.
    const repo = createInMemoryProductionEncodingRepository({
      users: [seedUser('gp', 'Grandpa', 'gp@yor.local'), seedUser('pa', 'Parent', 'pa@yor.local'), seedUser('mb', 'Member', 'mb@yor.local')],
      members: [
        seedMember('gp', 'grandpa1', 'YOR-MEMBER-0001', 'VIP', 'Grandpa', null),
        seedMember('pa', 'parent1', 'YOR-MEMBER-0002', 'Standard', 'Parent', 'YOR-MEMBER-0001'),
        seedMember('mb', 'member1', 'YOR-MEMBER-0003', 'Classic', 'Member', 'YOR-MEMBER-0002')
      ],
      networkAccounts: [
        { ...seedNetwork('gp', 'VIP', null), sponsorUserId: null },
        { ...seedNetwork('pa', 'Standard', 'gp'), sponsorUserId: 'gp' },
        { ...seedNetwork('mb', 'Classic', 'pa'), sponsorUserId: 'pa' }
      ]
    });
    const svc = new ProductionEncodingService(repo);
    const month = '2026-06';

    // Buyer accumulates 220 PV (11 products) — also satisfies their own maintenance.
    // Parent accumulates 200 PV (maintained). Grandpa accumulates 0 (NOT maintained).
    for (let i = 0; i < 11; i++) {
      await repo.insertRepurchase({
        id: `rb-${i}`, processKey: `rb-${i}`, userId: 'mb', productCode: 'YOR-PERFUME', productName: 'Yor Perfume',
        productType: 'perfume', quantity: 1, unitPrice: 350, srpPrice: 500, totalAmount: 350, pvEarned: 20,
        activationCode: `C-${i}`, transactionDate: `${month}-10T08:00:00.000Z`, createdAt: `${month}-10T08:00:00.000Z`
      });
    }
    for (let i = 0; i < 10; i++) {
      await repo.insertRepurchase({
        id: `rp-${i}`, processKey: `rp-${i}`, userId: 'pa', productCode: 'YOR-PERFUME', productName: 'Yor Perfume',
        productType: 'perfume', quantity: 1, unitPrice: 300, srpPrice: 500, totalAmount: 300, pvEarned: 20,
        activationCode: `P-${i}`, transactionDate: `${month}-11T08:00:00.000Z`, createdAt: `${month}-11T08:00:00.000Z`
      });
    }

    const res = await svc.reconcileMonthlyUnilevel(month);
    // Only parent earns: buyer has no downline; grandpa is not maintained (skipped).
    expect(res.earners).toBe(1);

    // Parent (maintained, 200 PV): earns L1 10% of buyer's 220 PV = 22.
    const parentLedger = await repo.listWalletLedgerEntriesForUser('pa');
    const parentUni = parentLedger.filter((e) => e.entryType === 'unilevel').reduce((s, e) => s + e.creditAmount, 0);
    expect(parentUni).toBeCloseTo(22, 2);

    // Grandpa is NOT maintained (0 PV) → earns nothing despite downline volume.
    const grandpaLedger = await repo.listWalletLedgerEntriesForUser('gp');
    expect(grandpaLedger.some((e) => e.entryType === 'unilevel')).toBe(false);

    // Idempotent: re-running the same month does not double-credit.
    await svc.reconcileMonthlyUnilevel(month);
    const parentUniAgain = (await repo.listWalletLedgerEntriesForUser('pa'))
      .filter((e) => e.entryType === 'unilevel').reduce((s, e) => s + e.creditAmount, 0);
    expect(parentUniAgain).toBeCloseTo(22, 2);
  });
});

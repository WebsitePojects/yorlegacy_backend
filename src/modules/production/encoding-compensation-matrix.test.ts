import { describe, expect, it } from 'vitest';
import { encodeReferralCode } from '../../lib/referral-utils.js';
import { packagePolicies } from '../compensation/mvp-service.js';
import {
  ProductionEncodingService,
  createInMemoryProductionEncodingRepository,
  normalizeFullName,
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
  placementSide: ProductionNetworkAccount['placementSide']
): ProductionNetworkAccount {
  return {
    userId,
    sponsorUserId,
    directReferrerUserId: sponsorUserId,
    placementParentUserId,
    placementSide,
    currentAccountTypeCode: packageTier === 'Business' || packageTier === 'VIP' ? 2 : 1,
    currentAccountType: packageTier === 'Business' || packageTier === 'VIP' ? 'FS' : 'PD',
    packageTier,
    activationCode: null,
    registrationStatus: 'active',
    leftPoints: 0,
    rightPoints: 0,
    createdAt: '2026-06-08T09:00:00.000Z'
  };
}

describe('Production encoding compensation matrix', () => {
  it('keeps package source-of-truth aligned to BUSINESSRULE values and phase-1 PV/BP handling', async () => {
    const expected = [
      { code: 'BASIC', price: 1998, pv: 5, directReferralBonus: 200, salesmatchValue: 250, weeklyCap: 5000, monthlyCap: 20000, binaryCyclePercent: null },
      { code: 'CLASSIC', price: 5998, pv: 10, directReferralBonus: 1000, salesmatchValue: 500, weeklyCap: 20000, monthlyCap: 80000, binaryCyclePercent: 2 },
      { code: 'STANDARD', price: 25998, pv: 50, directReferralBonus: 5000, salesmatchValue: 2500, weeklyCap: 60000, monthlyCap: 240000, binaryCyclePercent: 3 },
      { code: 'BUSINESS', price: 50998, pv: 100, directReferralBonus: 7000, salesmatchValue: 5000, weeklyCap: 120000, monthlyCap: 480000, binaryCyclePercent: 4 },
      { code: 'VIP', price: 159998, pv: 300, directReferralBonus: 15000, salesmatchValue: 15000, weeklyCap: 300000, monthlyCap: 1200000, binaryCyclePercent: 5 }
    ] as const;

    for (const row of expected) {
      const policy = packagePolicies.find((item) => item.code === row.code);
      expect(policy).toBeDefined();
      expect(policy).toMatchObject({
        code: row.code,
        price: row.price,
        pv: row.pv,
        directReferralBonus: row.directReferralBonus,
        salesmatchValue: row.salesmatchValue,
        weeklySalesmatchCap: row.weeklyCap,
        monthlySalesmatchCap: row.monthlyCap
      });
      expect(policy?.binaryCyclePercent ?? null).toBe(row.binaryCyclePercent);
      expect(policy?.pv).toBe(row.pv);
    }
  });

  it.each([
    { packageTier: 'Basic' as const, expectedDr: 200, expectedSalesmatch: 250, expectedPoints: 5, expectedBinaryCycle: 0, expectedGetFive: 0 },
    { packageTier: 'Classic' as const, expectedDr: 1000, expectedSalesmatch: 500, expectedPoints: 10, expectedBinaryCycle: 10, expectedGetFive: 5998 },
    { packageTier: 'Standard' as const, expectedDr: 5000, expectedSalesmatch: 2500, expectedPoints: 50, expectedBinaryCycle: 75, expectedGetFive: 25998 },
    { packageTier: 'Business' as const, expectedDr: 7000, expectedSalesmatch: 5000, expectedPoints: 100, expectedBinaryCycle: 200, expectedGetFive: 50998 },
    { packageTier: 'VIP' as const, expectedDr: 15000, expectedSalesmatch: 15000, expectedPoints: 300, expectedBinaryCycle: 750, expectedGetFive: 159998 }
  ])(
    'posts the expected phase-1 compensation basis for $packageTier registration',
    async ({ packageTier, expectedDr, expectedSalesmatch, expectedPoints, expectedBinaryCycle, expectedGetFive }) => {
      const sponsorUser = seedUser('sponsor-user', 'Sponsor', 'sponsor@yor.local');
      const sponsorMember = seedMember(
        'sponsor-user',
        'YOR0001',
        encodeReferralCode('YOR0001'),
        packageTier,
        'Sponsor Member'
      );
      const adminUser = seedUser('admin-user', 'Admin', 'admin@yor.local', 'admin');
      const repo = createInMemoryProductionEncodingRepository({
        users: [adminUser, sponsorUser],
        members: [sponsorMember],
        networkAccounts: [seedNetwork('sponsor-user', packageTier, null, null, null)],
        salesmatchBalances: [
          {
            userId: 'sponsor-user',
            leftSales: 0,
            rightSales: expectedSalesmatch,
            matchedSales: 0,
            leftPoints: 0,
            rightPoints: expectedPoints,
            matchedPoints: 0,
            updatedAt: '2026-06-08T09:00:00.000Z'
          }
        ]
      });
      const service = new ProductionEncodingService(repo);

      await service.generateActivationCodes(
        { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' },
        { quantity: 1, packageTier, assignedTo: 'YOR0001', accountType: 'PD' }
      );

      const [generatedCode] = await repo.listActivationCodes();
      expect(generatedCode.lockedDirectReferralBonus).toBe(expectedDr);
      expect(generatedCode.lockedSalesmatchValue).toBe(expectedSalesmatch);
      expect(generatedCode.lockedBinaryPoints).toBe(expectedPoints);
      expect(generatedCode.lockedGetFiveAmount).toBe(expectedGetFive);

      await service.releaseActivationCodes(
        { id: 'admin-user', name: 'Admin', email: 'admin@yor.local', role: 'admin' },
        [generatedCode.code]
      );

      const reservation = await service.createPlacementReservation(
        { id: 'sponsor-user', name: 'Sponsor', email: 'sponsor@yor.local', role: 'member' },
        { placementParentUsername: 'YOR0001', placementSide: 'left' }
      );

      await service.submitRegistration(null, {
        origin: 'referral-link',
        fullName: `${packageTier} Prospect`,
        username: `${packageTier.toLowerCase()}Prospect`,
        phone: '+63 999 111 1111',
        password: 'Password123!',
        referralCode: encodeReferralCode('YOR0001'),
        activationCode: generatedCode.code,
        placementToken: reservation.reservation.shareToken
      });

      const sponsorLedgerAfterSubmit = await repo.listWalletLedgerEntriesForUser('sponsor-user');
      expect(sponsorLedgerAfterSubmit.find((entry) => entry.entryType === 'direct_referral')?.creditAmount).toBe(expectedDr);

      await service.processCompensationQueue();

      const sponsorLedgerAfterQueue = await repo.listWalletLedgerEntriesForUser('sponsor-user');
      expect(sponsorLedgerAfterQueue.find((entry) => entry.entryType === 'salesmatch')?.creditAmount).toBe(expectedSalesmatch);

      const binaryEntry = sponsorLedgerAfterQueue.find((entry) => entry.entryType === 'binary_cycle');
      if (expectedBinaryCycle === 0) {
        expect(binaryEntry).toBeUndefined();
      } else {
        expect(binaryEntry?.creditAmount).toBe(expectedBinaryCycle);
      }
    }
  );
});

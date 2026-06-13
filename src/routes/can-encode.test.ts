import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import {
  findSandboxMemberByUsername,
  listSandboxWalletLedger,
  resetSandboxState
} from '../modules/sandbox/dev-sandbox-store.js';
import { encodeReferralCode } from '../lib/referral-utils.js';

function getCookieValue(cookieHeader: string | string[] | undefined, key: string): string | null {
  const values = Array.isArray(cookieHeader) ? cookieHeader : cookieHeader ? [cookieHeader] : [];
  for (const value of values) {
    const token = value.split(';')[0];
    const [name, ...rest] = token.split('=');
    if (name === key) {
      return rest.join('=');
    }
  }
  return null;
}

function buildCookieHeader(setCookie: string[] | string | undefined): string[] {
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return values.map((value) => value.split(';')[0]);
}

async function loginAsMember() {
  const response = await request(app).post('/api/auth/login').send({
    username: 'yor01',
    password: '1'
  });

  expect(response.status).toBe(200);
  return response.headers['set-cookie'][0] as string;
}

describe('Can Encode registration flow', () => {
  beforeEach(() => {
    resetSandboxState();
  });

  it('builds a referral-link registration path with the sponsor attached in the link context', async () => {
    const cookie = await loginAsMember();
    const response = await request(app)
      .get('/api/member/registration-readiness')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.referralLink).toContain('/register?');
    expect(response.body.referralLink).toContain('origin=referral-link');
    expect(response.body.referralLink).toContain('ref=' + encodeReferralCode('yor01'));
    expect(response.body.referralLink).not.toContain('packageTier=');
    expect(response.body.referralLink).not.toContain('preferredSide=');
    expect(response.body.placementPolicy.mode).toBe('auto-balanced');
  });

  it('keeps manual slot placement separate from sponsor truth during preview', async () => {
    const cookie = await loginAsMember();
    const response = await request(app).post('/api/registration/preview').set('Cookie', cookie).send({
      origin: 'genealogy-slot',
      fullName: 'Manual Placement Prospect',
      username: 'YOR0101',
      email: 'manual.placement@example.test',
      phone: '+63 900 111 2200',
      password: 'Sandbox123!',
      activationCode: 'PDSTK7V2LC',
      placementParentUsername: 'YOR0003',
      placementSide: 'left'
    });

    expect(response.status).toBe(200);
    expect(response.body.canProceed).toBe(true);
    expect(response.body.sponsor.username).toBe('yor01');
    expect(response.body.placement).toMatchObject({
      placementUsername: 'YOR0003',
      placementSide: 'left'
    });
  });

  it('blocks manual slot placement when the chosen side is already occupied', async () => {
    const cookie = await loginAsMember();
    const response = await request(app).post('/api/registration/preview').set('Cookie', cookie).send({
      origin: 'genealogy-slot',
      fullName: 'Blocked Placement Prospect',
      username: 'YOR0102',
      email: 'blocked.placement@example.test',
      phone: '+63 900 111 2201',
      password: 'Sandbox123!',
      activationCode: 'PDSTK7V2LC',
      placementParentUsername: 'YOR0002',
      placementSide: 'left'
    });

    expect(response.status).toBe(200);
    expect(response.body.canProceed).toBe(false);
    expect(response.body.issues).toContain('Placement side LEFT is already occupied under YOR0002.');
  });

  it('credits the sponsor and propagates binary points from the actual manual placement parent on submit', async () => {
    const cookie = await loginAsMember();
    const sponsorBefore = findSandboxMemberByUsername('yor01');
    const placementParentBefore = findSandboxMemberByUsername('YOR0003');

    expect(sponsorBefore).not.toBeNull();
    expect(placementParentBefore).not.toBeNull();

    const sponsorWalletBefore = sponsorBefore!.walletAvailable;
    const sponsorRightPointsBefore = sponsorBefore!.rightPoints;
    const placementParentLeftPointsBefore = placementParentBefore!.leftPoints;

    const response = await request(app).post('/api/registration/submit').set('Cookie', cookie).send({
      origin: 'genealogy-slot',
      fullName: 'Creditation Flow Prospect',
      username: 'YOR0103',
      email: 'creditation.flow@example.test',
      phone: '+63 900 111 2202',
      password: 'Sandbox123!',
      activationCode: 'PDSTK7V2LC',
      placementParentUsername: 'YOR0003',
      placementSide: 'left'
    });

    expect(response.status).toBe(200);
    expect(response.body.createdMember).toBeDefined();
    expect(response.body.createdMember.sponsorUsername).toBe('yor01');

    const createdMember = findSandboxMemberByUsername(response.body.createdMember.username);
    const sponsorAfter = findSandboxMemberByUsername('yor01');
    const placementParentAfter = findSandboxMemberByUsername('YOR0003');
    const sponsorLedger = listSandboxWalletLedger('yor01').find(
      (entry) =>
        entry.entryType === 'direct_referral' &&
        entry.sourceReference === response.body.createdMember.username
    );

    expect(createdMember).not.toBeNull();
    expect(createdMember).toMatchObject({
      sponsorCode: encodeReferralCode('yor01'),
      placementParentUsername: 'YOR0003',
      placement: 'left'
    });
    expect(sponsorAfter!.walletAvailable).toBe(sponsorWalletBefore + 5000);
    expect(placementParentAfter!.leftPoints).toBe(placementParentLeftPointsBefore + 10);
    expect(sponsorAfter!.rightPoints).toBe(sponsorRightPointsBefore + 10);
    expect(sponsorLedger).toMatchObject({
      creditAmount: 5000,
      memberUsername: 'yor01'
    });
  }, 15000);

  it('shows the newly encoded member in the clicked genealogy slot after submit', async () => {
    const cookie = await loginAsMember();

    const response = await request(app).post('/api/registration/submit').set('Cookie', cookie).send({
      origin: 'genealogy-slot',
      fullName: 'Visible Tree Prospect',
      username: 'YOR0104',
      email: 'visible.tree@example.test',
      phone: '+63 900 111 2204',
      password: 'Sandbox123!',
      activationCode: 'PDSTK7V2LC',
      placementParentUsername: 'YOR0003',
      placementSide: 'left'
    });

    expect(response.status).toBe(200);

    const treeResponse = await request(app)
      .get('/api/member/genealogy/binary-tree?rootUsername=YOR0003')
      .set('Cookie', cookie);

    expect(treeResponse.status).toBe(200);
    expect(treeResponse.body.root.username).toBe('YOR0003');
    expect(treeResponse.body.nodes.some((node: { username: string; placement: string; parentNodeId: string | null }) =>
      node.username === 'YOR0104' && node.placement === 'left' && node.parentNodeId === 'YOR0003-L'
    )).toBe(true);
  });

  it('preserves the typed username casing during genealogy-slot registration', async () => {
    const cookie = await loginAsMember();

    const response = await request(app).post('/api/registration/submit').set('Cookie', cookie).send({
      origin: 'genealogy-slot',
      fullName: 'Mixed Case Prospect',
      username: 'yorCaseOne',
      email: 'mixed.case@example.test',
      phone: '+63 900 111 2299',
      password: 'Sandbox123!',
      activationCode: 'PDSTK7V2LC',
      placementParentUsername: 'YOR0003',
      placementSide: 'left'
    });

    expect(response.status).toBe(200);
    expect(response.body.createdMember.username).toBe('yorCaseOne');
    expect(findSandboxMemberByUsername('yorCaseOne')?.username).toBe('yorCaseOne');
  });

  it('posts salesmatch and binary cycle after opposite-side directs complete a pair on the same account', async () => {
    const cookie = await loginAsMember();

    const firstResponse = await request(app).post('/api/registration/submit').set('Cookie', cookie).send({
      origin: 'genealogy-slot',
      fullName: 'Pair Left Prospect',
      username: 'YOR0110',
      email: 'pair.left@example.test',
      phone: '+63 900 111 2300',
      password: 'Sandbox123!',
      activationCode: 'PDSTK7V2LC',
      placementParentUsername: 'yorinternational',
      placementSide: 'left'
    });

    expect(firstResponse.status).toBe(200);

    const superadminLogin = await request(app).post('/api/auth/login').send({
      username: 'yoradmin',
      password: '1'
    });
    expect(superadminLogin.status).toBe(200);
    const superadminCookies = buildCookieHeader(superadminLogin.headers['set-cookie']);

    const inventoryBefore = await request(app)
      .get('/api/admin/activation-codes')
      .set('Cookie', superadminCookies);
    expect(inventoryBefore.status).toBe(200);
    const existingCodes = new Set(
      inventoryBefore.body.inventory.map((item: { code: string }) => item.code)
    );

    const generateResponse = await request(app)
      .post('/api/admin/activation-codes/generate')
      .set('Cookie', superadminCookies)
      .set('x-yor-csrf-token', getCookieValue(superadminCookies, 'yor_csrf') ?? '')
      .send({
        quantity: 1,
        packageTier: 'Standard',
        accountType: 'PD',
        assignedTo: 'yor01'
      });

    expect(generateResponse.status).toBe(200);

    const inventoryAfter = await request(app)
      .get('/api/admin/activation-codes')
      .set('Cookie', superadminCookies);
    expect(inventoryAfter.status).toBe(200);
    const generatedCode = inventoryAfter.body.inventory.find(
      (item: { code: string; assignedTo: string; packageTier: string; status: string }) =>
        !existingCodes.has(item.code) &&
        item.assignedTo === 'yor01' &&
        item.packageTier === 'Standard' &&
        item.status === 'available'
    );
    expect(generatedCode).toBeTruthy();

    const secondResponse = await request(app).post('/api/registration/submit').set('Cookie', cookie).send({
      origin: 'genealogy-slot',
      fullName: 'Pair Right Prospect',
      username: 'YOR0111',
      email: 'pair.right@example.test',
      phone: '+63 900 111 2301',
      password: 'Sandbox123!',
      activationCode: generatedCode.code,
      placementParentUsername: 'yorinternational',
      placementSide: 'right'
    });

    expect(secondResponse.status).toBe(200);

    const rootLedger = listSandboxWalletLedger('yorinternational');
    expect(rootLedger.some((entry) => entry.entryType === 'salesmatch' && entry.sourceReference === 'YOR0111' && entry.creditAmount === 2500)).toBe(true);
    expect(rootLedger.some((entry) => entry.entryType === 'binary_cycle' && entry.sourceReference === 'YOR0111' && entry.creditAmount === 125)).toBe(true);
  });
});

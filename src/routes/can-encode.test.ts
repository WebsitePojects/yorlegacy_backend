import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import {
  findSandboxMemberByUsername,
  listSandboxWalletLedger,
  resetSandboxState
} from '../modules/sandbox/dev-sandbox-store.js';

async function loginAsMember() {
  const response = await request(app).post('/api/auth/login').send({
    username: 'YOR0001',
    password: 'YorMember123!'
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
    expect(response.body.referralLink).toContain('ref=YOR-MEMBER-001');
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
    expect(response.body.sponsor.username).toBe('YOR0001');
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
    const sponsorBefore = findSandboxMemberByUsername('YOR0001');
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
    expect(response.body.createdMember.sponsorUsername).toBe('YOR0001');

    const createdMember = findSandboxMemberByUsername(response.body.createdMember.username);
    const sponsorAfter = findSandboxMemberByUsername('YOR0001');
    const placementParentAfter = findSandboxMemberByUsername('YOR0003');
    const sponsorLedger = listSandboxWalletLedger('YOR0001').find(
      (entry) =>
        entry.entryType === 'direct_referral' &&
        entry.sourceReference === response.body.createdMember.username
    );

    expect(createdMember).not.toBeNull();
    expect(createdMember).toMatchObject({
      sponsorCode: 'YOR-MEMBER-001',
      placementParentUsername: 'YOR0003',
      placement: 'left'
    });
    expect(sponsorAfter!.walletAvailable).toBe(sponsorWalletBefore + 5000);
    expect(placementParentAfter!.leftPoints).toBe(placementParentLeftPointsBefore + 5000);
    expect(sponsorAfter!.rightPoints).toBe(sponsorRightPointsBefore + 5000);
    expect(sponsorLedger).toMatchObject({
      creditAmount: 5000,
      memberUsername: 'YOR0001'
    });
  });
});

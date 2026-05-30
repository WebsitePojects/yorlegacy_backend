import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { resetSandboxState } from '../modules/sandbox/dev-sandbox-store.js';

async function login(email = 'member@yor.local', password = 'YorMember123!') {
  const response = await request(app).post('/api/auth/login').send({ email, password });

  expect(response.status).toBe(200);
  return response.headers['set-cookie'][0];
}

describe('Yor MVP compensation APIs', () => {
  beforeEach(() => {
    resetSandboxState();
  });

  it('serves the public compensation policy with Yor package values in sandbox mode', async () => {
    const response = await request(app).get('/api/compensation/policy');

    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('sandbox');
    expect(response.body.packages.map((pkg: { code: string }) => pkg.code)).toEqual([
      'CLASSIC',
      'BASIC',
      'STANDARD',
      'BUSINESS',
      'VIP'
    ]);
    expect(response.body.packages[0]).toMatchObject({
      code: 'CLASSIC',
      name: 'Classic',
      price: 1998,
      pv: 5,
      directReferralBonus: 200
    });
    expect(response.body.packages[1]).toMatchObject({
      code: 'BASIC',
      name: 'Basic',
      price: 5998,
      pv: 10,
      directReferralBonus: 1000
    });
    expect(response.body.packages.find((pkg: { code: string }) => pkg.code === 'VIP').price).toBe(159998);
    expect(response.body.unresolvedDecisions.length).toBeGreaterThan(0);
  });

  it('lists all eight earning streams with sandbox mode surfaced across the policy layer', async () => {
    const response = await request(app).get('/api/compensation/streams');

    expect(response.status).toBe(200);
    expect(response.body.streams).toHaveLength(8);
    expect(response.body.streams.every((stream: { writeStatus: string }) => stream.writeStatus === 'sandbox')).toBe(true);
    expect(response.body.streams.map((stream: { id: string }) => stream.id)).toContain('salesmatch');
  });

  it('returns member income simulations, wallet separation, genealogy, shadow accounts, and parity operating surfaces behind auth', async () => {
    const cookie = await login();

    const [
      dashboard,
      income,
      wallets,
      walletDetail,
      sponsor,
      binary,
      binaryTree,
      sponsorTree,
      shadows,
      codes,
      transactions,
      transactionDetail,
      registrationReadiness,
      publicRegistrationPreview,
      publicRegistrationSubmit,
      encashPreview,
      gatedEncash
    ] = await Promise.all([
      request(app).get('/api/member/dashboard').set('Cookie', cookie),
      request(app).get('/api/member/income/salesmatch').set('Cookie', cookie),
      request(app).get('/api/member/wallets').set('Cookie', cookie),
      request(app).get('/api/member/wallet-detail').set('Cookie', cookie),
      request(app).get('/api/member/genealogy/sponsor').set('Cookie', cookie),
      request(app).get('/api/member/genealogy/binary').set('Cookie', cookie),
      request(app).get('/api/member/genealogy/binary-tree').set('Cookie', cookie),
      request(app).get('/api/member/genealogy/sponsor-tree').set('Cookie', cookie),
      request(app).get('/api/member/shadow-accounts').set('Cookie', cookie),
      request(app).get('/api/member/activation-codes').set('Cookie', cookie),
      request(app).get('/api/member/transactions').set('Cookie', cookie),
      request(app).get('/api/member/transactions/WALLET-001').set('Cookie', cookie),
      request(app).get('/api/member/registration-readiness').set('Cookie', cookie),
      request(app).post('/api/registration/preview').send({
        fullName: 'Sandbox Member',
        email: 'sandbox.member@example.test',
        phone: '+63 900 000 0111',
        password: 'Sandbox123!',
        sponsorCode: 'YOR-MEMBER-001',
        packageTier: 'standard',
        preferredSide: 'left'
      }),
      request(app).post('/api/registration/submit').send({
        fullName: 'Sandbox Member',
        email: 'sandbox.member@example.test',
        phone: '+63 900 000 0111',
        password: 'Sandbox123!',
        sponsorCode: 'YOR-MEMBER-001',
        packageTier: 'standard',
        preferredSide: 'left'
      }),
      request(app).post('/api/member/wallet/preview-encash').set('Cookie', cookie).send({ amount: 5000 }),
      request(app).post('/api/member/wallet/encash').set('Cookie', cookie).send({ amount: 5000 })
    ]);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.moneyMode).toBe('sandbox');
    expect(dashboard.body.incomeStreams).toHaveLength(8);

    expect(income.status).toBe(200);
    expect(income.body.streamId).toBe('salesmatch');
    expect(income.body.writeStatus).toBe('sandbox');
    expect(income.body.calculationTrace.length).toBeGreaterThan(0);

    expect(wallets.status).toBe(200);
    expect(wallets.body.wallets.map((wallet: { type: string }) => wallet.type)).toEqual([
      'main',
      'lifestyle',
      'product',
      'pending',
      'encashment'
    ]);
    expect(walletDetail.status).toBe(200);
    expect(walletDetail.body.summary.availableBalance).toBeGreaterThan(0);
    expect(walletDetail.body.preview.netReceivable).toBeGreaterThan(0);

    expect(sponsor.status).toBe(200);
    expect(sponsor.body.treeType).toBe('sponsor');
    expect(binary.status).toBe(200);
    expect(binary.body.treeType).toBe('binary-placement');
    expect(binaryTree.status).toBe(200);
    expect(binaryTree.body.root.nodeId).toBe('YOR0001');
    expect(binaryTree.body.nodes.length).toBeGreaterThan(1);
    expect(binaryTree.body.root.openSlots.left).toBe(false);
    expect(binaryTree.body.root.openSlots.right).toBe(false);
    expect(sponsorTree.status).toBe(200);
    expect(sponsorTree.body.treeType).toBe('sponsor');
    expect(shadows.status).toBe(200);
    expect(shadows.body.accounts.map((account: { state: string }) => account.state)).toContain('reserved_shadow');
    expect(codes.status).toBe(200);
    expect(codes.body.inventory.length).toBeGreaterThan(0);
    expect(transactions.status).toBe(200);
    expect(transactions.body.transactions.length).toBeGreaterThan(0);
    expect(transactionDetail.status).toBe(200);
    expect(transactionDetail.body.transaction.support.notes.length).toBeGreaterThan(0);
    expect(registrationReadiness.status).toBe(200);
    expect(registrationReadiness.body.availableCodes.length).toBeGreaterThan(0);
    expect(publicRegistrationPreview.status).toBe(200);
    expect(publicRegistrationPreview.body.canProceed).toBe(true);
    expect(publicRegistrationPreview.body.matchingCode.code).toBe('YOR-ACT-1003');
    expect(publicRegistrationSubmit.status).toBe(200);
    expect(publicRegistrationSubmit.body.createdMember.username).toMatch(/^YOR/);
    expect(encashPreview.status).toBe(200);
    expect(encashPreview.body.preview.netReceivable).toBeGreaterThan(0);
    expect(gatedEncash.status).toBe(200);
    expect(gatedEncash.body.status).toBe('completed');
  });

  it('serves admin compensation review surfaces, parity consoles, and accepts sandbox money writes', async () => {
    const cookie = await login('yoradmin@gmail.com', '1');

    const [
      dashboard,
      members,
      simulations,
      ledger,
      payouts,
      codeCenter,
      encashments,
      genealogyTree,
      sponsorGenealogyTree,
      gatedWrite,
      gatedCodes,
      gatedEncashment
    ] = await Promise.all([
      request(app).get('/api/admin/dashboard').set('Cookie', cookie),
      request(app).get('/api/admin/members').set('Cookie', cookie),
      request(app).get('/api/admin/compensation/simulations').set('Cookie', cookie),
      request(app).get('/api/admin/wallet-ledger').set('Cookie', cookie),
      request(app).get('/api/admin/payouts').set('Cookie', cookie),
      request(app).get('/api/admin/activation-codes').set('Cookie', cookie),
      request(app).get('/api/admin/encashments').set('Cookie', cookie),
      request(app).get('/api/admin/genealogy/binary-tree').set('Cookie', cookie),
      request(app).get('/api/admin/genealogy/sponsor-tree?rootUsername=YOR-MEMBER-001').set('Cookie', cookie),
      request(app).post('/api/admin/payouts/approve').set('Cookie', cookie).send({ payoutId: 'ENC-20260524-001' }),
      request(app).post('/api/admin/activation-codes/generate').set('Cookie', cookie).send({ quantity: 5 }),
      request(app).post('/api/admin/encashments/ENC-20260524-001/approve').set('Cookie', cookie)
    ]);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.moneyMode).toBe('sandbox');
    expect(members.status).toBe(200);
    expect(members.body.members.length).toBeGreaterThan(0);
    expect(simulations.status).toBe(200);
    expect(simulations.body.simulations).toHaveLength(8);
    expect(ledger.status).toBe(200);
    expect(ledger.body.entries.length).toBeGreaterThan(0);
    expect(payouts.status).toBe(200);
    expect(payouts.body.payouts[0].status).toMatch(/sandbox|review|pending|approved|released/i);
    expect(codeCenter.status).toBe(200);
    expect(codeCenter.body.metrics.availableCodes).toBeGreaterThanOrEqual(0);
    expect(encashments.status).toBe(200);
    expect(encashments.body.encashments.length).toBeGreaterThan(0);
    expect(genealogyTree.status).toBe(200);
    expect(genealogyTree.body.root.nodeId).toBe('YOR0001');
    expect(sponsorGenealogyTree.status).toBe(200);
    expect(sponsorGenealogyTree.body.treeType).toBe('sponsor');
    expect(gatedWrite.status).toBe(200);
    expect(gatedWrite.body.moneyMode).toBe('sandbox');
    expect(gatedCodes.status).toBe(200);
    expect(gatedEncashment.status).toBe(200);
  });

  it('resets the branch-local sandbox runtime for a fresh destructive test pass', async () => {
    const memberCookie = await login();
    await request(app).post('/api/member/wallet/encash').set('Cookie', memberCookie).send({ amount: 5000 });

    const superadminCookie = await login('yoradmin@gmail.com', '1');
    const resetResponse = await request(app)
      .post('/api/admin/sandbox/reset')
      .set('Cookie', superadminCookie);

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.moneyMode).toBe('sandbox');
    expect(resetResponse.body.status).toBe('completed');

    const walletAfterReset = await request(app)
      .get('/api/member/wallet-detail')
      .set('Cookie', memberCookie);

    expect(walletAfterReset.status).toBe(200);
    expect(walletAfterReset.body.summary.availableBalance).toBeCloseTo(15200.75, 2);
  });
});

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { resetSandboxState } from '../modules/sandbox/dev-sandbox-store.js';

function getUsernameFromEmail(email: string): string {
  const norm = email.toLowerCase().trim();
  if (norm === 'yoradmin@gmail.com') return 'yorsuperadmin';
  if (norm === 'yormember@gmail.com') return 'yormember';
  if (norm === 'yorcashier@gmail.com') return 'yorcashier_legacy';
  if (norm === 'yorbod@gmail.com') return 'yorbod_legacy';
  if (norm === 'admin@yor.local') return 'yoradmin';
  if (norm === 'cashier@yor.local') return 'yorcashier';
  if (norm === 'bod@yor.local') return 'yorbod';
  if (norm === 'member@yor.local') return 'YOR0001';
  return email.split('@')[0];
}

async function login(email = 'member@yor.local', password = 'YorMember123!') {
  const username = getUsernameFromEmail(email);
  const response = await request(app).post('/api/auth/login').send({ username, password });

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
      'BASIC',
      'CLASSIC',
      'STANDARD',
      'BUSINESS',
      'VIP'
    ]);
    expect(response.body.packages[0]).toMatchObject({
      code: 'BASIC',
      name: 'Basic',
      price: 1998,
      pv: 5,
      directReferralBonus: 200
    });
    expect(response.body.packages[1]).toMatchObject({
      code: 'CLASSIC',
      name: 'Classic',
      price: 5998,
      pv: 10,
      directReferralBonus: 1000
    });
    expect(response.body.packages.find((pkg: { code: string }) => pkg.code === 'VIP').price).toBe(159998);
    expect(response.body.unresolvedDecisions.length).toBeGreaterThan(0);
  });

  it('lists all seven earning streams with sandbox mode surfaced across the policy layer', async () => {
    const response = await request(app).get('/api/compensation/streams');

    expect(response.status).toBe(200);
    expect(response.body.streams).toHaveLength(7);
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
        origin: 'referral-link',
        fullName: 'Sandbox Member',
        username: 'YOR0104',
        email: 'sandbox.member@example.test',
        phone: '+63 900 000 0111',
        password: 'Sandbox123!',
        referralCode: 'YOR-MEMBER-001',
        activationCode: 'PDSTK7V2LC'
      }),
      request(app).post('/api/registration/submit').send({
        origin: 'referral-link',
        fullName: 'Sandbox Member',
        username: 'YOR0104',
        email: 'sandbox.member@example.test',
        phone: '+63 900 000 0111',
        password: 'Sandbox123!',
        referralCode: 'YOR-MEMBER-001',
        activationCode: 'PDSTK7V2LC'
      }),
      request(app).post('/api/member/wallet/preview-encash').set('Cookie', cookie).send({ amount: 5000 }),
      request(app).post('/api/member/wallet/encash').set('Cookie', cookie).send({ amount: 5000 })
    ]);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.moneyMode).toBe('sandbox');
    expect(dashboard.body.incomeStreams).toHaveLength(7);

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
    expect(walletDetail.body.preview.requestedAmount).toBe(0);
    expect(walletDetail.body.preview.netReceivable).toBe(0);

    expect(sponsor.status).toBe(200);
    expect(sponsor.body.treeType).toBe('sponsor');
    expect(binary.status).toBe(200);
    expect(binary.body.treeType).toBe('binary-placement');
    expect(binaryTree.status).toBe(200);
    expect(binaryTree.body.root.nodeId).toBe('YOR0001');
    expect(binaryTree.body.nodes.length).toBeGreaterThan(1);
    expect(binaryTree.body.root.openSlots.left).toBe(false);
    expect(binaryTree.body.root.openSlots.right).toBe(false);
    expect(binaryTree.body.root.shadowSlots.left).toMatchObject({
      label: 'Shadow account',
      state: 'reserved_shadow',
      activationStatus: 'inactive',
      registrationEnabled: false,
      walletEnabled: false,
      unilevelEnabled: false
    });
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
    expect(publicRegistrationPreview.body.matchingCode.code).toMatch(/^PDST[A-Z0-9]+$/);
    expect(publicRegistrationSubmit.status).toBe(200);
    expect(publicRegistrationSubmit.body.createdMember.username).toMatch(/^YOR/);
    expect(publicRegistrationSubmit.body.createdMember.referralCode).toMatch(/^YOR-MEMBER-\d+$/);
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
    expect(simulations.body.simulations).toHaveLength(7);
    expect(ledger.status).toBe(200);
    expect(ledger.body.entries.length).toBeGreaterThan(0);
    expect(payouts.status).toBe(200);
    expect(payouts.body.payouts[0].status).toMatch(/sandbox|review|pending|approved|released|paid/i);
    expect(codeCenter.status).toBe(200);
    expect(codeCenter.body.metrics.availableCodes).toBeGreaterThanOrEqual(0);
    expect(encashments.status).toBe(200);
    expect(encashments.body.encashments.length).toBeGreaterThan(0);
    expect(genealogyTree.status).toBe(200);
    expect(genealogyTree.body.root.nodeId).toBe('YOR0001');
    expect(genealogyTree.body.root.shadowSlots.right).toMatchObject({
      label: 'Shadow account',
      state: 'reserved_shadow',
      registrationEnabled: false,
      binaryCycleEnabled: false
    });
    expect(sponsorGenealogyTree.status).toBe(200);
    expect(sponsorGenealogyTree.body.treeType).toBe('sponsor');
    expect(gatedWrite.status).toBe(200);
    expect(gatedWrite.body.moneyMode).toBe('sandbox');
    expect(gatedCodes.status).toBe(200);
    expect(gatedEncashment.status).toBe(200);
  });

  it('runs the admin release-transfer-registration lifecycle through the sandbox code inventory', async () => {
    const adminCookie = await login('admin@yor.local', 'YorAdmin123!');
    const inventoryBefore = await request(app)
      .get('/api/admin/activation-codes')
      .set('Cookie', adminCookie);

    expect(inventoryBefore.status).toBe(200);

    const existingCodes = new Set(
      inventoryBefore.body.inventory.map((item: { code: string }) => item.code)
    );

    const generateResponse = await request(app)
      .post('/api/admin/activation-codes/generate')
      .set('Cookie', adminCookie)
      .send({
        quantity: 1,
        packageTier: 'Standard',
        assignedTo: 'YOR0003'
      });

    expect(generateResponse.status).toBe(200);
    expect(generateResponse.body.status).toBe('completed');

    const inventoryAfterGenerate = await request(app)
      .get('/api/admin/activation-codes')
      .set('Cookie', adminCookie);

    expect(inventoryAfterGenerate.status).toBe(200);

    const generatedCode = inventoryAfterGenerate.body.inventory.find(
      (item: { code: string; assignedTo: string; packageTier: string; status: string }) =>
        !existingCodes.has(item.code) &&
        item.assignedTo === 'YOR0003' &&
        item.packageTier === 'Standard'
    );

    expect(generatedCode).toBeTruthy();
    if (!generatedCode) {
      throw new Error('Expected a newly generated admin activation code.');
    }

    expect(generatedCode.status).toBe('unreleased');

    const releaseResponse = await request(app)
      .post('/api/admin/activation-codes/release')
      .set('Cookie', adminCookie)
      .send({ codes: [generatedCode.code] });

    expect(releaseResponse.status).toBe(200);
    expect(releaseResponse.body.status).toBe('completed');

    const transferResponse = await request(app)
      .post('/api/admin/activation-codes/transfer')
      .set('Cookie', adminCookie)
      .send({
        targetUsername: 'YOR0001',
        codes: [generatedCode.code]
      });

    expect(transferResponse.status).toBe(200);
    expect(transferResponse.body.status).toBe('completed');

    const memberCookie = await login();
    const memberCodes = await request(app)
      .get('/api/member/activation-codes')
      .set('Cookie', memberCookie);

    expect(memberCodes.status).toBe(200);
    expect(
      memberCodes.body.inventory.some(
        (item: { code: string; visibility: string }) =>
          item.code === generatedCode.code && item.visibility === 'released-by-sponsor'
      )
    ).toBe(true);

    const previewResponse = await request(app).post('/api/registration/preview').send({
      origin: 'referral-link',
      fullName: 'Transferred Code Prospect',
      username: 'YOR0105',
      email: 'transferred.code.prospect@example.test',
      phone: '+63 900 000 0222',
      password: 'Sandbox123!',
      referralCode: 'YOR-MEMBER-001',
      activationCode: generatedCode.code
    });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.canProceed).toBe(true);
    expect(previewResponse.body.matchingCode.code).toBe(generatedCode.code);

    const submitResponse = await request(app).post('/api/registration/submit').send({
      origin: 'referral-link',
      fullName: 'Transferred Code Prospect',
      username: 'YOR0105',
      email: 'transferred.code.prospect@example.test',
      phone: '+63 900 000 0222',
      password: 'Sandbox123!',
      referralCode: 'YOR-MEMBER-001',
      activationCode: generatedCode.code
    });

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.createdMember.username).toMatch(/^YOR/);
    expect(submitResponse.body.createdMember.referralCode).toMatch(/^YOR-MEMBER-\d+$/);

    const inventoryAfterSubmit = await request(app)
      .get('/api/admin/activation-codes')
      .set('Cookie', adminCookie);

    expect(inventoryAfterSubmit.status).toBe(200);
    expect(
      inventoryAfterSubmit.body.inventory.some(
        (item: { code: string; assignedTo: string; status: string }) =>
          item.code === generatedCode.code &&
          item.assignedTo === submitResponse.body.createdMember.username &&
          item.status === 'used'
      )
    ).toBe(true);
  });

  it('keeps cashier limited to release and transfer actions while blocking generation and approvals', async () => {
    const cashierCookie = await login('cashier@yor.local', 'joyjoy05');

    const [generateResponse, payoutApprovalResponse, encashmentApprovalResponse] = await Promise.all([
      request(app)
        .post('/api/admin/activation-codes/generate')
        .set('Cookie', cashierCookie)
        .send({ quantity: 1, packageTier: 'Classic', assignedTo: 'YOR0001' }),
      request(app)
        .post('/api/admin/payouts/approve')
        .set('Cookie', cashierCookie)
        .send({ payoutId: 'ENC-20260524-001' }),
      request(app)
        .post('/api/admin/encashments/ENC-20260524-001/approve')
        .set('Cookie', cashierCookie)
    ]);

    expect(generateResponse.status).toBe(403);
    expect(payoutApprovalResponse.status).toBe(403);
    expect(encashmentApprovalResponse.status).toBe(403);

    const releaseResponse = await request(app)
      .post('/api/admin/activation-codes/release')
      .set('Cookie', cashierCookie)
      .send({ codes: ['FSBUH7M2KC'] });

    expect(releaseResponse.status).toBe(200);
    expect(releaseResponse.body.status).toBe('completed');

    const transferResponse = await request(app)
      .post('/api/admin/activation-codes/transfer')
      .set('Cookie', cashierCookie)
      .send({
        targetUsername: 'YOR0002',
        codes: ['FSBUH7M2KC']
      });

    expect(transferResponse.status).toBe(200);
    expect(transferResponse.body.status).toBe('completed');

    const codeCenter = await request(app)
      .get('/api/admin/activation-codes')
      .set('Cookie', cashierCookie);

    expect(codeCenter.status).toBe(200);
    expect(
      codeCenter.body.inventory.some(
        (item: { code: string; assignedTo: string; status: string }) =>
          item.code === 'FSBUH7M2KC' &&
          item.assignedTo === 'YOR0002' &&
          item.status === 'available'
      )
    ).toBe(true);
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

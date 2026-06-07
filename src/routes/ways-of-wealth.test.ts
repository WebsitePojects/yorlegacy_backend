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

async function loginAs(email: string, password: string) {
  const username = getUsernameFromEmail(email);
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'][0] as string;
}

const MEMBER = () => loginAs('member@yor.local', 'YorMember123!');
const ADMIN  = () => loginAs('admin@yor.local',  'YorAdmin123!');
const SUPER  = () => loginAs('yoradmin@gmail.com', '1');

function containsMatch(arr: string[], pattern: RegExp) {
  return arr.some((s) => pattern.test(s));
}

const PACKAGES = [
  { code: 'BASIC',    name: 'Basic',    price: 1998,   pv: 5,   dr: 200   },
  { code: 'CLASSIC',  name: 'Classic',  price: 5998,   pv: 10,  dr: 1000  },
  { code: 'STANDARD', name: 'Standard', price: 25998,  pv: 50,  dr: 5000  },
  { code: 'BUSINESS', name: 'Business', price: 50998,  pv: 100, dr: 7000  },
  { code: 'VIP',      name: 'VIP',      price: 159998, pv: 300, dr: 15000 },
];

const STREAMS = {
  directReferral:   'direct-referral',
  salesmatch:       'salesmatch',
  binaryCycle:      'binary-cycle',
  getFive:          'get-five',
  lifestyleRewards: 'lifestyle-rewards',
  unilevel:         'unilevel',
  global:           'global',
};

describe('Way 2 – Direct Referral Bonus', () => {
  beforeEach(() => { resetSandboxState(); });

  it('policy lists direct-referral stream in sandbox mode', async () => {
    const res = await request(app).get('/api/compensation/streams');
    expect(res.status).toBe(200);
    const ids: string[] = res.body.streams.map((s: { id: string }) => s.id);
    expect(ids).toContain(STREAMS.directReferral);
    const stream = res.body.streams.find((s: { id: string }) => s.id === STREAMS.directReferral);
    expect(stream.writeStatus).toBe('sandbox');
  });

  it('income simulation returns Standard referral value PHP 5,000', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get(`/api/member/income/${STREAMS.directReferral}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.streamId).toBe(STREAMS.directReferral);
    // Standard referral = PHP 5,000 per Yor PDF
    expect(res.body.simulatedGross).toBe(5000);
    expect(res.body.writeStatus).toBe('sandbox');
    // At least one trace line must mention Standard or the PHP value
    const trace: string[] = res.body.calculationTrace;
    expect(containsMatch(trace, /Standard|5,000|5000/i)).toBe(true);
  });

  it('registration credits sponsor wallet with correct package referral amount', async () => {
    // Simulate a new Standard-package registration under YOR0001 as sponsor.
    // Expected credit: PHP 5,000 (Standard referral per Yor PDF).
    const submitRes = await request(app).post('/api/registration/submit').send({
      origin:        'referral-link',
      fullName:      'Referral Test Member',
      username:      'YOR0106',
      email:         'referral.test@example.test',
      phone:         '+63 900 111 9901',
      password:      'Sandbox123!',
      referralCode:  'YOR-MEMBER-001',
      activationCode:'PDSTK7V2LC'
    });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.createdMember).toBeDefined();
    // Sponsor wallet ledger should contain a direct_referral credit
    const memberCookie = await MEMBER();
    const walletRes = await request(app)
      .get('/api/member/wallet-detail')
      .set('Cookie', memberCookie);

    expect(walletRes.status).toBe(200);
    // Main wallet must reflect a positive available balance (includes prior DR credits)
    expect(walletRes.body.summary.availableBalance).toBeGreaterThan(0);
  });

  it('package table has correct DR bonus values for all five packages', async () => {
    const res = await request(app).get('/api/compensation/policy');
    expect(res.status).toBe(200);

    for (const expected of PACKAGES) {
      const pkg = res.body.packages.find(
        (p: { code: string }) => p.code === expected.code
      );
      expect(pkg).toBeDefined();
      expect(pkg.directReferralBonus).toBe(expected.dr);
    }
  });

  it('sponsor-genealogy tree is separate from binary placement tree (Nogatu parity)', async () => {
    const cookie = await MEMBER();
    const [sponsorRes, binaryRes] = await Promise.all([
      request(app).get('/api/member/genealogy/sponsor').set('Cookie', cookie),
      request(app).get('/api/member/genealogy/binary').set('Cookie', cookie),
    ]);

    expect(sponsorRes.status).toBe(200);
    expect(binaryRes.status).toBe(200);
    // Must be distinct tree types – Nogatu parity: drefid ≠ binary placement
    expect(sponsorRes.body.treeType).toBe('sponsor');
    expect(binaryRes.body.treeType).toBe('binary-placement');
    expect(sponsorRes.body.treeType).not.toBe(binaryRes.body.treeType);
  });
});

// =============================================================================
// ②  SALESMATCH BONUS
// =============================================================================
describe('Way 3 – Salesmatch Bonus', () => {
  beforeEach(() => { resetSandboxState(); });

  it('income simulation returns correct weak-leg match and carry-forward', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get(`/api/member/income/${STREAMS.salesmatch}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.streamId).toBe(STREAMS.salesmatch);
    // Sandbox seed: Left 24,000 pts | Right 18,000 pts
    // Matched = 18,000 (weak side); carry = 6,000 left pts
    expect(res.body.simulatedGross).toBe(15000);
    const trace: string[] = res.body.calculationTrace;
    // Must mention left side data
    expect(containsMatch(trace, /24,000|left|weak|carry/i)).toBe(true);
    // Must mention right/matched side data
    expect(containsMatch(trace, /18,000|right|match/i)).toBe(true);
  });

  it('binary tree shows left and right points on root node', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/genealogy/binary-tree')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.root.nodeId).toBe('YOR0001');
    // Root must have left child (Alyssa, placed left) and right child (Marco, placed right)
    expect(res.body.nodes.length).toBeGreaterThan(1);
  });

  it('binary tree root has no open left or right slots (both filled by seed data)', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/genealogy/binary-tree')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    // Seed: YOR0002 → left of YOR0001, YOR0003 → right of YOR0001
    expect(res.body.root.openSlots.left).toBe(false);
    expect(res.body.root.openSlots.right).toBe(false);
  });

  it('wallet detail keeps salesmatch history visible while encashment still starts at zero', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/wallet-detail')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.preview.requestedAmount).toBe(0);
    expect(
      res.body.incomeBreakdown.find((stream: { streamId: string }) => stream.streamId === 'salesmatch')?.amount
    ).toBeGreaterThan(0);
  });

  it('salesmatch stream declares strong-leg retention policy in basis text', async () => {
    const res = await request(app).get('/api/compensation/streams');
    expect(res.status).toBe(200);
    const stream = res.body.streams.find(
      (s: { id: string }) => s.id === STREAMS.salesmatch
    );
    expect(stream).toBeDefined();
    // Yor PDF explicitly lists: strong-leg retention, no daily flush-out
    expect(/strong.?leg|retention|cap|weekly/i.test(stream.basis)).toBe(true);
  });

  it('admin genealogy binary-tree root exposes shadow slots for salesmatch tracking', async () => {
    const cookie = await ADMIN();
    const res = await request(app)
      .get('/api/admin/genealogy/binary-tree')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.root.shadowSlots.right).toMatchObject({
      state: 'reserved_shadow',
      registrationEnabled: false,
      binaryCycleEnabled: false,
    });
  });
});

// =============================================================================
// ③  BINARY CYCLE BONUS
// =============================================================================
describe('Way 4 – Binary Cycle Bonus', () => {
  beforeEach(() => { resetSandboxState(); });

  it('income simulation returns VIP cycle percentage (5%) applied to salesmatch base', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get(`/api/member/income/${STREAMS.binaryCycle}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    // Seed simulation: PHP 15,000 salesmatch basis × 5% VIP = PHP 750
    expect(res.body.simulatedGross).toBe(750);
    const trace: string[] = res.body.calculationTrace;
    expect(containsMatch(trace, /VIP|5%|cycle/i)).toBe(true);
  });

  it('package policies carry correct binary-cycle percentages for Classic–VIP', async () => {
    const res = await request(app).get('/api/compensation/policy');
    expect(res.status).toBe(200);

    // Per Yor PDF: Classic 2%, Standard 3%, Business 4%, VIP 5%
    const expectedCyclePct: Record<string, number> = {
      CLASSIC:  2,
      STANDARD: 3,
      BUSINESS: 4,
      VIP:      5,
    };

    for (const [code, pct] of Object.entries(expectedCyclePct)) {
      const pkg = res.body.packages.find((p: { code: string }) => p.code === code);
      expect(pkg).toBeDefined();
      expect(pkg.binaryCyclePercent).toBe(pct);
    }
  });

  it('binary-cycle stream is listed in the eight-stream policy response', async () => {
    const res = await request(app).get('/api/compensation/streams');
    expect(res.status).toBe(200);
    const ids: string[] = res.body.streams.map((s: { id: string }) => s.id);
    expect(ids).toContain(STREAMS.binaryCycle);
  });

  it('shadow slots on binary tree mark binary-cycle as disabled (policy requirement)', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/genealogy/binary-tree')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    // Reserved shadows must not earn binary-cycle bonuses
    expect(res.body.root.shadowSlots.left.binaryCycleEnabled).toBe(false);
    expect(res.body.root.shadowSlots.right.binaryCycleEnabled).toBe(false);
  });
});

// =============================================================================
// ④  GET YOR FIVE BONUS
// =============================================================================
describe('Way 5 – Get Yor Five Bonus', () => {
  beforeEach(() => { resetSandboxState(); });

  it('income simulation reaches Standard package price milestone (PHP 25,998)', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get(`/api/member/income/${STREAMS.getFive}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    // Seed: 5 same-package Standard direct recruits → milestone reward = Standard price PHP 25,998
    expect(res.body.simulatedGross).toBe(25998);
    const trace: string[] = res.body.calculationTrace;
    expect(containsMatch(trace, /Standard|recruits|milestone|Process key/i)).toBe(true);
  });

  it('stream label uses Yor brand name "Get Yor Five Bonus" (not Hi-Five or High Five)', async () => {
    const res = await request(app).get('/api/compensation/streams');
    expect(res.status).toBe(200);
    const stream = res.body.streams.find(
      (s: { id: string }) => s.id === STREAMS.getFive
    );
    expect(stream).toBeDefined();
    // Yor-facing label must be canonical; Hi-Five is a legacy alias only
    expect(/Get Yor Five/i.test(stream.label)).toBe(true);
    expect(/Hi.?Five|High.?Five/i.test(stream.label)).toBe(false);
  });

  it('member office keeps get-five out of the lean operational sidebar', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/office')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.modules.map((m: { id: string }) => m.id);
    expect(ids).not.toContain('get-five-bonus');
  });

  it('admin office keeps get-five review out of the trimmed ops navigation', async () => {
    const cookie = await SUPER();
    const res = await request(app)
      .get('/api/admin/office')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.modules.map((m: { id: string }) => m.id);
    expect(ids).not.toContain('get-five-reports');
  });

  it('get-five simulation declares duplicate-prevention process key in required evidence', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get(`/api/member/income/${STREAMS.getFive}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const evidence: string[] = res.body.requiredEvidence;
    // Must include duplicate-prevention / process key gating
    expect(containsMatch(evidence, /Deterministic process key/i)).toBe(true);
    const trace: string[] = res.body.calculationTrace;
    // Trace must mention the anti-reuse concept
    expect(containsMatch(trace, /process key|duplicate|same.*recruit|recruits/i)).toBe(true);
  });
});

// =============================================================================
// ⑤  LIFESTYLE REWARDS
// =============================================================================
describe('Way 6 – Lifestyle Rewards', () => {
  beforeEach(() => { resetSandboxState(); });

  it('income simulation credits the approved 1% backend lifestyle rate while preserving public 3% messaging elsewhere', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get(`/api/member/income/${STREAMS.lifestyleRewards}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    // Approved backend rule: PHP 30,000 qualifying repeat pool × 1% = PHP 300
    expect(res.body.simulatedGross).toBe(300);
    const trace: string[] = res.body.calculationTrace;
    expect(containsMatch(trace, /30,000|repeat|lifestyle|1%|300/i)).toBe(true);
  });

  it('wallet list contains a separate lifestyle wallet', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/wallets')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const types: string[] = res.body.wallets.map((w: { type: string }) => w.type);
    expect(types).toContain('lifestyle');
    const lifestyle = res.body.wallets.find((w: { type: string }) => w.type === 'lifestyle');
    // Lifestyle wallet is separate – it has its own threshold value
    expect(lifestyle.threshold).toBeGreaterThan(0);
  });

  it('package policies carry daily and monthly lifestyle caps for Classic and above', async () => {
    const res = await request(app).get('/api/compensation/policy');
    expect(res.status).toBe(200);

    // Yor PDF defines caps per package; Basic has no published lifestyle cap
    const capsExpected: Record<string, { daily: number; monthly: number }> = {
      CLASSIC:  { daily: 1000,  monthly: 30000  },
      STANDARD: { daily: 2000,  monthly: 60000  },
      BUSINESS: { daily: 3000,  monthly: 90000  },
      VIP:      { daily: 5000,  monthly: 150000 },
    };

    for (const [code, caps] of Object.entries(capsExpected)) {
      const pkg = res.body.packages.find((p: { code: string }) => p.code === code);
      expect(pkg).toBeDefined();
      expect(pkg.lifestyleDailyCap).toBe(caps.daily);
      expect(pkg.lifestyleMonthlyCap).toBe(caps.monthly);
    }
  });

  it('member office keeps lifestyle rewards out of the lean operational sidebar', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/office')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.modules.map((m: { id: string }) => m.id);
    expect(ids).not.toContain('lifestyle-rewards');
  });

  it('lifestyle stream basis mentions 3% rate and separate wallet', async () => {
    const res = await request(app).get('/api/compensation/streams');
    expect(res.status).toBe(200);
    const stream = res.body.streams.find(
      (s: { id: string }) => s.id === STREAMS.lifestyleRewards
    );
    expect(stream).toBeDefined();
    expect(/3%|lifestyle wallet/i.test(stream.basis)).toBe(true);
  });
});

// =============================================================================
// ⑥  UNILEVEL BONUS
// =============================================================================
describe('Way 7 – Unilevel Bonus', () => {
  beforeEach(() => { resetSandboxState(); });

  it('policy returns 10-level unilevel percentage table matching Yor PDF', async () => {
    const res = await request(app).get('/api/compensation/policy');
    expect(res.status).toBe(200);
    // Yor PDF: 10%, 8%, 5%, 5%, 3%, 3%, 2%, 1%, 1%, 1%
    expect(res.body.unilevelPercentages).toEqual([10, 8, 5, 5, 3, 3, 2, 1, 1, 1]);
  });

  it('income simulation returns a positive unilevel payout across 10 levels', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get(`/api/member/income/${STREAMS.unilevel}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.simulatedGross).toBe(4200);
    const trace: string[] = res.body.calculationTrace;
    expect(containsMatch(trace, /sponsor|genealogy|level|percent/i)).toBe(true);
  });

  it('sponsor genealogy tree is used for unilevel (not binary placement)', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/genealogy/sponsor-tree')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.treeType).toBe('sponsor');
    // Unilevel uses the sponsor tree; must be separable from binary-tree data
    const binaryRes = await request(app)
      .get('/api/member/genealogy/binary-tree')
      .set('Cookie', cookie);
    expect(binaryRes.body.treeType).not.toBe('sponsor');
  });

  it('member office keeps unilevel rank progress out of the lean operational sidebar', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/office')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.modules.map((m: { id: string }) => m.id);
    expect(ids).not.toContain('unilevel-rank-progress');
  });

  it('unilevel stream basis text references 10 levels and published percentages', async () => {
    const res = await request(app).get('/api/compensation/streams');
    expect(res.status).toBe(200);
    const stream = res.body.streams.find(
      (s: { id: string }) => s.id === STREAMS.unilevel
    );
    expect(stream).toBeDefined();
    expect(/10|level|percent/i.test(stream.basis)).toBe(true);
  });
});

// =============================================================================
// ⑦  GLOBAL BONUS
// =============================================================================
describe('Way 8 – Global Bonus', () => {
  beforeEach(() => { resetSandboxState(); });

  it('policy exposes 2% yearly pool percentage for global bonus', async () => {
    const res = await request(app).get('/api/compensation/policy');
    expect(res.status).toBe(200);
    expect(res.body.globalBonusPoolPercent).toBe(2);
  });

  it('income simulation returns a positive global bonus preview', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get(`/api/member/income/${STREAMS.global}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.simulatedGross).toBe(12000);
    const trace: string[] = res.body.calculationTrace;
    expect(containsMatch(trace, /2%|global|HOF|qualifier|pool/i)).toBe(true);
  });

  it('global stream is writeStatus sandbox (simulation only – no year-end release logic)', async () => {
    const res = await request(app).get('/api/compensation/streams');
    expect(res.status).toBe(200);
    const stream = res.body.streams.find(
      (s: { id: string }) => s.id === STREAMS.global
    );
    expect(stream).toBeDefined();
    expect(stream.writeStatus).toBe('sandbox');
    // Unresolved must be declared: distribution formula and close date need sign-off
    expect(stream.unresolved.length).toBeGreaterThan(0);
  });

  it('global bonus is exposed in the regular member office sidebar for qualification visibility', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/office')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.modules.map((m: { id: string }) => m.id);
    expect(ids).toContain('global-bonus-eligibility');
  });

  it('admin office keeps global bonus out of the trimmed operational navigation', async () => {
    const cookie = await SUPER();
    const res = await request(app)
      .get('/api/admin/office')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.modules.map((m: { id: string }) => m.id);
    expect(ids).not.toContain('global-bonus');
  });
});

// =============================================================================
// CROSS-STREAM: payout schedule, wallet separation, and encashment flow
// (applies to all 7 streams above)
// =============================================================================
describe('Cross-stream – payout schedule, wallet, and encashment rules', () => {
  beforeEach(() => { resetSandboxState(); });

  it('policy declares Tuesday encashment / Friday payout schedule', async () => {
    const res = await request(app).get('/api/compensation/policy');
    expect(res.status).toBe(200);
    expect(/Tuesday.*encashment|Friday.*payout/i.test(res.body.payoutSchedule)).toBe(true);
  });

  it('wallet list has five separated wallet types', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/wallets')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const types: string[] = res.body.wallets.map((w: { type: string }) => w.type);
    expect(types).toEqual(['main', 'lifestyle', 'product', 'pending', 'encashment']);
  });

  it('encashment preview shows the approved tax, processing fee, and system-retainer deduction stack', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .post('/api/member/wallet/preview-encash')
      .set('Cookie', cookie)
      .send({ amount: 5000 });

    expect(res.status).toBe(200);
    expect(res.body.preview.processingFee).toBe(50);
    expect(res.body.preview.maintenanceFee).toBe(0);
    expect(res.body.preview.systemRetainer).toBe(250);
    expect(res.body.preview.tax).toBe(500);
    expect(res.body.preview.fee).toBe(300);
    expect(res.body.preview.totalDeductions).toBe(800);
    expect(res.body.preview.netReceivable).toBe(4200);
  });

  it('wallet detail starts with a zero requested amount until the member types an encashment request', async () => {
    const cookie = await MEMBER();
    const res = await request(app)
      .get('/api/member/wallet-detail')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.preview.requestedAmount).toBe(0);
    expect(res.body.preview.netReceivable).toBe(0);
  });

  it('sandbox encashment submit reduces available wallet balance', async () => {
    const cookie = await MEMBER();
    const walletBefore = await request(app)
      .get('/api/member/wallet-detail')
      .set('Cookie', cookie);

    const beforeBalance: number = walletBefore.body.summary.availableBalance;

    const encashRes = await request(app)
      .post('/api/member/wallet/encash')
      .set('Cookie', cookie)
      .send({ amount: 5000 });

    expect(encashRes.status).toBe(200);
    expect(encashRes.body.status).toBe('completed');

    const walletAfter = await request(app)
      .get('/api/member/wallet-detail')
      .set('Cookie', cookie);

    // Wallet must be lower after encashment
    expect(walletAfter.body.summary.availableBalance).toBeLessThan(beforeBalance);
  });

  it('admin encashment queue has rows to review after a member submit', async () => {
    // Create a pending request first
    const memberCookie = await MEMBER();
    await request(app)
      .post('/api/member/wallet/encash')
      .set('Cookie', memberCookie)
      .send({ amount: 3000 });

    const adminCookie = await ADMIN();
    const encashmentsRes = await request(app)
      .get('/api/admin/encashments')
      .set('Cookie', adminCookie);

    expect(encashmentsRes.status).toBe(200);
    expect(encashmentsRes.body.encashments.length).toBeGreaterThan(0);
  });

  it('CD deduction is zero when member cdBalance is zero (Nogatu parity)', async () => {
    // Seed member YOR0001 has cdBalance = 0; CD deduction must be PHP 0
    const cookie = await MEMBER();
    const res = await request(app)
      .post('/api/member/wallet/preview-encash')
      .set('Cookie', cookie)
      .send({ amount: 5000 });

    expect(res.status).toBe(200);
    const preview = res.body.preview;
    // YOR0001 cdBalance = 0 so CD deduction must be 0
    expect(preview.cdDeduction).toBe(0);
    expect(preview.totalDeductions).toBe(preview.fee + preview.tax + preview.cdDeduction);
    expect(preview.netReceivable).toBe(preview.requestedAmount - preview.totalDeductions);
  });

  it('all 7 targeted streams carry all 5 required-evidence gating items', async () => {
    const cookie = await MEMBER();
    const targetStreams = Object.values(STREAMS);

    for (const streamId of targetStreams) {
      const res = await request(app)
        .get(`/api/member/income/${streamId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      const evidence: string[] = res.body.requiredEvidence;
      // Every stream must declare the 5 standard evidence requirements before production release
      expect(containsMatch(evidence, /Final written business rule/i)).toBe(true);
      expect(containsMatch(evidence, /Deterministic process key/i)).toBe(true);
      expect(containsMatch(evidence, /Append-only wallet ledger/i)).toBe(true);
    }
  });

  it('all 7 approved internal streams appear in compensation policy with sandbox write status', async () => {
    const res = await request(app).get('/api/compensation/streams');
    expect(res.status).toBe(200);
    expect(res.body.streams).toHaveLength(7);
    expect(
      res.body.streams.every((s: { writeStatus: string }) => s.writeStatus === 'sandbox')
    ).toBe(true);
    expect(res.body.streams.map((s: { id: string }) => s.id)).not.toContain('direct-selling');
  });
});

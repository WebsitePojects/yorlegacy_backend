import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { resetSandboxState } from '../modules/sandbox/dev-sandbox-store.js';

beforeEach(() => {
  resetSandboxState();
});

describe('auth and protected access', () => {
  it('logs in the seeded Yor super admin credentials', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'yoradmin@gmail.com',
      password: '1'
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.authenticated).toBe(true);
    expect(loginResponse.body.user.role).toBe('superadmin');
    expect(loginResponse.headers['set-cookie']).toBeTruthy();
  });

  it.each([
    ['yormember@gmail.com', 'member'],
    ['yorcashier@gmail.com', 'cashier'],
    ['yorbod@gmail.com', 'bod']
  ])('logs in the seeded %s account', async (email, role) => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email,
      password: '1'
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.authenticated).toBe(true);
    expect(loginResponse.body.user.role).toBe(role);
  });

  it.each([
    ['admin@yor.local', 'YorAdmin123!', 'admin'],
    ['cashier@yor.local', 'joyjoy05', 'cashier'],
    ['bod@yor.local', 'yoralliance321654', 'bod'],
    ['yoradmin@gmail.com', '1', 'superadmin']
  ])('lets %s reach the admin dashboard APIs', async (email, password, role) => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email,
      password
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.role).toBe(role);

    const cookie = loginResponse.headers['set-cookie'][0];
    const adminResponse = await request(app)
      .get('/api/admin/summary')
      .set('Cookie', cookie);

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.user.role).toBe(role);
  });

  it.each([
    ['cashier@yor.local', 'joyjoy05', 'cashier'],
    ['bod@yor.local', 'yoralliance321654', 'bod']
  ])('lets %s reach member oversight APIs', async (email, password, role) => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email,
      password
    });

    expect(loginResponse.status).toBe(200);

    const cookie = loginResponse.headers['set-cookie'][0];
    const memberResponse = await request(app)
      .get('/api/member/summary')
      .set('Cookie', cookie);

    expect(memberResponse.status).toBe(200);
    expect(memberResponse.body.user.role).toBe(role);
  });

  it('logs in a member and reaches the member summary', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'member@yor.local',
      password: 'YorMember123!'
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers['set-cookie']).toBeTruthy();

    const cookie = loginResponse.headers['set-cookie'][0];
    const memberResponse = await request(app)
      .get('/api/member/summary')
      .set('Cookie', cookie);

    expect(memberResponse.status).toBe(200);
    expect(memberResponse.body.user.role).toBe('member');
  });

  it('blocks member access to the admin summary', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'member@yor.local',
      password: 'YorMember123!'
    });

    const cookie = loginResponse.headers['set-cookie'][0];
    const adminResponse = await request(app)
      .get('/api/admin/summary')
      .set('Cookie', cookie);

    expect(adminResponse.status).toBe(403);
  });

  it('returns operational member office data behind auth', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'member@yor.local',
      password: 'YorMember123!'
    });

    const cookie = loginResponse.headers['set-cookie'][0];
    const officeResponse = await request(app)
      .get('/api/member/office')
      .set('Cookie', cookie);

    expect(officeResponse.status).toBe(200);
    expect(officeResponse.body.wallet.availableBalance).toBe('PHP 15,200.75');
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).toContain('wallet');
  });

  it('serves sandbox operational modules with mutable branch-only status', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'yoradmin@gmail.com',
      password: '1'
    });

    const cookie = loginResponse.headers['set-cookie'][0];
    const moduleResponse = await request(app)
      .get('/api/admin/modules/encashment-reports')
      .set('Cookie', cookie);

    expect(moduleResponse.status).toBe(200);
    expect(moduleResponse.body.status).toBe('sandbox-write');
    expect(moduleResponse.body.table.rows.length).toBeGreaterThan(0);
    expect(moduleResponse.body.gatedActions).toEqual([]);
  });

  it('filters admin modules by operational role', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'cashier@yor.local',
      password: 'joyjoy05'
    });

    const cookie = loginResponse.headers['set-cookie'][0];
    const officeResponse = await request(app)
      .get('/api/admin/office')
      .set('Cookie', cookie);
    const deniedModuleResponse = await request(app)
      .get('/api/admin/modules/encashment-reports')
      .set('Cookie', cookie);

    expect(officeResponse.status).toBe(200);
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).toEqual(
      expect.arrayContaining(['dashboard', 'member-management', 'activation-codes'])
    );
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).not.toContain('encashment-reports');
    expect(deniedModuleResponse.status).toBe(404);
  });

  it('lets cashier update a member name from the limited office surface', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'cashier@yor.local',
      password: 'joyjoy05'
    });

    const cookie = loginResponse.headers['set-cookie'][0];
    const updateResponse = await request(app)
      .post('/api/admin/members/YOR0002/change-name')
      .set('Cookie', cookie)
      .send({ fullName: 'Alyssa Cashier QA' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.status).toBe('completed');

    const officeResponse = await request(app)
      .get('/api/admin/modules/member-management')
      .set('Cookie', cookie);

    expect(officeResponse.status).toBe(200);
    expect(officeResponse.body.table.rows.some((row: { username: string; name: string }) => row.username === 'YOR0002' && row.name === 'Alyssa Cashier QA')).toBe(true);
  });

  it('serves every member side-nav module for smoke coverage', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'member@yor.local',
      password: 'YorMember123!'
    });

    const cookie = loginResponse.headers['set-cookie'][0];
    const officeResponse = await request(app)
      .get('/api/member/office')
      .set('Cookie', cookie);

    expect(officeResponse.status).toBe(200);
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).toEqual(
      expect.arrayContaining([
        'product-orders',
        'lifestyle-rewards',
        'get-five-bonus',
        'salesmatch-bonus',
        'binary-cycle-bonus',
        'unilevel-rank-progress',
        'account-details',
        'activation-codes',
        'upgrade-registration'
      ])
    );
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).not.toContain(
      'global-bonus-eligibility'
    );

    for (const module of officeResponse.body.modules as Array<{ id: string }>) {
      const moduleResponse = await request(app)
        .get(`/api/member/modules/${module.id}`)
        .set('Cookie', cookie);

      expect(moduleResponse.status).toBe(200);
      expect(moduleResponse.body.table.rows.length).toBeGreaterThan(0);
    }
  });

  it('serves the complete admin MVP side-nav module inventory', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'yoradmin@gmail.com',
      password: '1'
    });

    const cookie = loginResponse.headers['set-cookie'][0];
    const officeResponse = await request(app)
      .get('/api/admin/office')
      .set('Cookie', cookie);

    expect(officeResponse.status).toBe(200);
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).toEqual(
      expect.arrayContaining([
        'member-management',
        'account-genealogy',
        'encashment-reports',
        'finance-accounting',
        'cd-accounts',
        'voucher-management',
        'rankings',
        'global-bonus',
        'get-five-reports',
        'activation-codes'
      ])
    );
  });

  it('returns unauthenticated me when no session exists', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.authenticated).toBe(false);
  });
});

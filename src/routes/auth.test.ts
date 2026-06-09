import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { resetSandboxState } from '../modules/sandbox/dev-sandbox-store.js';

function buildCookieHeader(setCookie: string[] | string | undefined): string[] {
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return values.map((value) => value.split(';')[0]);
}

function getCookieValue(cookies: string[], name: string): string | null {
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return rest.join('=');
    }
  }

  return null;
}

beforeEach(() => {
  resetSandboxState();
});

describe('auth and protected access', () => {
  it('logs in the seeded Yor super admin credentials', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yorsuperadmin',
      password: '1'
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.authenticated).toBe(true);
    expect(loginResponse.body.user.role).toBe('superadmin');
    expect(loginResponse.headers['set-cookie']).toBeTruthy();
    expect(buildCookieHeader(loginResponse.headers['set-cookie'])).toEqual(
      expect.arrayContaining([expect.stringMatching(/^yor_session=/), expect.stringMatching(/^yor_csrf=/)])
    );
  });

  it.each([
    ['yormember', 'member'],
    ['yorcashier_legacy', 'cashier'],
    ['yorbod_legacy', 'bod']
  ])('logs in the seeded %s account', async (username, role) => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username,
      password: '1'
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.authenticated).toBe(true);
    expect(loginResponse.body.user.role).toBe(role);
  });

  it.each([
    ['yoradmin', '1', 'admin'],
    ['yorcashier', '1', 'cashier'],
    ['yorbod', '1', 'bod'],
    ['yorsuperadmin', '1', 'superadmin']
  ])('lets %s reach the admin dashboard APIs', async (username, password, role) => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username,
      password
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.role).toBe(role);

    const cookie = buildCookieHeader(loginResponse.headers['set-cookie']);
    const adminResponse = await request(app)
      .get('/api/admin/summary')
      .set('Cookie', cookie);

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.user.role).toBe(role);
  });

  it.each([
    ['yorcashier', '1', 'cashier'],
    ['yorbod', '1', 'bod']
  ])('lets %s reach member oversight APIs', async (username, password, role) => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username,
      password
    });

    expect(loginResponse.status).toBe(200);

    const cookie = buildCookieHeader(loginResponse.headers['set-cookie']);
    const memberResponse = await request(app)
      .get('/api/member/summary')
      .set('Cookie', cookie);

    expect(memberResponse.status).toBe(200);
    expect(memberResponse.body.user.role).toBe(role);
  });

  it('logs in a member and reaches the member summary', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yor01',
      password: '1'
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers['set-cookie']).toBeTruthy();

    const cookie = buildCookieHeader(loginResponse.headers['set-cookie']);
    const memberResponse = await request(app)
      .get('/api/member/summary')
      .set('Cookie', cookie);

    expect(memberResponse.status).toBe(200);
    expect(memberResponse.body.user.role).toBe('member');
  });

  it('allows member credentials through the member portal scope', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yor01',
      password: '1',
      scope: 'member'
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.authenticated).toBe(true);
    expect(loginResponse.body.user.role).toBe('member');
    expect(buildCookieHeader(loginResponse.headers['set-cookie'])).toEqual(
      expect.arrayContaining([expect.stringMatching(/^yor_session=/)])
    );
  });

  it.each([
    ['yoradmin', '1'],
    ['yorcashier', '1'],
    ['yorbod', '1'],
    ['yorsuperadmin', '1']
  ])('blocks %s credentials from the member portal scope', async (username, password) => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username,
      password,
      scope: 'member'
    });

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.message).toBe('Access denied: Members-only portal');
  });

  it('allows office credentials through the office portal scope', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yoradmin',
      password: '1',
      scope: 'office'
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.authenticated).toBe(true);
    expect(loginResponse.body.user.role).toBe('admin');
  });

  it('blocks member credentials from the office portal scope', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yor01',
      password: '1',
      scope: 'office'
    });

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.message).toBe('Access denied: Office-only portal');
  });

  it('uses a longer session cookie for remember-me login', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yor01',
      password: '1',
      rememberMe: true,
      scope: 'member'
    });

    const cookies = Array.isArray(loginResponse.headers['set-cookie'])
      ? loginResponse.headers['set-cookie']
      : [loginResponse.headers['set-cookie']];

    expect(loginResponse.status).toBe(200);
    expect(cookies.some((cookie) => /yor_session=.*Max-Age=2592000/i.test(cookie))).toBe(true);
  });

  it('returns a generic error for invalid usernames', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'missing-user',
      password: 'anything',
      scope: 'member'
    });

    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.message).toBe('Invalid username or password');
  });

  it('rejects missing login fields', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yor01'
    });

    expect(loginResponse.status).toBe(400);
    expect(loginResponse.body.message).toBe('Invalid credentials payload');
  });

  it('blocks member access to the admin summary', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yor01',
      password: '1'
    });

    const cookie = buildCookieHeader(loginResponse.headers['set-cookie']);
    const adminResponse = await request(app)
      .get('/api/admin/summary')
      .set('Cookie', cookie);

    expect(adminResponse.status).toBe(403);
  });

  it('returns operational member office data behind auth', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yor01',
      password: '1'
    });

    const cookie = buildCookieHeader(loginResponse.headers['set-cookie']);
    const officeResponse = await request(app)
      .get('/api/member/office')
      .set('Cookie', cookie);

    expect(officeResponse.status).toBe(200);
    expect(officeResponse.body.wallet.availableBalance).toBe('PHP 15,200.75');
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).toContain('wallet');
  });

  it('serves sandbox operational modules with mutable branch-only status', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yorsuperadmin',
      password: '1'
    });

    const cookie = buildCookieHeader(loginResponse.headers['set-cookie']);
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
      username: 'yorcashier',
      password: '1'
    });

    const cookie = buildCookieHeader(loginResponse.headers['set-cookie']);
    const officeResponse = await request(app)
      .get('/api/admin/office')
      .set('Cookie', cookie);
    const deniedModuleResponse = await request(app)
      .get('/api/admin/modules/encashment-reports')
      .set('Cookie', cookie);

    expect(officeResponse.status).toBe(200);
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).toEqual([
      'activation-codes'
    ]);
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).not.toContain('encashment-reports');
    expect(deniedModuleResponse.status).toBe(404);
  });

  it('keeps cashier out of full member-management modules while allowing member-name correction only', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yorcashier',
      password: '1'
    });

    const cookie = buildCookieHeader(loginResponse.headers['set-cookie']);
    const csrfToken = getCookieValue(cookie, 'yor_csrf');
    const updateResponse = await request(app)
      .post('/api/admin/members/YOR0002/change-name')
      .set('Cookie', cookie)
      .set('x-yor-csrf-token', csrfToken ?? '')
      .send({ fullName: 'Alyssa Cashier QA' });

    const officeResponse = await request(app)
      .get('/api/admin/modules/member-management')
      .set('Cookie', cookie);

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.status).toBe('completed');
    expect(officeResponse.status).toBe(404);
  });

  it('serves every member side-nav module for smoke coverage', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yor01',
      password: '1'
    });

    const cookie = buildCookieHeader(loginResponse.headers['set-cookie']);
    const officeResponse = await request(app)
      .get('/api/member/office')
      .set('Cookie', cookie);

    expect(officeResponse.status).toBe(200);
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).toEqual(
      expect.arrayContaining([
        'dashboard',
        'wallet',
        'transactions',
        'salesmatch-bonus',
        'genealogy',
        'account-shadow-management',
        'account-details',
        'direct-referrals',
        'activation-codes',
        'upgrade-registration'
      ])
    );
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).not.toContain(
      'get-five-bonus'
    );
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).toContain(
      'global-bonus-eligibility'
    );

    for (const module of officeResponse.body.modules as Array<{ id: string }>) {
      const moduleResponse = await request(app)
        .get(`/api/member/modules/${module.id}`)
        .set('Cookie', cookie);

      expect(moduleResponse.status).toBe(200);
      expect(Array.isArray(moduleResponse.body.table.rows)).toBe(true);
    }
  });

  it('serves the complete admin MVP side-nav module inventory', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yorsuperadmin',
      password: '1'
    });

    const cookie = buildCookieHeader(loginResponse.headers['set-cookie']);
    const officeResponse = await request(app)
      .get('/api/admin/office')
      .set('Cookie', cookie);

    expect(officeResponse.status).toBe(200);
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).toEqual(
      expect.arrayContaining([
        'dashboard',
        'member-management',
        'account-genealogy',
        'encashment-reports',
        'activation-codes'
      ])
    );
    expect(officeResponse.body.modules.map((module: { id: string }) => module.id)).not.toContain('global-bonus');
  });

  it('returns unauthenticated me when no session exists', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.authenticated).toBe(false);
  });

  it('blocks authenticated office writes without a matching csrf token', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'yorcashier',
      password: '1'
    });

    const cookie = buildCookieHeader(loginResponse.headers['set-cookie']);
    const blockedResponse = await request(app)
      .post('/api/admin/members/YOR0002/change-name')
      .set('Cookie', cookie)
      .send({ fullName: 'Blocked Write' });

    expect(blockedResponse.status).toBe(403);
    expect(blockedResponse.body.message).toMatch(/csrf/i);
  });
});

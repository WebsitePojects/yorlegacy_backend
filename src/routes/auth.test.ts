import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app';

describe('auth and protected access', () => {
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

  it('returns placeholder member office data behind auth', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'member@yor.local',
      password: 'YorMember123!'
    });

    const cookie = loginResponse.headers['set-cookie'][0];
    const officeResponse = await request(app)
      .get('/api/member/office')
      .set('Cookie', cookie);

    expect(officeResponse.status).toBe(200);
    expect(officeResponse.body.wallet.availableBalance).toBe('PHP 0.00');
  });

  it('returns unauthenticated me when no session exists', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.authenticated).toBe(false);
  });
});

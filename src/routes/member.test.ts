import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { resetSandboxState } from '../modules/sandbox/dev-sandbox-store.js';

function buildCookieHeader(setCookie: string[] | string | undefined): string[] {
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return values.map((value) => value.split(';')[0]);
}

beforeEach(() => {
  resetSandboxState();
});

describe('member code search', () => {
  it('returns username search results for transfer lookup', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'YOR0001',
      password: 'YorMember123!',
      scope: 'member'
    });

    expect(loginResponse.status).toBe(200);

    const response = await request(app)
      .get('/api/member/members/search?q=yor')
      .set('Cookie', buildCookieHeader(loginResponse.headers['set-cookie']));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.results)).toBe(true);
    expect(response.body.results.length).toBeGreaterThan(0);
    expect(response.body.results.length).toBeLessThanOrEqual(20);
  });

  it('returns no results for short queries', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      username: 'YOR0001',
      password: 'YorMember123!',
      scope: 'member'
    });

    const response = await request(app)
      .get('/api/member/members/search?q=yo')
      .set('Cookie', buildCookieHeader(loginResponse.headers['set-cookie']));

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([]);
  });
});

import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app: typeof import('../app').app;

beforeAll(async () => {
  process.env.FRONTEND_ORIGIN =
    'http://localhost:5173,http://127.0.0.1:5173,https://yorinternational.net,https://www.yorinternational.net';
  ({ app } = await import('../app'));
});

describe('CORS handling', () => {
  it('allows preflight requests from localhost dev origin', async () => {
    const response = await request(app)
      .options('/api/auth/me')
      .set('Origin', 'http://localhost:5173/')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173/'
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('keeps supporting the loopback IP dev origin', async () => {
    const response = await request(app)
      .options('/api/auth/me')
      .set('Origin', 'http://127.0.0.1:5173/')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://127.0.0.1:5173/'
    );
  });

  it('allows the Yor International custom domain origin', async () => {
    const response = await request(app)
      .options('/api/auth/me')
      .set('Origin', 'https://yorinternational.net')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://yorinternational.net'
    );
  });

  it('allows the www Yor International custom domain origin', async () => {
    const response = await request(app)
      .options('/api/auth/me')
      .set('Origin', 'https://www.yorinternational.net')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://www.yorinternational.net'
    );
  });
});

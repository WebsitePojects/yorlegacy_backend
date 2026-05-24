import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app';

describe('GET /api/pages/:slug', () => {
  it('returns a structured page payload', async () => {
    const response = await request(app).get('/api/pages/home');

    expect(response.status).toBe(200);
    expect(response.body.slug).toBe('home');
    expect(Array.isArray(response.body.sections)).toBe(true);
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app';

describe('GET /health', () => {
  it('returns an ok status payload', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns the operational readiness scope snapshot', async () => {
    const response = await request(app).get('/health/readiness');

    expect(response.status).toBe(200);
    expect(response.body.releaseLevel).toBe('ready for internal testing');
    expect(response.body.runtimeMode).toBe('sandbox');
    expect(response.body.publicRoutes).toEqual(['/', '/earn', '/packages', '/register', '/login', '/admin/login']);
    expect(response.body.collapsedRoutes).toContain('/vision');
    expect(response.body.roleSurfaces.admin.map((module: { id: string }) => module.id)).toEqual([
      'dashboard',
      'member-management',
      'encashment-reports',
      'account-genealogy',
      'activation-codes'
    ]);
    expect(response.body.roleSurfaces.bod).toEqual(response.body.roleSurfaces.admin);
    expect(response.body.roleSurfaces.member.map((module: { id: string }) => module.id)).not.toContain('product-orders');
    expect(response.body.workingCriticalFlows).toContain('Admin encashment review and mark paid');
    expect(response.body.productionEncoding.implemented).toBe(true);
    expect(response.body.productionEncoding.serviceReady).toBe(false);
    expect(response.body.productionEncoding.blockers).toContain(
      'Runtime is not switched to YOR_RUNTIME_MODE=production.'
    );
  });

  it('returns runtime diagnostics for the production encoding cutover state', async () => {
    const response = await request(app).get('/health/diagnostics');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.runtimeMode).toBe('sandbox');
    expect(response.body.productionModeEnabled).toBe(false);
    expect(response.body.supabase.configured).toBe(false);
    expect(response.body.productionEncodingServiceReady).toBe(false);
    expect(response.body.blockers).toContain('Runtime is not switched to production mode.');
  });
});

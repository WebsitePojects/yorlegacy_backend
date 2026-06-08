import { Router } from 'express';
import { buildOperationalReadinessSnapshot } from '../modules/readiness/operational-scope.js';
import { env } from '../config/env.js';
import { getSupabaseStatus } from '../lib/supabase.js';
import { getProductionEncodingService, isProductionMode } from '../modules/production/runtime.js';

export const healthRouter = Router();

healthRouter.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

healthRouter.get('/health/readiness', (_request, response) => {
  response.status(200).json(buildOperationalReadinessSnapshot());
});

healthRouter.get('/health/diagnostics', (_request, response) => {
  const supabase = getSupabaseStatus();
  const productionServiceReady = Boolean(getProductionEncodingService());

  response.status(200).json({
    status: 'ok',
    runtimeMode: env.YOR_RUNTIME_MODE,
    productionModeEnabled: isProductionMode(),
    supabase,
    productionEncodingServiceReady: productionServiceReady,
    blockers: [
      !isProductionMode() ? 'Runtime is not switched to production mode.' : null,
      !supabase.configured ? 'Privileged Supabase server key is missing.' : null,
      !productionServiceReady ? 'Production encoding service is unavailable in this process.' : null
    ].filter((value): value is string => Boolean(value))
  });
});

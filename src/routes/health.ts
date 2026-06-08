import { Router } from 'express';
import { buildOperationalReadinessSnapshot } from '../modules/readiness/operational-scope.js';

export const healthRouter = Router();

healthRouter.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

healthRouter.get('/health/readiness', (_request, response) => {
  response.status(200).json(buildOperationalReadinessSnapshot());
});

import { Router } from 'express';
import { getCompensationPolicy, listEarningStreams } from '../modules/compensation/mvp-service.js';

export const compensationRouter = Router();

compensationRouter.get('/api/compensation/policy', async (_req, res) => {
  res.status(200).json(await getCompensationPolicy());
});

compensationRouter.get('/api/compensation/streams', async (_req, res) => {
  res.status(200).json(await listEarningStreams());
});

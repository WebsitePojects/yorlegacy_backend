import { Router } from 'express';
import { buildMemberOffice } from '../modules/member/office-service.js';
import { buildMemberSummary } from '../modules/member/summary-service.js';
import { requireRole } from '../modules/auth/request-auth.js';

export const memberRouter = Router();

memberRouter.get('/api/member/summary', requireRole('member', 'admin'), async (req, res) => {
  const summary = await buildMemberSummary(req.authUser!);
  res.status(200).json(summary);
});

memberRouter.get('/api/member/office', requireRole('member', 'admin'), async (req, res) => {
  const office = await buildMemberOffice(req.authUser!);
  res.status(200).json(office);
});

import { Router } from 'express';
import { buildAdminOffice } from '../modules/admin/office-service.js';
import { buildAdminSummary } from '../modules/admin/summary-service.js';
import { requireRole } from '../modules/auth/request-auth.js';

export const adminRouter = Router();

adminRouter.get('/api/admin/summary', requireRole('admin'), async (req, res) => {
  const summary = await buildAdminSummary(req.authUser!);
  res.status(200).json(summary);
});

adminRouter.get('/api/admin/office', requireRole('admin'), async (req, res) => {
  const office = await buildAdminOffice(req.authUser!);
  res.status(200).json(office);
});

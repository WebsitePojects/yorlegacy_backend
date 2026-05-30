import { Router } from 'express';
import { buildAdminOffice } from '../modules/admin/office-service.js';
import { buildAdminSummary } from '../modules/admin/summary-service.js';
import { findAdminProfileByUserId } from '../modules/auth/app-users.js';
import { requireRole } from '../modules/auth/request-auth.js';
import { getOpsModuleForProfile } from '../modules/operations/hybrid-operational-data.js';
import {
  buildAdminMembers,
  buildAdminMvpDashboard,
  buildAdminPayouts,
  getMoneyMode,
  getWalletLedger,
  listIncomeSimulations
} from '../modules/compensation/mvp-service.js';
import {
  buildAdminActivationCodeCenter,
  buildAdminEncashmentCenter,
  buildAdminGenealogyCenter,
  runAdminApproveEncashment,
  runAdminGenerateActivationCodes,
  runAdminResetSandbox
} from '../modules/operations/legacy-parity-service.js';

export const adminRouter = Router();

adminRouter.get('/api/admin/summary', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const summary = await buildAdminSummary(req.authUser!);
  res.status(200).json(summary);
});

adminRouter.get('/api/admin/office', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const office = await buildAdminOffice(req.authUser!);
  res.status(200).json(office);
});

adminRouter.get('/api/admin/dashboard', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  res.status(200).json(await buildAdminMvpDashboard(req.authUser!));
});

adminRouter.get('/api/admin/members', requireRole('admin', 'cashier', 'bod', 'superadmin'), (_req, res) => {
  res.status(200).json(buildAdminMembers());
});

adminRouter.get('/api/admin/compensation/simulations', requireRole('admin', 'cashier', 'bod', 'superadmin'), (_req, res) => {
  res.status(200).json({
    moneyMode: getMoneyMode(),
    simulations: listIncomeSimulations()
  });
});

adminRouter.get('/api/admin/wallet-ledger', requireRole('admin', 'cashier', 'bod', 'superadmin'), (_req, res) => {
  res.status(200).json({
    moneyMode: getMoneyMode(),
    entries: getWalletLedger()
  });
});

adminRouter.get('/api/admin/payouts', requireRole('admin', 'cashier', 'bod', 'superadmin'), (_req, res) => {
  res.status(200).json(buildAdminPayouts());
});

adminRouter.post('/api/admin/payouts/approve', requireRole('admin', 'cashier', 'superadmin'), (req, res) => {
  const payoutId = typeof req.body?.payoutId === 'string'
    ? req.body.payoutId
    : typeof req.body?.encashmentId === 'string'
      ? req.body.encashmentId
      : null;

  if (!payoutId) {
    res.status(400).json({
      message: 'payoutId is required'
    });
    return;
  }

  res.status(200).json(runAdminApproveEncashment(req.authUser!, payoutId));
});

adminRouter.get('/api/admin/activation-codes', requireRole('admin', 'cashier', 'bod', 'superadmin'), (_req, res) => {
  res.status(200).json(buildAdminActivationCodeCenter());
});

adminRouter.post('/api/admin/activation-codes/generate', requireRole('admin', 'cashier', 'superadmin'), (req, res) => {
  res.status(200).json(
    runAdminGenerateActivationCodes(req.authUser!, {
      quantity: Number(req.body?.quantity ?? 1),
      packageTier: req.body?.packageTier,
      assignedTo: req.body?.assignedTo
    })
  );
});

adminRouter.get('/api/admin/encashments', requireRole('admin', 'cashier', 'bod', 'superadmin'), (_req, res) => {
  res.status(200).json(buildAdminEncashmentCenter());
});

adminRouter.post('/api/admin/encashments/:encashmentId/approve', requireRole('admin', 'cashier', 'superadmin'), (req, res) => {
  const encashmentId = Array.isArray(req.params.encashmentId) ? req.params.encashmentId[0] : req.params.encashmentId;
  res.status(200).json(runAdminApproveEncashment(req.authUser!, encashmentId));
});

adminRouter.post('/api/admin/sandbox/reset', requireRole('superadmin'), (req, res) => {
  res.status(200).json(runAdminResetSandbox(req.authUser!));
});

adminRouter.get('/api/admin/genealogy/binary-tree', requireRole('admin', 'cashier', 'bod', 'superadmin'), (_req, res) => {
  const rootUsername = typeof _req.query.rootUsername === 'string' ? _req.query.rootUsername : undefined;
  res.status(200).json(buildAdminGenealogyCenter('binary-placement', rootUsername));
});

adminRouter.get('/api/admin/genealogy/sponsor-tree', requireRole('admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const rootUsername = typeof req.query.rootUsername === 'string' ? req.query.rootUsername : undefined;
  res.status(200).json(buildAdminGenealogyCenter('sponsor', rootUsername));
});

adminRouter.get('/api/admin/modules/:moduleId', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const moduleId = Array.isArray(req.params.moduleId)
    ? req.params.moduleId[0]
    : req.params.moduleId;
  const profile = await findAdminProfileByUserId(req.authUser!.id);
  const module = getOpsModuleForProfile(req.authUser!, moduleId, profile);

  if (!module) {
    res.status(404).json({
      message: 'Operational module not found for this role'
    });
    return;
  }

  res.status(200).json(module);
});

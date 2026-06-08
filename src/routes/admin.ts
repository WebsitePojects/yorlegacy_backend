import { Router } from 'express';
import { buildAdminOffice } from '../modules/admin/office-service.js';
import { buildAdminSummary } from '../modules/admin/summary-service.js';
import { findAdminProfileByUserId } from '../modules/auth/app-users.js';
import { requireRole } from '../modules/auth/request-auth.js';
import { getOpsModuleForProfile } from '../modules/operations/hybrid-operational-data.js';
import {
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
  buildAdminMemberManagementCenter,
  runAdminApproveEncashment,
  runAdminChangeMemberName,
  runAdminGenerateActivationCodes,
  runAdminReleaseActivationCodes,
  runAdminReviewActivationCodes,
  runAdminReviewEncashment,
  runAdminResetSandbox,
  runAdminUpdateMemberProfile,
  runAdminUpdateMemberStatus,
  runAdminTransferActivationCodes
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

adminRouter.get('/api/admin/members', requireRole('admin', 'bod', 'superadmin'), (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query : '';
  const username = typeof req.query.username === 'string' ? req.query.username : '';
  const page = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
  const pageSize = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : 10;
  const payload = buildAdminMemberManagementCenter({
    query,
    username,
    page,
    pageSize
  });

  res.status(200).json({
    ...payload,
    members: payload.rows
  });
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

adminRouter.post('/api/admin/payouts/approve', requireRole('admin', 'bod', 'superadmin'), (req, res) => {
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

adminRouter.post('/api/admin/activation-codes/generate', requireRole('admin', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(
    runAdminGenerateActivationCodes(req.authUser!, {
      quantity: Number(req.body?.quantity ?? 1),
      packageTier: req.body?.packageTier,
      assignedTo: req.body?.assignedTo,
      accountType: req.body?.accountType
    })
  );
});

adminRouter.post('/api/admin/activation-codes/release', requireRole('admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const codes = Array.isArray(req.body?.codes)
    ? req.body.codes.filter((code: unknown): code is string => typeof code === 'string')
    : [];

  res.status(200).json(runAdminReleaseActivationCodes(req.authUser!, { codes }));
});

adminRouter.post('/api/admin/activation-codes/transfer', requireRole('admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const codes = Array.isArray(req.body?.codes)
    ? req.body.codes.filter((code: unknown): code is string => typeof code === 'string')
    : [];

  res.status(200).json(
    runAdminTransferActivationCodes(req.authUser!, {
      targetUsername: typeof req.body?.targetUsername === 'string' ? req.body.targetUsername : '',
      codes
    })
  );
});

adminRouter.post('/api/admin/activation-codes/review', requireRole('admin', 'bod', 'superadmin'), (req, res) => {
  const codes = Array.isArray(req.body?.codes)
    ? req.body.codes.filter((code: unknown): code is string => typeof code === 'string')
    : [];

  res.status(200).json(
    runAdminReviewActivationCodes(req.authUser!, {
      codes,
      action: req.body?.action,
      remarks: typeof req.body?.remarks === 'string' ? req.body.remarks : ''
    })
  );
});

adminRouter.get('/api/admin/encashments', requireRole('admin', 'cashier', 'bod', 'superadmin'), (_req, res) => {
  res.status(200).json(buildAdminEncashmentCenter(_req.authUser!));
});

adminRouter.post('/api/admin/encashments/:encashmentId/approve', requireRole('admin', 'bod', 'superadmin'), (req, res) => {
  const encashmentId = Array.isArray(req.params.encashmentId) ? req.params.encashmentId[0] : req.params.encashmentId;
  res.status(200).json(runAdminApproveEncashment(req.authUser!, encashmentId));
});

adminRouter.post('/api/admin/encashments/:encashmentId/review', requireRole('admin', 'bod', 'superadmin'), (req, res) => {
  const encashmentId = Array.isArray(req.params.encashmentId) ? req.params.encashmentId[0] : req.params.encashmentId;
  res.status(200).json(
    runAdminReviewEncashment(req.authUser!, encashmentId, {
      action: req.body?.action,
      method: typeof req.body?.method === 'string' ? req.body.method : '',
      fee: Number(req.body?.fee),
      tax: Number(req.body?.tax),
      cdDeduction: Number(req.body?.cdDeduction),
      remarks: typeof req.body?.remarks === 'string' ? req.body.remarks : ''
    })
  );
});

adminRouter.post('/api/admin/sandbox/reset', requireRole('superadmin'), (req, res) => {
  res.status(200).json(runAdminResetSandbox(req.authUser!));
});

adminRouter.post('/api/admin/members/:username/change-name', requireRole('admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  res.status(200).json(
    runAdminChangeMemberName(req.authUser!, {
      username,
      fullName: typeof req.body?.fullName === 'string' ? req.body.fullName : ''
    })
  );
});

adminRouter.post('/api/admin/members/:username/profile', requireRole('admin', 'bod', 'superadmin'), (req, res) => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  res.status(200).json(
    runAdminUpdateMemberProfile(req.authUser!, {
      username,
      firstName: typeof req.body?.firstName === 'string' ? req.body.firstName : '',
      lastName: typeof req.body?.lastName === 'string' ? req.body.lastName : '',
      middleName: typeof req.body?.middleName === 'string' ? req.body.middleName : '',
      password: typeof req.body?.password === 'string' ? req.body.password : '',
      payoutOption: typeof req.body?.payoutOption === 'string' ? req.body.payoutOption : '',
      payoutDetails: typeof req.body?.payoutDetails === 'string' ? req.body.payoutDetails : '',
      address: typeof req.body?.address === 'string' ? req.body.address : '',
      contactNumber: typeof req.body?.contactNumber === 'string' ? req.body.contactNumber : ''
    })
  );
});

adminRouter.post('/api/admin/members/:username/status', requireRole('admin', 'bod', 'superadmin'), (req, res) => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const status = typeof req.body?.status === 'string' ? req.body.status : 'pending';
  res.status(200).json(
    runAdminUpdateMemberStatus(req.authUser!, {
      username,
      status: status as 'active' | 'pending' | 'frozen' | 'suspended'
    })
  );
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

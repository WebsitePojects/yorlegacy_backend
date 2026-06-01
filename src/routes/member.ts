import { Router } from 'express';
import { buildMemberOffice } from '../modules/member/office-service.js';
import { buildMemberSummary } from '../modules/member/summary-service.js';
import { requireRole } from '../modules/auth/request-auth.js';
import { getMemberModule } from '../modules/operations/hybrid-operational-data.js';
import {
  buildGenealogy,
  buildMemberMvpDashboard,
  buildShadowAccounts,
  buildWallets,
  getIncomeSimulation
} from '../modules/compensation/mvp-service.js';
import {
  buildBinaryGenealogyCenter,
  buildMemberActivationCodeCenter,
  buildMemberRegistrationReadiness,
  buildScopedBinaryGenealogyCenter,
  buildSponsorGenealogyCenter,
  buildMemberTransactionCenter,
  buildMemberWalletDetail,
  runMemberEncashment,
  runMemberMaintenanceCode,
  runMemberTransferActivationCodes,
  runMemberUpgradeActivationCode
} from '../modules/operations/legacy-parity-service.js';

export const memberRouter = Router();

memberRouter.get('/api/member/summary', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const summary = await buildMemberSummary(req.authUser!);
  res.status(200).json(summary);
});

memberRouter.get('/api/member/office', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const office = await buildMemberOffice(req.authUser!);
  res.status(200).json(office);
});

memberRouter.get('/api/member/dashboard', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(buildMemberMvpDashboard(req.authUser!));
});

memberRouter.get('/api/member/income/:streamId', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const streamId = Array.isArray(req.params.streamId) ? req.params.streamId[0] : req.params.streamId;
  const simulation = getIncomeSimulation(streamId);

  if (!simulation) {
    res.status(404).json({ message: 'Income stream not found' });
    return;
  }

  res.status(200).json(simulation);
});

memberRouter.get('/api/member/wallets', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (_req, res) => {
  res.status(200).json(buildWallets());
});

memberRouter.get('/api/member/wallet-detail', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(buildMemberWalletDetail(req.authUser!));
});

memberRouter.get('/api/member/genealogy/sponsor', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (_req, res) => {
  res.status(200).json(buildGenealogy('sponsor'));
});

memberRouter.get('/api/member/genealogy/binary', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (_req, res) => {
  res.status(200).json(buildGenealogy('binary-placement'));
});

memberRouter.get('/api/member/genealogy/binary-tree', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const rootUsername = typeof req.query.rootUsername === 'string' ? req.query.rootUsername : undefined;
  res.status(200).json(buildScopedBinaryGenealogyCenter(req.authUser!, rootUsername));
});

memberRouter.get('/api/member/genealogy/sponsor-tree', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(buildSponsorGenealogyCenter(req.authUser!));
});

memberRouter.get('/api/member/shadow-accounts', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const ownerUsername = typeof req.query.ownerUsername === 'string' ? req.query.ownerUsername : undefined;
  res.status(200).json(buildShadowAccounts(ownerUsername));
});

memberRouter.get('/api/member/activation-codes', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(buildMemberActivationCodeCenter(req.authUser!));
});

memberRouter.post('/api/member/activation-codes/transfer', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(
    runMemberTransferActivationCodes(req.authUser!, {
      targetUsername: req.body?.targetUsername ?? '',
      codes: Array.isArray(req.body?.codes) ? req.body.codes : []
    })
  );
});

memberRouter.post('/api/member/activation-codes/upgrade', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(
    runMemberUpgradeActivationCode(req.authUser!, {
      code: req.body?.code ?? ''
    })
  );
});

memberRouter.post('/api/member/activation-codes/maintenance', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(
    runMemberMaintenanceCode(req.authUser!, {
      code: req.body?.code ?? '',
      transType: Number(req.body?.transType ?? 1)
    })
  );
});

memberRouter.get('/api/member/transactions', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const payload = buildMemberTransactionCenter(req.authUser!);
  res.status(200).json({
    moneyMode: payload.moneyMode,
    transactions: payload.transactions
  });
});

memberRouter.get('/api/member/transactions/:transactionId', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const transactionId = Array.isArray(req.params.transactionId)
    ? req.params.transactionId[0]
    : req.params.transactionId;
  const payload = buildMemberTransactionCenter(req.authUser!);
  const detail = payload.detailById[transactionId];

  if (!detail) {
    res.status(404).json({ message: 'Transaction not found' });
    return;
  }

  res.status(200).json({
    moneyMode: payload.moneyMode,
    transaction: detail
  });
});

memberRouter.get('/api/member/registration-readiness', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(buildMemberRegistrationReadiness(req.authUser!));
});

memberRouter.post('/api/member/wallet/preview-encash', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const payload = buildMemberWalletDetail(req.authUser!);
  res.status(200).json({
    moneyMode: payload.moneyMode,
    preview: payload.preview,
    requestedAmount: req.body?.amount ?? payload.preview.requestedAmount
  });
});

memberRouter.post('/api/member/wallet/encash', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(runMemberEncashment(req.authUser!, Number(req.body?.amount ?? 0)));
});

memberRouter.get('/api/member/modules/:moduleId', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const moduleId = Array.isArray(req.params.moduleId)
    ? req.params.moduleId[0]
    : req.params.moduleId;
  const module = getMemberModule(req.authUser!, moduleId);

  if (!module) {
    res.status(404).json({
      message: 'Member module not found for this role'
    });
    return;
  }

  res.status(200).json(module);
});

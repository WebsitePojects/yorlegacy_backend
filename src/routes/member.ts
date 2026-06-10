import { Router } from 'express';
import { buildMemberOffice } from '../modules/member/office-service.js';
import { buildMemberSummary } from '../modules/member/summary-service.js';
import { requireRole } from '../modules/auth/request-auth.js';
import { getMemberModule, getHybridMemberForUser } from '../modules/operations/hybrid-operational-data.js';
import {
  buildGenealogy,
  buildMemberMvpDashboard,
  buildShadowAccounts,
  buildWallets,
  getIncomeSimulation
} from '../modules/compensation/mvp-service.js';
import {
  buildAdminActivationCodeCenter,
  buildBinaryGenealogyCenter,
  buildMemberActivationCodeCenter,
  buildMemberRegistrationReadiness,
  buildScopedBinaryGenealogyCenter,
  buildSponsorGenealogyCenter,
  buildAdminMemberManagementCenter,
  buildMemberTransactionCenter,
  buildMemberWalletDetail,
  findMemberProfileByCode,
  runMemberEncashment,
  runMemberMaintenanceCode,
  runMemberTransferActivationCodes,
  runMemberUpgradeActivationCode,
  runMemberUpdatePayout
} from '../modules/operations/legacy-parity-service.js';
import { getProductionEncodingService, isProductionMode } from '../modules/production/runtime.js';

export const memberRouter = Router();

memberRouter.get('/api/member/summary', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const summary = await buildMemberSummary(req.authUser!);
  res.status(200).json(summary);
});

memberRouter.get('/api/member/office', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const office = await buildMemberOffice(req.authUser!);
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const [walletData, pts] = await Promise.all([
          service.buildMemberWalletData(req.authUser!.id),
          service.getMemberBinaryBalance(req.authUser!.id)
        ]);
        const mainWallet = walletData.wallets.find((w: { type: string }) => w.type === 'main');
        const available = mainWallet?.balance ?? 0;
        const updatedMetrics = office.metrics.map((m: { label: string }) =>
          pts && m.label === 'Left Points'  ? { ...m, value: String(pts.leftPoints) }  :
          pts && m.label === 'Right Points' ? { ...m, value: String(pts.rightPoints) } :
          m
        );
        res.status(200).json({
          ...office,
          metrics: updatedMetrics,
          wallet: {
            ...office.wallet,
            availableBalance: `PHP ${available.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
        });
        return;
      } catch (err) {
        console.error('[office] Production override error:', err);
      }
    }
  }
  res.status(200).json(office);
});

memberRouter.get('/api/member/dashboard', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const data = await service.buildMemberWalletData(req.authUser!.id);
        res.status(200).json({
          user: req.authUser,
          moneyMode: 'production',
          packageTier: data.packageTier,
          payoutSchedule: 'Tuesday encashment / Friday payout',
          incomeStreams: data.incomeStreams,
          notices: ['Live production ledger data. Income shown reflects actual credited transactions.']
        });
        return;
      } catch (err) {
        console.error('[dashboard] Production wallet data error:', err);
      }
    }
  }
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

memberRouter.get('/api/member/wallets', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const data = await service.buildMemberWalletData(req.authUser!.id);
        res.status(200).json({ moneyMode: data.moneyMode, wallets: data.wallets, entries: data.entries });
        return;
      } catch (err) {
        console.error('[wallets] Production wallet data error:', err);
      }
    }
  }
  res.status(200).json(buildWallets());
});

memberRouter.get('/api/member/wallet-detail', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const data = await service.buildMemberWalletData(req.authUser!.id);
        res.status(200).json(data);
        return;
      } catch (err) {
        console.error('[wallet-detail] Production wallet data error:', err);
      }
    }
  }
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
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }

    void service.buildScopedBinaryGenealogyCenter(req.authUser!, rootUsername).then((payload) => {
      res.status(200).json(payload);
    }).catch((error) => {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to build binary genealogy tree.' });
    });
    return;
  }

  res.status(200).json(buildScopedBinaryGenealogyCenter(req.authUser!, rootUsername));
});

memberRouter.get('/api/member/genealogy/sponsor-tree', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(buildSponsorGenealogyCenter(req.authUser!));
});

memberRouter.get('/api/member/shadow-accounts', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const ownerUsername = typeof req.query.ownerUsername === 'string' ? req.query.ownerUsername : undefined;
  res.status(200).json(buildShadowAccounts(ownerUsername));
});

memberRouter.get('/api/member/activation-codes', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }

    // Root company account YOR0001 sees the full code inventory (same as admin view).
    const isCompanyRoot = await service.isCompanyRootAccount(req.authUser!);
    if (isCompanyRoot) {
      res.status(200).json(await service.buildAdminActivationCodeCenter());
    } else {
      res.status(200).json(await service.buildMemberActivationCodeCenter(req.authUser!));
    }
    return;
  }

  // Non-production (sandbox) path: resolve the member record and check for the root company username.
  const sandboxMember = getHybridMemberForUser(req.authUser!);
  const companyRootUsernames = ['YOR0001', 'YOR01', 'YOR-COMPANY-ROOT'];
  const isCompanyRootSandbox = companyRootUsernames.includes(sandboxMember?.username?.toUpperCase() ?? '');
  if (isCompanyRootSandbox) {
    res.status(200).json(buildAdminActivationCodeCenter());
  } else {
    res.status(200).json(buildMemberActivationCodeCenter(req.authUser!));
  }
});

memberRouter.get('/api/member/search-profile', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const username = typeof req.query.username === 'string' ? req.query.username.trim() : '';
  const member = findMemberProfileByCode(username);

  if (!member) {
    res.status(404).json({
      message: 'Member not found'
    });
    return;
  }

  res.status(200).json(member);
});

memberRouter.get('/api/member/members/search', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (query.length < 3) {
    res.status(200).json({ results: [] });
    return;
  }

  const payload = buildAdminMemberManagementCenter({
    query,
    page: 1,
    pageSize: 20
  });

  res.status(200).json({
    results: payload.rows.slice(0, 20).map((member) => ({
      username: member.username,
      displayName: member.fullName,
      packageTier: member.packageTier
    }))
  });
});

memberRouter.post('/api/member/activation-codes/transfer', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      res.status(200).json(await service.transferActivationCodes(
        req.authUser!,
        req.body?.targetUsername ?? '',
        Array.isArray(req.body?.codes) ? req.body.codes : []
      ));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to transfer codes.' });
    }
    return;
  }

  res.status(200).json(runMemberTransferActivationCodes(req.authUser!, {
    targetUsername: req.body?.targetUsername ?? '',
    codes: Array.isArray(req.body?.codes) ? req.body.codes : []
  }));
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

memberRouter.get('/api/member/transactions', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const data = await service.buildMemberWalletData(req.authUser!.id);
        res.status(200).json({ moneyMode: data.moneyMode, transactions: data.transactions });
        return;
      } catch (err) {
        console.error('[transactions] Production wallet data error:', err);
      }
    }
  }
  const payload = buildMemberTransactionCenter(req.authUser!);
  res.status(200).json({ moneyMode: payload.moneyMode, transactions: payload.transactions });
});

memberRouter.get('/api/member/transactions/:transactionId', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const transactionId = Array.isArray(req.params.transactionId)
    ? req.params.transactionId[0]
    : req.params.transactionId;

  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const data = await service.buildMemberWalletData(req.authUser!.id);
        const tx = data.transactions.find(t => t.id === transactionId);
        if (!tx) {
          res.status(404).json({ message: 'Transaction not found' });
          return;
        }
        res.status(200).json({ moneyMode: data.moneyMode, transaction: tx });
        return;
      } catch (err) {
        console.error('[transactions/:id] Production wallet data error:', err);
      }
    }
  }

  const payload = buildMemberTransactionCenter(req.authUser!);
  const detail = payload.detailById[transactionId];
  if (!detail) {
    res.status(404).json({ message: 'Transaction not found' });
    return;
  }
  res.status(200).json({ moneyMode: payload.moneyMode, transaction: detail });
});

memberRouter.get('/api/member/registration-readiness', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    res.status(200).json(await service.buildMemberRegistrationReadiness(req.authUser!));
    return;
  }

  res.status(200).json(buildMemberRegistrationReadiness(req.authUser!));
});

memberRouter.post('/api/member/placement-reservations', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (!isProductionMode()) {
    res.status(200).json({
      moneyMode: 'sandbox',
      status: 'completed',
      reason: 'Placement reservations are production-mode only.'
    });
    return;
  }

  const service = getProductionEncodingService();
  if (!service) {
    res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
    return;
  }

  try {
    res.status(200).json(
      await service.createPlacementReservation(req.authUser!, {
        placementParentUsername: String(req.body?.placementParentUsername ?? ''),
        placementSide: req.body?.placementSide === 'right' ? 'right' : 'left',
        expiresInHours: Number(req.body?.expiresInHours ?? 24)
      })
    );
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to create placement reservation.' });
  }
});

memberRouter.post('/api/member/wallet/preview-encash', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const amount = Number(req.body?.amount ?? 0);
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const data = await service.buildMemberWalletData(req.authUser!.id, amount);
        res.status(200).json({ moneyMode: data.moneyMode, preview: data.preview, requestedAmount: data.preview.requestedAmount });
        return;
      } catch (err) {
        console.error('[preview-encash] Production wallet data error:', err);
      }
    }
  }
  const payload = buildMemberWalletDetail(req.authUser!, amount);
  res.status(200).json({ moneyMode: payload.moneyMode, preview: payload.preview, requestedAmount: payload.preview.requestedAmount });
});

memberRouter.post('/api/member/wallet/encash', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.status(200).json(runMemberEncashment(req.authUser!, Number(req.body?.amount ?? 0)));
});

memberRouter.post('/api/member/profile/payout', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const payoutOption = typeof req.body?.payoutOption === 'string' ? req.body.payoutOption : '';
  const payoutDetails = typeof req.body?.payoutDetails === 'string' ? req.body.payoutDetails : '';
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      res.status(200).json(await service.updateMemberPayoutSettings(req.authUser!, { payoutOption, payoutDetails }));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to update payout settings.' });
    }
    return;
  }
  res.status(200).json(runMemberUpdatePayout(req.authUser!, { payoutOption, payoutDetails }));
});

memberRouter.get('/api/member/get-yor-five', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const data = await service.getMemberGetYorFiveData(req.authUser!.id);
        res.status(200).json(data);
        return;
      } catch (err) {
        console.error('[get-yor-five] Production data error:', err);
      }
    }
  }
  // Sandbox fallback: derive from hybrid operational data
  const { getMemberModule: getModule, getHybridMemberForUser } = await import('../modules/operations/hybrid-operational-data.js');
  const mod = getModule(req.authUser!, 'get-five-bonus');
  const member = getHybridMemberForUser(req.authUser!);
  const row = mod?.table.rows[0] ?? {};
  const directSamePackage = Number(row.directSamePackage ?? 0);
  const completedGroups = Number(row.completedGroups ?? 0);
  const CLAIM_VALUES: Record<string, number> = { Classic: 5998, Standard: 25998, Business: 50998, VIP: 159998 };
  const tier = String(member?.packageTier ?? '');
  res.status(200).json({
    moneyMode: 'sandbox',
    memberPackageTier: tier,
    tierProgress: ['Classic', 'Standard', 'Business', 'VIP'].map((t) => ({
      tier: t,
      claimValue: CLAIM_VALUES[t] ?? 0,
      referralCount: t === tier ? directSamePackage : 0,
      completedGroups: t === tier ? completedGroups : 0,
      remainingToNext: t === tier ? (directSamePackage % 5 === 0 ? 5 : 5 - (directSamePackage % 5)) : 5,
      nextThreshold: t === tier ? (completedGroups + 1) * 5 : 5
    })),
    ledgerEntries: [],
    totalEarned: 0,
    completedGroupsTotal: completedGroups
  });
});

memberRouter.get('/api/member/modules/:moduleId', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
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

  // In production, replace salesmatch-bonus metrics and table with live Supabase data
  if (isProductionMode() && moduleId === 'salesmatch-bonus') {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const pts = await service.getMemberBinaryBalance(req.authUser!.id);
        if (pts !== null) {
          module.metrics = [
            { label: 'Current Left', value: String(pts.leftPoints), tone: 'neutral' as const },
            { label: 'Current Right', value: String(pts.rightPoints), tone: 'neutral' as const }
          ];
          // Build pairing rows from lifetime matched totals only when at least one match has occurred
          const tableRows: Array<Record<string, string | number>> = pts.matchedPoints > 0 ? [{
            leftPoints: pts.leftPoints + pts.matchedPoints,
            rightPoints: pts.rightPoints + pts.matchedPoints,
            matchedPoints: pts.matchedPoints,
            salesmatch: `PHP ${pts.matchedSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            carryForward: pts.leftPoints > 0 ? `${pts.leftPoints} left pts` : pts.rightPoints > 0 ? `${pts.rightPoints} right pts` : '0'
          }] : [];
          const columns = [
            { key: 'leftPoints', label: 'Left Points' },
            { key: 'rightPoints', label: 'Right Points' },
            { key: 'matchedPoints', label: 'Matched Points' },
            { key: 'salesmatch', label: 'Salesmatch' },
            { key: 'carryForward', label: 'Carry Forward' }
          ];
          module.table = { title: 'Salesmatch snapshots', columns, rows: tableRows };
        }
      } catch (err) {
        console.error('[modules] salesmatch-bonus enrichment error:', err);
      }
    }
  }

  // In production, replace get-five-bonus metrics and table with live Supabase data
  if (isProductionMode() && moduleId === 'get-five-bonus') {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const gyf = await service.getMemberGetYorFiveData(req.authUser!.id);
        const myTierProgress = gyf.tierProgress.find((t) => t.tier === gyf.memberPackageTier);
        module.metrics = [
          { label: 'Direct Same Package', value: String(myTierProgress?.referralCount ?? 0), tone: 'neutral' as const },
          { label: 'Claimable Groups', value: String(myTierProgress?.completedGroups ?? 0), tone: 'neutral' as const },
          { label: 'Next Milestone', value: myTierProgress && myTierProgress.remainingToNext < 5 ? `${myTierProgress.remainingToNext} remaining` : 'ready now', tone: 'neutral' as const }
        ];
        module.table = {
          title: 'Get Yor Five progress',
          columns: [
            { key: 'package', label: 'Package' },
            { key: 'directSamePackage', label: 'Direct Same Package' },
            { key: 'completedGroups', label: 'Completed Groups' },
            { key: 'remainingToNextGroup', label: 'Remaining to Next' },
            { key: 'target', label: 'Target' },
            { key: 'status', label: 'Status' }
          ],
          rows: gyf.tierProgress
            .filter((t) => t.tier === gyf.memberPackageTier)
            .map((t) => ({
              package: t.tier,
              directSamePackage: t.referralCount,
              completedGroups: t.completedGroups,
              remainingToNextGroup: t.remainingToNext,
              target: 5,
              status: t.referralCount >= 5 ? 'qualified' : 'building'
            }))
        };
      } catch (err) {
        console.error('[modules] get-five-bonus enrichment error:', err);
      }
    }
  }

  // In production, replace get-yor-five metrics and table with live Supabase data
  if (isProductionMode() && moduleId === 'get-yor-five') {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const gyf = await service.getMemberGetYorFiveData(req.authUser!.id);
        const myTierProgress = gyf.tierProgress.find((t) => t.tier === gyf.memberPackageTier);
        module.metrics = [
          { label: 'Direct Same Package', value: String(myTierProgress?.referralCount ?? 0), tone: 'neutral' as const },
          { label: 'Claimable Groups', value: String(myTierProgress?.completedGroups ?? 0), tone: 'neutral' as const },
          { label: 'Next Milestone', value: myTierProgress && myTierProgress.remainingToNext < 5 ? `${myTierProgress.remainingToNext} remaining` : 'ready now', tone: 'neutral' as const }
        ];
        module.table = {
          title: 'Get Yor Five overview',
          columns: [
            { key: 'package', label: 'Package' },
            { key: 'directSamePackage', label: 'Direct Same Package' },
            { key: 'completedGroups', label: 'Completed Groups' },
            { key: 'remainingToNextGroup', label: 'Remaining to Next' },
            { key: 'target', label: 'Target' },
            { key: 'status', label: 'Status' }
          ],
          rows: gyf.tierProgress
            .filter((t) => t.tier === gyf.memberPackageTier)
            .map((t) => ({
              package: t.tier,
              directSamePackage: t.referralCount,
              completedGroups: t.completedGroups,
              remainingToNextGroup: t.remainingToNext,
              target: 5,
              status: t.referralCount >= 5 ? 'qualified' : 'building'
            }))
        };
      } catch (err) {
        console.error('[modules] get-yor-five enrichment error:', err);
      }
    }
  }

  res.status(200).json(module);
});

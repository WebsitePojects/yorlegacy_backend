import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from '../lib/rate-limit.js';
import { addLiveClient } from '../lib/live-events.js';
import { moneyAmountSchema, parseBody } from '../lib/validate.js';
import { submitSupportMessage } from '../modules/support/support-service.js';
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
  runMemberUpdatePayout,
  runMemberUpdateCredentials
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
        const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
        const [walletData, pts] = await Promise.all([
          service.buildMemberWalletData(memberViewUserId),
          service.getMemberBinaryBalance(memberViewUserId)
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
          // Item 8: surface the member's real saved payout method + details on
          // Account Details (no GCash default, and the saved account number is
          // returned so the field fetches/displays it).
          profile: {
            ...office.profile,
            payoutMethod: walletData.summary.payoutMethod ?? '',
            payoutDetails: walletData.summary.payoutDetails ?? ''
          },
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
        const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
        const data = await service.buildMemberWalletData(memberViewUserId);
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
        const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
        const data = await service.buildMemberWalletData(memberViewUserId);
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
        const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
        const data = await service.buildMemberWalletData(memberViewUserId);
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
  // Optional depth window (tree levels) so we only build what the canvas shows.
  const depth = typeof req.query.depth === 'string' ? Number(req.query.depth) : undefined;
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }

    void service.buildScopedBinaryGenealogyCenter(req.authUser!, rootUsername, depth && Number.isFinite(depth) ? depth : undefined).then((payload) => {
      res.status(200).json(payload);
    }).catch((error) => {
      console.error('[member/genealogy/binary-tree] production render failed', {
        userId: req.authUser?.id,
        role: req.authUser?.role,
        email: req.authUser?.email,
        rootUsername,
        depth
      }, error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to build binary genealogy tree.' });
    });
    return;
  }

  try {
    res.status(200).json(buildScopedBinaryGenealogyCenter(req.authUser!, rootUsername));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to build binary genealogy tree.' });
  }
});

memberRouter.get('/api/member/genealogy/sponsor-tree', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const rootUsername = typeof req.query.rootUsername === 'string' ? req.query.rootUsername : undefined;
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable.' });
      return;
    }
    void service.buildScopedSponsorGenealogyCenter(req.authUser!, rootUsername).then((payload) => {
      res.status(200).json(payload);
    }).catch((error) => {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to build sponsor tree.' });
    });
    return;
  }
  res.status(200).json(buildSponsorGenealogyCenter(req.authUser!));
});

memberRouter.get('/api/member/shadow-accounts', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const ownerUsername = typeof req.query.ownerUsername === 'string' ? req.query.ownerUsername : undefined;
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }

    void service.buildMemberShadowAccountCenter(req.authUser!, ownerUsername).then((payload) => {
      res.status(200).json(payload);
    }).catch((error) => {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to build shadow account center.' });
    });
    return;
  }

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

// Live updates stream (SSE). The dashboard opens this once; the compensation engine
// pushes 'update' events here whenever this member's PV or income changes, so the UI
// ticks live without polling.
memberRouter.get('/api/member/live', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(': connected\n\n');
  const remove = addLiveClient(req.authUser!.id, { write: (chunk) => res.write(chunk) });
  // Keep-alive comment every 25s so proxies don't drop the idle connection.
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* closed */ }
  }, 25_000);
  req.on('close', () => {
    clearInterval(keepAlive);
    remove();
  });
});

// On-demand trigger: immediately runs salesmatch reconcile for the calling user.
// Idempotent — safe to call on every income page load. The processId lock in
// postLedgerIfNeeded ensures the same matched amount is never double-credited.
memberRouter.post('/api/member/trigger-compensation', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const [smb, queue] = await Promise.all([
          service.reconcileSalesmatchForUser(req.authUser!.id),
          service.processCompensationQueue(50)
        ]);
        res.status(200).json({ credited: smb, processed: queue.processed.length });
        return;
      } catch (err) {
        console.error('[trigger-compensation] error:', err);
      }
    }
  }
  res.status(200).json({ credited: 0, processed: 0 });
});

memberRouter.get('/api/member/salesmatch/pairing-events', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
        res.status(200).json(await service.getMemberPairingEvents(memberViewUserId));
        return;
      } catch (err) {
        console.error('[pairing-events] Production error:', err);
      }
    }
  }
  res.status(200).json({ moneyMode: 'sandbox', events: [] });
});

memberRouter.get('/api/member/direct-referrals', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
        const rows = await service.buildMemberDirectReferrals(memberViewUserId);
        res.status(200).json({ rows });
        return;
      } catch (err) {
        console.error('[direct-referrals] Production error:', err);
      }
    }
  }
  res.status(200).json({ rows: [] });
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

memberRouter.get('/api/member/members/search', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (query.length < 3) {
    res.status(200).json({ results: [] });
    return;
  }

  // Code transfer can target anyone in the directory (in-network to any depth and
  // outside the network), so this resolves against the real member directory in
  // production instead of the sandbox parity store.
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      const payload = await service.listAdminMembersForManagement({ query, page: 1, pageSize: 20 });
      res.status(200).json({
        results: payload.rows.slice(0, 20).map((member) => ({
          username: member.username,
          displayName: member.fullName,
          packageTier: member.packageTier
        }))
      });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to search members.' });
    }
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

memberRouter.post('/api/member/activation-codes/upgrade', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode() && typeof req.body?.shadowCode === 'string' && req.body.shadowCode.trim()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      res.status(200).json(await service.activateShadowAccount(req.authUser!, {
        code: req.body?.code ?? '',
        shadowCode: req.body.shadowCode
      }));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to activate shadow account.' });
    }
    return;
  }

  res.status(200).json(
    runMemberUpgradeActivationCode(req.authUser!, {
      code: req.body?.code ?? ''
    })
  );
});

memberRouter.post('/api/member/activation-codes/maintenance', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  try {
    const result = await runMemberMaintenanceCode(req.authUser!, {
      code: req.body?.code ?? '',
      transType: Number(req.body?.transType ?? 1)
    });
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Maintenance code error.';
    res.status(400).json({ error: { code: 'MAINTENANCE_CODE_ERROR', message } });
  }
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
    // No silent sandbox fallback in production mode: failing over to demo data
    // would show members fake balances.
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      const data = await service.buildMemberWalletData(req.authUser!.id, amount);
      res.status(200).json({ moneyMode: data.moneyMode, preview: data.preview, requestedAmount: data.preview.requestedAmount });
    } catch (error) {
      // Internal storage errors stay in the server log; clients get a safe message.
      console.error('[preview-encash] failed:', error);
      res.status(500).json({ message: 'Unable to preview encashment.' });
    }
    return;
  }
  const payload = buildMemberWalletDetail(req.authUser!, amount);
  res.status(200).json({ moneyMode: payload.moneyMode, preview: payload.preview, requestedAmount: payload.preview.requestedAmount });
});

const encashRateLimit = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'encash-submit' });

memberRouter.post(
  '/api/member/wallet/encash',
  requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'),
  encashRateLimit,
  async (req, res) => {
    let amount: number;
    try {
      amount = parseBody(z.object({ amount: moneyAmountSchema }), { amount: req.body?.amount }).amount;
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Enter a valid encashment amount.' });
      return;
    }

    if (isProductionMode()) {
      const service = getProductionEncodingService();
      if (!service) {
        res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
        return;
      }
      try {
        res.status(200).json(await service.submitEncashment(req.authUser!, amount));
      } catch (error) {
        // The client maps DB/technical errors to a generic toast, so log the real
        // cause server-side (visible via `pm2 logs`) for diagnosis.
        console.error('[encash-submit] failed:', error);
        res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to submit encashment.' });
      }
      return;
    }
    res.status(200).json(runMemberEncashment(req.authUser!, amount));
  }
);

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

memberRouter.post('/api/member/profile/credentials', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : undefined;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : undefined;
  const password = typeof req.body?.password === 'string' ? req.body.password : undefined;

  if (!username && !email && !password) {
    res.status(400).json({ message: 'Provide at least one field to update.' });
    return;
  }

  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable.' });
      return;
    }
    try {
      res.status(200).json(
        await service.updateOwnMemberCredentials(req.authUser!, {
          username: username || undefined,
          email: email || undefined,
          password: password || undefined
        })
      );
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to update credentials.' });
    }
    return;
  }

  try {
    res.status(200).json(
      runMemberUpdateCredentials(req.authUser!, {
        username: username || undefined,
        email: email || undefined,
        password: password || undefined
      })
    );
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to update credentials.' });
  }
});

memberRouter.get('/api/member/get-yor-five', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service unavailable.' });
      return;
    }
    try {
      const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
      res.status(200).json(await service.getMemberGetYorFiveData(memberViewUserId));
    } catch (err) {
      console.error('[get-yor-five] Production data error:', err);
      res.status(500).json({ message: 'Unable to load Get Yor Five data.' });
    }
    return;
  }
  // Non-production path
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

memberRouter.get('/api/member/rank', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service unavailable.' });
      return;
    }
    try {
      const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
      res.status(200).json(await service.getMemberRank(memberViewUserId));
    } catch (err) {
      console.error('[rank] Production data error:', err);
      res.status(500).json({ message: 'Unable to load rank data.' });
    }
    return;
  }
  res.status(200).json({
    moneyMode: 'sandbox',
    level: 0,
    rankName: 'Unranked',
    unilevelIncome: 0,
    currentThreshold: 0,
    nextRankName: 'Manager',
    nextThreshold: 50000,
    remainingToNext: 50000
  });
});

memberRouter.get('/api/member/leaderboard', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service unavailable.' });
      return;
    }
    try {
      res.status(200).json(await service.getLeaderboard());
    } catch (err) {
      console.error('[leaderboard] Production data error:', err);
      res.status(500).json({ message: 'Unable to load leaderboard.' });
    }
    return;
  }
  res.status(200).json({ moneyMode: 'sandbox', entries: [] });
});

memberRouter.get('/api/member/unilevel', requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service unavailable.' });
      return;
    }
    try {
      const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
      res.status(200).json(await service.getMemberUnilevelData(memberViewUserId));
    } catch (err) {
      console.error('[unilevel] Production data error:', err);
      res.status(500).json({ message: 'Unable to load unilevel data.' });
    }
    return;
  }
  res.status(200).json({
    moneyMode: 'sandbox',
    levelPercentages: [10, 8, 5, 5, 3, 3, 2, 1, 1, 1],
    totalEarned: 0,
    byLevel: [],
    entries: []
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
        const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
        const pts = await service.getMemberBinaryBalance(memberViewUserId);
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
        const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
        const gyf = await service.getMemberGetYorFiveData(memberViewUserId);
        const myTierProgress = gyf.tierProgress.find((t) => t.tier === gyf.memberPackageTier);
        const myVoidedGroups = gyf.voidedGroups.filter((v) => v.tier === gyf.memberPackageTier).length;
        module.metrics = [
          { label: 'Direct Same Package', value: String(myTierProgress?.referralCount ?? 0), tone: 'neutral' as const },
          { label: 'Claimable Groups', value: String(myTierProgress?.completedGroups ?? 0), tone: 'neutral' as const },
          { label: 'Next Milestone', value: myTierProgress && myTierProgress.remainingToNext < 5 ? `${myTierProgress.remainingToNext} more in ${myTierProgress.remainingDays}d` : 'ready now', tone: 'neutral' as const },
          { label: 'Voided Groups', value: String(myVoidedGroups), tone: myVoidedGroups > 0 ? ('warning' as const) : ('neutral' as const) }
        ];
        module.table = {
          title: 'Get Yor Five progress',
          columns: [
            { key: 'package', label: 'Package' },
            { key: 'directSamePackage', label: 'Direct Same Package' },
            { key: 'completedGroups', label: 'Completed Groups' },
            { key: 'remainingToNextGroup', label: 'Remaining to Next' },
            { key: 'daysLeft', label: 'Days Left' },
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
              daysLeft: t.remainingDays > 0 ? `${t.remainingDays}d` : '—',
              target: 5,
              status: t.completedGroups > 0 ? 'qualified' : t.remainingDays > 0 ? 'in window' : 'building'
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
        const memberViewUserId = await service.resolveMemberViewUserId(req.authUser!);
        const gyf = await service.getMemberGetYorFiveData(memberViewUserId);
        const myTierProgress = gyf.tierProgress.find((t) => t.tier === gyf.memberPackageTier);
        const myVoidedGroups = gyf.voidedGroups.filter((v) => v.tier === gyf.memberPackageTier).length;
        module.metrics = [
          { label: 'Direct Same Package', value: String(myTierProgress?.referralCount ?? 0), tone: 'neutral' as const },
          { label: 'Claimable Groups', value: String(myTierProgress?.completedGroups ?? 0), tone: 'neutral' as const },
          { label: 'Next Milestone', value: myTierProgress && myTierProgress.remainingToNext < 5 ? `${myTierProgress.remainingToNext} more in ${myTierProgress.remainingDays}d` : 'ready now', tone: 'neutral' as const },
          { label: 'Voided Groups', value: String(myVoidedGroups), tone: myVoidedGroups > 0 ? ('warning' as const) : ('neutral' as const) }
        ];
        module.table = {
          title: 'Get Yor Five overview',
          columns: [
            { key: 'package', label: 'Package' },
            { key: 'directSamePackage', label: 'Direct Same Package' },
            { key: 'completedGroups', label: 'Completed Groups' },
            { key: 'remainingToNextGroup', label: 'Remaining to Next' },
            { key: 'daysLeft', label: 'Days Left' },
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
              daysLeft: t.remainingDays > 0 ? `${t.remainingDays}d` : '—',
              target: 5,
              status: t.completedGroups > 0 ? 'qualified' : t.remainingDays > 0 ? 'in window' : 'building'
            }))
        };
      } catch (err) {
        console.error('[modules] get-yor-five enrichment error:', err);
      }
    }
  }

  res.status(200).json(module);
});

const supportMessageRateLimit = rateLimit({ windowMs: 300_000, max: 5, keyPrefix: 'support-message' });

memberRouter.post('/api/member/support/message', supportMessageRateLimit, requireRole('member', 'admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const user = req.authUser!;
  let payload: { category: string; subject: string; message: string };
  try {
    payload = parseBody(
      z.object({
        category: z.enum(['general', 'account', 'technical', 'encashment']),
        subject: z.string().min(3).max(120),
        message: z.string().min(10).max(2000)
      }),
      req.body
    );
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid request.' });
    return;
  }
  try {
    const submitted = await submitSupportMessage({
      userId: user.id,
      username: user.id,
      displayName: user.name ?? 'Unknown',
      email: user.email ?? '',
      category: payload.category as 'general' | 'account' | 'technical' | 'encashment',
      subject: payload.subject,
      message: payload.message
    });
    res.status(200).json({ status: 'submitted', id: submitted.id });
  } catch {
    res.status(500).json({ message: 'Unable to submit support message.' });
  }
});

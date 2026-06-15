import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from '../lib/rate-limit.js';
import { codeQuantitySchema, parseBody } from '../lib/validate.js';
import { listSupportMessages, updateSupportMessageStatus } from '../modules/support/support-service.js';
import { buildAdminOffice } from '../modules/admin/office-service.js';
import { buildAdminSummary } from '../modules/admin/summary-service.js';
import {
  findAdminProfileByUserId,
  findStaffAccountById,
  listStaffAccounts,
  updateUserPassword
} from '../modules/auth/app-users.js';
import { createPasswordHash } from '../modules/auth/password.js';
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
import { getProductionEncodingService, isProductionMode } from '../modules/production/runtime.js';
import { voucherService } from '../modules/vouchers/voucher-service.js';
import { newsService } from '../modules/news/news-service.js';

export const adminRouter = Router();

adminRouter.get('/api/admin/summary', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const summary = await buildAdminSummary(req.authUser!);
  res.status(200).json(summary);
});

adminRouter.get('/api/admin/office', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const office = await buildAdminOffice(req.authUser!);
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const prodMetrics = await service.buildAdminDashboardMetrics();
        const existingLabels = new Set(prodMetrics.map((m) => m.label.toLowerCase()));
        const baseMetrics = office.metrics.filter((m) => !existingLabels.has(m.label.toLowerCase()));
        res.status(200).json({ ...office, metrics: [...prodMetrics, ...baseMetrics] });
        return;
      } catch {
        // fall through to sandbox office
      }
    }
  }
  res.status(200).json(office);
});

adminRouter.get('/api/admin/dashboard', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  res.status(200).json(await buildAdminMvpDashboard(req.authUser!));
});

adminRouter.get('/api/admin/members', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query : '';
  const username = typeof req.query.username === 'string' ? req.query.username : '';
  const page = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
  const pageSize = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : 10;

  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ error: 'Production service unavailable.' });
      return;
    }
    try {
      const payload = await service.listAdminMembersForManagement({ query, username, page, pageSize });
      res.status(200).json({ ...payload, members: payload.rows });
      return;
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch members from database.' });
      return;
    }
  }

  const payload = buildAdminMemberManagementCenter({ query, username, page, pageSize });
  res.status(200).json({ ...payload, members: payload.rows });
});

adminRouter.get('/api/admin/members/search', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (query.length < 3) {
    res.status(200).json({ results: [] });
    return;
  }

  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ results: [] });
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
      return;
    } catch {
      res.status(200).json({ results: [] });
      return;
    }
  }

  const payload = buildAdminMemberManagementCenter({ query, page: 1, pageSize: 20 });
  res.status(200).json({
    results: payload.rows.slice(0, 20).map((member) => ({
      username: member.username,
      displayName: member.fullName,
      packageTier: member.packageTier
    }))
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

adminRouter.get('/api/admin/cashiers', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service unavailable.' });
      return;
    }
    res.status(200).json(await service.listCashiers());
    return;
  }
  res.status(200).json([]);
});

adminRouter.get('/api/admin/activation-codes', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    res.status(200).json(await service.buildAdminActivationCodeCenter(req.authUser!));
    return;
  }

  res.status(200).json(buildAdminActivationCodeCenter());
});

const generateRateLimit = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'code-generate' });

// GATE-CASHIER-CODES-20260613: cashier cannot generate codes — only admin/bod/superadmin.
// Cashier flow: admin generates → admin transfers to cashier → cashier releases/transfers.
adminRouter.post('/api/admin/activation-codes/generate', requireRole('admin', 'bod', 'superadmin'), generateRateLimit, async (req, res) => {
  const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.slice(0, 200) : '';
  let quantity: number;
  try {
    quantity = parseBody(z.object({ quantity: codeQuantitySchema }), { quantity: Number(req.body?.quantity ?? 1) }).quantity;
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Enter a valid quantity (1-100).' });
    return;
  }

  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      res.status(200).json(
        await service.generateActivationCodes(req.authUser!, {
          quantity,
          packageTier: req.body?.packageTier,
          assignedTo: req.body?.assignedTo,
          assignedToUserId: typeof req.body?.assignedToUserId === 'string' ? req.body.assignedToUserId : undefined,
          accountType: req.body?.accountType,
          codeFamily: req.body?.codeFamily,
          remarks
        })
      );
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to generate activation codes.' });
    }
    return;
  }

  res.status(200).json(runAdminGenerateActivationCodes(req.authUser!, {
    quantity,
    packageTier: req.body?.packageTier,
    assignedTo: req.body?.assignedTo,
    accountType: req.body?.accountType,
    remarks,
    codeFamily: req.body?.codeFamily
  }));
});

adminRouter.post('/api/admin/activation-codes/release', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const codes = Array.isArray(req.body?.codes)
    ? req.body.codes.filter((code: unknown): code is string => typeof code === 'string')
    : [];

  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      res.status(200).json(await service.releaseActivationCodes(req.authUser!, codes));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to release activation codes.' });
    }
    return;
  }

  res.status(200).json(runAdminReleaseActivationCodes(req.authUser!, { codes }));
});

adminRouter.post('/api/admin/activation-codes/transfer', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const codes = Array.isArray(req.body?.codes)
    ? req.body.codes.filter((code: unknown): code is string => typeof code === 'string')
    : [];

  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      res.status(200).json(await service.transferActivationCodes(
        req.authUser!,
        typeof req.body?.targetUsername === 'string' ? req.body.targetUsername : '',
        codes
      ));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to transfer activation codes.' });
    }
    return;
  }

  res.status(200).json(runAdminTransferActivationCodes(req.authUser!, {
    targetUsername: typeof req.body?.targetUsername === 'string' ? req.body.targetUsername : '',
    codes
  }));
});

// Settlement is a finance action: admin/BOD/superadmin only â€” cashier is
// limited to release/transfer/name-correction per the approved role matrix.
adminRouter.post('/api/admin/activation-codes/settle', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const mode = req.body?.mode === 'externally-paid' ? 'externally-paid' : req.body?.mode === 'paid' ? 'paid' : null;
  if (!code || !mode) {
    res.status(400).json({ message: 'Provide a code and a settlement mode (paid or externally-paid).' });
    return;
  }

  if (!isProductionMode()) {
    res.status(400).json({ message: 'Code settlement is only available in production mode.' });
    return;
  }
  const service = getProductionEncodingService();
  if (!service) {
    res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
    return;
  }
  try {
    res.status(200).json(await service.settleActivationCode(req.authUser!, code, mode));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to settle activation code.' });
  }
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

// News / Announcements management (admin-authored, surfaced on the public bulletin).
adminRouter.get('/api/admin/news-posts', requireRole('admin', 'bod', 'superadmin'), async (_req, res) => {
  try {
    res.status(200).json({ posts: await newsService.listAll() });
  } catch (error) {
    console.error('[admin-news] load failed:', error);
    res.status(500).json({ message: 'Unable to load posts.' });
  }
});

adminRouter.post('/api/admin/news-posts', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  const category = ['announcement', 'news', 'promo', 'memo'].includes(req.body?.category) ? req.body.category : 'announcement';
  const status = ['draft', 'published', 'archived'].includes(req.body?.status) ? req.body.status : 'draft';
  if (title.length < 3 || body.length < 3) {
    res.status(400).json({ message: 'Title and body are required.' });
    return;
  }
  try {
    const post = await newsService.create({
      title, body, category, status, pinned: Boolean(req.body?.pinned),
      createdByUserId: req.authUser!.id, createdByLabel: req.authUser!.name ?? 'admin'
    });
    res.status(200).json({ post });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to create post.' });
  }
});

adminRouter.patch('/api/admin/news-posts/:id', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const post = await newsService.update(id, {
      title: typeof req.body?.title === 'string' ? req.body.title.trim() : undefined,
      body: typeof req.body?.body === 'string' ? req.body.body.trim() : undefined,
      category: ['announcement', 'news', 'promo', 'memo'].includes(req.body?.category) ? req.body.category : undefined,
      status: ['draft', 'published', 'archived'].includes(req.body?.status) ? req.body.status : undefined,
      pinned: typeof req.body?.pinned === 'boolean' ? req.body.pinned : undefined
    });
    res.status(200).json({ post });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to update post.' });
  }
});

adminRouter.delete('/api/admin/news-posts/:id', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    await newsService.remove(id);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to delete post.' });
  }
});

// Shadow-account overview — system-wide shadow monitoring (leg volumes, matched, SMB transferred).
adminRouter.get('/api/admin/shadow-overview', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (_req, res) => {
  if (!isProductionMode()) {
    res.status(200).json({ stats: null, shadows: [] });
    return;
  }
  const service = getProductionEncodingService();
  if (!service) {
    res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
    return;
  }
  try {
    res.status(200).json(await service.buildShadowAccountOverview());
  } catch (error) {
    console.error('[admin-shadow-overview] load failed:', error);
    res.status(500).json({ message: 'Unable to load shadow accounts.' });
  }
});

// CD (Credit-Deduction) account center — real per-account data + package breakdown + totals.
adminRouter.get('/api/admin/cd-accounts', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (_req, res) => {
  if (!isProductionMode()) {
    res.status(200).json({ stats: null, packageBreakdown: [], accounts: [] });
    return;
  }
  const service = getProductionEncodingService();
  if (!service) {
    res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
    return;
  }
  try {
    res.status(200).json(await service.buildCdAccountCenter());
  } catch (error) {
    console.error('[admin-cd-accounts] load failed:', error);
    res.status(500).json({ message: 'Unable to load CD accounts.' });
  }
});

// Paginated activation-code history (full audit trail, server-side paged for performance).
adminRouter.get('/api/admin/activation-code-events', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (!isProductionMode()) {
    res.status(200).json({ events: [], total: 0, page: 1, pageSize: 50, totalPages: 1 });
    return;
  }
  const service = getProductionEncodingService();
  if (!service) {
    res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
    return;
  }
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 50);
    res.status(200).json(await service.getActivationCodeEventsPage(page, pageSize));
  } catch (error) {
    console.error('[admin-code-events] load failed:', error);
    res.status(500).json({ message: 'Unable to load activation-code history.' });
  }
});

// GATE-ADMIN-PWD-20260615: real staff-account directory + privileged password reset.
// Authorization rule: only a superadmin may change a superadmin's password; admin/bod cannot.
adminRouter.get('/api/admin/staff-accounts', requireRole('admin', 'bod', 'superadmin'), async (_req, res) => {
  try {
    const accounts = await listStaffAccounts();
    res.status(200).json({ accounts });
  } catch (error) {
    console.error('[admin-staff-accounts] load failed:', error);
    res.status(500).json({ message: 'Unable to load staff accounts.' });
  }
});

adminRouter.post('/api/admin/staff-accounts/:id/password', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (newPassword.length < 8) {
    res.status(400).json({ message: 'New password must be at least 8 characters.' });
    return;
  }

  try {
    const target = await findStaffAccountById(id);
    if (!target) {
      res.status(404).json({ message: 'Staff account not found.' });
      return;
    }

    // Only a superadmin can change a superadmin password.
    if (target.role === 'superadmin' && req.authUser!.role !== 'superadmin') {
      res.status(403).json({ message: 'Only a Super Admin can change a Super Admin password.' });
      return;
    }

    const { hash, salt } = await createPasswordHash(newPassword);
    const ok = await updateUserPassword(id, hash, salt);
    if (!ok) {
      res.status(503).json({ message: 'Password update is unavailable because Supabase is not configured.' });
      return;
    }
    res.status(200).json({ ok: true, account: { id: target.id, displayName: target.displayName, role: target.role } });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to change password.' });
  }
});

// GATE-VOUCHER-B1T1-20260615: Buy-1-Take-1 voucher inventory (admin-side surface).
adminRouter.get('/api/admin/vouchers', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (_req, res) => {
  try {
    res.status(200).json(await voucherService.getVoucherCenter());
  } catch (error) {
    console.error('[admin-vouchers] load failed:', error);
    res.status(500).json({ message: 'Unable to load vouchers.' });
  }
});

adminRouter.post('/api/admin/vouchers/grant', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  try {
    const voucher = await voucherService.grantVoucher(req.authUser!, {
      beneficiaryUsername: typeof req.body?.beneficiaryUsername === 'string' ? req.body.beneficiaryUsername : '',
      packageTier: typeof req.body?.packageTier === 'string' ? req.body.packageTier : '',
      quantity: Number(req.body?.quantity ?? 1),
      expiresAt: typeof req.body?.expiresAt === 'string' && req.body.expiresAt ? req.body.expiresAt : null,
      remarks: typeof req.body?.remarks === 'string' ? req.body.remarks : null
    });
    res.status(200).json({ voucher });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to grant voucher.' });
  }
});

adminRouter.post('/api/admin/vouchers/:id/suspend', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    res.status(200).json({ voucher: await voucherService.suspendVoucher(req.authUser!, id) });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to suspend voucher.' });
  }
});

adminRouter.post('/api/admin/vouchers/:id/reactivate', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    res.status(200).json({ voucher: await voucherService.reactivateVoucher(req.authUser!, id) });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to reactivate voucher.' });
  }
});

adminRouter.get('/api/admin/encashments', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      res.status(200).json(await service.buildAdminEncashmentCenter());
      return;
    } catch (error) {
      // Internal storage errors stay in the server log; clients get a safe message.
      console.error('[admin-encashments] load failed:', error);
      res.status(500).json({ message: 'Unable to load encashments.' });
      return;
    }
  }
  res.status(200).json(buildAdminEncashmentCenter(req.authUser!));
});

adminRouter.post('/api/admin/encashments/:encashmentId/approve', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const encashmentId = Array.isArray(req.params.encashmentId) ? req.params.encashmentId[0] : req.params.encashmentId;
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      res.status(200).json(await service.reviewEncashment(req.authUser!, encashmentId, 'approve'));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to approve encashment.' });
    }
    return;
  }
  res.status(200).json(runAdminApproveEncashment(req.authUser!, encashmentId));
});

adminRouter.post('/api/admin/encashments/:encashmentId/review', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const encashmentId = Array.isArray(req.params.encashmentId) ? req.params.encashmentId[0] : req.params.encashmentId;
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    const action =
      req.body?.action === 'approve' || req.body?.action === 'reject' || req.body?.action === 'mark-paid'
        ? req.body.action
        : null;
    if (!action) {
      res.status(400).json({ message: 'Provide a review action: approve, reject, or mark-paid.' });
      return;
    }
    try {
      res.status(200).json(
        await service.reviewEncashment(
          req.authUser!,
          encashmentId,
          action,
          typeof req.body?.remarks === 'string' ? req.body.remarks : undefined
        )
      );
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to review encashment.' });
    }
    return;
  }
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

adminRouter.post('/api/admin/compensation/process-queue', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  if (!isProductionMode()) {
    res.status(200).json({ moneyMode: 'sandbox', processed: [] });
    return;
  }
  const service = getProductionEncodingService();
  if (!service) {
    res.status(503).json({ message: 'Production encoding service unavailable.' });
    return;
  }
  try {
    const limit = Math.max(1, Math.min(500, Number(req.body?.limit ?? 100)));
    const result = await service.processCompensationQueue(limit);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Queue processing failed.' });
  }
});

adminRouter.post('/api/admin/sandbox/reset', requireRole('superadmin'), (req, res) => {
  res.status(200).json(runAdminResetSandbox(req.authUser!));
});

adminRouter.post('/api/admin/members/:username/change-name', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName : '';
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      res.status(200).json(await service.changeMemberFullName(req.authUser!, username, fullName));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to change member name.' });
    }
    return;
  }
  res.status(200).json(runAdminChangeMemberName(req.authUser!, { username, fullName }));
});

adminRouter.post('/api/admin/members/:username/profile', requireRole('admin', 'cashier', 'bod', 'superadmin'), async (req, res) => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const actorRole = req.authUser!.role;
  const canEditFullProfile = actorRole === 'admin' || actorRole === 'superadmin' || actorRole === 'bod';

  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    try {
      res.status(200).json(
        await service.updateMemberProfileByUsername(req.authUser!, {
          username,
          firstName: typeof req.body?.firstName === 'string' ? req.body.firstName : '',
          lastName: typeof req.body?.lastName === 'string' ? req.body.lastName : '',
          middleName: typeof req.body?.middleName === 'string' ? req.body.middleName : '',
          password: canEditFullProfile && typeof req.body?.password === 'string' ? req.body.password : '',
          payoutOption: canEditFullProfile && typeof req.body?.payoutOption === 'string' ? req.body.payoutOption : '',
          payoutDetails: canEditFullProfile && typeof req.body?.payoutDetails === 'string' ? req.body.payoutDetails : '',
          contactNumber: canEditFullProfile && typeof req.body?.contactNumber === 'string' ? req.body.contactNumber : '',
          email: canEditFullProfile && typeof req.body?.email === 'string' ? req.body.email : undefined,
          newUsername: canEditFullProfile && typeof req.body?.newUsername === 'string' ? req.body.newUsername : undefined
        })
      );
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to update member profile.' });
    }
    return;
  }

  res.status(200).json(
    runAdminUpdateMemberProfile(req.authUser!, {
      username,
      firstName: typeof req.body?.firstName === 'string' ? req.body.firstName : '',
      lastName: typeof req.body?.lastName === 'string' ? req.body.lastName : '',
      middleName: typeof req.body?.middleName === 'string' ? req.body.middleName : '',
      password: canEditFullProfile && typeof req.body?.password === 'string' ? req.body.password : '',
      payoutOption: canEditFullProfile && typeof req.body?.payoutOption === 'string' ? req.body.payoutOption : '',
      payoutDetails: canEditFullProfile && typeof req.body?.payoutDetails === 'string' ? req.body.payoutDetails : '',
      address: canEditFullProfile && typeof req.body?.address === 'string' ? req.body.address : '',
      contactNumber: canEditFullProfile && typeof req.body?.contactNumber === 'string' ? req.body.contactNumber : '',
      email: canEditFullProfile && typeof req.body?.email === 'string' ? req.body.email : undefined,
      newUsername: canEditFullProfile && typeof req.body?.newUsername === 'string' ? req.body.newUsername : undefined
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
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    void service.buildAdminBinaryGenealogyCenter(rootUsername).then((payload) => {
      res.status(200).json(payload);
    }).catch((error) => {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to build admin binary genealogy tree.' });
    });
    return;
  }
  res.status(200).json(buildAdminGenealogyCenter('binary-placement', rootUsername));
});

adminRouter.get('/api/admin/genealogy/sponsor-tree', requireRole('admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
  const rootUsername = typeof req.query.rootUsername === 'string' ? req.query.rootUsername : undefined;
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production service unavailable.' });
      return;
    }
    void service.buildScopedSponsorGenealogyCenter(req.authUser!, rootUsername).then((payload) => {
      res.status(200).json(payload);
    }).catch((err) => {
      res.status(400).json({ message: err instanceof Error ? err.message : 'Unable to build sponsor tree.' });
    });
    return;
  }
  res.status(200).json(buildAdminGenealogyCenter('sponsor', rootUsername));
});

adminRouter.get('/api/admin/shadow-accounts', requireRole('admin', 'cashier', 'bod', 'superadmin'), (req, res) => {
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
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to build admin shadow account center.' });
    });
    return;
  }

  res.status(404).json({ message: 'Shadow account center is only available in production mode.' });
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

  // In production, override the static sandbox catalog table with real DB data for
  // the modules that have a production builder (rankings, finance-accounting, ...).
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (service) {
      try {
        const live = await service.buildAdminModuleProductionData(moduleId);
        if (live) {
          res.status(200).json({ ...module, status: 'live-report', metrics: live.metrics, table: live.table });
          return;
        }
      } catch (error) {
        console.error(`[admin-module:${moduleId}] production data failed:`, error);
      }
    }
  }

  res.status(200).json(module);
});

adminRouter.get('/api/admin/contact-messages', requireRole('admin', 'bod', 'superadmin'), async (_req, res) => {
  try {
    const messages = await listSupportMessages();
    res.status(200).json({ messages });
  } catch {
    res.status(500).json({ message: 'Unable to load contact messages.' });
  }
});

adminRouter.get('/api/admin/unilevel', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const username = typeof req.query.username === 'string' ? req.query.username.trim() : null;
  if (!username) {
    res.status(400).json({ message: 'username query param is required.' });
    return;
  }
  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      res.status(503).json({ message: 'Production service unavailable.' });
      return;
    }
    try {
      res.status(200).json(await service.getMemberUnilevelDataByUsername(username));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load unilevel data.';
      res.status(msg.includes('not found') ? 404 : 500).json({ message: msg });
    }
    return;
  }
  res.status(200).json({ moneyMode: 'sandbox', levelPercentages: [10, 8, 5, 5, 3, 3, 2, 1, 1, 1], totalEarned: 0, byLevel: [], entries: [] });
});

adminRouter.patch('/api/admin/contact-messages/:id/status', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  let status: string;
  try {
    ({ status } = parseBody(
      z.object({ status: z.enum(['unread', 'read', 'done', 'blocked']) }),
      req.body
    ));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid status.' });
    return;
  }
  try {
    await updateSupportMessageStatus(id, status as 'unread' | 'read' | 'done' | 'blocked');
    res.status(200).json({ status: 'updated' });
  } catch {
    res.status(500).json({ message: 'Unable to update message status.' });
  }
});

adminRouter.get('/api/admin/global-bonus', requireRole('admin', 'bod', 'superadmin'), async (_req, res) => {
  if (!isProductionMode()) {
    res.status(200).json({ moneyMode: 'sandbox', entries: [], totalPortions: 0, notes: [] });
    return;
  }
  const service = getProductionEncodingService();
  if (!service) {
    res.status(503).json({ message: 'Production service unavailable.' });
    return;
  }
  try {
    res.status(200).json(await service.buildGlobalBonusData());
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to load global bonus data.' });
  }
});

adminRouter.post('/api/admin/global-bonus/tag-stockist', requireRole('admin', 'bod', 'superadmin'), async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const level = typeof req.body?.level === 'string' ? req.body.level : 'none';
  if (!username) {
    res.status(400).json({ message: 'username is required.' });
    return;
  }
  if (!['none', 'mobile_kiosk', 'city_center', 'mega_center'].includes(level)) {
    res.status(400).json({ message: 'level must be none, mobile_kiosk, city_center, or mega_center.' });
    return;
  }
  if (!isProductionMode()) {
    res.status(200).json({ moneyMode: 'sandbox', username, stockistLevel: level });
    return;
  }
  const service = getProductionEncodingService();
  if (!service) {
    res.status(503).json({ message: 'Production service unavailable.' });
    return;
  }
  try {
    res.status(200).json(await service.setMemberStockistLevel(username, level as import('../modules/production/encoding-service.js').StockistLevel, req.authUser!));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to set stockist level.' });
  }
});


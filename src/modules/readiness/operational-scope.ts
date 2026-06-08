import { listOperationalCatalog } from '../operations/hybrid-operational-data.js';
import { env } from '../../config/env.js';
import { getSupabaseStatus } from '../../lib/supabase.js';
import { getProductionEncodingService, isProductionMode } from '../production/runtime.js';
import { getSandboxMoneyMode, isSandboxMode } from '../sandbox/dev-sandbox-store.js';

const publicRoutes = ['/', '/earn', '/packages', '/register', '/login', '/admin/login'];
const collapsedRoutes = [
  '/vision',
  '/mission',
  '/founder',
  '/products',
  '/perfume-collection',
  '/thank-you',
  '/rank-incentives',
  '/earn/direct-selling',
  '/earn/direct-referral',
  '/earn/salesmatch',
  '/earn/binary-cycle',
  '/earn/leadership',
  '/earn/get-five',
  '/earn/lifestyle-rewards',
  '/earn/unilevel',
  '/earn/unilevel-rank',
  '/earn/global'
];

const departmentGoals = [
  {
    surface: 'public',
    goal:
      'Convert prospects into real Yor registrations while keeping member login and office login as separate portals.'
  },
  {
    surface: 'member',
    goal:
      'Let a member manage sponsor-owned codes, inspect the binary tree, submit encashment, review wallet history, and prepare upgrades or new registrations.'
  },
  {
    surface: 'admin',
    goal:
      'Run the operating office for member governance, activation-code control, genealogy review, and encashment processing.'
  },
  {
    surface: 'cashier',
    goal:
      'Handle code release and transfer work without broader finance or member-governance powers.'
  },
  {
    surface: 'bod',
    goal:
      'Use the same core office authority as Admin for governance, genealogy review, code control, and encashment oversight.'
  }
];

const workingCriticalFlows = [
  'Public registration preview and submit',
  'Member activation-code transfer',
  'Member upgrade by activation code',
  'Member maintenance code use',
  'Member encashment submit',
  'Admin activation-code generation',
  'Admin activation-code release and transfer',
  'Admin encashment review and mark paid',
  'Superadmin sandbox reset'
];

const criticalWriteEndpoints = [
  'POST /api/registration/submit',
  'POST /api/member/activation-codes/transfer',
  'POST /api/member/activation-codes/upgrade',
  'POST /api/member/activation-codes/maintenance',
  'POST /api/member/wallet/encash',
  'POST /api/admin/activation-codes/generate',
  'POST /api/admin/activation-codes/release',
  'POST /api/admin/activation-codes/transfer',
  'POST /api/admin/activation-codes/review',
  'POST /api/admin/encashments/:encashmentId/review',
  'POST /api/admin/encashments/:encashmentId/approve',
  'POST /api/admin/sandbox/reset'
];

const nationwideBlockers = [
  'Money writes still depend on branch-local sandbox storage instead of append-only production ledgers and deterministic process keys.',
  'Compensation streams still require final Yor policy sign-off, duplicate-prevention proof, and audit-workflow evidence before nationwide release.',
  'Production observability, restore rehearsal, and rollout/rollback governance are not yet evidenced in this branch runtime.',
  'Demo-style credentials and local sandbox operations are suitable for internal testing, not nationwide production.'
];

export function buildOperationalReadinessSnapshot() {
  const { memberModules, adminModules } = listOperationalCatalog();
  const moneyMode = isProductionMode() ? 'production' : isSandboxMode() ? getSandboxMoneyMode() : 'playground';
  const supabase = getSupabaseStatus();
  const productionEncodingServiceReady = Boolean(getProductionEncodingService());
  const productionEncodingBlockers = [
    !isProductionMode() ? 'Runtime is not switched to YOR_RUNTIME_MODE=production.' : null,
    !supabase.configured ? 'Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY for trusted server writes.' : null,
    !productionEncodingServiceReady ? 'Production encoding service is not bootable in the current backend process.' : null
  ].filter((value): value is string => Boolean(value));
  const releaseLevel = productionEncodingBlockers.length === 0
    ? 'production encoding configured; live database verification still required'
    : 'ready for internal testing';
  const rationale = productionEncodingBlockers.length === 0
    ? 'The codebase is wired for production-mode encoding, but the platform still needs live database verification, reconciliation, monitoring, and rollout governance before nationwide release.'
    : 'The system now exposes only the public and office surfaces that map to working operational flows, but financial integrity, production ledgering, and nationwide governance remain incomplete.';

  const modulesForRole = (role: 'admin' | 'cashier' | 'bod' | 'superadmin') =>
    adminModules
      .filter((module) => module.permissions.includes(role))
      .map(({ id, label, path, status }) => ({ id, label, path, status }));

  return {
    status: 'reviewed',
    releaseLevel,
    rationale,
    moneyMode,
    runtimeMode: env.YOR_RUNTIME_MODE,
    systemGoal:
      'Operate the Yor lifecycle from sponsor-owned registration code through member placement, wallet request, and office approval using Yor-facing compensation language and Nogatu-verified operational discipline.',
    departmentGoals,
    publicRoutes,
    collapsedRoutes,
    roleSurfaces: {
      member: memberModules.map(({ id, label, path, status }) => ({ id, label, path, status })),
      admin: modulesForRole('admin'),
      cashier: modulesForRole('cashier'),
      bod: modulesForRole('bod'),
      superadmin: modulesForRole('superadmin')
    },
    workingCriticalFlows,
    criticalWriteEndpoints,
    productionEncoding: {
      implemented: true,
      runtimeMode: env.YOR_RUNTIME_MODE,
      supabase,
      serviceReady: productionEncodingServiceReady,
      blockers: productionEncodingBlockers
    },
    nationwideBlockers
  };
}

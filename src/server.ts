import { app } from './app.js';
import { assertProductionEnv, env, getAllowedFrontendOrigins } from './config/env.js';
import { getSupabaseClient, getSupabaseStatus } from './lib/supabase.js';
import { getProductionEncodingService, isProductionMode } from './modules/production/runtime.js';

assertProductionEnv(env);

// Background compensation drainer: continuously processes any pending placement-sales
// events (PV propagation up the tree + SMB pairing + binary cycle) so points distribute
// 24/7 — even if a registration's inline processing failed, even for out-of-band events
// (deferred CD-settlement PV), and regardless of whether the sponsor is online. This makes
// every member's balance a live server-side record rather than something computed only when
// they open their dashboard.
function startCompensationDrainer() {
  if (!isProductionMode()) return;
  const DRAIN_INTERVAL_MS = 10_000;
  // Unilevel is a monthly settlement (idempotent). Running its full sponsor-tree walk
  // every 10s is wasteful, so gate it to at most once every 30 minutes.
  const UNILEVEL_INTERVAL_MS = 30 * 60 * 1000;
  let lastUnilevelRun = 0;
  let draining = false;
  setInterval(async () => {
    if (draining) return; // skip if the previous tick is still running
    const service = getProductionEncodingService();
    if (!service) return;
    draining = true;
    try {
      const result = await service.processCompensationQueue(200);
      if (result?.processed?.length) {
        console.info(`[compensation-drainer] processed ${result.processed.length} event(s)`);
      }
      // Shadow earnings: each shadow's own sub-legs pair → owner earns, transferred tagged L/R.
      const shadowPaid = await service.reconcileShadowEarnings();
      if (shadowPaid.length) {
        console.info(`[compensation-drainer] shadow earnings paid: ${shadowPaid.length}`);
      }
      // Salesmatch reconcile: catch users with unmatched volume that the queue missed
      // (e.g. eligibility changed after the queue item already ran at-most-once).
      const smb = await service.reconcileSalesmatchAllEligible();
      if (smb.credited > 0) {
        console.info(`[compensation-drainer] salesmatch reconcile: PHP ${smb.credited.toFixed(2)} to ${smb.users.length} user(s)`);
      }
      // GATE-GLOBAL-BONUS-3PCT-20260615: 3% of net product sales → lifestyle pool (lifestyle_rewards).
      const gb = await service.reconcileGlobalBonus();
      if (gb.distributed > 0) {
        console.info(`[compensation-drainer] lifestyle pool: PHP ${gb.distributed.toFixed(2)} → ${gb.memberCount} members @ PHP ${gb.perMember.toFixed(2)} each`);
      }
      // GATE-UNI-MONTHLY-20260615: settle the current month's unilevel over the sponsor
      // tree (200-PV maintenance gated), at most every 30 min. Idempotent per
      // (earner, month, level, downline), so each run only posts new/incremental credits.
      if (Date.now() - lastUnilevelRun >= UNILEVEL_INTERVAL_MS) {
        lastUnilevelRun = Date.now();
        const uni = await service.reconcileMonthlyUnilevel();
        if (uni.credited > 0) {
          console.info(`[compensation-drainer] monthly unilevel: PHP ${uni.credited.toFixed(2)} to ${uni.earners} earner(s)`);
        }
      }
    } catch (err) {
      console.error('[compensation-drainer] error:', err);
    } finally {
      draining = false;
    }
  }, DRAIN_INTERVAL_MS);
}

app.listen(env.PORT, () => {
  const supabase = getSupabaseStatus();

  console.info(`yorinternational-backend listening on http://127.0.0.1:${env.PORT}`);
  console.info(`Allowed frontend origins: ${getAllowedFrontendOrigins().join(', ')}`);
  console.info(
    `Supabase: ${supabase.configured ? `configured (${supabase.url}, key=${supabase.keyType})` : 'not configured'}`
  );
  console.info(
    `Supabase public access: ${supabase.publicConfigured ? `configured (${supabase.url}, key=${supabase.publicKeyType})` : 'not configured'}`
  );

  // Eagerly initialize the Supabase client at startup so the first login request
  // does not pay the cold-start initialization cost.
  getSupabaseClient();

  startCompensationDrainer();
  console.info(`Compensation drainer: ${isProductionMode() ? 'running (10s interval)' : 'disabled (non-production mode)'}`);
});

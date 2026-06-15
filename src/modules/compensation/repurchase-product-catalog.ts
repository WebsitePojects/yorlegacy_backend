import type { PackageTier } from '../production/encoding-service.js';

export const LIFESTYLE_REWARD_RATE = 0.01;

// GATE-PRODUCT-SRP-20260615: SRP for both Yor Perfume and Yor Vision = PHP 500.
// The retail profit for the selling member = SRP - DP (kept by member; outside the
// internal earning engine — Direct Selling is a public-only business activity per
// BUSINESSRULE.md). The system records only the DP (what the company collected).
export const PRODUCT_SRP = 500;

// GATE-PRODUCT-DP-20260615: Discounted prices (DP) are tier-based, per owner image
// supplied 2026-06-15. The unit_price recorded in `repurchases` = DP (actual company
// collection), NOT the SRP. srp_price column stores SRP for audit reference.
export const PERFUME_DP_BY_TIER: Record<PackageTier, number> = {
  Basic:    350,
  Classic:  320,
  Standard: 300,
  Business: 280,
  VIP:      250,
};

export const VISION_DP_BY_TIER: Record<PackageTier, number> = {
  Basic:    250,
  Classic:  240,
  Standard: 230,
  Business: 220,
  VIP:      210,
};

// GATE-REPURCHASE-PV-20260615: per the official Yor Unilevel Bonus plan, ALL three
// repurchase products — Perfume, Eyedrops, and Perfume Refill — carry exactly 20
// repurchase PV each. Unilevel pays a percentage of these repurchase PV (NOT the peso
// price, NOT the SMB pairing PV). Confirmed by owner compensation-plan slide 2026-06-15.
export const PERFUME_REPURCHASE_PV = 20;
export const VISION_REPURCHASE_PV  = 20;
export const REFILL_REPURCHASE_PV  = 20;

// Kept for backward compat where code reads the old constant directly.
export const PERFUME_REPURCHASE_PRICE = PRODUCT_SRP;
export const REFILL_REPURCHASE_PRICE  = 150;

export type RepeatPurchaseProduct = {
  sku: string;
  label: string;
  codeFamily: 'YOR MAINTENANCE' | 'YOR REFILL' | 'YOR VISION';
  // srpPrice: SRP (list price, PHP 500 for perfume/vision). Retail profit = SRP − DP.
  srpPrice: number;
  // dpByTier: member's actual discounted purchase price by package tier.
  // For products without tier pricing (refills), all tiers use the same price.
  dpByTier: Record<PackageTier, number>;
  // repurchasePrice: kept for backward compat; equals srpPrice for existing code paths.
  repurchasePrice: number;
  lifestyleRewardPer: number;
  repurchasePv: number;
  lifestyleEligible: boolean;
  unilevelEligible: boolean;
  notes: string;
};

export const repeatPurchaseProductCatalog: RepeatPurchaseProduct[] = [
  {
    sku:              'YOR-PERFUME',
    label:            'Yor Perfume',
    codeFamily:       'YOR MAINTENANCE',
    srpPrice:         PRODUCT_SRP,
    dpByTier:         PERFUME_DP_BY_TIER,
    repurchasePrice:  PRODUCT_SRP,
    lifestyleRewardPer: PRODUCT_SRP * LIFESTYLE_REWARD_RATE,
    repurchasePv:     PERFUME_REPURCHASE_PV,
    lifestyleEligible: true,
    unilevelEligible:  true,
    notes: 'Yor Perfume. YOR MAINTENANCE code family. DP is tier-based (350/320/300/280/250). SRP = 500.'
  },
  {
    sku:              'YOR-VISION',
    label:            'Yor Eyedrops',
    codeFamily:       'YOR VISION',
    srpPrice:         PRODUCT_SRP,
    dpByTier:         VISION_DP_BY_TIER,
    repurchasePrice:  PRODUCT_SRP,
    lifestyleRewardPer: PRODUCT_SRP * LIFESTYLE_REWARD_RATE,
    repurchasePv:     VISION_REPURCHASE_PV,
    lifestyleEligible: true,
    unilevelEligible:  true,
    notes: 'Yor Vision eyedrops. YOR VISION code family. DP is tier-based (250/240/230/220/210). SRP = 500.'
  },
  {
    // PENDING-SIGN-OFF: Refill DP and repurchase PV not yet confirmed by owner.
    // Price and PV retained as placeholders from previous catalog.
    sku:              'YOR-REFILL',
    label:            'Yor Perfume Refill',
    codeFamily:       'YOR REFILL',
    srpPrice:         150,
    dpByTier:         { Basic: 150, Classic: 150, Standard: 150, Business: 150, VIP: 150 },
    repurchasePrice:  150,
    lifestyleRewardPer: 150 * LIFESTYLE_REWARD_RATE,
    repurchasePv:     REFILL_REPURCHASE_PV,
    lifestyleEligible: true,
    unilevelEligible:  true,
    notes: 'Yor Perfume Refill. YOR REFILL code family. SRP 150, 20 repurchase PV (same as perfume/eyedrops).'
  }
];

// Daily lifestyle credit caps per package (LFR-01, BUSINESSRULE.md)
export const lifestyleDailyCapByPackage: Record<Exclude<PackageTier, 'Basic'>, number> = {
  Classic:  1000,
  Standard: 2000,
  Business: 3000,
  VIP:      5000,
};

// Monthly lifestyle credit caps per package (LFR-01, BUSINESSRULE.md)
export const lifestyleMonthlyCapByPackage: Record<Exclude<PackageTier, 'Basic'>, number> = {
  Classic:  30000,
  Standard: 60000,
  Business: 90000,
  VIP:      150000,
};

export const lifestyleRepeatPurchaseReactivationByPackage = lifestyleDailyCapByPackage;

export function findProductByCodeFamily(codeFamily: string): RepeatPurchaseProduct | null {
  return repeatPurchaseProductCatalog.find((p) => p.codeFamily === codeFamily) ?? null;
}

// GATE-PRODUCT-NORMALIZE-20260615: product codes are normalized to two retail lines —
// Perfume and Eyedrops (Yor Vision). Brand/variant suffixes (e.g. "-HUGO-BOSS") are no
// longer distinct SKUs; any code is resolved to its canonical product by keyword so a
// variant code still prices and credits correctly. Refill remains a keyword alias
// (pending owner sign-off). Resolution order: exact SKU → code family → keyword.
export function resolveRepurchaseProduct(skuOrFamily: string): RepeatPurchaseProduct | null {
  const exact =
    repeatPurchaseProductCatalog.find((p) => p.sku === skuOrFamily) ??
    findProductByCodeFamily(skuOrFamily);
  if (exact) return exact;

  const norm = skuOrFamily.trim().toUpperCase();
  const bySku = (sku: string) => repeatPurchaseProductCatalog.find((p) => p.sku === sku) ?? null;
  if (norm.includes('PERFUME')) return bySku('YOR-PERFUME');
  if (norm.includes('VISION') || norm.includes('EYEDROP') || norm.includes('EYE-DROP')) return bySku('YOR-VISION');
  if (norm.includes('REFILL')) return bySku('YOR-REFILL');
  return null;
}

export function getProductDp(product: RepeatPurchaseProduct, tier: PackageTier): number {
  return product.dpByTier[tier] ?? product.srpPrice;
}

// Official Yor Unilevel Bonus plan (owner slide 2026-06-15):
// - 10 levels: L1 10%, L2 8%, L3 5%, L4 5%, L5 3%, L6 3%, L7 2%, L8 1%, L9 1%, L10 1%.
// - Bonus base = downline repurchase PV (20 per product), NOT peso price, NOT SMB PV.
// - Monthly maintenance: an earner must accumulate >= 200 repurchase PV within the
//   calendar month to earn unilevel that month. Maintenance RESETS every month — a
//   month with no maintaining points earns no unilevel (carries nothing forward).
export const unilevelMonthlyMaintenanceRequirement = {
  requiredPv: 200,
  resetsMonthly: true,
  basis: 'product repurchase PV only (20 PV per product)',
  scope: 'sponsor tree only, up to 10 levels',
  levelPercentages: [10, 8, 5, 5, 3, 3, 2, 1, 1, 1]
} as const;

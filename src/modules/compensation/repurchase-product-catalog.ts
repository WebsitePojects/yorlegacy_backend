import type { PackageTier } from '../production/encoding-service.js';

export const LIFESTYLE_REWARD_RATE = 0.01;

export const PERFUME_REPURCHASE_PRICE = 500;
export const REFILL_REPURCHASE_PRICE = 150;

export type RepeatPurchaseProduct = {
  sku: string;
  label: string;
  codeFamily: 'YOR MAINTENANCE' | 'YOR REFILL';
  repurchasePrice: number;
  lifestyleRewardPer: number;
  repurchasePv: number;
  lifestyleEligible: boolean;
  unilevelEligible: boolean;
  notes: string;
};

export const repeatPurchaseProductCatalog: RepeatPurchaseProduct[] = [
  {
    sku: 'YOR-PERFUME-HUGO-BOSS',
    label: 'Yor Perfume - Hugo Boss',
    codeFamily: 'YOR MAINTENANCE',
    repurchasePrice: PERFUME_REPURCHASE_PRICE,
    lifestyleRewardPer: PERFUME_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: PERFUME_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Perfume repurchase. YOR MAINTENANCE code family.'
  },
  {
    sku: 'YOR-PERFUME-SWISS-ARMY',
    label: 'Yor Perfume - Swiss Army',
    codeFamily: 'YOR MAINTENANCE',
    repurchasePrice: PERFUME_REPURCHASE_PRICE,
    lifestyleRewardPer: PERFUME_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: PERFUME_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Perfume repurchase. YOR MAINTENANCE code family.'
  },
  {
    sku: 'YOR-PERFUME-CHANEL-BLEU',
    label: 'Yor Perfume - Chanel Bleu',
    codeFamily: 'YOR MAINTENANCE',
    repurchasePrice: PERFUME_REPURCHASE_PRICE,
    lifestyleRewardPer: PERFUME_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: PERFUME_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Perfume repurchase. YOR MAINTENANCE code family.'
  },
  {
    sku: 'YOR-PERFUME-PARIS-HILTON',
    label: 'Yor Perfume - Paris Hilton',
    codeFamily: 'YOR MAINTENANCE',
    repurchasePrice: PERFUME_REPURCHASE_PRICE,
    lifestyleRewardPer: PERFUME_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: PERFUME_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Perfume repurchase. YOR MAINTENANCE code family.'
  },
  {
    sku: 'YOR-PERFUME-BVLGARI-AMETHYSTE',
    label: 'Yor Perfume - Bvlgari Amethyste',
    codeFamily: 'YOR MAINTENANCE',
    repurchasePrice: PERFUME_REPURCHASE_PRICE,
    lifestyleRewardPer: PERFUME_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: PERFUME_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Perfume repurchase. YOR MAINTENANCE code family.'
  },
  {
    sku: 'YOR-PERFUME-VS-BOMBSHELL',
    label: 'Yor Perfume - VS Bombshell',
    codeFamily: 'YOR MAINTENANCE',
    repurchasePrice: PERFUME_REPURCHASE_PRICE,
    lifestyleRewardPer: PERFUME_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: PERFUME_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Perfume repurchase. YOR MAINTENANCE code family.'
  },
  {
    sku: 'YOR-REFILL-HUGO-BOSS',
    label: 'Yor Refill - Hugo Boss',
    codeFamily: 'YOR REFILL',
    repurchasePrice: REFILL_REPURCHASE_PRICE,
    lifestyleRewardPer: REFILL_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: REFILL_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Refill repurchase. Separate YOR REFILL code family.'
  },
  {
    sku: 'YOR-REFILL-SWISS-ARMY',
    label: 'Yor Refill - Swiss Army',
    codeFamily: 'YOR REFILL',
    repurchasePrice: REFILL_REPURCHASE_PRICE,
    lifestyleRewardPer: REFILL_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: REFILL_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Refill repurchase. Separate YOR REFILL code family.'
  },
  {
    sku: 'YOR-REFILL-CHANEL-BLEU',
    label: 'Yor Refill - Chanel Bleu',
    codeFamily: 'YOR REFILL',
    repurchasePrice: REFILL_REPURCHASE_PRICE,
    lifestyleRewardPer: REFILL_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: REFILL_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Refill repurchase. Separate YOR REFILL code family.'
  },
  {
    sku: 'YOR-REFILL-PARIS-HILTON',
    label: 'Yor Refill - Paris Hilton',
    codeFamily: 'YOR REFILL',
    repurchasePrice: REFILL_REPURCHASE_PRICE,
    lifestyleRewardPer: REFILL_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: REFILL_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Refill repurchase. Separate YOR REFILL code family.'
  },
  {
    sku: 'YOR-REFILL-BVLGARI-AMETHYSTE',
    label: 'Yor Refill - Bvlgari Amethyste',
    codeFamily: 'YOR REFILL',
    repurchasePrice: REFILL_REPURCHASE_PRICE,
    lifestyleRewardPer: REFILL_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: REFILL_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Refill repurchase. Separate YOR REFILL code family.'
  },
  {
    sku: 'YOR-REFILL-VS-BOMBSHELL',
    label: 'Yor Refill - VS Bombshell',
    codeFamily: 'YOR REFILL',
    repurchasePrice: REFILL_REPURCHASE_PRICE,
    lifestyleRewardPer: REFILL_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: REFILL_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Refill repurchase. Separate YOR REFILL code family.'
  },
  {
    sku: 'YOR-VISION-MINERAL-DROPS-15ML',
    label: 'Yor Vision Mineral Drops 15ml',
    codeFamily: 'YOR MAINTENANCE',
    repurchasePrice: PERFUME_REPURCHASE_PRICE,
    lifestyleRewardPer: PERFUME_REPURCHASE_PRICE * LIFESTYLE_REWARD_RATE,
    repurchasePv: PERFUME_REPURCHASE_PRICE,
    lifestyleEligible: true,
    unilevelEligible: true,
    notes: 'Yor Vision product repurchase. YOR MAINTENANCE code family.'
  }
];

export const lifestyleRepeatPurchaseReactivationByPackage: Record<
  Exclude<PackageTier, 'Basic'>,
  number
> = {
  Classic: 1000,
  Standard: 2000,
  Business: 3000,
  VIP: 5000
};

export const unilevelMonthlyMaintenanceRequirement = {
  requiredPv: 200,
  basis: 'product repurchases only',
  scope: 'sponsor tree only',
  levelPercentages: [10, 8, 5, 5, 3, 3, 2, 1, 1, 1]
} as const;

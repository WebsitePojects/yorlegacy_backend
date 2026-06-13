import { describe, expect, it } from 'vitest';
import { rankForIncome, RANK_LADDER } from './rank-ladder.js';

describe('rankForIncome', () => {
  it('is unranked below the first threshold (50K)', () => {
    const r = rankForIncome(49_999);
    expect(r.level).toBe(0);
    expect(r.rankName).toBe('Unranked');
    expect(r.nextRankName).toBe('Manager');
    expect(r.nextThreshold).toBe(50_000);
    expect(r.remainingToNext).toBe(1);
  });

  it('reaches Manager exactly at 50K (inclusive)', () => {
    const r = rankForIncome(50_000);
    expect(r.level).toBe(1);
    expect(r.rankName).toBe('Manager');
    expect(r.nextRankName).toBe('Bronze Director');
    expect(r.remainingToNext).toBe(50_000);
  });

  it('holds the highest threshold met (e.g. 600K -> Gold Director)', () => {
    const r = rankForIncome(600_000);
    expect(r.rankName).toBe('Gold Director');
    expect(r.level).toBe(4);
    expect(r.nextRankName).toBe('Platinum Director');
    expect(r.nextThreshold).toBe(750_000);
  });

  it('caps at Hall of Famer with no next rank at/above 50M', () => {
    const r = rankForIncome(60_000_000);
    expect(r.rankName).toBe('Hall of Famer');
    expect(r.level).toBe(11);
    expect(r.nextRankName).toBeNull();
    expect(r.nextThreshold).toBeNull();
    expect(r.remainingToNext).toBeNull();
  });

  it('treats zero / negative / NaN income as unranked', () => {
    expect(rankForIncome(0).level).toBe(0);
    expect(rankForIncome(-5).level).toBe(0);
    expect(rankForIncome(Number.NaN).level).toBe(0);
  });

  it('ladder is strictly ascending by threshold and level', () => {
    for (let i = 1; i < RANK_LADDER.length; i += 1) {
      expect(RANK_LADDER[i].threshold).toBeGreaterThan(RANK_LADDER[i - 1].threshold);
      expect(RANK_LADDER[i].level).toBe(RANK_LADDER[i - 1].level + 1);
    }
  });
});

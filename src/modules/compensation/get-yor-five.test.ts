import { describe, expect, it } from 'vitest';
import { computeGetYorFiveGroups, type GyfDirect } from './get-yor-five.js';

const d = (id: string, joinedAt: string): GyfDirect => ({ memberUserId: id, joinedAt });

describe('computeGetYorFiveGroups', () => {
  it('completes a group when 5 directs land within 3 months', () => {
    const directs = [
      d('a', '2026-01-01T00:00:00.000Z'),
      d('b', '2026-01-10T00:00:00.000Z'),
      d('c', '2026-02-01T00:00:00.000Z'),
      d('d', '2026-03-01T00:00:00.000Z'),
      d('e', '2026-03-20T00:00:00.000Z')
    ];
    const groups = computeGetYorFiveGroups(directs, { asOf: '2026-04-01T00:00:00.000Z' });
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe('complete');
    expect(groups[0].index).toBe(1);
    expect(groups[0].completedAt).toBe('2026-03-20T00:00:00.000Z');
    expect(groups[0].memberUserIds).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('voids a partial group whose 3-month window expired with < 5', () => {
    const directs = [
      d('a', '2026-01-01T00:00:00.000Z'),
      d('b', '2026-01-10T00:00:00.000Z'),
      d('c', '2026-02-01T00:00:00.000Z')
    ];
    const groups = computeGetYorFiveGroups(directs, { asOf: '2026-05-01T00:00:00.000Z' });
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe('void');
    expect(groups[0].index).toBeNull();
    expect(groups[0].memberUserIds).toEqual(['a', 'b', 'c']);
  });

  it('reports an open group with remaining target and remaining days', () => {
    const directs = [
      d('a', '2026-03-01T00:00:00.000Z'),
      d('b', '2026-03-05T00:00:00.000Z')
    ];
    const groups = computeGetYorFiveGroups(directs, { asOf: '2026-03-10T00:00:00.000Z' });
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe('open');
    expect(groups[0].remainingNeeded).toBe(3);
    // window ends 2026-06-01; ~83 days remain from 2026-03-10
    expect(groups[0].remainingDays).toBeGreaterThan(80);
    expect(groups[0].remainingDays).toBeLessThan(86);
  });

  it('voids an expired partial group, then starts a fresh group from later directs', () => {
    const directs = [
      d('a', '2026-01-01T00:00:00.000Z'),
      d('b', '2026-01-02T00:00:00.000Z'), // these two void (window ends ~Apr 1)
      d('c', '2026-05-01T00:00:00.000Z'),
      d('d', '2026-05-02T00:00:00.000Z'),
      d('e', '2026-05-03T00:00:00.000Z'),
      d('f', '2026-05-04T00:00:00.000Z'),
      d('g', '2026-05-05T00:00:00.000Z') // c..g complete within window
    ];
    const groups = computeGetYorFiveGroups(directs, { asOf: '2026-06-01T00:00:00.000Z' });
    expect(groups.map((g) => g.status)).toEqual(['void', 'complete']);
    const complete = groups[1];
    expect(complete.index).toBe(1); // index counts only completed groups
    expect(complete.memberUserIds).toEqual(['c', 'd', 'e', 'f', 'g']);
  });

  it('completed-group index is stable across multiple completed groups (no void)', () => {
    const mk = (prefix: string, base: number) =>
      Array.from({ length: 5 }, (_, i) => d(`${prefix}${i}`, `2026-0${base}-0${i + 1}T00:00:00.000Z`));
    const directs = [...mk('x', 1), ...mk('y', 2)];
    const groups = computeGetYorFiveGroups(directs, { asOf: '2026-04-01T00:00:00.000Z' });
    expect(groups.map((g) => g.status)).toEqual(['complete', 'complete']);
    expect(groups.map((g) => g.index)).toEqual([1, 2]);
  });
});

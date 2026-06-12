import { describe, expect, it } from 'vitest';
import { manilaDateKey, manilaMonthStartIso, manilaWeekStartIso } from './cap-windows.js';

describe('manilaWeekStartIso', () => {
  it('maps a mid-week Manila timestamp to that week\'s Monday 00:00 Manila', () => {
    // 2026-06-10 is a Wednesday. 09:00Z = 17:00 Manila.
    expect(manilaWeekStartIso('2026-06-10T09:00:00.000Z')).toBe('2026-06-07T16:00:00.000Z'); // Mon 2026-06-08 00:00 Manila
  });

  it('maps Sunday 23:00 Manila to the previous Monday', () => {
    // Sunday 2026-06-14 23:00 Manila = 15:00Z.
    expect(manilaWeekStartIso('2026-06-14T15:00:00.000Z')).toBe('2026-06-07T16:00:00.000Z');
  });

  it('maps Monday 00:30 Manila to that same Monday', () => {
    // Monday 2026-06-08 00:30 Manila = 2026-06-07 16:30Z.
    expect(manilaWeekStartIso('2026-06-07T16:30:00.000Z')).toBe('2026-06-07T16:00:00.000Z');
  });

  it('maps late Sunday UTC that is already Monday in Manila to the new week', () => {
    // 2026-06-14 17:00Z = Monday 2026-06-15 01:00 Manila.
    expect(manilaWeekStartIso('2026-06-14T17:00:00.000Z')).toBe('2026-06-14T16:00:00.000Z');
  });
});

describe('manilaMonthStartIso', () => {
  it('maps a mid-month timestamp to the 1st 00:00 Manila', () => {
    expect(manilaMonthStartIso('2026-06-10T09:00:00.000Z')).toBe('2026-05-31T16:00:00.000Z'); // Jun 1 00:00 Manila
  });

  it('handles a UTC timestamp that is already next month in Manila', () => {
    // 2026-06-30 17:00Z = July 1 01:00 Manila.
    expect(manilaMonthStartIso('2026-06-30T17:00:00.000Z')).toBe('2026-06-30T16:00:00.000Z'); // Jul 1 00:00 Manila
  });
});

describe('manilaDateKey', () => {
  it('returns the Manila calendar date', () => {
    expect(manilaDateKey('2026-06-10T09:00:00.000Z')).toBe('2026-06-10');
    expect(manilaDateKey('2026-06-10T17:00:00.000Z')).toBe('2026-06-11');
  });
});

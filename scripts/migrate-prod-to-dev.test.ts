import { describe, expect, it } from 'vitest';
import { shapeRowsForTarget } from './migrate-prod-to-dev';

describe('shapeRowsForTarget', () => {
  it('drops prod-only columns before inserting into a drifted dev table', () => {
    const result = shapeRowsForTarget(
      'member_profiles',
      [
        {
          user_id: 'member-1',
          username: 'yor01',
          full_name: 'Yor Company 01',
          normalized_full_name: 'yor company 01',
        },
      ],
      new Set(['user_id', 'username']),
    );

    expect(result.rows).toEqual([{ user_id: 'member-1', username: 'yor01' }]);
    expect(result.skippedColumns).toEqual(['full_name', 'normalized_full_name']);
  });

  it('fails when no target columns are available', () => {
    expect(() => shapeRowsForTarget('member_profiles', [{ user_id: 'member-1' }], new Set())).toThrow(
      /No target columns discovered/
    );
  });

  it('coerces prod activation-code statuses for the legacy dev enum', () => {
    const result = shapeRowsForTarget(
      'activation_codes',
      [
        { id: 'code-1', code: 'YOR-001', status: 'unreleased' },
        { id: 'code-2', code: 'YOR-002', status: 'lost' },
      ],
      new Set(['id', 'code', 'status']),
    );

    expect(result.rows).toEqual([
      { id: 'code-1', code: 'YOR-001', status: 'assigned' },
      { id: 'code-2', code: 'YOR-002', status: 'disabled' },
    ]);
  });
});

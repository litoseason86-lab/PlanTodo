import {describe, expect, it} from 'vitest';

import {parseTaskBody, parseTaskQuery} from './schemas';

describe('task schemas', () => {
  it('rejects an invalid planned date in task body', () => {
    expect(() => parseTaskBody({
      title: 'Write',
      categoryId: 1,
      plannedDate: '2026-02-30',
    })).toThrow('plannedDate must be a valid date in YYYY-MM-DD format');
  });

  it('rejects an invalid task query date', () => {
    expect(() => parseTaskQuery({date: '2026-6-5'})).toThrow(
      'date must be a valid date in YYYY-MM-DD format',
    );
  });
});

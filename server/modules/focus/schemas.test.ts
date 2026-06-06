import {describe, expect, it} from 'vitest';

import {parseSessionDateQuery, parseSessionQuery} from './schemas';

describe('focus schemas', () => {
  it('allows an omitted session date query', () => {
    expect(parseSessionDateQuery(undefined)).toBeUndefined();
  });

  it('rejects invalid session date query values', () => {
    expect(() => parseSessionDateQuery('2026-02-30')).toThrow(
      'date must be a valid date in YYYY-MM-DD format',
    );
  });

  it('parses focus session date range query', () => {
    expect(parseSessionQuery({dateFrom: '2026-06-01', dateTo: '2026-06-07'})).toEqual({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
    });
  });

  it('rejects mixed focus session date query', () => {
    expect(() => parseSessionQuery({date: '2026-06-06', dateFrom: '2026-06-01', dateTo: '2026-06-07'}))
      .toThrow('Use either date or dateFrom/dateTo');
  });
});

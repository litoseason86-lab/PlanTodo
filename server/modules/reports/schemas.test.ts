import {describe, expect, it} from 'vitest';

import {parseDailyBodyDate, parseDailyDate, parseWeekStart} from './schemas';

describe('report schemas', () => {
  it('rejects invalid daily report dates', () => {
    expect(() => parseDailyDate('2026-02-30')).toThrow(
      'date must be a valid date in YYYY-MM-DD format',
    );
    expect(() => parseDailyBodyDate('2026-6-5')).toThrow(
      'date must be a valid date in YYYY-MM-DD format',
    );
  });

  it('rejects invalid week start dates', () => {
    expect(() => parseWeekStart('not-a-date', 'query')).toThrow(
      'weekStart must be a valid date in YYYY-MM-DD format',
    );
  });
});

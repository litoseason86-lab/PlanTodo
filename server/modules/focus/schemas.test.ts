import {describe, expect, it} from 'vitest';

import {parseSessionDateQuery} from './schemas';

describe('focus schemas', () => {
  it('allows an omitted session date query', () => {
    expect(parseSessionDateQuery(undefined)).toBeUndefined();
  });

  it('rejects invalid session date query values', () => {
    expect(() => parseSessionDateQuery('2026-02-30')).toThrow(
      'date must be a valid date in YYYY-MM-DD format',
    );
  });
});

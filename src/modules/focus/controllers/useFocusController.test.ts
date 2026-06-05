import {describe, expect, it} from 'vitest';

import {calculateEffectiveFocusSeconds, calculateFocusRingOffset, formatFocusElapsed} from './useFocusController';

describe('useFocusController helpers', () => {
  it('formats elapsed seconds as hh:mm:ss', () => {
    expect(formatFocusElapsed(3661)).toBe('01:01:01');
  });

  it('keeps the ring offset within one hour progress', () => {
    expect(calculateFocusRingOffset(1800)).toBeCloseTo(326.5, 1);
    expect(calculateFocusRingOffset(3600)).toBeCloseTo(653, 1);
  });

  it('freezes elapsed seconds while paused and excludes accumulated pauses', () => {
    expect(
      calculateEffectiveFocusSeconds(
        {
          id: 1,
          taskId: 1,
          userId: 1,
          startedAt: '2026-06-05T01:00:00.000Z',
          pausedAt: '2026-06-05T01:10:00.000Z',
          accumulatedPauseSeconds: 120,
          status: 'PAUSED',
          createdAt: '2026-06-05T01:00:00.000Z',
        },
        new Date('2026-06-05T01:30:00.000Z').getTime(),
      ),
    ).toBe(480);
  });
});

import {describe, expect, it} from 'vitest';

import {
  TIMELINE_END_HOUR,
  TIMELINE_SLOT_MINUTES,
  TIMELINE_START_HOUR,
  buildFocusSessionBlock,
  buildTimedTaskBlock,
  getHourFromDropMinute,
  minutesFromDayStart,
  snapMinutes,
} from './weekTimelineLayout';

describe('weekTimelineLayout', () => {
  it('exports the week timeline interaction constants', () => {
    expect(TIMELINE_START_HOUR).toBe(6);
    expect(TIMELINE_END_HOUR).toBe(23);
    expect(TIMELINE_SLOT_MINUTES).toBe(15);
  });

  it('reads minutes from the local day start', () => {
    expect(minutesFromDayStart('2026-06-06T09:30:00.000')).toBe(570);
  });

  it('builds a timed task block from local datetimes', () => {
    expect(buildTimedTaskBlock({
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:15:00.000',
    })).toEqual({
      topMinutes: 540,
      durationMinutes: 75,
    });
  });

  it('uses the minimum slot duration for zero-length timed task blocks', () => {
    expect(buildTimedTaskBlock({
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T09:00:00.000',
    })).toMatchObject({
      durationMinutes: 15,
    });
  });

  it('snaps raw minutes to the nearest timeline slot', () => {
    expect(snapMinutes(547)).toBe(540);
    expect(snapMinutes(553)).toBe(555);
  });

  it('returns the snapped clock time for a drop minute from the 06:00 timeline start', () => {
    expect(getHourFromDropMinute(187)).toEqual({hour: 9, minute: 0});
  });

  it('builds a focus session block in China local time', () => {
    expect(buildFocusSessionBlock({
      startedAt: '2026-06-06T09:00:00.000Z',
      durationSeconds: 2700,
    })).toMatchObject({
      topMinutes: 1020,
      durationMinutes: 45,
    });
  });

  it('uses the minimum slot duration for focus sessions without duration', () => {
    expect(buildFocusSessionBlock({
      startedAt: '2026-06-06T09:00:00.000Z',
    })).toMatchObject({
      durationMinutes: 15,
    });
  });
});

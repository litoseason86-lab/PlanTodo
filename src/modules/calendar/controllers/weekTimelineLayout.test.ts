import {describe, expect, it} from 'vitest';

import {
  TIMELINE_END_HOUR,
  TIMELINE_SLOT_MINUTES,
  TIMELINE_START_HOUR,
  buildFocusSessionBlock,
  buildTimedTaskBlock,
  buildTimedTaskDayLayout,
  buildTimedTaskSegments,
  getHourFromDropMinute,
  minutesFromDayStart,
  snapMinutes,
} from './weekTimelineLayout';

describe('weekTimelineLayout', () => {
  it('exports the week timeline interaction constants', () => {
    expect(TIMELINE_START_HOUR).toBe(0);
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

  it('keeps same-day timed tasks as one visible segment', () => {
    expect(buildTimedTaskSegments({
      task: {
        startAt: '2026-06-06T13:00:00.000',
        endAt: '2026-06-06T15:30:00.000',
      },
      visibleDates: ['2026-06-06'],
    })).toEqual([
      {
        date: '2026-06-06',
        topMinutes: 780,
        endMinutes: 930,
        durationMinutes: 150,
        startsBeforeDate: false,
        continuesAfterDate: false,
        isFirstSegment: true,
        isLastSegment: true,
      },
    ]);
  });

  it('splits cross-day timed tasks into one segment per visible date', () => {
    expect(buildTimedTaskSegments({
      task: {
        startAt: '2026-06-06T23:00:00.000',
        endAt: '2026-06-07T02:00:00.000',
      },
      visibleDates: ['2026-06-06', '2026-06-07'],
    })).toEqual([
      {
        date: '2026-06-06',
        topMinutes: 1380,
        endMinutes: 1440,
        durationMinutes: 60,
        startsBeforeDate: false,
        continuesAfterDate: true,
        isFirstSegment: true,
        isLastSegment: false,
      },
      {
        date: '2026-06-07',
        topMinutes: 0,
        endMinutes: 120,
        durationMinutes: 120,
        startsBeforeDate: true,
        continuesAfterDate: false,
        isFirstSegment: false,
        isLastSegment: true,
      },
    ]);
  });

  it('assigns lanes to overlapping timed task segments', () => {
    expect(buildTimedTaskDayLayout({
      date: '2026-06-06',
      tasks: [
        {taskId: 1, startAt: '2026-06-06T13:00:00.000', endAt: '2026-06-06T14:00:00.000'},
        {taskId: 2, startAt: '2026-06-06T13:30:00.000', endAt: '2026-06-06T14:30:00.000'},
        {taskId: 3, startAt: '2026-06-06T15:00:00.000', endAt: '2026-06-06T16:00:00.000'},
      ],
    }).map((segment) => ({
      taskId: segment.taskId,
      topMinutes: segment.topMinutes,
      endMinutes: segment.endMinutes,
      laneIndex: segment.laneIndex,
      laneCount: segment.laneCount,
    }))).toEqual([
      {taskId: 1, topMinutes: 780, endMinutes: 840, laneIndex: 0, laneCount: 2},
      {taskId: 2, topMinutes: 810, endMinutes: 870, laneIndex: 1, laneCount: 2},
      {taskId: 3, topMinutes: 900, endMinutes: 960, laneIndex: 0, laneCount: 1},
    ]);
  });

  it('snaps raw minutes to the nearest timeline slot', () => {
    expect(snapMinutes(547)).toBe(540);
    expect(snapMinutes(553)).toBe(555);
  });

  it('returns the snapped clock time for a drop minute from the 00:00 timeline start', () => {
    expect(getHourFromDropMinute(547)).toEqual({hour: 9, minute: 0});
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

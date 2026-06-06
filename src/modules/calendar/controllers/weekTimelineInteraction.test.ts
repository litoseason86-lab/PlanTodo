import {describe, expect, it} from 'vitest';

import {
  WEEK_TIMELINE_DENSITY_HEIGHTS,
  buildAllDayQuickCreateDraft,
  buildTimedQuickCreateDraftFromDrag,
  buildTimedQuickCreateDraftFromPoint,
  canResizeTimedTask,
  getResizeDurationMinutes,
  hourHeightForDensity,
} from './weekTimelineInteraction';

describe('weekTimelineInteraction', () => {
  it('maps density to hour heights', () => {
    expect(WEEK_TIMELINE_DENSITY_HEIGHTS).toEqual({
      compact: 48,
      standard: 64,
      comfortable: 88,
    });
    expect(hourHeightForDensity('compact')).toBe(48);
    expect(hourHeightForDensity('standard')).toBe(64);
    expect(hourHeightForDensity('comfortable')).toBe(88);
  });

  it('creates a default 60 minute timed draft from a point', () => {
    expect(buildTimedQuickCreateDraftFromPoint({
      date: '2026-06-06',
      hour: 9,
      clientY: 132,
      rectTop: 100,
      hourHeight: 64,
      anchor: {x: 20, y: 132},
    })).toEqual({
      kind: 'timed',
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:30:00.000',
      endAt: '2026-06-06T10:30:00.000',
      anchor: {x: 20, y: 132},
    });
  });

  it('clamps late point creation to 23:44-23:59', () => {
    expect(buildTimedQuickCreateDraftFromPoint({
      date: '2026-06-06',
      hour: 23,
      clientY: 163,
      rectTop: 100,
      hourHeight: 64,
      anchor: {x: 20, y: 163},
    })).toMatchObject({
      startAt: '2026-06-06T23:44:00.000',
      endAt: '2026-06-06T23:59:00.000',
    });
  });

  it('creates an ascending timed draft from downward drag', () => {
    expect(buildTimedQuickCreateDraftFromDrag({
      date: '2026-06-06',
      startHour: 9,
      startClientY: 100,
      endHour: 11,
      endClientY: 132,
      startRectTop: 100,
      endRectTop: 100,
      hourHeight: 64,
      anchor: {x: 40, y: 100},
    })).toMatchObject({
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T11:30:00.000',
    });
  });

  it('creates an ascending timed draft from upward drag', () => {
    expect(buildTimedQuickCreateDraftFromDrag({
      date: '2026-06-06',
      startHour: 12,
      startClientY: 100,
      endHour: 10,
      endClientY: 132,
      startRectTop: 100,
      endRectTop: 100,
      hourHeight: 64,
      anchor: {x: 40, y: 100},
    })).toMatchObject({
      startAt: '2026-06-06T10:30:00.000',
      endAt: '2026-06-06T12:00:00.000',
    });
  });

  it('keeps dragged timed drafts at least 15 minutes', () => {
    expect(buildTimedQuickCreateDraftFromDrag({
      date: '2026-06-06',
      startHour: 9,
      startClientY: 100,
      endHour: 9,
      endClientY: 103,
      startRectTop: 100,
      endRectTop: 100,
      hourHeight: 64,
      anchor: {x: 40, y: 100},
    })).toMatchObject({
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T09:15:00.000',
    });
  });

  it('builds all-day drafts in ascending date order', () => {
    expect(buildAllDayQuickCreateDraft({
      startDate: '2026-06-21',
      endDate: '2026-06-18',
      anchor: {x: 10, y: 20},
    })).toEqual({
      kind: 'all-day',
      plannedDate: '2026-06-18',
      plannedEndDate: '2026-06-21',
      anchor: {x: 10, y: 20},
    });
  });

  it('omits plannedEndDate for one-day all-day drafts', () => {
    expect(buildAllDayQuickCreateDraft({
      startDate: '2026-06-18',
      endDate: '2026-06-18',
      anchor: {x: 10, y: 20},
    })).toEqual({
      kind: 'all-day',
      plannedDate: '2026-06-18',
      plannedEndDate: undefined,
      anchor: {x: 10, y: 20},
    });
  });

  it('calculates resize duration with hour-height-aware pixels', () => {
    expect(getResizeDurationMinutes({
      initialDurationMinutes: 60,
      startY: 0,
      currentY: 32,
      hourHeight: 64,
    })).toBe(90);
    expect(getResizeDurationMinutes({
      initialDurationMinutes: 60,
      startY: 0,
      currentY: 24,
      hourHeight: 48,
    })).toBe(90);
  });

  it('clamps resize duration to at least one slot', () => {
    expect(getResizeDurationMinutes({
      initialDurationMinutes: 60,
      startY: 100,
      currentY: 0,
      hourHeight: 64,
    })).toBe(15);
  });

  it('allows resize only when a 15 minute same-day end is possible', () => {
    expect(canResizeTimedTask('2026-06-06T23:44:00.000')).toBe(true);
    expect(canResizeTimedTask('2026-06-06T23:45:00.000')).toBe(false);
  });
});

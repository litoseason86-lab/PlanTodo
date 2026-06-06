import {describe, expect, it} from 'vitest';

import type {Task} from '../../../../shared/domain/entities';
import {
  buildMonthGrid,
  buildWeekDays,
  getCalendarRange,
  groupTasksByDate,
  segmentAllDayTask,
} from './calendarLayout';

const baseTask: Task = {
  id: 1,
  userId: 1,
  categoryId: 1,
  title: '写方案',
  plannedDate: '2026-06-06',
  allDay: true,
  status: 'TODO',
  createdAt: '',
  updatedAt: '',
};

describe('calendarLayout', () => {
  it('builds a Monday-first month grid', () => {
    const grid = buildMonthGrid('2026-06-06');
    expect(grid[0]).toEqual({isoDate: '2026-06-01', isCurrentMonth: true});
    expect(grid.at(-1)?.isoDate).toBe('2026-07-05');
  });

  it('builds week days and ranges', () => {
    expect(buildWeekDays('2026-06-06').map((day) => day.isoDate)).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
    ]);
    expect(getCalendarRange('week', '2026-06-06')).toEqual({dateFrom: '2026-06-01', dateTo: '2026-06-07'});
    expect(getCalendarRange('list', '2026-06-06')).toEqual({dateFrom: '2026-06-01', dateTo: '2026-06-07'});
  });

  it('groups date, cross-day, and timed tasks by visible date', () => {
    const grouped = groupTasksByDate([
      baseTask,
      {...baseTask, id: 2, title: '跨天', plannedDate: '2026-06-05', plannedEndDate: '2026-06-07'},
      {...baseTask, id: 3, title: '会议', allDay: false, startAt: '2026-06-06T09:00:00.000', endAt: '2026-06-06T10:00:00.000'},
    ], '2026-06-06', '2026-06-06');

    expect(grouped['2026-06-06'].map((task) => task.title)).toEqual(['写方案', '跨天', '会议']);
  });

  it('segments all-day cross-day tasks within a visible range', () => {
    expect(segmentAllDayTask({
      ...baseTask,
      plannedDate: '2026-06-05',
      plannedEndDate: '2026-06-09',
    }, '2026-06-06', '2026-06-08')).toEqual({
      taskId: 1,
      startsOn: '2026-06-06',
      endsOn: '2026-06-08',
      continuesBefore: true,
      continuesAfter: true,
    });
  });
});

import {describe, expect, it} from 'vitest';

import type {Task} from '../domain/entities';
import {
  addMinutesToLocalDateTime,
  getTaskScheduleKind,
  isLocalDateTimeString,
  makeLocalDateTime,
  taskIntersectsDateRange,
  toCanonicalTask,
} from './schedule';

const baseTask: Omit<Task, 'allDay'> & {allDay?: boolean} = {
  id: 1,
  userId: 1,
  categoryId: 1,
  title: '写方案',
  plannedDate: '2026-06-06',
  status: 'TODO',
  createdAt: '2026-06-06T00:00:00.000Z',
  updatedAt: '2026-06-06T00:00:00.000Z',
};

describe('schedule helpers', () => {
  it('normalizes legacy tasks as all-day date tasks', () => {
    expect(toCanonicalTask(baseTask)).toMatchObject({
      plannedDate: '2026-06-06',
      allDay: true,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
    });
  });

  it('classifies date, cross-day, and timed tasks', () => {
    expect(getTaskScheduleKind(toCanonicalTask(baseTask))).toBe('date');
    expect(getTaskScheduleKind(toCanonicalTask({...baseTask, plannedEndDate: '2026-06-08'}))).toBe('cross-day');
    expect(getTaskScheduleKind(toCanonicalTask({
      ...baseTask,
      allDay: false,
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
    }))).toBe('timed');
  });

  it('detects tasks intersecting a date range', () => {
    expect(taskIntersectsDateRange(toCanonicalTask({
      ...baseTask,
      plannedDate: '2026-06-05',
      plannedEndDate: '2026-06-07',
    }), '2026-06-06', '2026-06-06')).toBe(true);

    expect(taskIntersectsDateRange(toCanonicalTask({
      ...baseTask,
      allDay: false,
      startAt: '2026-06-09T09:00:00.000',
      endAt: '2026-06-09T10:00:00.000',
    }), '2026-06-01', '2026-06-08')).toBe(false);
  });

  it('handles local datetime strings without timezone conversion', () => {
    expect(isLocalDateTimeString('2026-06-06T09:30:00.000')).toBe(true);
    expect(isLocalDateTimeString('2026-06-06T09:30:00.000Z')).toBe(false);
    expect(makeLocalDateTime('2026-06-06', 9, 5)).toBe('2026-06-06T09:05:00.000');
    expect(addMinutesToLocalDateTime('2026-06-06T09:30:00.000', 60)).toBe('2026-06-06T10:30:00.000');
  });

  it('adds local datetime minutes across day boundaries', () => {
    expect(addMinutesToLocalDateTime('2026-06-06T23:30:00.000', 60)).toBe('2026-06-07T00:30:00.000');
  });

  it('detects cross-day timed tasks intersecting both calendar days', () => {
    const task = toCanonicalTask({
      ...baseTask,
      allDay: false,
      startAt: '2026-06-06T23:00:00.000',
      endAt: '2026-06-07T02:00:00.000',
    });

    expect(taskIntersectsDateRange(task, '2026-06-06', '2026-06-06')).toBe(true);
    expect(taskIntersectsDateRange(task, '2026-06-07', '2026-06-07')).toBe(true);
    expect(taskIntersectsDateRange(task, '2026-06-08', '2026-06-08')).toBe(false);
  });
});

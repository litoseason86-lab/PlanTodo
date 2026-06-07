import {describe, expect, it} from 'vitest';

import {
  buildTodayTimelineFlow,
  partitionTodayExecutionTasks,
} from './todayTimelineFlow';
import type {TodayTimedTaskInput} from './todayTimelineFlow';

function timedTask(id: number, start: string, end: string): TodayTimedTaskInput & {
  userId: number;
  categoryId: number;
  plannedDate: string;
  priority: null;
  tagIds: number[];
  createdAt: string;
  updatedAt: string;
} {
  return {
    id,
    userId: 1,
    categoryId: 1,
    title: `任务 ${id}`,
    plannedDate: '2026-06-07',
    startAt: `2026-06-07T${start}:00.000`,
    endAt: `2026-06-07T${end}:00.000`,
    allDay: false,
    status: 'TODO' as const,
    priority: null,
    tagIds: [] as number[],
    createdAt: '',
    updatedAt: '',
  };
}

describe('todayTimelineFlow', () => {
  it('returns empty flow when no timed tasks are provided', () => {
    expect(buildTodayTimelineFlow({
      date: '2026-06-07',
      tasks: [],
    })).toEqual([]);
  });

  it('standard flow inserts one compact-boundary gap', () => {
    const result = buildTodayTimelineFlow({
      date: '2026-06-07',
      tasks: [
        timedTask(1, '09:00', '10:30'),
        timedTask(2, '11:30', '12:30'),
      ],
    });

    expect(result.map((item) => item.type)).toEqual(['task', 'gap', 'task']);
    expect(result[1]).toEqual({
      type: 'gap',
      startMinutes: 630,
      endMinutes: 690,
      durationMinutes: 60,
    });
  });

  it('overlap flow removes local fake idle gaps', () => {
    const result = buildTodayTimelineFlow({
      date: '2026-06-07',
      tasks: [
        timedTask(1, '09:00', '10:30'),
        timedTask(2, '10:00', '11:30'),
      ],
    });

    expect(result.some((item) => item.type === 'gap')).toBe(false);
    expect(result.map((item) => item.type)).toEqual(['task', 'task']);
  });

  it('contained flow has no gap when the large interval covers the small one', () => {
    const result = buildTodayTimelineFlow({
      date: '2026-06-07',
      tasks: [
        timedTask(1, '09:00', '12:00'),
        timedTask(2, '10:00', '11:00'),
      ],
    });

    expect(result.some((item) => item.type === 'gap')).toBe(false);
  });

  it('fragmented flow extracts multiple independent gaps without edge gaps', () => {
    const result = buildTodayTimelineFlow({
      date: '2026-06-07',
      tasks: [
        timedTask(1, '09:00', '10:00'),
        timedTask(2, '10:30', '11:15'),
        timedTask(3, '12:00', '13:00'),
      ],
    });

    expect(result.map((item) => item.type)).toEqual(['task', 'gap', 'task', 'gap', 'task']);
    expect(result.filter((item) => item.type === 'gap')).toEqual([
      {type: 'gap', startMinutes: 600, endMinutes: 630, durationMinutes: 30},
      {type: 'gap', startMinutes: 675, endMinutes: 720, durationMinutes: 45},
    ]);
  });

  it('does not create gaps shorter than fifteen minutes', () => {
    const result = buildTodayTimelineFlow({
      date: '2026-06-07',
      tasks: [
        timedTask(1, '09:00', '10:00'),
        timedTask(2, '10:10', '11:00'),
      ],
    });

    expect(result.some((item) => item.type === 'gap')).toBe(false);
  });

  it('does not create zero-minute gaps for touching intervals', () => {
    const result = buildTodayTimelineFlow({
      date: '2026-06-07',
      tasks: [
        timedTask(1, '09:00', '10:00'),
        timedTask(2, '10:00', '11:00'),
      ],
    });

    expect(result.some((item) => item.type === 'gap')).toBe(false);
    expect(result.map((item) => item.type)).toEqual(['task', 'task']);
  });

  it('ignores invalid timed intervals', () => {
    const invalid = {
      ...timedTask(1, '09:00', '10:00'),
      startAt: '2026-06-07T11:00:00.000',
      endAt: '2026-06-07T10:00:00.000',
    };

    expect(buildTodayTimelineFlow({
      date: '2026-06-07',
      tasks: [invalid],
    })).toEqual([]);
  });

  it('partitions invalid timed intervals into the queue instead of the flow', () => {
    const invalid = {
      ...timedTask(1, '09:00', '10:00'),
      startAt: '2026-06-07T11:00:00.000',
      endAt: '2026-06-07T10:00:00.000',
    };

    const partition = partitionTodayExecutionTasks({
      date: '2026-06-07',
      tasks: [timedTask(2, '09:00', '10:00'), invalid],
    });

    expect(partition.timelineFlow).toEqual([
      {type: 'task', taskId: 2, startMinutes: 540, endMinutes: 600, durationMinutes: 60},
    ]);
    expect(partition.taskQueue.map((task) => task.id)).toEqual([1]);
  });

  it('clips cross-day tasks to the selected date before building flow', () => {
    const result = buildTodayTimelineFlow({
      date: '2026-06-07',
      tasks: [
        {
          ...timedTask(1, '09:00', '10:00'),
          startAt: '2026-06-06T23:00:00.000',
          endAt: '2026-06-07T01:00:00.000',
        },
        timedTask(2, '02:00', '03:00'),
      ],
    });

    expect(result).toEqual([
      {type: 'task', taskId: 1, startMinutes: 0, endMinutes: 60, durationMinutes: 60},
      {type: 'gap', startMinutes: 60, endMinutes: 120, durationMinutes: 60},
      {type: 'task', taskId: 2, startMinutes: 120, endMinutes: 180, durationMinutes: 60},
    ]);
  });

  it('partitions untimed and all-day tasks into the queue', () => {
    const allDay = {...timedTask(3, '09:00', '10:00'), allDay: true, startAt: undefined, endAt: undefined};
    const untimed = {...timedTask(4, '09:00', '10:00'), startAt: undefined, endAt: undefined};
    const partition = partitionTodayExecutionTasks({
      date: '2026-06-07',
      tasks: [timedTask(1, '09:00', '10:00'), allDay, untimed],
    });

    expect(partition.timelineFlow.map((item) => item.type)).toEqual(['task']);
    expect(partition.taskQueue.map((task) => task.id)).toEqual([3, 4]);
  });
});

import {renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {
  buildTodayCategoryFocusData,
  getTaskFocusMinutes,
  useDashboardController,
} from './useDashboardController';

const categories = [
  {
    id: 1,
    userId: 1,
    name: '工作',
    color: '#ef4444',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    userId: 1,
    name: '学习',
    color: '#3b82f6',
    sortOrder: 2,
    createdAt: '',
    updatedAt: '',
  },
];

const tasks = [
  {
    id: 1,
    userId: 1,
    categoryId: 1,
    title: '写方案',
    plannedDate: '2026-06-05',
    allDay: true,
    status: 'TODO' as const,
    priority: null,
    tagIds: [] as number[],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    userId: 1,
    categoryId: 2,
    title: '复盘',
    plannedDate: '2026-06-05',
    allDay: true,
    status: 'DONE' as const,
    priority: null,
    tagIds: [] as number[],
    createdAt: '',
    updatedAt: '',
  },
];

const sessions = [
  {
    id: 1,
    taskId: 1,
    userId: 1,
    startedAt: '',
    durationSeconds: 1200,
    status: 'COMPLETED' as const,
    createdAt: '',
  },
  {
    id: 2,
    taskId: 2,
    userId: 1,
    startedAt: '',
    durationSeconds: 1800,
    status: 'COMPLETED' as const,
    createdAt: '',
  },
  {
    id: 3,
    taskId: 1,
    userId: 1,
    startedAt: '',
    durationSeconds: 299,
    status: 'COMPLETED' as const,
    createdAt: '',
  },
];

describe('useDashboardController helpers', () => {
  it('adds running session time to task focus minutes', () => {
    expect(
      getTaskFocusMinutes({
        taskId: 1,
        selectedDateSessions: sessions,
        runningSession: {
          id: 3,
          taskId: 1,
          userId: 1,
          startedAt: '',
          status: 'RUNNING',
          createdAt: '',
        },
        focusTimeElapsed: 600,
      }),
    ).toBe(30);
  });

  it('groups completed focus minutes by category', () => {
    expect(
      buildTodayCategoryFocusData({
        categories,
        tasks,
        allTasks: tasks,
        selectedDateSessions: sessions,
      }),
    ).toEqual([
      {name: '工作', minutes: 20, color: '#ef4444'},
      {name: '学习', minutes: 30, color: '#3b82f6'},
    ]);
  });

  it('excludes completed focus sessions shorter than five minutes from statistics', () => {
    expect(
      getTaskFocusMinutes({
        taskId: 1,
        selectedDateSessions: [
          {
            id: 4,
            taskId: 1,
            userId: 1,
            startedAt: '',
            durationSeconds: 299,
            status: 'COMPLETED',
            createdAt: '',
          },
          {
            id: 5,
            taskId: 1,
            userId: 1,
            startedAt: '',
            durationSeconds: 300,
            status: 'COMPLETED',
            createdAt: '',
          },
        ],
        runningSession: null,
        focusTimeElapsed: 0,
      }),
    ).toBe(5);
  });

  it('exposes today timeline flow and untimed queue', () => {
    const timedTask = {
      id: 10,
      userId: 1,
      categoryId: 1,
      title: '定时任务',
      plannedDate: '2026-06-07',
      startAt: '2026-06-07T09:00:00.000',
      endAt: '2026-06-07T10:00:00.000',
      allDay: false,
      status: 'TODO' as const,
      priority: null,
      tagIds: [] as number[],
      createdAt: '',
      updatedAt: '',
    };
    const untimedTask = {
      ...timedTask,
      id: 11,
      title: '无时间任务',
      startAt: undefined,
      endAt: undefined,
    };

    const {result} = renderHook(() =>
      useDashboardController({
        categories,
        tasks: [timedTask, untimedTask],
        allTasks: [timedTask, untimedTask],
        selectedDateSessions: [],
        runningSession: null,
        focusTimeElapsed: 0,
        selectedDate: '2026-06-07',
      }),
    );

    expect(result.current.todayTimelineFlow.map((item) => item.type)).toEqual(['task']);
    expect(result.current.todayTaskQueue.map((task) => task.id)).toEqual([11]);
  });
});

import {describe, expect, it} from 'vitest';

import {buildDailyReportMetrics} from './useDailyReportController';

describe('buildDailyReportMetrics', () => {
  it('builds daily counters and category duration data', () => {
    const result = buildDailyReportMetrics({
      categories: [
        {
          id: 1,
          userId: 1,
          name: '工作',
          color: '#ef4444',
          sortOrder: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
      dailyTasks: [
        {
          id: 1,
          userId: 1,
          categoryId: 1,
          title: '写周报',
          plannedDate: '2026-06-05',
          allDay: true,
          status: 'DONE',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 2,
          userId: 1,
          categoryId: 1,
          title: '整理任务',
          plannedDate: '2026-06-05',
          allDay: true,
          status: 'TODO',
          createdAt: '',
          updatedAt: '',
        },
      ],
      allTasks: [],
      dailySessions: [
        {
          id: 1,
          taskId: 1,
          userId: 1,
          startedAt: '',
          durationSeconds: 3600,
          status: 'COMPLETED',
          createdAt: '',
        },
        {
          id: 3,
          taskId: 1,
          userId: 1,
          startedAt: '',
          durationSeconds: 299,
          status: 'COMPLETED',
          createdAt: '',
        },
      ],
      prevDailySessions: [
        {
          id: 2,
          taskId: 1,
          userId: 1,
          startedAt: '',
          durationSeconds: 1800,
          status: 'COMPLETED',
          createdAt: '',
        },
        {
          id: 4,
          taskId: 1,
          userId: 1,
          startedAt: '',
          durationSeconds: 120,
          status: 'COMPLETED',
          createdAt: '',
        },
      ],
    });

    expect(result.dailyTotalMinutes).toBe(60);
    expect(result.prevDailyTotalMinutes).toBe(30);
    expect(result.dailyFocusDeltaPercent).toBe(100);
    expect(result.doneDailyTasksCount).toBe(1);
    expect(result.dailyCategoryDistributionData).toEqual([
      {name: '工作', minutes: 60, color: '#ef4444'},
    ]);
  });
});

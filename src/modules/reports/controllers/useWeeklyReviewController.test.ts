import {describe, expect, it} from 'vitest';

import {buildWeeklyReviewMetrics} from './useWeeklyReviewController';

describe('buildWeeklyReviewMetrics', () => {
  it('builds weekly totals, timeline and streak', () => {
    const result = buildWeeklyReviewMetrics({
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
      weeklyDaysData: [
        {
          day: '2026-06-01',
          tasks: [
            {
              id: 1,
              userId: 1,
              categoryId: 1,
              title: 'A',
              plannedDate: '2026-06-01',
              status: 'DONE',
              createdAt: '',
              updatedAt: '',
            },
          ],
          sessions: [
            {
              id: 1,
              taskId: 1,
              userId: 1,
              startedAt: '',
              durationSeconds: 1800,
              status: 'COMPLETED',
              createdAt: '',
            },
          ],
        },
        {
          day: '2026-06-02',
          tasks: [
            {
              id: 2,
              userId: 1,
              categoryId: 1,
              title: 'B',
              plannedDate: '2026-06-02',
              status: 'TODO',
              createdAt: '',
              updatedAt: '',
            },
          ],
          sessions: [],
        },
      ],
    });

    expect(result.weeklyTotalTasks).toBe(2);
    expect(result.weeklyDoneTasks).toBe(1);
    expect(result.weeklyPendingTasks).toBe(1);
    expect(result.weeklyTotalMins).toBe(30);
    expect(result.maxStreak).toBe(1);
    expect(result.weeklyCategoryDistribution).toEqual([
      {name: '工作', value: 1, color: '#ef4444'},
    ]);
    expect(result.weeklyTimelineRateData[0]).toMatchObject({
      day: '06-01',
      weekday: '周一',
      rate: 100,
    });
  });

  it('counts a streak day only when all tasks for that day are done', () => {
    const result = buildWeeklyReviewMetrics({
      categories: [],
      weeklyDaysData: [
        {
          day: '2026-06-01',
          tasks: [
            {
              id: 1,
              userId: 1,
              categoryId: 1,
              title: 'A',
              plannedDate: '2026-06-01',
              status: 'DONE',
              createdAt: '',
              updatedAt: '',
            },
            {
              id: 2,
              userId: 1,
              categoryId: 1,
              title: 'B',
              plannedDate: '2026-06-01',
              status: 'TODO',
              createdAt: '',
              updatedAt: '',
            },
          ],
          sessions: [],
        },
        {
          day: '2026-06-02',
          tasks: [
            {
              id: 3,
              userId: 1,
              categoryId: 1,
              title: 'C',
              plannedDate: '2026-06-02',
              status: 'DONE',
              createdAt: '',
              updatedAt: '',
            },
          ],
          sessions: [],
        },
        {
          day: '2026-06-03',
          tasks: [
            {
              id: 4,
              userId: 1,
              categoryId: 1,
              title: 'D',
              plannedDate: '2026-06-03',
              status: 'DONE',
              createdAt: '',
              updatedAt: '',
            },
          ],
          sessions: [],
        },
      ],
    });

    expect(result.maxStreak).toBe(2);
  });
});

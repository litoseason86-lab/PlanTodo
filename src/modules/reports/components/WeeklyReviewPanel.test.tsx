import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {WeeklyReviewPanel} from './WeeklyReviewPanel';

const weeklyDay = {
  day: '2026-06-01',
  tasks: [
    {
      id: 1,
      userId: 1,
      categoryId: 1,
      title: '写方案',
      plannedDate: '2026-06-01',
      allDay: true,
      status: 'DONE' as const,
      createdAt: '',
      updatedAt: '',
    },
  ],
  sessions: [
    {
      id: 1,
      taskId: 1,
      userId: 1,
      startedAt: '2026-06-01T01:00:00.000Z',
      endedAt: '2026-06-01T01:30:00.000Z',
      durationSeconds: 1800,
      status: 'COMPLETED' as const,
      createdAt: '',
    },
    {
      id: 2,
      taskId: 1,
      userId: 1,
      startedAt: '2026-06-01T02:00:00.000Z',
      endedAt: '2026-06-01T02:04:00.000Z',
      durationSeconds: 240,
      status: 'COMPLETED' as const,
      createdAt: '',
    },
  ],
};

describe('WeeklyReviewPanel', () => {
  it('renders weekly summary metrics and streak', () => {
    render(
      <WeeklyReviewPanel
        styleContext={{primary: '#fb7185', primaryLight: '#fff1f2', secondary: '#fda4af'}}
        weeklyStartDate="2026-06-01"
        setWeeklyStartDate={() => {}}
        loadWeeklyStats={() => {}}
        weeklyStatsLoaded
        metrics={{
          weeklyTotalTasks: 3,
          weeklyDoneTasks: 2,
          weeklyPendingTasks: 1,
          weeklyOverdueTasks: 0,
          weeklyTotalMins: 90,
          weeklyTimelineRateData: [{day: '06-01', weekday: '周一', rate: 100, total: 1, completed: 1}],
          weeklyCategoryDistribution: [{name: '工作', value: 2, color: '#ef4444'}],
          weeklyDaysData: [weeklyDay],
          maxStreak: 2,
        }}
      />,
    );

    expect(screen.getByText('周度效率复盘看板')).toBeInTheDocument();
    expect(screen.getByText('90 分钟')).toBeInTheDocument();
    expect(screen.getByText('2 日')).toBeInTheDocument();
    expect(screen.getByText('30m')).toBeInTheDocument();
    expect(screen.queryByText('34m')).not.toBeInTheDocument();
  });
});

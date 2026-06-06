import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {WeekTimelineView} from './WeekTimelineView';

const categories = [
  {id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''},
];

const task = {
  id: 1,
  userId: 1,
  categoryId: 1,
  title: '写方案',
  plannedDate: '2026-06-06',
  allDay: true,
  status: 'TODO',
  createdAt: '',
  updatedAt: '',
} as const;

describe('WeekTimelineView', () => {
  it('ignores unscheduled all-day tasks if malformed date groups include them', () => {
    render(
      <WeekTimelineView
        anchorDate="2026-06-06"
        tasksByDate={{'2026-06-06': [{...task, id: 99, title: '未安排', plannedDate: undefined}]}}
        categories={categories}
        focusSessions={[]}
        showFocusSessions={false}
        onScheduleTime={vi.fn().mockResolvedValue(undefined)}
        onMoveTimedTask={vi.fn().mockResolvedValue(undefined)}
        onResizeTimedTask={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByText('未安排')).not.toBeInTheDocument();
  });
});

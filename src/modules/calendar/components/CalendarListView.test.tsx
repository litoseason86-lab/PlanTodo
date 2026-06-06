import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {CalendarListView} from './CalendarListView';

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

describe('CalendarListView', () => {
  it('ignores unscheduled tasks if malformed date groups include them', () => {
    render(
      <CalendarListView
        dateFrom="2026-06-06"
        dateTo="2026-06-06"
        tasksByDate={{'2026-06-06': [{...task, id: 99, title: '未安排', plannedDate: undefined}]}}
        categories={categories}
        focusSessions={[]}
        showFocusSessions={false}
      />,
    );

    expect(screen.queryByText('未安排')).not.toBeInTheDocument();
  });
});

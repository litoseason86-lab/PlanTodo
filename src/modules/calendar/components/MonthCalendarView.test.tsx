import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {MonthCalendarView} from './MonthCalendarView';
import {writeCalendarDragPayload} from '../controllers/schedulingDrag';

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

function createDragData() {
  const values = new Map<string, string>();
  return {
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
  } as unknown as DataTransfer;
}

function renderMonth(overrides: Partial<Parameters<typeof MonthCalendarView>[0]> = {}) {
  return render(
    <MonthCalendarView
      anchorDate="2026-06-06"
      tasksByDate={{'2026-06-06': [task]}}
      categories={categories}
      onCreateDateTask={vi.fn().mockResolvedValue(undefined)}
      onScheduleDate={vi.fn().mockResolvedValue(true)}
      onBatchScheduleDate={vi.fn().mockResolvedValue(true)}
      {...overrides}
    />,
  );
}

describe('MonthCalendarView', () => {
  it('creates a task when an empty date cell is clicked', () => {
    const createTask = vi.fn().mockResolvedValue(undefined);

    render(
      <MonthCalendarView
        anchorDate="2026-06-06"
        tasksByDate={{}}
        categories={categories}
        onCreateDateTask={createTask}
        onScheduleDate={vi.fn().mockResolvedValue(undefined)}
        onBatchScheduleDate={vi.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.click(screen.getByRole('button', {name: '2026-06-06'}));

    expect(createTask).toHaveBeenCalledWith('2026-06-06');
  });

  it('does not create a new task when an existing task block is clicked', () => {
    const createTask = vi.fn().mockResolvedValue(undefined);

    render(
      <MonthCalendarView
        anchorDate="2026-06-06"
        tasksByDate={{'2026-06-06': [task]}}
        categories={categories}
        onCreateDateTask={createTask}
        onScheduleDate={vi.fn().mockResolvedValue(undefined)}
        onBatchScheduleDate={vi.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.click(screen.getByText('写方案'));

    expect(createTask).not.toHaveBeenCalled();
  });

  it('schedules a task when it is dropped onto a date cell', () => {
    const scheduleDate = vi.fn().mockResolvedValue(undefined);

    render(
      <MonthCalendarView
        anchorDate="2026-06-06"
        tasksByDate={{'2026-06-06': [task]}}
        categories={categories}
        onCreateDateTask={vi.fn().mockResolvedValue(undefined)}
        onScheduleDate={scheduleDate}
        onBatchScheduleDate={vi.fn().mockResolvedValue(true)}
      />,
    );

    const data = createDragData();
    fireEvent.dragStart(screen.getByText('写方案'), {dataTransfer: data});
    fireEvent.drop(screen.getByRole('button', {name: '2026-06-08'}), {dataTransfer: data});

    expect(scheduleDate).toHaveBeenCalledWith(1, '2026-06-08');
  });

  it('batch schedules tasks when a batch payload is dropped onto a date cell', () => {
    const batchScheduleDate = vi.fn().mockResolvedValue(true);
    renderMonth({onBatchScheduleDate: batchScheduleDate});
    const data = createDragData();
    writeCalendarDragPayload(data, {type: 'calendar-task-batch', taskIds: [1, 2], source: 'sidebar'});
    fireEvent.drop(screen.getByRole('button', {name: '2026-06-08'}), {dataTransfer: data});
    expect(batchScheduleDate).toHaveBeenCalledWith([1, 2], '2026-06-08');
  });

  it('ignores unscheduled tasks if malformed date groups include them', () => {
    render(
      <MonthCalendarView
        anchorDate="2026-06-06"
        tasksByDate={{'2026-06-06': [{...task, id: 99, title: '未安排', plannedDate: undefined}]}}
        categories={categories}
        onCreateDateTask={vi.fn().mockResolvedValue(undefined)}
        onScheduleDate={vi.fn().mockResolvedValue(undefined)}
        onBatchScheduleDate={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.queryByText('未安排')).not.toBeInTheDocument();
  });
});

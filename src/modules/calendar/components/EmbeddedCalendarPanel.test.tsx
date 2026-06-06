import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {calendarApi} from '../api/calendarApi';
import {writeCalendarDragPayload} from '../controllers/schedulingDrag';
import {EmbeddedCalendarPanel} from './EmbeddedCalendarPanel';

vi.mock('../api/calendarApi', () => ({
  calendarApi: {
    getCalendarTasks: vi.fn(),
    getFocusSessions: vi.fn(),
    createCalendarTask: vi.fn(),
    updateTaskSchedule: vi.fn(),
    batchScheduleDate: vi.fn(),
    batchUnschedule: vi.fn(),
  },
}));

const categories = [{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}];

function createDragData() {
  const values = new Map<string, string>();
  return {
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
  } as unknown as DataTransfer;
}

describe('EmbeddedCalendarPanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders calendar surface without the scheduling sidebar', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    render(<EmbeddedCalendarPanel categories={categories} initialDate="2026-06-06" showToast={vi.fn()} onMutationSuccess={vi.fn()} />);
    expect(screen.getByRole('heading', {name: '日历'})).toBeInTheDocument();
    expect(screen.queryByText('安排任务')).not.toBeInTheDocument();
  });

  it('schedules a task-list payload dropped onto an embedded month date', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);
    render(<EmbeddedCalendarPanel categories={categories} initialDate="2026-06-06" showToast={vi.fn()} onMutationSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', {name: '月'}));
    const data = createDragData();
    writeCalendarDragPayload(data, {type: 'calendar-task', taskId: 1, source: 'task-list'});
    fireEvent.drop(screen.getByRole('button', {name: '2026-06-08'}), {dataTransfer: data});
    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({plannedDate: '2026-06-08', allDay: true}));
  });
});

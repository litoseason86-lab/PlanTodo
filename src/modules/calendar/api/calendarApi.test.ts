import {afterEach, describe, expect, it, vi} from 'vitest';

import {tasksApi} from '../../tasks/api/tasksApi';
import {calendarApi} from './calendarApi';

vi.mock('../../tasks/api/tasksApi', () => ({
  tasksApi: {
    getTasks: vi.fn(),
    createTask: vi.fn(),
    updateTaskSchedule: vi.fn(),
    batchScheduleDate: vi.fn(),
    batchUnschedule: vi.fn(),
  },
}));

describe('calendarApi', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes metadata filters to unscheduled and all-day task pool queries', async () => {
    vi.mocked(tasksApi.getTasks).mockResolvedValue([]);

    await calendarApi.getUnscheduledTasks({query: '方案', categoryId: 1, tagIds: [2, 3], priority: 'none'});
    await calendarApi.getAllDayWithoutTimeTasks({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
      query: '方案',
      categoryId: 1,
      tagIds: [2, 3],
      priority: 'P1',
    });

    expect(tasksApi.getTasks).toHaveBeenNthCalledWith(1, {
      query: '方案',
      categoryId: 1,
      tagIds: [2, 3],
      priority: 'none',
      scheduled: 'unscheduled',
    });
    expect(tasksApi.getTasks).toHaveBeenNthCalledWith(2, {
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
      query: '方案',
      categoryId: 1,
      tagIds: [2, 3],
      priority: 'P1',
      scheduled: 'all-day-without-time',
    });
  });

  it('forwards the full timed task creation payload to tasks API', async () => {
    vi.mocked(tasksApi.createTask).mockResolvedValue({id: 1} as never);
    const payload = {
      title: '写方案',
      categoryId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
      priority: null,
      tagIds: [] as number[],
    } satisfies Parameters<typeof calendarApi.createCalendarTask>[0];

    await calendarApi.createCalendarTask(payload);

    expect(tasksApi.createTask).toHaveBeenCalledWith({
      title: '写方案',
      categoryId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
      priority: null,
      tagIds: [],
    });
  });

  it('forwards the full cross-day all-day task creation payload to tasks API', async () => {
    vi.mocked(tasksApi.createTask).mockResolvedValue({id: 1} as never);
    const payload = {
      title: '跨天安排',
      categoryId: 1,
      plannedDate: '2026-06-06',
      plannedEndDate: '2026-06-08',
      allDay: true,
      priority: null,
      tagIds: [] as number[],
    } satisfies Parameters<typeof calendarApi.createCalendarTask>[0];

    await calendarApi.createCalendarTask(payload);

    expect(tasksApi.createTask).toHaveBeenCalledWith({
      title: '跨天安排',
      categoryId: 1,
      plannedDate: '2026-06-06',
      plannedEndDate: '2026-06-08',
      allDay: true,
      priority: null,
      tagIds: [],
    });
  });
});

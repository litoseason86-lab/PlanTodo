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
});

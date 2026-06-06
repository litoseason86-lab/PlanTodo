import {afterEach, describe, expect, it, vi} from 'vitest';

import {tasksApi} from './tasksApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tasksApi', () => {
  it('queries tasks by date range', async () => {
    const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => []});
    vi.stubGlobal('fetch', fetch);

    await tasksApi.getTasks({dateFrom: '2026-06-01', dateTo: '2026-06-07', categoryId: 2});

    expect(fetch).toHaveBeenCalledWith('/api/tasks?dateFrom=2026-06-01&dateTo=2026-06-07&categoryId=2', expect.any(Object));
  });

  it('updates a task schedule', async () => {
    const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({id: 1})});
    vi.stubGlobal('fetch', fetch);

    await tasksApi.updateTaskSchedule(1, {
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
    });

    expect(fetch).toHaveBeenCalledWith('/api/tasks/1/schedule', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        plannedDate: '2026-06-06',
        startAt: '2026-06-06T09:00:00.000',
        endAt: '2026-06-06T10:00:00.000',
        allDay: false,
      }),
    }));
  });

  it('deletes a task by id', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });
    vi.stubGlobal('fetch', fetch);

    await tasksApi.deleteTask(12);

    expect(fetch).toHaveBeenCalledWith('/api/tasks/12', expect.objectContaining({method: 'DELETE'}));
  });

  it('queries tasks by scheduled state and search query', async () => {
    const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => []});
    vi.stubGlobal('fetch', fetch);

    await tasksApi.getTasks({
      scheduled: 'all-day-without-time',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
      query: '周报',
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks?dateFrom=2026-06-01&dateTo=2026-06-07&scheduled=all-day-without-time&query=%E5%91%A8%E6%8A%A5',
      expect.any(Object),
    );
  });

  it('creates an unscheduled task without plannedDate', async () => {
    const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({id: 1})});
    vi.stubGlobal('fetch', fetch);

    await tasksApi.createTask({title: '收集资料', categoryId: 1});

    expect(fetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({title: '收集资料', categoryId: 1}),
    }));
  });

  it('unschedules a task with null plannedDate', async () => {
    const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({id: 1})});
    vi.stubGlobal('fetch', fetch);

    await tasksApi.updateTaskSchedule(1, {plannedDate: null, allDay: true});

    expect(fetch).toHaveBeenCalledWith('/api/tasks/1/schedule', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({plannedDate: null, allDay: true}),
    }));
  });

  it('calls batch schedule endpoints', async () => {
    const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => []});
    vi.stubGlobal('fetch', fetch);

    await tasksApi.batchScheduleDate({taskIds: [1, 2], plannedDate: '2026-06-06'});
    await tasksApi.batchUnschedule({taskIds: [1, 2]});

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/tasks/batch-schedule', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({taskIds: [1, 2], plannedDate: '2026-06-06'}),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/tasks/batch-unschedule', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({taskIds: [1, 2]}),
    }));
  });
});

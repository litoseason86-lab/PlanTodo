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
});

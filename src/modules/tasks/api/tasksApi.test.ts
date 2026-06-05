import {afterEach, describe, expect, it, vi} from 'vitest';

import {tasksApi} from './tasksApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tasksApi', () => {
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

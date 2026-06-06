import {afterEach, describe, expect, it, vi} from 'vitest';

import {focusApi} from './focusApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('focusApi', () => {
  it('queries sessions by date range', async () => {
    const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => []});
    vi.stubGlobal('fetch', fetch);

    await focusApi.getSessions({dateFrom: '2026-06-01', dateTo: '2026-06-07'});

    expect(fetch).toHaveBeenCalledWith('/api/task-sessions?dateFrom=2026-06-01&dateTo=2026-06-07', expect.any(Object));
  });

  it('pauses and resumes sessions by id', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({id: 1, status: 'PAUSED'}),
    });
    vi.stubGlobal('fetch', fetch);

    await focusApi.pauseSession(1);
    await focusApi.resumeSession(1);

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/task-sessions/1/pause', expect.objectContaining({method: 'POST'}));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/task-sessions/1/resume', expect.objectContaining({method: 'POST'}));
  });
});

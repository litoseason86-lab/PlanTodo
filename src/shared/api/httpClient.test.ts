import {afterEach, describe, expect, it, vi} from 'vitest';

import {requestJson} from './httpClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestJson', () => {
  it('throws ApiError when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({message: 'duplicate'}),
      }),
    );

    await expect(requestJson('/api/categories')).rejects.toMatchObject({
      status: 409,
      message: 'duplicate',
    });
  });

  it('returns undefined for empty success responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );

    await expect(requestJson('/api/tasks/1', {method: 'DELETE'})).resolves.toBeUndefined();
  });
});

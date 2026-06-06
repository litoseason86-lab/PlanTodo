import express from 'express';
import type {Server} from 'node:http';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {buildTaskRoutes} from './routes';

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

function buildService(overrides = {}) {
  return {
    list: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    updateSchedule: vi.fn(() => ({id: 1})),
    batchScheduleDate: vi.fn(() => [{id: 1}, {id: 2}]),
    batchUnschedule: vi.fn(() => [{id: 1}, {id: 2}]),
    delete: vi.fn(),
    ...overrides,
  };
}

async function request(service: ReturnType<typeof buildService>, path: string, body: unknown) {
  const app = express();
  app.use(express.json());
  app.use('/api', buildTaskRoutes(service as unknown as Parameters<typeof buildTaskRoutes>[0]));

  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server!.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind to a port');
  }

  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
}

describe('task routes', () => {
  it('routes batch schedule to the static batch handler', async () => {
    const service = buildService();

    const response = await request(service, '/api/tasks/batch-schedule', {
      taskIds: [1, 2],
      plannedDate: '2026-06-06',
    });

    expect(response.status).toBe(200);
    expect(service.batchScheduleDate).toHaveBeenCalledWith({
      userId: 1,
      taskIds: [1, 2],
      plannedDate: '2026-06-06',
    });
    expect(service.updateSchedule).not.toHaveBeenCalled();
  });

  it('routes batch unschedule to the static batch handler', async () => {
    const service = buildService();

    const response = await request(service, '/api/tasks/batch-unschedule', {taskIds: [1, 2]});

    expect(response.status).toBe(200);
    expect(service.batchUnschedule).toHaveBeenCalledWith({userId: 1, taskIds: [1, 2]});
    expect(service.updateSchedule).not.toHaveBeenCalled();
  });

  it('routes single-task empty schedule body as unschedule', async () => {
    const service = buildService();

    const response = await request(service, '/api/tasks/1/schedule', {});

    expect(response.status).toBe(200);
    expect(service.updateSchedule).toHaveBeenCalledWith({
      taskId: 1,
      userId: 1,
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
  });
});

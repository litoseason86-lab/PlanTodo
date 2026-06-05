import {describe, expect, it, vi} from 'vitest';

import {FocusService} from './service';

describe('FocusService', () => {
  it('lists sessions by China calendar day boundaries', () => {
    const listByDateRange = vi.fn(() => []);
    const service = new FocusService(
      {
        getById: vi.fn(),
        updateStatus: vi.fn(),
      },
      {
        getRunningByUser: vi.fn(),
        listByDateRange,
        listByTask: vi.fn(),
        createRunning: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(),
      },
    );

    service.listByDate(1, '2026-06-05');

    expect(listByDateRange).toHaveBeenCalledWith(
      1,
      '2026-06-04T16:00:00.000Z',
      '2026-06-05T15:59:59.999Z',
    );
  });

  it('marks task IN_PROGRESS when a session starts and resets it on stop', () => {
    const task = {
      id: 1,
      userId: 1,
      categoryId: 1,
      title: '任务',
      plannedDate: '2026-06-05',
      status: 'TODO' as const,
      createdAt: '',
      updatedAt: '',
    };
    const updateStatus = vi.fn((_taskId: number, _userId: number, status: 'TODO' | 'IN_PROGRESS') => {
      const updatedTask = {
        ...task,
        status,
      };
      Object.assign(task, updatedTask);
      return updatedTask;
    });
    const tasks = {
      getById: vi.fn(() => task),
      updateStatus,
    };
    const sessions = {
      getRunningByUser: vi
        .fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce({
          id: 1,
          taskId: 1,
          userId: 1,
          startedAt: '2026-06-05T00:00:00.000Z',
          status: 'RUNNING' as const,
          createdAt: '2026-06-05T00:00:00.000Z',
        }),
      listByDateRange: vi.fn(),
      listByTask: vi.fn(),
      createRunning: vi.fn(() => ({
        id: 1,
        taskId: 1,
        userId: 1,
        startedAt: '2026-06-05T00:00:00.000Z',
        status: 'RUNNING' as const,
        createdAt: '2026-06-05T00:00:00.000Z',
      })),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(() => ({
        id: 1,
        taskId: 1,
        userId: 1,
        startedAt: '2026-06-05T00:00:00.000Z',
        endedAt: '2026-06-05T00:30:00.000Z',
        durationSeconds: 1800,
        status: 'COMPLETED' as const,
        createdAt: '2026-06-05T00:00:00.000Z',
      })),
    };

    const service = new FocusService(tasks, sessions);
    const started = service.start({taskId: 1, userId: 1});
    const stopped = service.stop({sessionId: 1, userId: 1});

    expect(started.status).toBe('RUNNING');
    expect(stopped.status).toBe('COMPLETED');
    expect(updateStatus).toHaveBeenNthCalledWith(1, 1, 1, 'IN_PROGRESS');
    expect(updateStatus).toHaveBeenNthCalledWith(2, 1, 1, 'TODO');
  });

  it('pauses and resumes sessions through the repository', () => {
    const pausedSession = {
      id: 1,
      taskId: 1,
      userId: 1,
      startedAt: '2026-06-05T00:00:00.000Z',
      pausedAt: '2026-06-05T00:10:00.000Z',
      accumulatedPauseSeconds: 0,
      status: 'PAUSED' as const,
      createdAt: '2026-06-05T00:00:00.000Z',
    };
    const resumedSession = {
      ...pausedSession,
      pausedAt: undefined,
      accumulatedPauseSeconds: 600,
      status: 'RUNNING' as const,
    };
    const sessions = {
      getRunningByUser: vi.fn(),
      listByDateRange: vi.fn(),
      listByTask: vi.fn(),
      createRunning: vi.fn(),
      pause: vi.fn(() => pausedSession),
      resume: vi.fn(() => resumedSession),
      stop: vi.fn(),
    };
    const service = new FocusService(
      {
        getById: vi.fn(),
        updateStatus: vi.fn(),
      },
      sessions,
    );

    expect(service.pause({sessionId: 1, userId: 1})).toEqual(pausedSession);
    expect(service.resume({sessionId: 1, userId: 1})).toEqual(resumedSession);
    expect(sessions.pause).toHaveBeenCalledWith({sessionId: 1, userId: 1});
    expect(sessions.resume).toHaveBeenCalledWith({sessionId: 1, userId: 1});
  });

  it('rejects pause or resume when session state is invalid', () => {
    const service = new FocusService(
      {
        getById: vi.fn(),
        updateStatus: vi.fn(),
      },
      {
        getRunningByUser: vi.fn(),
        listByDateRange: vi.fn(),
        listByTask: vi.fn(),
        createRunning: vi.fn(),
        pause: vi.fn(() => undefined),
        resume: vi.fn(() => undefined),
        stop: vi.fn(),
      },
    );

    expect(() => service.pause({sessionId: 1, userId: 1})).toThrow('Session is not running.');
    expect(() => service.resume({sessionId: 1, userId: 1})).toThrow('Session is not paused.');
  });
});

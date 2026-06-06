import {describe, expect, it, vi} from 'vitest';

import {TasksService} from './service';

describe('TasksService', () => {
  it('rejects task creation when category does not exist', () => {
    const service = new TasksService(
      {
        listByFilters: vi.fn(),
        getById: vi.fn(),
        create: vi.fn(),
        updateStatus: vi.fn(),
        updateSchedule: vi.fn(),
        remove: vi.fn(),
      },
      {
        getById: () => undefined,
      },
      {
        getRunningByUser: vi.fn(),
        stop: vi.fn(),
      },
    );

    expect(() => {
      service.create({
        userId: 1,
        categoryId: 99,
        title: '测试',
        plannedDate: '2026-06-05',
      });
    }).toThrow('Category not found');
  });

  it('rejects IN_PROGRESS when no matching running session exists', () => {
    const service = new TasksService(
      {
        listByFilters: vi.fn(),
        getById: vi.fn(),
        create: vi.fn(),
        updateStatus: vi.fn(),
        updateSchedule: vi.fn(),
        remove: vi.fn(),
      },
      {
        getById: () => ({
          id: 1,
          userId: 1,
          categoryId: 2,
          name: '学习',
          color: '#fff',
          sortOrder: 1,
          createdAt: '',
          updatedAt: '',
        }),
      },
      {
        getRunningByUser: () => undefined,
        stop: vi.fn(),
      },
    );

    expect(() => service.updateStatus(1, 1, 'IN_PROGRESS')).toThrow('focus session start endpoint');
  });

  it('deletes an existing task through the repository', () => {
    const remove = vi.fn(() => true);
    const service = new TasksService(
      {
        listByFilters: vi.fn(),
        getById: vi.fn(),
        create: vi.fn(),
        updateStatus: vi.fn(),
        updateSchedule: vi.fn(),
        remove,
      },
      {
        getById: vi.fn(),
      },
      {
        getRunningByUser: vi.fn(),
        stop: vi.fn(),
      },
    );

    service.delete(12, 1);

    expect(remove).toHaveBeenCalledWith(12, 1);
  });

  it('rejects deleting a missing task', () => {
    const service = new TasksService(
      {
        listByFilters: vi.fn(),
        getById: vi.fn(),
        create: vi.fn(),
        updateStatus: vi.fn(),
        updateSchedule: vi.fn(),
        remove: vi.fn(() => false),
      },
      {
        getById: vi.fn(),
      },
      {
        getRunningByUser: vi.fn(),
        stop: vi.fn(),
      },
    );

    expect(() => service.delete(999, 1)).toThrow('Task not found');
  });

  it('rejects timed schedules without start and end', () => {
    const task = {id: 1, userId: 1, categoryId: 1, title: '写方案', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''} as const;
    const service = new TasksService(
      {
        listByFilters: () => [],
        getById: () => task,
        create: () => task,
        updateStatus: () => task,
        updateSchedule: () => task,
        remove: () => false,
      },
      {getById: () => ({id: 1, userId: 1, name: '工作', color: '#000', sortOrder: 1, createdAt: '', updatedAt: ''})},
      {getRunningByUser: () => undefined, stop: () => undefined},
    );

    expect(() => service.updateSchedule({
      taskId: 1,
      userId: 1,
      plannedDate: '2026-06-06',
      allDay: false,
    })).toThrow('Timed task requires startAt and endAt');
  });

  it('accepts cross-day timed schedules', () => {
    const task = {id: 1, userId: 1, categoryId: 1, title: '写方案', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''} as const;
    let savedSchedule: unknown;
    const service = new TasksService(
      {
        listByFilters: () => [],
        getById: () => task,
        create: () => task,
        updateStatus: () => task,
        updateSchedule: (input) => {
          savedSchedule = input;
          return {...task, ...input, allDay: false};
        },
        remove: () => false,
      },
      {getById: () => ({id: 1, userId: 1, name: '工作', color: '#000', sortOrder: 1, createdAt: '', updatedAt: ''})},
      {getRunningByUser: () => undefined, stop: () => undefined},
    );

    expect(service.updateSchedule({
      taskId: 1,
      userId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T23:30:00.000',
      endAt: '2026-06-07T00:30:00.000',
      allDay: false,
    })).toMatchObject({
      startAt: '2026-06-06T23:30:00.000',
      endAt: '2026-06-07T00:30:00.000',
      allDay: false,
    });
    expect(savedSchedule).toMatchObject({
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T23:30:00.000',
      endAt: '2026-06-07T00:30:00.000',
      allDay: false,
    });
  });

  it('rejects timed schedules whose date differs from plannedDate', () => {
    const task = {id: 1, userId: 1, categoryId: 1, title: '写方案', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''} as const;
    const service = new TasksService(
      {
        listByFilters: () => [],
        getById: () => task,
        create: () => task,
        updateStatus: () => task,
        updateSchedule: () => task,
        remove: () => false,
      },
      {getById: () => ({id: 1, userId: 1, name: '工作', color: '#000', sortOrder: 1, createdAt: '', updatedAt: ''})},
      {getRunningByUser: () => undefined, stop: () => undefined},
    );

    expect(() => service.updateSchedule({
      taskId: 1,
      userId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-07T09:00:00.000',
      endAt: '2026-06-07T10:00:00.000',
      allDay: false,
    })).toThrow('Timed task date must match plannedDate');
  });

  it('rejects invalid timed task creation through the service', () => {
    const service = new TasksService(
      {
        listByFilters: () => [],
        getById: () => undefined,
        create: () => {
          throw new Error('not used');
        },
        updateStatus: () => undefined,
        updateSchedule: () => undefined,
        remove: () => false,
      },
      {getById: () => ({id: 1, userId: 1, name: '工作', color: '#000', sortOrder: 1, createdAt: '', updatedAt: ''})},
      {getRunningByUser: () => undefined, stop: () => undefined},
    );

    expect(() => service.create({
      userId: 1,
      categoryId: 1,
      title: '非法时间段',
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T10:00:00.000',
      endAt: '2026-06-06T09:00:00.000',
      allDay: false,
    })).toThrow('endAt must be after startAt');
  });
});

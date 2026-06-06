import {describe, expect, it, vi} from 'vitest';

import type {Task} from '../../../shared/domain/entities';
import type {TaskRepository} from './repository';
import {TasksService} from './service';

function existingTask(id: number, userId = 1): Task {
  return {
    id,
    userId,
    categoryId: 1,
    title: `任务${id}`,
    plannedDate: '2026-06-06',
    allDay: true,
    status: 'TODO',
    createdAt: '',
    updatedAt: '',
  };
}

function buildTaskRepository(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    listByFilters: vi.fn(() => []),
    getById: vi.fn(),
    create: vi.fn((input) => ({
      id: 1,
      status: 'TODO',
      createdAt: '',
      updatedAt: '',
      allDay: input.allDay ?? true,
      ...input,
    })),
    updateStatus: vi.fn((_taskId, userId, status) => ({
      ...existingTask(1, userId),
      status,
    })),
    updateSchedule: vi.fn((input) => ({
      ...existingTask(input.taskId, input.userId),
      plannedDate: input.plannedDate,
      plannedEndDate: input.plannedEndDate,
      startAt: input.startAt,
      endAt: input.endAt,
      allDay: input.allDay,
    })),
    batchUpdateSchedules: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

function buildService(repository: TaskRepository, categoryExists = true) {
  return new TasksService(
    repository,
    {
      getById: () => categoryExists
        ? {id: 1, userId: 1, name: '工作', color: '#000', sortOrder: 1, createdAt: '', updatedAt: ''}
        : undefined,
    },
    {
      getRunningByUser: () => undefined,
      stop: vi.fn(),
    },
  );
}

describe('TasksService', () => {
  it('rejects task creation when category does not exist', () => {
    const service = buildService(buildTaskRepository(), false);

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
    const service = buildService(buildTaskRepository());

    expect(() => service.updateStatus(1, 1, 'IN_PROGRESS')).toThrow('focus session start endpoint');
  });

  it('deletes an existing task through the repository', () => {
    const remove = vi.fn(() => true);
    const service = buildService(buildTaskRepository({remove}));

    service.delete(12, 1);

    expect(remove).toHaveBeenCalledWith(12, 1);
  });

  it('rejects deleting a missing task', () => {
    const service = buildService(buildTaskRepository({remove: vi.fn(() => false)}));

    expect(() => service.delete(999, 1)).toThrow('Task not found');
  });

  it('rejects timed schedules without start and end', () => {
    const service = buildService(buildTaskRepository({getById: vi.fn(() => existingTask(1))}));

    expect(() => service.updateSchedule({
      taskId: 1,
      userId: 1,
      plannedDate: '2026-06-06',
      allDay: false,
    })).toThrow('Timed task requires startAt and endAt');
  });

  it('rejects cross-day timed schedules', () => {
    const service = buildService(buildTaskRepository({getById: vi.fn(() => existingTask(1))}));

    expect(() => service.updateSchedule({
      taskId: 1,
      userId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T23:30:00.000',
      endAt: '2026-06-07T00:30:00.000',
      allDay: false,
    })).toThrow('Cross-day timed tasks are not supported yet');
  });

  it('rejects timed schedules whose date differs from plannedDate', () => {
    const service = buildService(buildTaskRepository({getById: vi.fn(() => existingTask(1))}));

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
    const service = buildService(buildTaskRepository({
      create: vi.fn(() => {
        throw new Error('not used');
      }),
    }));

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

  it('creates unscheduled tasks after category validation', () => {
    const repository = buildTaskRepository();
    const service = buildService(repository);

    service.create({
      userId: 1,
      categoryId: 1,
      title: '  收集资料  ',
      plannedDate: undefined,
      allDay: true,
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      title: '收集资料',
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    }));
  });

  it('rejects task creation with schedule details but no plannedDate', () => {
    const repository = buildTaskRepository();
    const service = buildService(repository);

    expect(() => service.create({
      userId: 1,
      categoryId: 1,
      title: '缺日期的时间段',
      plannedDate: undefined,
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
    })).toThrow('Timed task requires plannedDate');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('unschedules a task through schedule update', () => {
    const repository = buildTaskRepository({
      getById: vi.fn(() => existingTask(1)),
    });
    const service = buildService(repository);

    service.updateSchedule({
      taskId: 1,
      userId: 1,
      plannedDate: undefined,
      allDay: true,
    });

    expect(repository.updateSchedule).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 1,
      userId: 1,
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    }));
  });

  it('rejects schedule updates with schedule details but no plannedDate', () => {
    const repository = buildTaskRepository({
      getById: vi.fn(() => existingTask(1)),
    });
    const service = buildService(repository);

    expect(() => service.updateSchedule({
      taskId: 1,
      userId: 1,
      plannedDate: undefined,
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: true,
    })).toThrow('Timed task requires plannedDate');
    expect(repository.updateSchedule).not.toHaveBeenCalled();
  });

  it('batch schedules only after every task exists for the user', () => {
    const repository = buildTaskRepository({
      getById: vi.fn((taskId: number, userId: number) => existingTask(taskId, userId)),
      batchUpdateSchedules: vi.fn(() => [existingTask(1), existingTask(2)]),
    });
    const service = buildService(repository);

    service.batchScheduleDate({userId: 1, taskIds: [1, 2], plannedDate: '2026-06-08'});

    expect(repository.getById).toHaveBeenCalledTimes(2);
    expect(repository.batchUpdateSchedules).toHaveBeenCalledWith([
      {taskId: 1, userId: 1, plannedDate: '2026-06-08', plannedEndDate: undefined, startAt: undefined, endAt: undefined, allDay: true},
      {taskId: 2, userId: 1, plannedDate: '2026-06-08', plannedEndDate: undefined, startAt: undefined, endAt: undefined, allDay: true},
    ]);
  });

  it('does not partially batch schedule when any task is missing', () => {
    const repository = buildTaskRepository({
      getById: vi.fn((taskId: number) => taskId === 2 ? undefined : existingTask(taskId)),
      batchUpdateSchedules: vi.fn(),
    });
    const service = buildService(repository);

    expect(() => service.batchScheduleDate({userId: 1, taskIds: [1, 2], plannedDate: '2026-06-08'}))
      .toThrow('Task not found');
    expect(repository.batchUpdateSchedules).not.toHaveBeenCalled();
  });

  it('rejects invalid batch task ids before reading tasks', () => {
    const repository = buildTaskRepository({
      getById: vi.fn(),
      batchUpdateSchedules: vi.fn(),
    });
    const service = buildService(repository);

    expect(() => service.batchUnschedule({userId: 1, taskIds: [1.9]})).toThrow('taskIds must contain positive integers');
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.batchUpdateSchedules).not.toHaveBeenCalled();
  });

  it('batch unschedules tasks as all-day unscheduled tasks', () => {
    const repository = buildTaskRepository({
      getById: vi.fn((taskId: number, userId: number) => existingTask(taskId, userId)),
      batchUpdateSchedules: vi.fn(() => [existingTask(1), existingTask(2)]),
    });
    const service = buildService(repository);

    service.batchUnschedule({userId: 1, taskIds: [1, 2]});

    expect(repository.batchUpdateSchedules).toHaveBeenCalledWith([
      {taskId: 1, userId: 1, plannedDate: undefined, plannedEndDate: undefined, startAt: undefined, endAt: undefined, allDay: true},
      {taskId: 2, userId: 1, plannedDate: undefined, plannedEndDate: undefined, startAt: undefined, endAt: undefined, allDay: true},
    ]);
  });
});

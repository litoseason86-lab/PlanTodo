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
});

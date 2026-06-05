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
});


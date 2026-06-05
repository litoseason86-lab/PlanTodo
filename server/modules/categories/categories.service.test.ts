import {describe, expect, it, vi} from 'vitest';

import {CategoriesService} from './service';

describe('CategoriesService', () => {
  it('rejects duplicate category names for the same user', () => {
    const service = new CategoriesService(
      {
        listByUser: () => [
          {
            id: 1,
            userId: 1,
            name: '工作',
            color: '#000',
            sortOrder: 1,
            createdAt: '',
            updatedAt: '',
          },
        ],
        getById: () => undefined,
        existsByName: () => true,
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
      {
        listByFilters: () => [],
      },
    );

    expect(() => {
      service.create({
        userId: 1,
        name: '工作',
        color: '#fff',
        sortOrder: 2,
      });
    }).toThrow('already exists');
  });

  it('rejects deletion when tasks still reference the category', () => {
    const service = new CategoriesService(
      {
        listByUser: () => [],
        getById: () => undefined,
        existsByName: () => false,
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
      {
        listByFilters: () => [
          {
            id: 1,
            userId: 1,
            categoryId: 2,
            title: '任务',
            plannedDate: '2026-06-05',
            status: 'TODO',
            createdAt: '',
            updatedAt: '',
          },
        ],
      },
    );

    expect(() => service.remove(2, 1)).toThrow('referencing');
  });
});


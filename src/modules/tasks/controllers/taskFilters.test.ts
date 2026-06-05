import {describe, expect, it} from 'vitest';

import {filterTasks} from './useTasksController';

describe('filterTasks', () => {
  it('filters tasks by status and category', () => {
    const tasks = [
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: 'A',
        plannedDate: '2026-06-05',
        status: 'TODO' as const,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 2,
        userId: 1,
        categoryId: 2,
        title: 'B',
        plannedDate: '2026-06-05',
        status: 'DONE' as const,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const result = filterTasks(tasks, {
      category: '2',
      status: 'DONE',
      dateScope: 'all',
      selectedDate: '2026-06-05',
    });

    expect(result.map((task) => task.id)).toEqual([2]);
  });
});


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
        allDay: true,
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
        allDay: true,
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

  it('excludes unscheduled tasks from date scoped task filters', () => {
    const scheduled = {
      id: 1,
      userId: 1,
      categoryId: 1,
      title: '已安排',
      plannedDate: '2026-06-05',
      allDay: true,
      status: 'TODO' as const,
      createdAt: '',
      updatedAt: '',
    };
    const unscheduled = {...scheduled, id: 99, title: '未安排', plannedDate: undefined};

    expect(filterTasks([unscheduled, scheduled], {
      category: 'all',
      status: 'all',
      dateScope: 'today',
      selectedDate: '2026-06-05',
    }).map((task) => task.title)).not.toContain('未安排');

    expect(filterTasks([unscheduled, scheduled], {
      category: 'all',
      status: 'all',
      dateScope: 'seven-days',
      selectedDate: '2026-06-05',
    }).map((task) => task.title)).not.toContain('未安排');

    expect(filterTasks([unscheduled, scheduled], {
      category: 'all',
      status: 'all',
      dateScope: 'all',
      selectedDate: '2026-06-05',
    }).map((task) => task.title)).toContain('未安排');
  });
});

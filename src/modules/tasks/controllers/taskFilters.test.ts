import {describe, expect, it} from 'vitest';

import {filterTasks} from './useTasksController';

const baseTask = {
  id: 1,
  userId: 1,
  categoryId: 1,
  title: '已安排',
  plannedDate: '2026-06-06',
  allDay: true,
  status: 'TODO' as const,
  createdAt: '',
  updatedAt: '',
};

const baseFilters = {
  category: 'all',
  status: 'all' as const,
  selectedDate: '2026-06-06',
};

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

  it('filters unscheduled tasks explicitly', () => {
    expect(filterTasks([
      {...baseTask, id: 1, plannedDate: undefined, title: '未安排'},
      {...baseTask, id: 2, plannedDate: '2026-06-06', title: '已安排'},
    ], {
      category: 'all',
      status: 'all',
      dateScope: 'unscheduled',
      selectedDate: '2026-06-06',
    }).map((task) => task.title)).toEqual(['未安排']);
  });

  it('keeps unscheduled tasks in all scope but excludes them from date scopes', () => {
    const tasks = [
      {...baseTask, id: 1, plannedDate: undefined, title: '未安排'},
      {...baseTask, id: 2, plannedDate: '2026-06-06', title: '已安排'},
    ];
    expect(filterTasks(tasks, {...baseFilters, dateScope: 'all'}).map((task) => task.title)).toEqual(['未安排', '已安排']);
    expect(filterTasks(tasks, {...baseFilters, dateScope: 'today'}).map((task) => task.title)).toEqual(['已安排']);
  });
});

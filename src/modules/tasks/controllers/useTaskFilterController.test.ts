import {describe, expect, it} from 'vitest';

import type {Task} from '../../../../shared/domain/entities';
import {filterTasksWithMetadata} from './useTaskFilterController';

const taskA = {
  id: 1,
  userId: 1,
  categoryId: 1,
  title: 'A',
  plannedDate: undefined,
  allDay: true,
  status: 'TODO',
  priority: null,
  tagIds: [],
  createdAt: '',
  updatedAt: '',
} satisfies Task;

const taskB = {
  id: 2,
  userId: 1,
  categoryId: 1,
  title: 'B',
  plannedDate: undefined,
  allDay: true,
  status: 'TODO',
  priority: 'P1',
  tagIds: [],
  createdAt: '',
  updatedAt: '',
} satisfies Task;

describe('filterTasksWithMetadata', () => {
  it('filters tasks by all selected tag ids and null priority', () => {
    expect(filterTasksWithMetadata([
      {...taskA, tagIds: [1, 2], priority: null},
      {...taskB, tagIds: [1], priority: 'P1'},
    ], {
      category: 'all',
      status: 'all',
      dateScope: 'all',
      selectedDate: '2026-06-07',
      tagIds: [1, 2],
      priority: 'none',
      query: '',
    })).toEqual([{...taskA, tagIds: [1, 2], priority: null}]);
  });

  it('distinguishes all priorities from no-priority filtering and only searches titles', () => {
    expect(filterTasksWithMetadata([
      {...taskA, title: '写方案', tagIds: [], priority: null},
      {...taskB, title: '客户会议', tagIds: [], priority: 'P1'},
    ], {
      category: 'all',
      status: 'all',
      dateScope: 'all',
      selectedDate: '2026-06-07',
      tagIds: [],
      priority: 'all',
      query: '客户',
    })).toEqual([{...taskB, title: '客户会议', tagIds: [], priority: 'P1'}]);

    expect(filterTasksWithMetadata([
      {...taskA, title: '无优先级', tagIds: [], priority: null},
      {...taskB, title: '高优先级', tagIds: [], priority: 'P1'},
    ], {
      category: 'all',
      status: 'all',
      dateScope: 'all',
      selectedDate: '2026-06-07',
      tagIds: [],
      priority: 'none',
      query: '',
    })).toEqual([{...taskA, title: '无优先级', tagIds: [], priority: null}]);
  });
});

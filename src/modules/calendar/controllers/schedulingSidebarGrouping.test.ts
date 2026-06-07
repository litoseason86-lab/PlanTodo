import {describe, expect, it} from 'vitest';

import type {Category, Tag, Task} from '../../../../shared/domain/entities';
import {groupSchedulingTasks, uniqueSelectedTaskIds} from './schedulingSidebarGrouping';

const categories: Category[] = [
  {id: 1, userId: 1, name: '工作', color: '#000000', sortOrder: 1, createdAt: '', updatedAt: ''},
];

const tags: Tag[] = [
  {id: 1, userId: 1, name: '客户A', createdAt: '', updatedAt: ''},
  {id: 2, userId: 1, name: '项目B', createdAt: '', updatedAt: ''},
];

const task = {
  id: 1,
  userId: 1,
  categoryId: 1,
  title: '任务',
  plannedDate: undefined,
  allDay: true,
  status: 'TODO',
  priority: null,
  tagIds: [],
  createdAt: '',
  updatedAt: '',
} satisfies Task;

describe('scheduling sidebar grouping', () => {
  it('groups tasks by priority with null last', () => {
    const tasks: Task[] = [
      {...task, id: 1, priority: 'P1'},
      {...task, id: 2, priority: 'P2'},
      {...task, id: 3, priority: 'P3'},
      {...task, id: 4, priority: 'P4'},
      {...task, id: 5, priority: null},
    ];

    expect(groupSchedulingTasks(tasks, {mode: 'priority', categories, tags}).map((group) => group.label)).toEqual(['P1', 'P2', 'P3', 'P4', '无优先级']);
  });

  it('keeps duplicate tag-group tasks selected by one global task id set', () => {
    const groups = groupSchedulingTasks([{...task, tagIds: [1, 2]}], {mode: 'tag', categories, tags});

    expect(groups).toHaveLength(2);
    expect(uniqueSelectedTaskIds(new Set([task.id]))).toEqual([task.id]);
  });

  it('keeps tasks with unknown tag ids visible in an unknown tag group', () => {
    const groups = groupSchedulingTasks([{...task, tagIds: [999]}], {mode: 'tag', categories, tags});

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({id: 'tag:unknown', label: '未知标签'});
    expect(groups[0].tasks.map((item) => item.id)).toEqual([task.id]);
  });
});

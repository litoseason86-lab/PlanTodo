import {act, renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import type {Task} from '../../../../shared/domain/entities';
import {useTaskDraftController} from './useTaskDraftController';

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

describe('useTaskDraftController', () => {
  it('keeps create draft and details draft isolated from schedule fields', () => {
    const task = {...taskA, title: '编辑任务', plannedDate: '2026-06-07'};
    const {result} = renderHook(() => useTaskDraftController({defaultCategoryId: 1}));

    act(() => {
      result.current.openEditTask({...task, plannedDate: '2026-06-07', tagIds: [1], priority: 'P2'});
    });

    expect(result.current.editDraft.details).toEqual({
      title: task.title,
      categoryId: task.categoryId,
      tagIds: [1],
      priority: 'P2',
    });
    expect(result.current.editDraft.details).not.toHaveProperty('plannedDate');
  });
});

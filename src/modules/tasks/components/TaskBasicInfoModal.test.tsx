import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import type {Category, Tag, Task} from '../../../../shared/domain/entities';
import {TaskBasicInfoModal} from './TaskBasicInfoModal';

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

describe('TaskBasicInfoModal', () => {
  it('submits full replacement details', async () => {
    const task = {...taskA, title: '旧标题', tagIds: [], priority: null};
    const categories: Category[] = [{
      id: 1,
      userId: 1,
      name: '工作',
      color: '#000',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    }];
    const tags: Tag[] = [];
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <TaskBasicInfoModal
        task={task}
        categories={categories}
        tags={tags}
        onCreateTag={vi.fn()}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('任务标题'), {target: {value: '新标题'}});
    fireEvent.change(screen.getByLabelText('优先级'), {target: {value: 'P1'}});
    fireEvent.click(screen.getByRole('button', {name: '保存'}));

    expect(onSave).toHaveBeenCalledWith({
      title: '新标题',
      categoryId: 1,
      tagIds: [],
      priority: 'P1',
    });
  });
});

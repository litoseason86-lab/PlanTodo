import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import type {Category, Task} from '../../../../shared/domain/entities';
import {CalendarTaskPopover} from './CalendarTaskPopover';

const categories: Category[] = [
  {id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''},
  {id: 2, userId: 1, name: '学习', color: '#3b82f6', sortOrder: 2, createdAt: '', updatedAt: ''},
];

const task: Task = {
  id: 7,
  userId: 1,
  categoryId: 1,
  title: '数学',
  plannedDate: '2026-06-06',
  startAt: '2026-06-06T13:00:00.000',
  endAt: '2026-06-06T14:00:00.000',
  allDay: false,
  status: 'TODO',
  priority: 'P1',
  tagIds: [2, 3],
  createdAt: '',
  updatedAt: '',
};

describe('CalendarTaskPopover', () => {
  it('submits edited task fields', async () => {
    const onSave = vi.fn().mockResolvedValue({ok: true});
    render(
      <CalendarTaskPopover
        task={task}
        categories={categories}
        anchor={{x: 30, y: 40}}
        onCancel={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('任务标题'), {target: {value: '高数'}});
    fireEvent.change(screen.getByLabelText('任务分类'), {target: {value: '2'}});
    fireEvent.change(screen.getByLabelText('开始时间'), {target: {value: '13:15'}});
    fireEvent.change(screen.getByLabelText('结束时间'), {target: {value: '14:15'}});
    fireEvent.click(screen.getByRole('button', {name: '保存'}));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      title: '高数',
      categoryId: 2,
      startAt: '2026-06-06T13:15:00.000',
      endAt: '2026-06-06T14:15:00.000',
    }));
  });

  it('rejects shorter-than-15-minute ranges', () => {
    const onSave = vi.fn();
    render(
      <CalendarTaskPopover
        task={task}
        categories={categories}
        anchor={{x: 30, y: 40}}
        onCancel={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('结束时间'), {target: {value: '13:10'}});
    fireEvent.click(screen.getByRole('button', {name: '保存'}));

    expect(screen.getByText('任务时长不能少于 15 分钟')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('requires two delete clicks before deleting', async () => {
    const onDelete = vi.fn().mockResolvedValue({ok: true});
    render(
      <CalendarTaskPopover
        task={task}
        categories={categories}
        anchor={{x: 30, y: 40}}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', {name: '删除'}));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '确认删除'}));

    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
  });

  it('closes on Escape and outside pointer down without deleting', () => {
    const onCancel = vi.fn();
    const onDelete = vi.fn();
    render(
      <div>
        <button type="button">外部区域</button>
        <CalendarTaskPopover
          task={task}
          categories={categories}
          anchor={{x: 30, y: 40}}
          onCancel={onCancel}
          onSave={vi.fn()}
          onDelete={onDelete}
        />
      </div>,
    );

    fireEvent.keyDown(document, {key: 'Escape'});
    fireEvent.pointerDown(screen.getByRole('button', {name: '外部区域'}));

    expect(onCancel).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});

import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {FormEvent} from 'react';

import {TasksPanel} from './TasksPanel';

const baseCategories = [
  {
    id: 1,
    userId: 1,
    name: '工作',
    color: '#ef4444',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
];

const baseTasks = [
  {
    id: 1,
    userId: 1,
    categoryId: 1,
    title: '写周报',
    plannedDate: '2026-06-05',
    status: 'TODO' as const,
    createdAt: '',
    updatedAt: '',
  },
];

describe('TasksPanel', () => {
  it('submits new task form through the provided handler', () => {
    const onCreateTask = vi.fn((event?: FormEvent) => event?.preventDefault());

    render(
      <TasksPanel
        styleContext={{
          primary: '#fb7185',
          primaryLight: '#fff1f2',
          secondary: '#fda4af',
        }}
        categories={baseCategories}
        allTasks={baseTasks}
        filteredTaskItems={baseTasks}
        selectedDate="2026-06-05"
        taskFormTitle="写周报"
        taskFormCategory={1}
        taskFormDate="2026-06-05"
        taskFilterCategory="all"
        taskFilterStatus="all"
        taskFilterDateScope="today"
        setTaskFormTitle={vi.fn()}
        setTaskFormCategory={vi.fn()}
        setTaskFormDate={vi.fn()}
        setTaskFilterCategory={vi.fn()}
        setTaskFilterStatus={vi.fn()}
        setTaskFilterDateScope={vi.fn()}
        handleCreateTask={onCreateTask}
        handleUpdateTaskStatus={vi.fn()}
        handleStartSession={vi.fn()}
        handleDeleteTask={vi.fn()}
      />,
    );

    fireEvent.submit(screen.getByRole('button', {name: /确认归档入库/i}).closest('form')!);

    expect(onCreateTask).toHaveBeenCalledOnce();
  });

  it('routes IN_PROGRESS selection to the focus starter', () => {
    const onStartSession = vi.fn();
    const onUpdateTaskStatus = vi.fn();

    render(
      <TasksPanel
        styleContext={{
          primary: '#fb7185',
          primaryLight: '#fff1f2',
          secondary: '#fda4af',
        }}
        categories={baseCategories}
        allTasks={baseTasks}
        filteredTaskItems={baseTasks}
        selectedDate="2026-06-05"
        taskFormTitle=""
        taskFormCategory={1}
        taskFormDate="2026-06-05"
        taskFilterCategory="all"
        taskFilterStatus="all"
        taskFilterDateScope="today"
        setTaskFormTitle={vi.fn()}
        setTaskFormCategory={vi.fn()}
        setTaskFormDate={vi.fn()}
        setTaskFilterCategory={vi.fn()}
        setTaskFilterStatus={vi.fn()}
        setTaskFilterDateScope={vi.fn()}
        handleCreateTask={vi.fn()}
        handleUpdateTaskStatus={onUpdateTaskStatus}
        handleStartSession={onStartSession}
        handleDeleteTask={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('task-status-1'), {
      target: {value: 'IN_PROGRESS'},
    });

    expect(onStartSession).toHaveBeenCalledWith(baseTasks[0]);
    expect(onUpdateTaskStatus).not.toHaveBeenCalled();
  });

  it('calls the delete handler from a task row', () => {
    const onDeleteTask = vi.fn();

    render(
      <TasksPanel
        styleContext={{
          primary: '#fb7185',
          primaryLight: '#fff1f2',
          secondary: '#fda4af',
        }}
        categories={baseCategories}
        allTasks={baseTasks}
        filteredTaskItems={baseTasks}
        selectedDate="2026-06-05"
        taskFormTitle=""
        taskFormCategory={1}
        taskFormDate="2026-06-05"
        taskFilterCategory="all"
        taskFilterStatus="all"
        taskFilterDateScope="today"
        setTaskFormTitle={vi.fn()}
        setTaskFormCategory={vi.fn()}
        setTaskFormDate={vi.fn()}
        setTaskFilterCategory={vi.fn()}
        setTaskFilterStatus={vi.fn()}
        setTaskFilterDateScope={vi.fn()}
        handleCreateTask={vi.fn()}
        handleUpdateTaskStatus={vi.fn()}
        handleStartSession={vi.fn()}
        handleDeleteTask={onDeleteTask}
      />,
    );

    fireEvent.click(screen.getByRole('button', {name: '删除任务 写周报'}));

    expect(onDeleteTask).toHaveBeenCalledWith(baseTasks[0]);
  });
});

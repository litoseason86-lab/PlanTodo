import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {FormEvent} from 'react';

import {readCalendarDragPayload} from '../../calendar/controllers/schedulingDrag';
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
    allDay: true,
    status: 'TODO' as const,
    createdAt: '',
    updatedAt: '',
  },
];

type TasksPanelProps = Parameters<typeof TasksPanel>[0];

function renderPanel(overrides: Partial<TasksPanelProps> = {}) {
  const props: TasksPanelProps = {
    styleContext: {primary: '#fb7185', primaryLight: '#fff1f2', secondary: '#fda4af'},
    categories: baseCategories,
    allTasks: baseTasks,
    filteredTaskItems: baseTasks,
    taskFormTitle: '',
    taskFormCategory: 1,
    taskFormDate: '2026-06-05',
    taskFormUnscheduled: false,
    taskFilterCategory: 'all',
    taskFilterStatus: 'all',
    taskFilterDateScope: 'today',
    setTaskFormTitle: vi.fn(),
    setTaskFormCategory: vi.fn(),
    setTaskFormDate: vi.fn(),
    setTaskFormUnscheduled: vi.fn(),
    setTaskFilterCategory: vi.fn(),
    setTaskFilterStatus: vi.fn(),
    setTaskFilterDateScope: vi.fn(),
    showToast: vi.fn(),
    selectedDate: '2026-06-05',
    refreshAllTasks: vi.fn().mockResolvedValue(baseTasks),
    loadTasksForSelectedDate: vi.fn().mockResolvedValue({tasks: baseTasks, sessions: []}),
    handleCreateTask: vi.fn(),
    handleUpdateTaskStatus: vi.fn(),
    handleStartSession: vi.fn(),
    handleDeleteTask: vi.fn(),
    ...overrides,
  };

  return render(<TasksPanel {...props} />);
}

function createDragData() {
  const values = new Map<string, string>();
  return {
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
  } as unknown as DataTransfer;
}

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
        taskFormTitle="写周报"
        taskFormCategory={1}
        taskFormDate="2026-06-05"
        taskFormUnscheduled={false}
        taskFilterCategory="all"
        taskFilterStatus="all"
        taskFilterDateScope="today"
        setTaskFormTitle={vi.fn()}
        setTaskFormCategory={vi.fn()}
        setTaskFormDate={vi.fn()}
        setTaskFormUnscheduled={vi.fn()}
        setTaskFilterCategory={vi.fn()}
        setTaskFilterStatus={vi.fn()}
        setTaskFilterDateScope={vi.fn()}
        showToast={vi.fn()}
        selectedDate="2026-06-05"
        refreshAllTasks={vi.fn().mockResolvedValue(baseTasks)}
        loadTasksForSelectedDate={vi.fn().mockResolvedValue({tasks: baseTasks, sessions: []})}
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
        taskFormTitle=""
        taskFormCategory={1}
        taskFormDate="2026-06-05"
        taskFormUnscheduled={false}
        taskFilterCategory="all"
        taskFilterStatus="all"
        taskFilterDateScope="today"
        setTaskFormTitle={vi.fn()}
        setTaskFormCategory={vi.fn()}
        setTaskFormDate={vi.fn()}
        setTaskFormUnscheduled={vi.fn()}
        setTaskFilterCategory={vi.fn()}
        setTaskFilterStatus={vi.fn()}
        setTaskFilterDateScope={vi.fn()}
        showToast={vi.fn()}
        selectedDate="2026-06-05"
        refreshAllTasks={vi.fn().mockResolvedValue(baseTasks)}
        loadTasksForSelectedDate={vi.fn().mockResolvedValue({tasks: baseTasks, sessions: []})}
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
        taskFormTitle=""
        taskFormCategory={1}
        taskFormDate="2026-06-05"
        taskFormUnscheduled={false}
        taskFilterCategory="all"
        taskFilterStatus="all"
        taskFilterDateScope="today"
        setTaskFormTitle={vi.fn()}
        setTaskFormCategory={vi.fn()}
        setTaskFormDate={vi.fn()}
        setTaskFormUnscheduled={vi.fn()}
        setTaskFilterCategory={vi.fn()}
        setTaskFilterStatus={vi.fn()}
        setTaskFilterDateScope={vi.fn()}
        showToast={vi.fn()}
        selectedDate="2026-06-05"
        refreshAllTasks={vi.fn().mockResolvedValue(baseTasks)}
        loadTasksForSelectedDate={vi.fn().mockResolvedValue({tasks: baseTasks, sessions: []})}
        handleCreateTask={vi.fn()}
        handleUpdateTaskStatus={vi.fn()}
        handleStartSession={vi.fn()}
        handleDeleteTask={onDeleteTask}
      />,
    );

    fireEvent.click(screen.getByRole('button', {name: '删除任务 写周报'}));

    expect(onDeleteTask).toHaveBeenCalledWith(baseTasks[0]);
  });

  it('shows unscheduled tasks as 未安排', () => {
    renderPanel({
      filteredTaskItems: [{...baseTasks[0], id: 99, title: '未安排任务', plannedDate: undefined}],
    });

    expect(screen.getAllByText('未安排').length).toBeGreaterThan(0);
  });

  it('shows an unscheduled filter option', () => {
    renderPanel({taskFilterDateScope: 'unscheduled'});
    expect(screen.getByRole('option', {name: '未安排'})).toBeInTheDocument();
  });

  it('renders an explicit unscheduled create option', () => {
    renderPanel();
    expect(screen.getByLabelText('不安排日期')).toBeInTheDocument();
  });

  it('toggles the embedded calendar', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', {name: '显示日历'}));
    expect(screen.getByRole('button', {name: '隐藏日历'})).toBeInTheDocument();
  });

  it('writes task-list drag payload from the drag handle only', () => {
    const data = createDragData();
    renderPanel();
    fireEvent.dragStart(screen.getByLabelText('拖拽任务 写周报'), {dataTransfer: data});
    expect(readCalendarDragPayload(data)).toEqual({type: 'calendar-task', taskId: 1, source: 'task-list'});
  });
});

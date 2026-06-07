import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {FormEvent} from 'react';

import type {Category, Tag, Task} from '../../../../shared/domain/entities';
import type {TaskPriority, TaskStatus} from '../../../../shared/domain/status';
import {readCalendarDragPayload} from '../../calendar/controllers/schedulingDrag';
import {TasksPanel} from './TasksPanel';

vi.mock('../../calendar/components/EmbeddedCalendarPanel', () => ({
  EmbeddedCalendarPanel: () => <div data-testid="embedded-calendar" />,
}));

const baseCategories: Category[] = [
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

const baseTasks: Task[] = [
  {
    id: 1,
    userId: 1,
    categoryId: 1,
    title: '写周报',
    plannedDate: '2026-06-05',
    allDay: true,
    status: 'TODO',
    priority: null,
    tagIds: [],
    createdAt: '',
    updatedAt: '',
  },
];

function baseController() {
  return {
    categories: baseCategories,
    tags: [] as Tag[],
    allTasks: baseTasks,
    createDraft: {
      title: '',
      categoryId: 1,
      tagIds: [] as number[],
      priority: null as TaskPriority | null,
      plannedDate: '2026-06-05',
      unscheduled: false,
      setTitle: vi.fn(),
      setCategoryId: vi.fn(),
      setTagIds: vi.fn(),
      setPriority: vi.fn(),
      setPlannedDate: vi.fn(),
      setUnscheduled: vi.fn(),
      reset: vi.fn(),
    },
    editDraft: {
      task: null as Task | null,
      details: null,
      setTitle: vi.fn(),
      setCategoryId: vi.fn(),
      setTagIds: vi.fn(),
      setPriority: vi.fn(),
      setDetails: vi.fn(),
    },
    filters: {
      category: 'all',
      status: 'all' as 'all' | TaskStatus,
      dateScope: 'today' as 'today' | 'seven-days' | 'all' | 'unscheduled',
      tagIds: [] as number[],
      priority: 'all' as const,
      query: '',
      setCategory: vi.fn(),
      setStatus: vi.fn(),
      setDateScope: vi.fn(),
      setTagIds: vi.fn(),
      setPriority: vi.fn(),
      setQuery: vi.fn(),
    },
    filteredTaskItems: baseTasks,
    mutations: {
      createTask: vi.fn(async (event?: FormEvent) => {
        event?.preventDefault();
      }),
      updateTaskDetails: vi.fn().mockResolvedValue(undefined),
      deleteTask: vi.fn().mockResolvedValue(undefined),
    },
    tagActions: {
      createTag: vi.fn(),
      updateTag: vi.fn(),
      deleteTag: vi.fn(),
    },
    statusActions: {
      updateTaskStatus: vi.fn(),
      startSession: vi.fn(),
    },
    calendar: {
      selectedDate: '2026-06-05',
      showToast: vi.fn(),
      onMutationSuccess: vi.fn(),
    },
    openEditTask: vi.fn(),
    closeEditTask: vi.fn(),
  };
}

type TestController = ReturnType<typeof baseController>;

function renderPanel(controller: TestController = baseController()) {
  return render(
    <TasksPanel
      styleContext={{primary: '#fb7185', primaryLight: '#fff1f2', secondary: '#fda4af'}}
      controller={controller}
    />,
  );
}

function createDragData() {
  const values = new Map<string, string>();
  return {
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
  } as unknown as DataTransfer;
}

describe('TasksPanel', () => {
  it('submits new task form through the controller mutation', () => {
    const controller = baseController();
    controller.createDraft.title = '写周报';

    renderPanel(controller);

    fireEvent.submit(screen.getByRole('button', {name: /确认归档入库/i}).closest('form')!);

    expect(controller.mutations.createTask).toHaveBeenCalledOnce();
  });

  it('routes IN_PROGRESS selection to the focus starter', () => {
    const controller = baseController();

    renderPanel(controller);

    fireEvent.change(screen.getByLabelText('task-status-1'), {
      target: {value: 'IN_PROGRESS'},
    });

    expect(controller.statusActions.startSession).toHaveBeenCalledWith(baseTasks[0]);
    expect(controller.statusActions.updateTaskStatus).not.toHaveBeenCalled();
  });

  it('calls the delete mutation from a task row', () => {
    const controller = baseController();

    renderPanel(controller);

    fireEvent.click(screen.getByRole('button', {name: '删除任务 写周报'}));

    expect(controller.mutations.deleteTask).toHaveBeenCalledWith(baseTasks[0].id);
  });

  it('opens task details from the explicit edit button only', () => {
    const controller = baseController();

    renderPanel(controller);

    fireEvent.click(screen.getByRole('button', {name: '编辑任务 写周报'}));

    expect(controller.openEditTask).toHaveBeenCalledWith(baseTasks[0]);
  });

  it('shows unscheduled tasks as 未安排', () => {
    const controller = baseController();
    controller.filteredTaskItems = [{...baseTasks[0], id: 99, title: '未安排任务', plannedDate: undefined}];

    renderPanel(controller);

    expect(screen.getAllByText('未安排').length).toBeGreaterThan(0);
  });

  it('shows an unscheduled filter option', () => {
    const controller = baseController();
    controller.filters.dateScope = 'unscheduled';

    renderPanel(controller);

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

  it('writes timed task drag payload with duration from the drag handle', () => {
    const data = createDragData();
    const controller = baseController();
    controller.filteredTaskItems = [{
      ...baseTasks[0],
      allDay: false,
      startAt: '2026-06-05T09:15:00.000',
      endAt: '2026-06-05T10:45:00.000',
    }];

    renderPanel(controller);
    fireEvent.dragStart(screen.getByLabelText('拖拽任务 写周报'), {dataTransfer: data});

    expect(readCalendarDragPayload(data)).toEqual({
      type: 'calendar-timed-task',
      taskId: 1,
      durationMinutes: 90,
    });
  });
});

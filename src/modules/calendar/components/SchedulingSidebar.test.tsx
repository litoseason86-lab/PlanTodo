import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import type {Task} from '../../../../shared/domain/entities';
import {readCalendarDragPayload} from '../controllers/schedulingDrag';
import type {useSchedulingSidebarController} from '../controllers/useSchedulingSidebarController';
import {SchedulingSidebar} from './SchedulingSidebar';

const categories = [{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}];
const tags = [{id: 1, userId: 1, name: '客户A', createdAt: '', updatedAt: ''}];
const unscheduledTask = {id: 1, userId: 1, categoryId: 1, title: '未安排任务', plannedDate: undefined, allDay: true, status: 'TODO', priority: null, tagIds: [] as number[], createdAt: '', updatedAt: ''} as const;
const dateTask = {...unscheduledTask, id: 2, title: '全天任务', plannedDate: '2026-06-06'} as const;

function createDragData() {
  const values = new Map<string, string>();
  return {
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
  } as unknown as DataTransfer;
}

function controllerWithTasks(
  tasks: Task[],
  selectedTaskIds = new Set<number>(),
  overrides: Partial<ReturnType<typeof useSchedulingSidebarController>> = {},
) {
  return {
    tasks,
    loading: false,
    query: '',
    categoryId: 'all',
    tagIds: [] as number[],
    priority: 'all' as const,
    groupMode: 'none' as const,
    groupedTaskGroups: [{id: 'all', label: '全部', tasks}],
    selectedTaskIds,
    selectedScheduleDate: '2026-06-08',
    setQuery: vi.fn(),
    setCategoryId: vi.fn(),
    setTagIds: vi.fn(),
    setPriority: vi.fn(),
    setGroupMode: vi.fn(),
    setSelectedScheduleDate: vi.fn(),
    toggleTask: vi.fn(),
    selectAllVisible: vi.fn(),
    clearSelected: vi.fn(),
    batchScheduleSelected: vi.fn().mockResolvedValue(undefined),
    batchUnscheduleSelected: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SchedulingSidebar', () => {
  it('renders task pool rows with category and schedule labels', () => {
    render(<SchedulingSidebar controller={controllerWithTasks([unscheduledTask, dateTask])} categories={categories} tags={tags} />);
    expect(screen.getByText('未安排任务')).toBeInTheDocument();
    expect(screen.getByText('未安排')).toBeInTheDocument();
    expect(screen.getByText('2026-06-06')).toBeInTheDocument();
  });

  it('selects visible tasks and schedules them through the date input', async () => {
    const controller = controllerWithTasks([unscheduledTask, dateTask], new Set([1, 2]));
    render(<SchedulingSidebar controller={controller} categories={categories} tags={tags} />);
    fireEvent.click(screen.getByRole('button', {name: '全选'}));
    fireEvent.change(screen.getByLabelText('批量安排日期'), {target: {value: '2026-06-08'}});
    fireEvent.click(screen.getByRole('button', {name: '安排所选'}));
    expect(controller.batchScheduleSelected).toHaveBeenCalledWith('2026-06-08');
  });

  it('writes a batch payload only when dragging a selected row with multiple selections', () => {
    const controller = controllerWithTasks([unscheduledTask, dateTask], new Set([1, 2]));
    const data = createDragData();
    render(<SchedulingSidebar controller={controller} categories={categories} tags={tags} />);
    fireEvent.dragStart(screen.getByLabelText('拖拽 未安排任务'), {dataTransfer: data});
    expect(readCalendarDragPayload(data)).toEqual({type: 'calendar-task-batch', taskIds: [1, 2], source: 'sidebar'});
  });

  it('writes a single payload when dragging an unselected row while other rows are selected', () => {
    const controller = controllerWithTasks([unscheduledTask, dateTask], new Set([2]));
    const data = createDragData();
    render(<SchedulingSidebar controller={controller} categories={categories} tags={tags} />);
    fireEvent.dragStart(screen.getByLabelText('拖拽 未安排任务'), {dataTransfer: data});
    expect(readCalendarDragPayload(data)).toEqual({type: 'calendar-task', taskId: 1, source: 'sidebar'});
  });

  it('shows metadata filters when the filter panel is expanded', () => {
    render(<SchedulingSidebar controller={controllerWithTasks([unscheduledTask])} categories={categories} tags={tags} />);

    expect(screen.getByRole('button', {name: '筛选'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '筛选'}));

    expect(screen.getByLabelText('安排栏优先级')).toBeInTheDocument();
    expect(screen.getByLabelText('安排栏标签')).toBeInTheDocument();
    expect(screen.getByLabelText('安排栏分组')).toBeInTheDocument();
  });

  it('clears selected tag filters from the filter panel', () => {
    const controller = controllerWithTasks([unscheduledTask], new Set(), {
      tagIds: [1],
      setTagIds: vi.fn(),
    });
    render(<SchedulingSidebar controller={controller} categories={categories} tags={tags} />);

    fireEvent.click(screen.getByRole('button', {name: '筛选'}));
    fireEvent.click(screen.getByRole('button', {name: '清空标签'}));

    expect(controller.setTagIds).toHaveBeenCalledWith([]);
  });

  it('shares selection state and dedupes drag payloads for duplicate tag-group rows', () => {
    const taggedTask = {...unscheduledTask, tagIds: [1, 2]};
    const controller = controllerWithTasks([taggedTask], new Set([1, 2]), {
      groupMode: 'tag',
      groupedTaskGroups: [
        {id: 'tag:1', label: '客户A', tasks: [taggedTask]},
        {id: 'tag:2', label: '项目B', tasks: [taggedTask]},
      ],
    });
    const data = createDragData();
    render(<SchedulingSidebar controller={controller} categories={categories} tags={[...tags, {id: 2, userId: 1, name: '项目B', createdAt: '', updatedAt: ''}]} />);

    expect(screen.getByLabelText('选择 客户A 未安排任务')).toBeChecked();
    expect(screen.getByLabelText('选择 项目B 未安排任务')).toBeChecked();

    fireEvent.dragStart(screen.getByLabelText('拖拽 客户A 未安排任务'), {dataTransfer: data});

    expect(readCalendarDragPayload(data)).toEqual({type: 'calendar-task-batch', taskIds: [1, 2], source: 'sidebar'});
  });
});

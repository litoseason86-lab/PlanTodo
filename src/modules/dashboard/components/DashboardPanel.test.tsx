import {fireEvent, render, screen} from '@testing-library/react';
import type {ComponentProps} from 'react';
import {describe, expect, it, vi} from 'vitest';

import {DashboardPanel} from './DashboardPanel';

const categories = [
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

const tasks = [
  {
    id: 1,
    userId: 1,
    categoryId: 1,
    title: '写方案',
    plannedDate: '2026-06-05',
    allDay: true,
    status: 'TODO' as const,
    priority: null,
    tagIds: [] as number[],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    userId: 1,
    categoryId: 1,
    title: '复盘',
    plannedDate: '2026-06-05',
    allDay: true,
    status: 'TODO' as const,
    priority: null,
    tagIds: [] as number[],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 3,
    userId: 1,
    categoryId: 1,
    title: '整理资料',
    plannedDate: '2026-06-05',
    allDay: true,
    status: 'TODO' as const,
    priority: null,
    tagIds: [] as number[],
    createdAt: '',
    updatedAt: '',
  },
];

function renderDashboard(overrides: Partial<ComponentProps<typeof DashboardPanel>> = {}) {
  const props: ComponentProps<typeof DashboardPanel> = {
    styleContext: {primary: '#fb7185', primaryLight: '#fff1f2', secondary: '#fda4af'},
    categories,
    tasks,
    selectedDate: '2026-06-05',
    setSelectedDate: vi.fn(),
    todayCategoryFocusData: [],
    todayTimelineFlow: [],
    todayTaskQueue: tasks,
    todayQuickCreate: {
      title: '',
      categoryId: 1,
      isCreating: false,
      setTitle: vi.fn(),
      setCategoryId: vi.fn(),
      createTodayTask: vi.fn(),
    },
    handleUpdateTaskStatus: vi.fn(),
    handleStartSession: vi.fn(),
    handleStopSession: vi.fn(),
    runningSession: null,
    lastFinishedSessionTask: null,
    setLastFinishedSessionTask: vi.fn(),
    getTaskFocusMinutes: () => 0,
    ...overrides,
  };

  return render(<DashboardPanel {...props} />);
}

function renderDashboardWithRunningSession() {
  return renderDashboard({
    runningSession: {
      id: 1,
      taskId: 1,
      userId: 1,
      startedAt: '2026-06-05T09:00:00.000',
      status: 'RUNNING',
      createdAt: '',
    },
    todayTimelineFlow: [
      {type: 'task', taskId: 1, startMinutes: 540, endMinutes: 600, durationMinutes: 60},
    ],
    todayTaskQueue: [],
    getTaskFocusMinutes: () => 20,
  });
}

describe('DashboardPanel', () => {
  it('submits quick task creation for the selected date and shows dashboard title', () => {
    const todayQuickCreate = {
      title: '写方案',
      categoryId: 1,
      isCreating: false,
      setTitle: vi.fn(),
      setCategoryId: vi.fn(),
      createTodayTask: vi.fn(),
    };

    renderDashboard({
      todayCategoryFocusData: [{name: '工作', minutes: 20, color: '#ef4444'}],
      todayQuickCreate,
      getTaskFocusMinutes: () => 20,
    });

    expect(screen.getByText('今日规划时空轴')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: /快速派遣/i}));

    expect(todayQuickCreate.createTodayTask).toHaveBeenCalledWith();
  });

  it('disables quick-create controls while creating', () => {
    renderDashboard({
      todayQuickCreate: {
        title: '写方案',
        categoryId: 1,
        isCreating: true,
        setTitle: vi.fn(),
        setCategoryId: vi.fn(),
        createTodayTask: vi.fn(),
      },
    });

    expect(screen.getByPlaceholderText('💡 快速添加今日行动计划...')).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', {name: /快速派遣/i})).toBeDisabled();
  });

  it('renders gap nodes with stable accessible labels', () => {
    renderDashboard({
      todayTimelineFlow: [
        {type: 'task', taskId: 1, startMinutes: 540, endMinutes: 600, durationMinutes: 60},
        {type: 'gap', startMinutes: 600, endMinutes: 630, durationMinutes: 30},
      ],
      todayTaskQueue: [],
    });

    expect(screen.getByLabelText('空闲 30 分钟 10:00-10:30')).toBeInTheDocument();
  });

  it('keeps the current action visible for a running session', () => {
    renderDashboardWithRunningSession();

    expect(screen.getAllByRole('button', {name: '停止'})).toHaveLength(1);
    expect(screen.getByText('专注进行中')).toBeInTheDocument();
  });

  it('keeps focus feedback actions visible after a session stops', () => {
    const handleUpdateTaskStatus = vi.fn();
    const setLastFinishedSessionTask = vi.fn();
    renderDashboard({
      lastFinishedSessionTask: tasks[0],
      handleUpdateTaskStatus,
      setLastFinishedSessionTask,
    });

    fireEvent.click(screen.getByRole('button', {name: '✓ 完美标记'}));
    expect(handleUpdateTaskStatus).toHaveBeenCalledWith(1, 'DONE');
    expect(setLastFinishedSessionTask).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByRole('button', {name: '稍后处理'}));
    expect(setLastFinishedSessionTask).toHaveBeenCalledWith(null);
  });

  it('renders the existing empty state when there are no tasks', () => {
    renderDashboard({tasks: [], todayTimelineFlow: [], todayTaskQueue: []});

    expect(screen.getByText('今日暂无行动计划')).toBeInTheDocument();
  });

  it('renders untimed tasks in the queue without an empty timeline', () => {
    renderDashboard({
      tasks,
      todayTimelineFlow: [],
      todayTaskQueue: tasks,
    });

    expect(screen.getByText('今日待执行队列')).toBeInTheDocument();
    expect(screen.queryByText(/空闲 \d+ 分钟/)).not.toBeInTheDocument();
  });

  it('renders a timed-only flow without showing the untimed queue empty state', () => {
    renderDashboard({
      tasks,
      todayTimelineFlow: [
        {type: 'task', taskId: 1, startMinutes: 540, endMinutes: 600, durationMinutes: 60},
      ],
      todayTaskQueue: [],
    });

    expect(screen.getByText('写方案')).toBeInTheDocument();
    expect(screen.queryByText('今日待执行队列')).not.toBeInTheDocument();
    expect(screen.queryByText('今日暂无行动计划')).not.toBeInTheDocument();
  });

  it('renders multiple gap nodes from the fragmented rehearsal scenario', () => {
    renderDashboard({
      todayTimelineFlow: [
        {type: 'task', taskId: 1, startMinutes: 540, endMinutes: 600, durationMinutes: 60},
        {type: 'gap', startMinutes: 600, endMinutes: 630, durationMinutes: 30},
        {type: 'task', taskId: 2, startMinutes: 630, endMinutes: 675, durationMinutes: 45},
        {type: 'gap', startMinutes: 675, endMinutes: 720, durationMinutes: 45},
        {type: 'task', taskId: 3, startMinutes: 720, endMinutes: 780, durationMinutes: 60},
      ],
    });

    expect(screen.getByLabelText('空闲 30 分钟 10:00-10:30')).toBeInTheDocument();
    expect(screen.getByLabelText('空闲 45 分钟 11:15-12:00')).toBeInTheDocument();
  });
});

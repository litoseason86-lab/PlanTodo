import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {calendarApi} from '../api/calendarApi';
import {writeCalendarDragPayload} from '../controllers/schedulingDrag';
import {CalendarPanel} from './CalendarPanel';

vi.mock('../api/calendarApi', () => ({
  calendarApi: {
    getCalendarTasks: vi.fn(),
    getFocusSessions: vi.fn(),
    getUnscheduledTasks: vi.fn(),
    getAllDayWithoutTimeTasks: vi.fn(),
    createCalendarTask: vi.fn(),
    updateTaskSchedule: vi.fn(),
    batchScheduleDate: vi.fn(),
    batchUnschedule: vi.fn(),
  },
}));

function createDragData() {
  const values = new Map<string, string>();
  return {
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
  } as unknown as DataTransfer;
}

function mockElementRect(element: HTMLElement, rect: Partial<DOMRect>) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width: rect.width ?? 1024,
    height: rect.height ?? 64,
    top: rect.top ?? 0,
    left: rect.left ?? 0,
    right: rect.right ?? 1024,
    bottom: rect.bottom ?? (rect.top ?? 0) + (rect.height ?? 64),
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    toJSON() { return this; },
  } as DOMRect);
}

function dispatchElementPointerDown(element: Element, clientY: number, clientX = 0) {
  element.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, clientX, clientY}));
}

function dispatchElementPointerUp(element: Element, clientY: number, clientX = 0) {
  element.dispatchEvent(new MouseEvent('pointerup', {bubbles: true, clientX, clientY}));
}

const CALENDAR_SETTINGS_STORAGE_KEY = 'plantodo.calendar.settings';

function renderCalendarPanel(overrides: Partial<Parameters<typeof CalendarPanel>[0]> = {}) {
  return render(
    <CalendarPanel
      categories={[{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}]}
      styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
      showToast={vi.fn()}
      initialDate="2026-06-06"
      onMutationSuccess={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  );
}

function renderCalendarPanelWithSidebarTasks(overrides: Partial<Parameters<typeof CalendarPanel>[0]> = {}) {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  vi.mocked(calendarApi.getUnscheduledTasks).mockResolvedValue([
    {id: 10, userId: 1, categoryId: 1, title: '未安排任务', plannedDate: undefined, allDay: true, status: 'TODO', createdAt: '', updatedAt: ''},
  ] as never);
  vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([
    {id: 11, userId: 1, categoryId: 1, title: '全天任务', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''},
  ] as never);
  return renderCalendarPanel(overrides);
}

describe('CalendarPanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  beforeEach(() => {
    vi.mocked(calendarApi.getUnscheduledTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.batchScheduleDate).mockResolvedValue([]);
    vi.mocked(calendarApi.batchUnschedule).mockResolvedValue([]);
  });

  it('renders calendar shell and view switcher', () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    render(
      <CalendarPanel
        categories={[]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    expect(screen.getByRole('heading', {name: '日历'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '月'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '周'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '列表'})).toBeInTheDocument();
  });

  it('renders scheduling sidebar and loads both task pool sources', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.getUnscheduledTasks).mockResolvedValue([{id: 10, title: '未安排任务'}] as never);
    vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([{id: 11, title: '全天任务'}] as never);
    renderCalendarPanel();
    expect(await screen.findByText('未安排任务')).toBeInTheDocument();
    expect(await screen.findByText('全天任务')).toBeInTheDocument();
  });

  it('batch schedules selected sidebar tasks onto a month date', async () => {
    vi.mocked(calendarApi.batchScheduleDate).mockResolvedValue([{id: 10}, {id: 11}] as never);
    renderCalendarPanelWithSidebarTasks();
    fireEvent.click(await screen.findByLabelText('选择 未安排任务'));
    fireEvent.click(await screen.findByLabelText('选择 全天任务'));
    const data = createDragData();
    fireEvent.dragStart(screen.getByLabelText('拖拽 未安排任务'), {dataTransfer: data});
    fireEvent.click(screen.getByRole('button', {name: '月'}));
    fireEvent.drop(screen.getByRole('button', {name: '2026-06-08'}), {dataTransfer: data});
    expect(calendarApi.batchScheduleDate).toHaveBeenCalledWith({taskIds: [10, 11], plannedDate: '2026-06-08'});
  });

  it('rejects batch task payloads on week time slots', async () => {
    const showToast = vi.fn();
    renderCalendarPanelWithSidebarTasks({showToast});
    fireEvent.click(await screen.findByLabelText('选择 未安排任务'));
    fireEvent.click(await screen.findByLabelText('选择 全天任务'));
    const data = createDragData();
    fireEvent.dragStart(screen.getByLabelText('拖拽 未安排任务'), {dataTransfer: data});
    fireEvent.drop(screen.getByLabelText('2026-06-06 09:00'), {dataTransfer: data});
    expect(showToast).toHaveBeenCalledWith('多选任务不能直接安排到时间段', 'error');
  });

  it('runs app-level mutation refresh after calendar scheduling succeeds', async () => {
    const onMutationSuccess = vi.fn().mockResolvedValue(undefined);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);
    renderCalendarPanelWithSidebarTasks({onMutationSuccess});
    const data = createDragData();
    fireEvent.dragStart(await screen.findByLabelText('拖拽 未安排任务'), {dataTransfer: data});
    fireEvent.drop(screen.getByLabelText('2026-06-06 全天'), {dataTransfer: data});
    await waitFor(() => expect(onMutationSuccess).toHaveBeenCalledOnce());
  });

  it('refreshes the scheduling sidebar even when app-level mutation refresh fails', async () => {
    const onMutationSuccess = vi.fn().mockRejectedValue(new Error('外层刷新失败'));
    const showToast = vi.fn();
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 10} as never);
    vi.mocked(calendarApi.getUnscheduledTasks)
      .mockResolvedValueOnce([
        {id: 10, userId: 1, categoryId: 1, title: '未安排任务', plannedDate: undefined, allDay: true, status: 'TODO', createdAt: '', updatedAt: ''},
      ] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([] as never);
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    renderCalendarPanel({onMutationSuccess, showToast});
    const data = createDragData();
    fireEvent.dragStart(await screen.findByLabelText('拖拽 未安排任务'), {dataTransfer: data});
    fireEvent.drop(screen.getByLabelText('2026-06-06 全天'), {dataTransfer: data});

    await waitFor(() => expect(onMutationSuccess).toHaveBeenCalledOnce());
    await waitFor(() => expect(calendarApi.getUnscheduledTasks).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('未安排任务')).not.toBeInTheDocument());
    expect(showToast).toHaveBeenCalledWith('外层刷新失败', 'error');
  });

  it('renders month tasks', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {id: 1, userId: 1, categoryId: 1, title: '写方案', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''},
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    render(
      <CalendarPanel
        categories={[{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    await screen.findByText('写方案');
  });

  it('hides completed tasks from settings', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {id: 1, userId: 1, categoryId: 1, title: '完成任务', plannedDate: '2026-06-06', allDay: true, status: 'DONE', createdAt: '', updatedAt: ''},
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    render(
      <CalendarPanel
        categories={[{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    expect(await screen.findByText('完成任务')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('显示设置'));
    fireEvent.click(screen.getByLabelText('显示已完成'));
    expect(screen.queryByText('完成任务')).not.toBeInTheDocument();
  });

  it('moves month view by calendar months', () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    render(
      <CalendarPanel
        categories={[]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-03-31"
      />,
    );

    fireEvent.click(screen.getByRole('button', {name: '月'}));
    fireEvent.click(screen.getByLabelText('下一段'));

    expect(screen.getByText('2026-04-30')).toBeInTheDocument();
  });

  it('drags a task to a month date cell', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {id: 1, userId: 1, categoryId: 1, title: '拖拽任务', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''},
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    render(
      <CalendarPanel
        categories={[{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    fireEvent.click(screen.getByRole('button', {name: '月'}));

    const task = await screen.findByText('拖拽任务');
    const target = screen.getByLabelText('2026-06-08');
    const data = createDragData();

    fireEvent.dragStart(task, {dataTransfer: data});
    fireEvent.drop(target, {dataTransfer: data});

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
      plannedDate: '2026-06-08',
      allDay: true,
    }));
  });

  it('drops an all-day task onto the week timeline', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {id: 1, userId: 1, categoryId: 1, title: '安排会议', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''},
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    render(
      <CalendarPanel
        categories={[{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    await screen.findByText('安排会议');
    const target = screen.getByLabelText('2026-06-06 09:00');
    const data = createDragData();

    writeCalendarDragPayload(data, {type: 'calendar-task', taskId: 1, source: 'calendar'});
    fireEvent.drop(target, {dataTransfer: data});

    await waitFor(() => expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
    })));
  });

  it('moves a timed task on the week timeline while preserving duration', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: '时间段任务',
        plannedDate: '2026-06-06',
        allDay: false,
        startAt: '2026-06-06T09:00:00.000',
        endAt: '2026-06-06T10:30:00.000',
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    render(
      <CalendarPanel
        categories={[{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    await screen.findByText('09:00-10:30 时间段任务');
    const target = screen.getByLabelText('2026-06-07 14:00');
    const data = createDragData();

    writeCalendarDragPayload(data, {type: 'calendar-timed-task', taskId: 1, durationMinutes: 90});
    fireEvent.drop(target, {dataTransfer: data});

    await waitFor(() => expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
      plannedDate: '2026-06-07',
      startAt: '2026-06-07T14:00:00.000',
      endAt: '2026-06-07T15:30:00.000',
      allDay: false,
    })));
  });

  it('renders a same-day timed task as one continuous block', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: '数学',
        plannedDate: '2026-06-06',
        allDay: false,
        startAt: '2026-06-06T13:00:00.000',
        endAt: '2026-06-06T15:30:00.000',
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    render(
      <CalendarPanel
        categories={[{id: 1, userId: 1, name: '学习', color: '#3b82f6', sortOrder: 1, createdAt: '', updatedAt: ''}]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    expect(await screen.findByText('13:00-15:30 数学')).toBeInTheDocument();
    expect(screen.queryByText('13:00-14:00 数学')).not.toBeInTheDocument();
    expect(screen.queryByText('14:00-15:00 数学')).not.toBeInTheDocument();
    expect(screen.queryByText('15:00-15:30 数学')).not.toBeInTheDocument();
  });

  it('renders a cross-day timed task as one segment per visible date', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: '夜间学习',
        plannedDate: '2026-06-06',
        allDay: false,
        startAt: '2026-06-06T23:00:00.000',
        endAt: '2026-06-07T02:00:00.000',
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    render(
      <CalendarPanel
        categories={[{id: 1, userId: 1, name: '学习', color: '#3b82f6', sortOrder: 1, createdAt: '', updatedAt: ''}]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    expect(await screen.findByText('23:00-24:00 夜间学习')).toBeInTheDocument();
    expect(await screen.findByText('00:00-02:00 夜间学习')).toBeInTheDocument();
    expect(screen.queryByText('00:00-01:00 夜间学习')).not.toBeInTheDocument();
    expect(screen.queryByText('01:00-02:00 夜间学习')).not.toBeInTheDocument();
  });

  it('renders overlapping timed tasks side by side', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: '数学',
        plannedDate: '2026-06-06',
        allDay: false,
        startAt: '2026-06-06T13:00:00.000',
        endAt: '2026-06-06T14:00:00.000',
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 2,
        userId: 1,
        categoryId: 1,
        title: '英语',
        plannedDate: '2026-06-06',
        allDay: false,
        startAt: '2026-06-06T13:30:00.000',
        endAt: '2026-06-06T14:30:00.000',
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    render(
      <CalendarPanel
        categories={[{id: 1, userId: 1, name: '学习', color: '#3b82f6', sortOrder: 1, createdAt: '', updatedAt: ''}]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    const math = await screen.findByLabelText('2026-06-06 13:00-14:00 数学');
    const english = await screen.findByLabelText('2026-06-06 13:30-14:30 英语');

    expect(math).toHaveStyle({width: 'calc((100% - 4px) / 2)'});
    expect(english).toHaveStyle({width: 'calc((100% - 4px) / 2)'});
  });

  it('renders identical-time timed tasks with lane gutters and title-first labels', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: '数学复习',
        plannedDate: '2026-06-06',
        allDay: false,
        startAt: '2026-06-06T02:00:00.000',
        endAt: '2026-06-06T02:45:00.000',
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 2,
        userId: 1,
        categoryId: 1,
        title: '英语听力',
        plannedDate: '2026-06-06',
        allDay: false,
        startAt: '2026-06-06T02:00:00.000',
        endAt: '2026-06-06T02:45:00.000',
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    render(
      <CalendarPanel
        categories={[{id: 1, userId: 1, name: '学习', color: '#3b82f6', sortOrder: 1, createdAt: '', updatedAt: ''}]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    const math = await screen.findByLabelText('2026-06-06 02:00-02:45 数学复习');
    const english = await screen.findByLabelText('2026-06-06 02:00-02:45 英语听力');

    expect(math).toHaveTextContent('数学复习');
    expect(math).toHaveTextContent('02:00-02:45');
    expect(english).toHaveTextContent('英语听力');
    expect(english).toHaveTextContent('02:00-02:45');
    expect(math).toHaveStyle({width: 'calc((100% - 4px) / 2)'});
    expect(english.getAttribute('style')).toContain('left: calc(1 *');
    expect(english.getAttribute('style')).toContain('+ 4px');
  });

  it('drags a timed task resize handle', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: '时间段任务',
        plannedDate: '2026-06-06',
        allDay: false,
        startAt: '2026-06-06T09:00:00.000',
        endAt: '2026-06-06T10:00:00.000',
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    render(
      <CalendarPanel
        categories={[{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    await screen.findByText('09:00-10:00 时间段任务');
    const handle = screen.getByLabelText('调整时间段任务时长');
    act(() => {
      handle.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, clientY: 0}));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', {bubbles: true, clientY: 30}));
      window.dispatchEvent(new MouseEvent('pointerup', {bubbles: true, clientY: 30}));
    });

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:30:00.000',
      allDay: false,
    }));
  });

  it('renders counted focus time inside the matching task block', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: '写方案',
        plannedDate: '2026-06-06',
        allDay: false,
        startAt: '2026-06-06T17:00:00.000',
        endAt: '2026-06-06T18:00:00.000',
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([
      {
        id: 1,
        taskId: 1,
        userId: 1,
        startedAt: '2026-06-06T01:00:00.000Z',
        durationSeconds: 2700,
        status: 'COMPLETED',
        createdAt: '',
        taskTitle: '写方案',
      },
      {
        id: 2,
        taskId: 1,
        userId: 1,
        startedAt: '2026-06-06T02:00:00.000Z',
        durationSeconds: 120,
        status: 'COMPLETED',
        createdAt: '',
        taskTitle: '数学',
      },
    ]);

    render(
      <CalendarPanel
        categories={[]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    const task = await screen.findByLabelText('2026-06-06 17:00-18:00 写方案，专注 45m');
    expect(task).toHaveTextContent('写方案');
    expect(task).toHaveTextContent('专注 45m');
    expect(screen.queryByText('专注 2m')).not.toBeInTheDocument();
  });

  it('renders focus records in list view', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([
      {
        id: 1,
        taskId: 1,
        userId: 1,
        startedAt: '2026-06-06T01:00:00.000Z',
        durationSeconds: 1800,
        status: 'COMPLETED',
        createdAt: '',
      },
      {
        id: 2,
        taskId: 1,
        userId: 1,
        startedAt: '2026-06-06T02:00:00.000Z',
        durationSeconds: 240,
        status: 'COMPLETED',
        createdAt: '',
      },
    ]);

    render(
      <CalendarPanel
        categories={[]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    fireEvent.click(screen.getByRole('button', {name: '列表'}));

    expect(await screen.findByText('专注 30m')).toBeInTheDocument();
    expect(screen.queryByText('专注 4m')).not.toBeInTheDocument();
  });

  it('hides focus records when focus display is disabled', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: '写方案',
        plannedDate: '2026-06-06',
        allDay: false,
        startAt: '2026-06-06T09:00:00.000',
        endAt: '2026-06-06T10:00:00.000',
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([
      {
        id: 1,
        taskId: 1,
        userId: 1,
        startedAt: '2026-06-06T01:00:00.000Z',
        durationSeconds: 1800,
        status: 'COMPLETED',
        createdAt: '',
      },
    ]);

    render(
      <CalendarPanel
        categories={[]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    expect(await screen.findByText('专注 30m')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('显示设置'));
    fireEvent.click(screen.getByLabelText('显示专注记录'));

    expect(screen.queryByText('专注 30m')).not.toBeInTheDocument();
  });

  it('opens and closes scheduling sidebar from toolbar', async () => {
    renderCalendarPanelWithSidebarTasks();

    expect(await screen.findByRole('button', {name: '关闭安排任务'})).toBeInTheDocument();
    expect(await screen.findByText('未安排任务')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: '关闭安排任务'}));

    await waitFor(() => expect(screen.queryByText('未安排任务')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', {name: '安排任务'}));

    expect(await screen.findByText('未安排任务')).toBeInTheDocument();
  });

  it('does not persist scheduling sidebar open state to localStorage', async () => {
    renderCalendarPanelWithSidebarTasks();

    fireEvent.click(await screen.findByRole('button', {name: '关闭安排任务'}));

    const settings = localStorage.getItem(CALENDAR_SETTINGS_STORAGE_KEY) ?? '';
    expect(settings).not.toContain('schedulingSidebar');
    expect(settings).not.toContain('sidebarOpen');
  });

  it('quick creates timed task from week timeline', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.getUnscheduledTasks)
      .mockResolvedValueOnce([
        {id: 10, userId: 1, categoryId: 1, title: '未安排任务', plannedDate: undefined, allDay: true, status: 'TODO', createdAt: '', updatedAt: ''},
      ] as never)
      .mockResolvedValue([] as never);
    vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 99} as never);
    renderCalendarPanel({onMutationSuccess: vi.fn().mockResolvedValue(undefined)});

    await screen.findByText('未安排任务');
    const slot = screen.getByLabelText('2026-06-06 09:00');
    mockElementRect(slot, {top: 0, height: 64});
    act(() => {
      dispatchElementPointerDown(slot, 0, 120);
      dispatchElementPointerUp(slot, 0, 120);
    });

    expect(await screen.findByRole('dialog', {name: '快速创建任务'})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('任务标题'), {target: {value: '写周计划'}});
    fireEvent.click(screen.getByRole('button', {name: '保存'}));

    await waitFor(() => expect(calendarApi.createCalendarTask).toHaveBeenCalledWith(expect.objectContaining({
      title: '写周计划',
      categoryId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
    })));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: '快速创建任务'})).not.toBeInTheDocument());
    await waitFor(() => expect(calendarApi.getUnscheduledTasks).toHaveBeenCalledTimes(2));
  });

  it('quick creates cross-day all-day task from dragged all-day range', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 99} as never);
    renderCalendarPanelWithSidebarTasks();

    const start = screen.getByLabelText('2026-06-06 全天');
    const end = screen.getByLabelText('2026-06-04 全天');
    act(() => {
      dispatchElementPointerDown(start, 12, 120);
      dispatchElementPointerUp(end, 12, 80);
    });

    expect(await screen.findByRole('dialog', {name: '快速创建任务'})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('任务标题'), {target: {value: '跨天任务'}});
    fireEvent.click(screen.getByRole('button', {name: '保存'}));

    await waitFor(() => expect(calendarApi.createCalendarTask).toHaveBeenCalledWith(expect.objectContaining({
      title: '跨天任务',
      categoryId: 1,
      plannedDate: '2026-06-04',
      plannedEndDate: '2026-06-06',
      allDay: true,
    })));
  });

  it('quick creates single-day all-day task without plannedEndDate', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 99} as never);
    renderCalendarPanelWithSidebarTasks();

    const day = screen.getByLabelText('2026-06-06 全天');
    act(() => {
      dispatchElementPointerDown(day, 12, 120);
      dispatchElementPointerUp(day, 12, 120);
    });

    expect(await screen.findByRole('dialog', {name: '快速创建任务'})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('任务标题'), {target: {value: '全天单日'}});
    fireEvent.click(screen.getByRole('button', {name: '保存'}));

    await waitFor(() => expect(calendarApi.createCalendarTask).toHaveBeenCalledWith(expect.objectContaining({
      title: '全天单日',
      categoryId: 1,
      plannedDate: '2026-06-06',
      plannedEndDate: undefined,
      allDay: true,
    })));
  });

  it('keeps quick-create popover input when create fails', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockRejectedValue(new Error('创建失败'));
    renderCalendarPanelWithSidebarTasks();

    const slot = screen.getByLabelText('2026-06-06 09:00');
    mockElementRect(slot, {top: 0, height: 64});
    act(() => {
      dispatchElementPointerDown(slot, 0, 120);
      dispatchElementPointerUp(slot, 0, 120);
    });

    expect(await screen.findByRole('dialog', {name: '快速创建任务'})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('任务标题'), {target: {value: '保留输入'}});
    fireEvent.click(screen.getByRole('button', {name: '保存'}));

    expect(await screen.findByText('创建失败')).toBeInTheDocument();
    expect(screen.getByLabelText('任务标题')).toHaveValue('保留输入');
  });

  it('changes week timeline density from toolbar', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    renderCalendarPanel();

    fireEvent.click(await screen.findByRole('button', {name: '宽松'}));

    expect(screen.getByLabelText('2026-06-06 09:00')).toHaveStyle({height: '88px'});
  });

  it('does not render fake tag or priority tabs in scheduling sidebar', async () => {
    renderCalendarPanelWithSidebarTasks();

    expect(await screen.findByText('未安排任务')).toBeInTheDocument();
    expect(screen.queryByText('标签')).not.toBeInTheDocument();
    expect(screen.queryByText('优先级')).not.toBeInTheDocument();
  });
});

import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {calendarApi} from '../api/calendarApi';
import {CalendarPanel} from './CalendarPanel';

vi.mock('../api/calendarApi', () => ({
  calendarApi: {
    getCalendarTasks: vi.fn(),
    getFocusSessions: vi.fn(),
    createCalendarTask: vi.fn(),
    updateTaskSchedule: vi.fn(),
  },
}));

function createDragData() {
  const values = new Map<string, string>();
  return {
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
  } as unknown as DataTransfer;
}

describe('CalendarPanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

    const task = await screen.findByText('安排会议');
    const target = screen.getByLabelText('2026-06-06 09:00');
    const data = createDragData();

    fireEvent.dragStart(task, {dataTransfer: data});
    fireEvent.drop(target, {dataTransfer: data});

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
    }));
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

    const task = await screen.findByText('09:00-10:30 时间段任务');
    const target = screen.getByLabelText('2026-06-07 14:00');
    const data = createDragData();

    fireEvent.dragStart(task, {dataTransfer: data});
    fireEvent.drop(target, {dataTransfer: data});

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
      plannedDate: '2026-06-07',
      startAt: '2026-06-07T14:00:00.000',
      endAt: '2026-06-07T15:30:00.000',
      allDay: false,
    }));
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

    const math = await screen.findByText('13:00-14:00 数学');
    const english = await screen.findByText('13:30-14:30 英语');

    expect(math.parentElement).toHaveStyle({width: '50%'});
    expect(english.parentElement).toHaveStyle({width: '50%'});
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
});

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
  } as DataTransfer;
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

    const task = await screen.findByText('09:00 时间段任务');
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

    await screen.findByText('09:00 时间段任务');
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
});

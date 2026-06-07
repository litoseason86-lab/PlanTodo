import {act, createEvent, fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {writeCalendarDragPayload} from '../controllers/schedulingDrag';
import {WeekTimelineView} from './WeekTimelineView';

const categories = [
  {id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''},
];

const task = {
  id: 1,
  userId: 1,
  categoryId: 1,
  title: '写方案',
  plannedDate: '2026-06-06',
  allDay: true,
  status: 'TODO',
  priority: null,
  tagIds: [] as number[],
  createdAt: '',
  updatedAt: '',
} as const;

const timedTask = {
  ...task,
  allDay: false,
  startAt: '2026-06-06T13:00:00.000',
  endAt: '2026-06-06T14:00:00.000',
};

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
    toJSON() {
      return this;
    },
  } as DOMRect);
}

function dispatchWindowPointerUp(clientY: number) {
  window.dispatchEvent(new MouseEvent('pointerup', {bubbles: true, clientY}));
}

function dispatchWindowPointerCancel(clientY = 0) {
  window.dispatchEvent(new MouseEvent('pointercancel', {bubbles: true, clientY}));
}

function dispatchWindowBlur() {
  window.dispatchEvent(new Event('blur'));
}

function dispatchElementPointerDown(element: Element, clientY: number, clientX = 0) {
  element.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, clientX, clientY}));
}

function dispatchElementPointerUp(element: Element, clientY: number, clientX = 0) {
  element.dispatchEvent(new MouseEvent('pointerup', {bubbles: true, clientX, clientY}));
}

function renderWeek(overrides: Partial<Parameters<typeof WeekTimelineView>[0]> = {}) {
  return render(
    <WeekTimelineView
      anchorDate="2026-06-06"
      tasksByDate={{'2026-06-06': [task]}}
      categories={categories}
      focusSessions={[]}
      showFocusSessions={false}
      onScheduleDate={vi.fn().mockResolvedValue(true)}
      onBatchScheduleDate={vi.fn().mockResolvedValue(true)}
      onScheduleTime={vi.fn().mockResolvedValue(true)}
      onMoveTimedTask={vi.fn().mockResolvedValue(true)}
      onResizeTimedTask={vi.fn().mockResolvedValue(true)}
      onRejectBatchTimeDrop={vi.fn()}
      enableQuickCreate={false}
      weekTimelineDensity="standard"
      onOpenQuickCreate={vi.fn()}
      {...overrides}
    />,
  );
}

describe('WeekTimelineView', () => {
  it('ignores unscheduled all-day tasks if malformed date groups include them', () => {
    render(
      <WeekTimelineView
        anchorDate="2026-06-06"
        tasksByDate={{'2026-06-06': [{...task, id: 99, title: '未安排', plannedDate: undefined}]}}
        categories={categories}
        focusSessions={[]}
        showFocusSessions={false}
        onScheduleDate={vi.fn().mockResolvedValue(true)}
        onBatchScheduleDate={vi.fn().mockResolvedValue(true)}
        onScheduleTime={vi.fn().mockResolvedValue(undefined)}
        onMoveTimedTask={vi.fn().mockResolvedValue(undefined)}
        onResizeTimedTask={vi.fn().mockResolvedValue(undefined)}
        onRejectBatchTimeDrop={vi.fn()}
        enableQuickCreate={false}
        weekTimelineDensity="standard"
        onOpenQuickCreate={vi.fn()}
      />,
    );

    expect(screen.queryByText('未安排')).not.toBeInTheDocument();
  });

  it('schedules a single task from the all-day lane drop target', () => {
    const onScheduleDate = vi.fn().mockResolvedValue(true);
    renderWeek({onScheduleDate});
    const data = createDragData();
    writeCalendarDragPayload(data, {type: 'calendar-task', taskId: 1, source: 'sidebar'});
    fireEvent.drop(screen.getByLabelText('2026-06-06 全天'), {dataTransfer: data});
    expect(onScheduleDate).toHaveBeenCalledWith(1, '2026-06-06');
  });

  it('opens quick create from a week time slot when enabled', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({enableQuickCreate: true, onOpenQuickCreate});
    const slot = screen.getByLabelText('2026-06-06 09:00');
    mockElementRect(slot, {top: 100, height: 64});

    act(() => {
      dispatchElementPointerDown(slot, 100, 20);
      dispatchElementPointerUp(slot, 100, 20);
    });

    expect(onOpenQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'timed',
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
    }));
  });

  it('does not open quick create when disabled', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({enableQuickCreate: false, onOpenQuickCreate});
    const slot = screen.getByLabelText('2026-06-06 09:00');
    mockElementRect(slot, {top: 100, height: 64});

    act(() => {
      dispatchElementPointerDown(slot, 100, 20);
      dispatchElementPointerUp(slot, 100, 20);
    });

    expect(onOpenQuickCreate).not.toHaveBeenCalled();
  });

  it('opens all-day quick create from a dragged all-day date range', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({enableQuickCreate: true, onOpenQuickCreate});

    act(() => {
      dispatchElementPointerDown(screen.getByLabelText('2026-06-04 全天'), 20, 10);
      dispatchElementPointerUp(screen.getByLabelText('2026-06-06 全天'), 20, 50);
    });

    expect(onOpenQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'all-day',
      plannedDate: '2026-06-04',
      plannedEndDate: '2026-06-06',
    }));
  });

  it('opens all-day quick create when a dragged range ends on an existing segment', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({
      enableQuickCreate: true,
      onOpenQuickCreate,
      tasksByDate: {
        '2026-06-04': [{
          ...task,
          id: 2,
          title: '跨天任务',
          plannedDate: '2026-06-04',
          plannedEndDate: '2026-06-05',
        }],
      },
    });
    const segment = screen.getByLabelText('2026-06-04 至 2026-06-05 跨天任务');
    const segmentLayer = segment.parentElement;
    expect(segmentLayer).not.toBeNull();
    mockElementRect(segmentLayer as HTMLElement, {left: 0, width: 764});

    act(() => {
      dispatchElementPointerDown(screen.getByLabelText('2026-06-03 全天'), 20, 100);
      dispatchElementPointerUp(segment, 20, 414);
    });

    expect(onOpenQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'all-day',
      plannedDate: '2026-06-03',
      plannedEndDate: '2026-06-04',
    }));
  });

  it('does not open quick create for external drop payloads', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({enableQuickCreate: true, onOpenQuickCreate});
    const data = createDragData();
    writeCalendarDragPayload(data, {type: 'calendar-task', taskId: 1, source: 'sidebar'});

    fireEvent.drop(screen.getByLabelText('2026-06-06 09:00'), {dataTransfer: data});

    expect(onOpenQuickCreate).not.toHaveBeenCalled();
  });

  it('opens the task editor when clicking a timed task', () => {
    const onOpenTaskEditor = vi.fn();
    renderWeek({
      tasksByDate: {'2026-06-06': [timedTask]},
      onOpenTaskEditor,
    });

    fireEvent.click(screen.getByLabelText('2026-06-06 13:00-14:00 写方案'));

    expect(onOpenTaskEditor).toHaveBeenCalledWith(expect.objectContaining({
      task: timedTask,
      anchor: expect.objectContaining({x: expect.any(Number), y: expect.any(Number)}),
    }));
  });

  it('does not open the task editor after timed task drag starts', () => {
    const onOpenTaskEditor = vi.fn();
    renderWeek({
      tasksByDate: {'2026-06-06': [timedTask]},
      onOpenTaskEditor,
    });
    const segment = screen.getByLabelText('2026-06-06 13:00-14:00 写方案');

    fireEvent.dragStart(segment, {dataTransfer: createDragData()});
    fireEvent.click(segment);

    expect(onOpenTaskEditor).not.toHaveBeenCalled();
  });

  it('does not open the task editor from the resize handle', () => {
    const onOpenTaskEditor = vi.fn();
    renderWeek({
      tasksByDate: {'2026-06-06': [timedTask]},
      onOpenTaskEditor,
    });

    fireEvent.pointerDown(screen.getByRole('button', {name: '调整写方案时长'}));

    expect(onOpenTaskEditor).not.toHaveBeenCalled();
  });

  it('clears a timed quick-create pointer after pointerup on a different date', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({enableQuickCreate: true, onOpenQuickCreate});
    const startSlot = screen.getByLabelText('2026-06-06 09:00');
    const wrongDateSlot = screen.getByLabelText('2026-06-05 09:00');
    mockElementRect(startSlot, {top: 100, height: 64});
    mockElementRect(wrongDateSlot, {top: 100, height: 64});

    act(() => {
      dispatchElementPointerDown(startSlot, 100, 20);
      dispatchElementPointerUp(wrongDateSlot, 100, 20);
      dispatchElementPointerUp(startSlot, 100, 20);
    });

    expect(onOpenQuickCreate).not.toHaveBeenCalled();
  });

  it('clears a timed quick-create pointer after window pointerup', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({enableQuickCreate: true, onOpenQuickCreate});
    const slot = screen.getByLabelText('2026-06-06 09:00');
    mockElementRect(slot, {top: 100, height: 64});

    act(() => {
      dispatchElementPointerDown(slot, 100, 20);
      dispatchWindowPointerUp(100);
      dispatchElementPointerUp(slot, 100, 20);
    });

    expect(onOpenQuickCreate).not.toHaveBeenCalled();
  });

  it('clears a timed quick-create pointer after pointer cancel', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({enableQuickCreate: true, onOpenQuickCreate});
    const slot = screen.getByLabelText('2026-06-06 09:00');
    mockElementRect(slot, {top: 100, height: 64});

    act(() => {
      dispatchElementPointerDown(slot, 100, 20);
      dispatchWindowPointerCancel(100);
      dispatchElementPointerUp(slot, 100, 20);
    });

    expect(onOpenQuickCreate).not.toHaveBeenCalled();
  });

  it('clears an all-day quick-create pointer after window pointerup', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({enableQuickCreate: true, onOpenQuickCreate});
    const allDayLane = screen.getByLabelText('2026-06-06 全天');

    act(() => {
      dispatchElementPointerDown(allDayLane, 20, 10);
      dispatchWindowPointerUp(20);
      dispatchElementPointerUp(allDayLane, 20, 10);
    });

    expect(onOpenQuickCreate).not.toHaveBeenCalled();
  });

  it('clears all quick-create pointers when dropping on a time slot', () => {
    const onOpenQuickCreate = vi.fn();
    const onScheduleTime = vi.fn().mockResolvedValue(true);
    renderWeek({enableQuickCreate: true, onOpenQuickCreate, onScheduleTime});
    const allDayLane = screen.getByLabelText('2026-06-06 全天');
    const slot = screen.getByLabelText('2026-06-06 09:00');
    mockElementRect(slot, {top: 100, height: 64});
    const data = createDragData();
    writeCalendarDragPayload(data, {type: 'calendar-task', taskId: 1, source: 'sidebar'});

    act(() => {
      dispatchElementPointerDown(allDayLane, 20, 10);
    });
    const dropEvent = createEvent.drop(slot, {dataTransfer: data});
    Object.defineProperty(dropEvent, 'clientY', {value: 100});
    fireEvent(slot, dropEvent);
    act(() => {
      dispatchElementPointerUp(allDayLane, 20, 10);
    });

    expect(onScheduleTime).toHaveBeenCalledWith({taskId: 1, date: '2026-06-06', hour: 9, minute: 0});
    expect(onOpenQuickCreate).not.toHaveBeenCalled();
  });

  it('uses density height for timeline rows', () => {
    renderWeek({weekTimelineDensity: 'comfortable'});
    expect(screen.getByLabelText('2026-06-06 09:00')).toHaveStyle({height: '88px'});
  });

  for (const {density, slotHeight} of [
    {density: 'compact' as const, slotHeight: 48},
    {density: 'comfortable' as const, slotHeight: 88},
  ]) {
    it(`uses ${density} slot height when converting a sidebar task drop`, () => {
      const onScheduleTime = vi.fn().mockResolvedValue(true);
      renderWeek({weekTimelineDensity: density, onScheduleTime});
      const slot = screen.getByLabelText('2026-06-06 09:00');
      mockElementRect(slot, {top: 100, height: slotHeight});
      const data = createDragData();
      writeCalendarDragPayload(data, {type: 'calendar-task', taskId: 1, source: 'sidebar'});

      const dropEvent = createEvent.drop(slot, {dataTransfer: data});
      Object.defineProperty(dropEvent, 'clientY', {value: 100 + slotHeight / 2});
      fireEvent(slot, dropEvent);

      expect(onScheduleTime).toHaveBeenCalledWith({taskId: 1, date: '2026-06-06', hour: 9, minute: 30});
    });
  }

  it('uses the clicked hour range for point quick create regardless of pointer offset', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({enableQuickCreate: true, weekTimelineDensity: 'comfortable', onOpenQuickCreate});
    const slot = screen.getByLabelText('2026-06-06 09:00');
    mockElementRect(slot, {top: 100, height: 88});

    act(() => {
      dispatchElementPointerDown(slot, 144, 20);
      dispatchElementPointerUp(slot, 144, 20);
    });

    expect(onOpenQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      editableStartAt: '2026-06-06T09:00:00.000',
      editableEndAt: '2026-06-06T10:00:00.000',
    }));
  });

  it('creates the default timed draft for below-threshold same-slot pointer movement', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({enableQuickCreate: true, onOpenQuickCreate});
    const slot = screen.getByLabelText('2026-06-06 09:00');
    mockElementRect(slot, {top: 100, height: 64});

    act(() => {
      dispatchElementPointerDown(slot, 100, 20);
      dispatchElementPointerUp(slot, 103, 20);
    });

    expect(onOpenQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
    }));
  });

  it('creates a minimum-duration timed draft for above-threshold same-slot pointer movement', () => {
    const onOpenQuickCreate = vi.fn();
    renderWeek({enableQuickCreate: true, onOpenQuickCreate});
    const slot = screen.getByLabelText('2026-06-06 09:00');
    mockElementRect(slot, {top: 100, height: 64});

    act(() => {
      dispatchElementPointerDown(slot, 100, 20);
      dispatchElementPointerUp(slot, 110, 20);
    });

    expect(onOpenQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T09:15:00.000',
    }));
  });

  it('does not open quick create when a time-slot drop payload lands after quick-create was armed', () => {
    const onOpenQuickCreate = vi.fn();
    const onScheduleTime = vi.fn().mockResolvedValue(true);
    renderWeek({enableQuickCreate: true, onOpenQuickCreate, onScheduleTime});
    const slot = screen.getByLabelText('2026-06-06 09:00');
    mockElementRect(slot, {top: 100, height: 64});
    const data = createDragData();
    writeCalendarDragPayload(data, {type: 'calendar-task', taskId: 1, source: 'sidebar'});

    act(() => {
      dispatchElementPointerDown(slot, 100, 20);
    });
    const dropEvent = createEvent.drop(slot, {dataTransfer: data});
    Object.defineProperty(dropEvent, 'clientY', {value: 132});
    fireEvent(slot, dropEvent);
    act(() => {
      dispatchElementPointerUp(slot, 100, 20);
    });

    expect(onScheduleTime).toHaveBeenCalledWith({taskId: 1, date: '2026-06-06', hour: 9, minute: 30});
    expect(onOpenQuickCreate).not.toHaveBeenCalled();
  });

  it('uses non-standard density when moving an existing timed task and preserves duration', () => {
    const onMoveTimedTask = vi.fn().mockResolvedValue(true);
    renderWeek({
      weekTimelineDensity: 'comfortable',
      onMoveTimedTask,
      tasksByDate: {
        '2026-06-06': [{
          ...task,
          id: 2,
          title: '时间段任务',
          plannedDate: '2026-06-06',
          allDay: false,
          startAt: '2026-06-06T09:15:00.000',
          endAt: '2026-06-06T10:30:00.000',
        }],
      },
    });

    const data = createDragData();
    fireEvent.dragStart(screen.getByLabelText('2026-06-06 09:15-10:30 时间段任务'), {dataTransfer: data});
    const dropSlot = screen.getByLabelText('2026-06-04 13:00');
    mockElementRect(dropSlot, {top: 200, height: 88});
    const dropEvent = createEvent.drop(dropSlot, {dataTransfer: data});
    Object.defineProperty(dropEvent, 'clientY', {value: 266});
    fireEvent(dropSlot, dropEvent);

    expect(onMoveTimedTask).toHaveBeenCalledWith({
      taskId: 2,
      date: '2026-06-04',
      hour: 13,
      minute: 45,
      durationMinutes: 75,
    });
  });

  it('positions timed task blocks from their wall-clock range', () => {
    renderWeek({
      weekTimelineDensity: 'comfortable',
      tasksByDate: {
        '2026-06-06': [{
          ...task,
          id: 2,
          title: '时间段任务',
          plannedDate: '2026-06-06',
          allDay: false,
          startAt: '2026-06-06T09:15:00.000',
          endAt: '2026-06-06T10:30:00.000',
        }],
      },
    });

    expect(screen.getByLabelText('2026-06-06 09:00')).toHaveStyle({height: '88px'});
    expect(screen.getByLabelText('2026-06-06 09:15-10:30 时间段任务')).toHaveStyle({
      top: '38.54166666666667%',
      height: '5.208333333333334%',
      minHeight: '24px',
    });
  });

  it('uses density height when converting resize pointer movement', () => {
    const onResizeTimedTask = vi.fn().mockResolvedValue(true);
    renderWeek({
      weekTimelineDensity: 'comfortable',
      onResizeTimedTask,
      tasksByDate: {
        '2026-06-06': [{
          ...task,
          id: 2,
          title: '时间段任务',
          plannedDate: '2026-06-06',
          allDay: false,
          startAt: '2026-06-06T09:00:00.000',
          endAt: '2026-06-06T10:00:00.000',
        }],
      },
    });

    act(() => {
      dispatchElementPointerDown(screen.getByLabelText('调整时间段任务时长'), 100);
    });
    act(() => {
      dispatchWindowPointerUp(144);
    });

    expect(onResizeTimedTask).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 2,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      durationMinutes: 90,
    }));
  });

  it('resizes from the handle pointer flow without opening quick create', () => {
    const onResizeTimedTask = vi.fn().mockResolvedValue(true);
    const onOpenQuickCreate = vi.fn();
    renderWeek({
      enableQuickCreate: true,
      onOpenQuickCreate,
      onResizeTimedTask,
      tasksByDate: {
        '2026-06-06': [{
          ...task,
          id: 2,
          title: '时间段任务',
          plannedDate: '2026-06-06',
          allDay: false,
          startAt: '2026-06-06T09:00:00.000',
          endAt: '2026-06-06T10:00:00.000',
        }],
      },
    });

    act(() => {
      dispatchElementPointerDown(screen.getByLabelText('调整时间段任务时长'), 100);
    });
    act(() => {
      dispatchWindowPointerUp(116);
    });

    expect(onResizeTimedTask).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 2,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      durationMinutes: 75,
    }));
    expect(onOpenQuickCreate).not.toHaveBeenCalled();
  });

  it('clears resize state on pointer cancel without resizing', () => {
    const onResizeTimedTask = vi.fn().mockResolvedValue(true);
    renderWeek({
      onResizeTimedTask,
      tasksByDate: {
        '2026-06-06': [{
          ...task,
          id: 2,
          title: '时间段任务',
          plannedDate: '2026-06-06',
          allDay: false,
          startAt: '2026-06-06T09:00:00.000',
          endAt: '2026-06-06T10:00:00.000',
        }],
      },
    });

    act(() => {
      dispatchElementPointerDown(screen.getByLabelText('调整时间段任务时长'), 100);
    });
    act(() => {
      dispatchWindowPointerCancel(100);
      dispatchWindowPointerUp(144);
    });

    expect(onResizeTimedTask).not.toHaveBeenCalled();
  });

  it('clears resize state on window blur without resizing', () => {
    const onResizeTimedTask = vi.fn().mockResolvedValue(true);
    renderWeek({
      onResizeTimedTask,
      tasksByDate: {
        '2026-06-06': [{
          ...task,
          id: 2,
          title: '时间段任务',
          plannedDate: '2026-06-06',
          allDay: false,
          startAt: '2026-06-06T09:00:00.000',
          endAt: '2026-06-06T10:00:00.000',
        }],
      },
    });

    act(() => {
      dispatchElementPointerDown(screen.getByLabelText('调整时间段任务时长'), 100);
    });
    act(() => {
      dispatchWindowBlur();
      dispatchWindowPointerUp(144);
    });

    expect(onResizeTimedTask).not.toHaveBeenCalled();
  });

  it('hides resize handle when a timed task cannot end 15 minutes later on the same day', () => {
    renderWeek({
      tasksByDate: {
        '2026-06-06': [{
          ...task,
          id: 2,
          title: '临界时间任务',
          plannedDate: '2026-06-06',
          allDay: false,
          startAt: '2026-06-06T23:45:00.000',
          endAt: '2026-06-06T23:59:00.000',
        }],
      },
    });

    expect(screen.queryByLabelText('调整临界时间任务时长')).not.toBeInTheDocument();
  });

  it('hides resize handle for cross-day timed tasks', () => {
    renderWeek({
      tasksByDate: {
        '2026-06-06': [{
          ...task,
          id: 2,
          title: '跨天时间段任务',
          plannedDate: '2026-06-06',
          allDay: false,
          startAt: '2026-06-06T23:00:00.000',
          endAt: '2026-06-07T02:00:00.000',
        }],
      },
    });

    expect(screen.queryByLabelText('调整跨天时间段任务时长')).not.toBeInTheDocument();
  });

  it('renders duplicated cross-day all-day tasks as one continuous segment', () => {
    const crossDayTask = {
      ...task,
      id: 2,
      title: '跨天任务',
      plannedDate: '2026-06-05',
      plannedEndDate: '2026-06-07',
    };

    renderWeek({
      tasksByDate: {
        '2026-06-05': [crossDayTask],
        '2026-06-06': [crossDayTask],
        '2026-06-07': [crossDayTask],
      },
    });

    expect(screen.getByLabelText('2026-06-05 至 2026-06-07 跨天任务')).toBeInTheDocument();
    expect(screen.getAllByText('跨天任务')).toHaveLength(1);
  });

  it('renders overlapping all-day segments once each', () => {
    const firstTask = {
      ...task,
      id: 2,
      title: '跨天任务 A',
      plannedDate: '2026-06-03',
      plannedEndDate: '2026-06-05',
    };
    const secondTask = {
      ...task,
      id: 3,
      title: '跨天任务 B',
      plannedDate: '2026-06-04',
      plannedEndDate: '2026-06-06',
    };

    renderWeek({
      tasksByDate: {
        '2026-06-03': [firstTask],
        '2026-06-04': [firstTask, secondTask],
        '2026-06-05': [firstTask, secondTask],
        '2026-06-06': [secondTask],
      },
    });

    const firstSegment = screen.getByLabelText('2026-06-03 至 2026-06-05 跨天任务 A');
    const secondSegment = screen.getByLabelText('2026-06-04 至 2026-06-06 跨天任务 B');
    expect(firstSegment).toBeInTheDocument();
    expect(firstSegment).toHaveStyle({gridColumn: '4 / span 3', gridRow: '1'});
    expect(secondSegment).toBeInTheDocument();
    expect(secondSegment).toHaveStyle({gridColumn: '5 / span 3', gridRow: '2'});
    expect(screen.getAllByText(/跨天任务 [AB]/)).toHaveLength(2);
    expect(screen.getByLabelText('2026-06-04 全天')).toHaveStyle({minHeight: '100px'});
  });

  it('clips all-day tasks that start before the visible week and exposes previous continuation', () => {
    renderWeek({
      tasksByDate: {
        '2026-06-01': [{
          ...task,
          id: 2,
          title: '上周延续',
          plannedDate: '2026-05-30',
          plannedEndDate: '2026-06-03',
        }],
      },
    });

    const segment = screen.getByLabelText(/2026-06-01 至 2026-06-03 上周延续/);
    expect(segment).toHaveStyle({gridColumn: '2 / span 3'});
    expect(segment).toHaveAttribute('data-visible-start', '2026-06-01');
    expect(segment).toHaveAttribute('data-visible-end', '2026-06-03');
    expect(segment).toHaveAttribute('data-continues-before', 'true');
    expect(segment).toHaveAttribute('data-continues-after', 'false');
    expect(segment).toHaveAccessibleName(/从本周前开始/);
  });

  it('clips all-day tasks that continue after the visible week and exposes next continuation', () => {
    renderWeek({
      tasksByDate: {
        '2026-06-05': [{
          ...task,
          id: 2,
          title: '下周继续',
          plannedDate: '2026-06-05',
          plannedEndDate: '2026-06-10',
        }],
      },
    });

    const segment = screen.getByLabelText(/2026-06-05 至 2026-06-07 下周继续/);
    expect(segment).toHaveStyle({gridColumn: '6 / span 3'});
    expect(segment).toHaveAttribute('data-visible-start', '2026-06-05');
    expect(segment).toHaveAttribute('data-visible-end', '2026-06-07');
    expect(segment).toHaveAttribute('data-continues-before', 'false');
    expect(segment).toHaveAttribute('data-continues-after', 'true');
    expect(segment).toHaveAccessibleName(/持续到本周后/);
  });

  it('clips all-day tasks spanning both sides of the visible week and exposes both continuations', () => {
    renderWeek({
      tasksByDate: {
        '2026-06-01': [{
          ...task,
          id: 2,
          title: '整周跨越',
          plannedDate: '2026-05-28',
          plannedEndDate: '2026-06-12',
        }],
      },
    });

    const segment = screen.getByLabelText(/2026-06-01 至 2026-06-07 整周跨越/);
    expect(segment).toHaveStyle({gridColumn: '2 / span 7'});
    expect(segment).toHaveAttribute('data-visible-start', '2026-06-01');
    expect(segment).toHaveAttribute('data-visible-end', '2026-06-07');
    expect(segment).toHaveAttribute('data-continues-before', 'true');
    expect(segment).toHaveAttribute('data-continues-after', 'true');
    expect(segment).toHaveAccessibleName(/从本周前开始/);
    expect(segment).toHaveAccessibleName(/持续到本周后/);
  });

  it('writes calendar drag payloads from all-day segments', () => {
    renderWeek({
      tasksByDate: {
        '2026-06-05': [{
          ...task,
          id: 2,
          title: '跨天任务',
          plannedDate: '2026-06-05',
          plannedEndDate: '2026-06-07',
        }],
      },
    });

    const data = createDragData();
    fireEvent.dragStart(screen.getByLabelText('2026-06-05 至 2026-06-07 跨天任务'), {dataTransfer: data});

    expect(JSON.parse(data.getData('application/json'))).toEqual({
      type: 'calendar-task',
      taskId: 2,
      source: 'calendar',
    });
  });

  it('proxies drops on all-day segments to the date under the pointer', () => {
    const onScheduleDate = vi.fn().mockResolvedValue(true);
    renderWeek({
      onScheduleDate,
      tasksByDate: {
        '2026-06-03': [{
          ...task,
          id: 2,
          title: '跨天任务',
          plannedDate: '2026-06-03',
          plannedEndDate: '2026-06-05',
        }],
      },
    });

    const segment = screen.getByLabelText('2026-06-03 至 2026-06-05 跨天任务');
    const segmentLayer = segment.parentElement;
    expect(segmentLayer).not.toBeNull();
    mockElementRect(segmentLayer as HTMLElement, {left: 0, width: 764});

    const data = createDragData();
    writeCalendarDragPayload(data, {type: 'calendar-task', taskId: 1, source: 'sidebar'});
    const dropEvent = createEvent.drop(segment, {dataTransfer: data});
    Object.defineProperty(dropEvent, 'clientX', {value: 414});
    fireEvent(segment, dropEvent);

    expect(onScheduleDate).toHaveBeenCalledOnce();
    expect(onScheduleDate).toHaveBeenCalledWith(1, '2026-06-04');
  });

  it('rejects batch payloads on time slots', () => {
    const onRejectBatchTimeDrop = vi.fn();
    renderWeek({onRejectBatchTimeDrop});
    const data = createDragData();
    writeCalendarDragPayload(data, {type: 'calendar-task-batch', taskIds: [1, 2], source: 'sidebar'});
    fireEvent.drop(screen.getByLabelText('2026-06-06 09:00'), {dataTransfer: data});
    expect(onRejectBatchTimeDrop).toHaveBeenCalledOnce();
  });
});

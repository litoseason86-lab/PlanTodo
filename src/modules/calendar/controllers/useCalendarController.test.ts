import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {calendarApi} from '../api/calendarApi';
import {useCalendarController} from './useCalendarController';

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

describe('useCalendarController', () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('defaults to week view and recalculates range when view changes', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    expect(result.current.view).toBe('week');
    expect(result.current.range).toEqual({dateFrom: '2026-06-01', dateTo: '2026-06-07'});

    act(() => result.current.setView('month'));

    expect(result.current.range).toEqual({dateFrom: '2026-06-01', dateTo: '2026-06-30'});
    await waitFor(() => expect(calendarApi.getCalendarTasks).toHaveBeenCalled());
  });

  it('updates an all-day task schedule then refreshes', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    await act(async () => {
      await result.current.scheduleTaskForDate(1, '2026-06-08');
    });

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, {
      plannedDate: '2026-06-08',
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
  });

  it('schedules a task at a specific time with a default 60 minute duration', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    await act(async () => {
      await result.current.scheduleTaskAtTime({taskId: 1, date: '2026-06-06', hour: 9, minute: 0});
    });

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, {
      plannedDate: '2026-06-06',
      plannedEndDate: undefined,
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
    });
  });

  it('moves a timed task while preserving duration', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    await act(async () => {
      await result.current.moveTimedTask({
        taskId: 1,
        date: '2026-06-06',
        hour: 14,
        minute: 15,
        durationMinutes: 45,
      });
    });

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, {
      plannedDate: '2026-06-06',
      plannedEndDate: undefined,
      startAt: '2026-06-06T14:15:00.000',
      endAt: '2026-06-06T15:00:00.000',
      allDay: false,
    });
  });

  it('shows an error toast when moving a timed task would cross midnight', async () => {
    const showToast = vi.fn();
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast,
    }));

    await act(async () => {
      await result.current.moveTimedTask({
        taskId: 1,
        date: '2026-06-06',
        hour: 23,
        minute: 0,
        durationMinutes: 180,
      });
    });

    expect(calendarApi.updateTaskSchedule).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Local datetime addition crossed day boundary', 'error');
  });

  it('resizes a timed task duration', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    await act(async () => {
      await result.current.resizeTimedTask({
        taskId: 1,
        plannedDate: '2026-06-06',
        startAt: '2026-06-06T09:00:00.000',
        durationMinutes: 90,
      });
    });

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, {
      plannedDate: '2026-06-06',
      plannedEndDate: undefined,
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:30:00.000',
      allDay: false,
    });
  });

  it('creates an all-day task from a date cell', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    await act(async () => {
      await result.current.createAllDayTask('2026-06-08', '新任务');
    });

    expect(calendarApi.createCalendarTask).toHaveBeenCalledWith({
      title: '新任务',
      categoryId: 8,
      plannedDate: '2026-06-08',
      allDay: true,
    });
  });

  it('ignores stale calendar data responses', async () => {
    let resolveFirstTasks: (tasks: never[]) => void = () => {};
    vi.mocked(calendarApi.getCalendarTasks)
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveFirstTasks = resolve;
      }))
      .mockResolvedValueOnce([{id: 2, title: '月任务'} as never]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    act(() => result.current.setView('month'));

    await waitFor(() => expect(result.current.rawTasks).toEqual([{id: 2, title: '月任务'}]));

    await act(async () => {
      resolveFirstTasks([{id: 1, title: '旧周任务'} as never]);
    });

    expect(result.current.rawTasks).toEqual([{id: 2, title: '月任务'}]);
  });

  it('shows an error toast when scheduling fails', async () => {
    const showToast = vi.fn();
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockRejectedValue(new Error('排期失败'));

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast,
    }));

    await act(async () => {
      await result.current.scheduleTaskForDate(1, '2026-06-08');
    });

    expect(showToast).toHaveBeenCalledWith('排期失败', 'error');
  });

  it('runs mutation success callback after scheduling succeeds', async () => {
    const onMutationSuccess = vi.fn().mockResolvedValue(undefined);
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
      onMutationSuccess,
    }));

    await act(async () => {
      await result.current.scheduleTaskForDate(1, '2026-06-08');
    });

    expect(onMutationSuccess).toHaveBeenCalledOnce();
  });

  it('does not run mutation success callback after failed scheduling', async () => {
    const onMutationSuccess = vi.fn();
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockRejectedValue(new Error('排期失败'));

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
      onMutationSuccess,
    }));

    await act(async () => {
      await result.current.scheduleTaskForDate(1, '2026-06-08');
    });

    expect(onMutationSuccess).not.toHaveBeenCalled();
  });

  it('clamps default time scheduling near midnight to the same day', async () => {
    const showToast = vi.fn();
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast,
    }));

    await act(async () => {
      await result.current.scheduleTaskAtTime({taskId: 1, date: '2026-06-06', hour: 23, minute: 30});
    });

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T23:30:00.000',
      endAt: '2026-06-06T23:59:00.000',
      allDay: false,
    }));
    expect(showToast).not.toHaveBeenCalledWith('Local datetime addition crossed day boundary', 'error');
  });

  it('shows an error toast when schedule update fails', async () => {
    const showToast = vi.fn();
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockRejectedValue(new Error('endAt must be after startAt'));

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast,
    }));

    await act(async () => {
      await result.current.scheduleTaskAtTime({taskId: 1, date: '2026-06-06', hour: 9, minute: 0});
    });

    expect(showToast).toHaveBeenCalledWith('endAt must be after startAt', 'error');
  });

  it('shows an error toast when creating a date task fails', async () => {
    const showToast = vi.fn();
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockRejectedValue(new Error('创建失败'));

    const {result} = renderHook(() => useCalendarController({
      categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
      initialDate: '2026-06-06',
      showToast,
    }));

    await act(async () => {
      await result.current.createAllDayTask('2026-06-08', '新任务');
    });

    expect(showToast).toHaveBeenCalledWith('创建失败', 'error');
  });

  it('refreshes the latest range when an older create action completes late', async () => {
    let resolveCreate: (task: never) => void = () => {};
    vi.mocked(calendarApi.getCalendarTasks).mockImplementation(async (params) => (
      params.dateTo === '2026-06-30'
        ? [{id: 2, title: '月任务'} as never]
        : [{id: 1, title: '旧周任务'} as never]
    ));
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockReturnValue(new Promise((resolve) => {
      resolveCreate = resolve;
    }));

    const {result} = renderHook(() => useCalendarController({
      categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    const createFromWeekView = result.current.createAllDayTask;
    const createPromise = createFromWeekView('2026-06-08', '新任务');

    act(() => result.current.setView('month'));
    await waitFor(() => expect(result.current.rawTasks).toEqual([{id: 2, title: '月任务'}]));

    await act(async () => {
      resolveCreate({id: 3} as never);
      await createPromise;
    });

    expect(result.current.rawTasks).toEqual([{id: 2, title: '月任务'}]);
    expect(calendarApi.getCalendarTasks).toHaveBeenLastCalledWith({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      categoryId: undefined,
    });
  });

  it('opens and closes a quick create draft', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    act(() => result.current.openQuickCreateDraft({
      kind: 'timed',
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      anchor: {x: 10, y: 20},
    }));

    expect(result.current.quickCreateDraft).toMatchObject({kind: 'timed'});

    act(() => result.current.closeQuickCreateDraft());
    expect(result.current.quickCreateDraft).toBeUndefined();
  });

  it('submits a timed quick create draft through calendarApi', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    act(() => result.current.openQuickCreateDraft({
      kind: 'timed',
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      anchor: {x: 10, y: 20},
    }));

    await act(async () => {
      const resultValue = await result.current.submitQuickCreateDraft({
        title: '写方案',
        categoryId: 8,
      });
      expect(resultValue).toEqual({ok: true});
    });

    expect(calendarApi.createCalendarTask).toHaveBeenCalledWith({
      title: '写方案',
      categoryId: 8,
      plannedDate: '2026-06-06',
      plannedEndDate: undefined,
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
    });
    expect(result.current.quickCreateDraft).toBeUndefined();
  });

  it('submits an all-day quick create draft through calendarApi', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    act(() => result.current.openQuickCreateDraft({
      kind: 'all-day',
      plannedDate: '2026-06-18',
      plannedEndDate: '2026-06-21',
      anchor: {x: 10, y: 20},
    }));

    await act(async () => {
      const resultValue = await result.current.submitQuickCreateDraft({
        title: '跨天事项',
        categoryId: 8,
      });
      expect(resultValue).toEqual({ok: true});
    });

    expect(calendarApi.createCalendarTask).toHaveBeenCalledWith({
      title: '跨天事项',
      categoryId: 8,
      plannedDate: '2026-06-18',
      plannedEndDate: '2026-06-21',
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
  });

  it('keeps the quick create draft and returns an error when create fails', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockRejectedValue(new Error('创建失败'));

    const {result} = renderHook(() => useCalendarController({
      categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    act(() => result.current.openQuickCreateDraft({
      kind: 'timed',
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      anchor: {x: 10, y: 20},
    }));

    await act(async () => {
      await expect(result.current.submitQuickCreateDraft({
        title: '写方案',
        categoryId: 8,
      })).resolves.toEqual({ok: false, message: '创建失败'});
    });

    expect(result.current.quickCreateDraft).toMatchObject({kind: 'timed'});
  });

  it('does not let an older quick create submit close a newer draft', async () => {
    let resolveCreate: (task: never) => void = () => {};
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockReturnValue(new Promise((resolve) => {
      resolveCreate = resolve;
    }));

    const {result} = renderHook(() => useCalendarController({
      categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    act(() => result.current.openQuickCreateDraft({
      kind: 'timed',
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      anchor: {x: 10, y: 20},
    }));

    const submitPromise = result.current.submitQuickCreateDraft({
      title: '写方案',
      categoryId: 8,
    });

    act(() => result.current.openQuickCreateDraft({
      kind: 'all-day',
      plannedDate: '2026-06-18',
      anchor: {x: 30, y: 40},
    }));

    await act(async () => {
      resolveCreate({id: 1} as never);
      await expect(submitPromise).resolves.toEqual({ok: true});
    });

    expect(result.current.quickCreateDraft).toMatchObject({
      kind: 'all-day',
      plannedDate: '2026-06-18',
    });
  });

  it('closes quick create and returns success when post-create refresh fails', async () => {
    const showToast = vi.fn();
    vi.mocked(calendarApi.getCalendarTasks).mockRejectedValue(new Error('刷新失败'));
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
      initialDate: '2026-06-06',
      showToast,
    }));

    act(() => result.current.openQuickCreateDraft({
      kind: 'timed',
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      anchor: {x: 10, y: 20},
    }));

    await act(async () => {
      await expect(result.current.submitQuickCreateDraft({
        title: '写方案',
        categoryId: 8,
      })).resolves.toEqual({ok: true});
    });

    expect(result.current.quickCreateDraft).toBeUndefined();
    expect(showToast).toHaveBeenCalledWith('刷新失败', 'error');
  });

  it('closes quick create and returns success when mutation success callback fails', async () => {
    const showToast = vi.fn();
    const onMutationSuccess = vi.fn().mockRejectedValue(new Error('同步失败'));
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
      initialDate: '2026-06-06',
      showToast,
      onMutationSuccess,
    }));

    act(() => result.current.openQuickCreateDraft({
      kind: 'timed',
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      anchor: {x: 10, y: 20},
    }));

    await act(async () => {
      await expect(result.current.submitQuickCreateDraft({
        title: '写方案',
        categoryId: 8,
      })).resolves.toEqual({ok: true});
    });

    expect(result.current.quickCreateDraft).toBeUndefined();
    expect(showToast).toHaveBeenCalledWith('同步失败', 'error');
  });

  it('stores week timeline density through calendar settings', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    await waitFor(() => expect(calendarApi.getCalendarTasks).toHaveBeenCalled());
    const callsBeforeDensityChange = vi.mocked(calendarApi.getCalendarTasks).mock.calls.length;

    act(() => result.current.setWeekTimelineDensity('comfortable'));

    expect(result.current.settings.weekTimelineDensity).toBe('comfortable');
    expect(localStorage.getItem('plantodo.calendar.settings')).toContain('"weekTimelineDensity":"comfortable"');
    expect(calendarApi.getCalendarTasks).toHaveBeenCalledTimes(callsBeforeDensityChange);
  });
});

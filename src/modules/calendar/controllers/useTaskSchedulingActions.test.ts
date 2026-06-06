import {renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {calendarApi} from '../api/calendarApi';
import {useTaskSchedulingActions} from './useTaskSchedulingActions';

vi.mock('../api/calendarApi', () => ({
  calendarApi: {
    getCalendarTasks: vi.fn(),
    getFocusSessions: vi.fn(),
    updateTaskSchedule: vi.fn(),
    batchScheduleDate: vi.fn(),
    batchUnschedule: vi.fn(),
  },
}));

describe('useTaskSchedulingActions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('schedules one task for an all-day date and returns true', async () => {
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);
    const refreshCalendarData = vi.fn().mockResolvedValue(undefined);
    const onMutationSuccess = vi.fn().mockResolvedValue(undefined);
    const {result} = renderHook(() => useTaskSchedulingActions({showToast: vi.fn(), refreshCalendarData, onMutationSuccess}));

    await expect(result.current.scheduleDate({taskId: 1, date: '2026-06-08'})).resolves.toBe(true);
    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, {
      plannedDate: '2026-06-08',
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
    expect(refreshCalendarData).toHaveBeenCalledOnce();
    expect(onMutationSuccess).toHaveBeenCalledOnce();
  });

  it('batch schedules tasks and returns true', async () => {
    vi.mocked(calendarApi.batchScheduleDate).mockResolvedValue([{id: 1}, {id: 2}] as never);
    const {result} = renderHook(() => useTaskSchedulingActions({
      showToast: vi.fn(),
      refreshCalendarData: vi.fn().mockResolvedValue(undefined),
      onMutationSuccess: vi.fn().mockResolvedValue(undefined),
    }));

    await expect(result.current.batchScheduleDate({taskIds: [1, 2], date: '2026-06-08'})).resolves.toBe(true);
    expect(calendarApi.batchScheduleDate).toHaveBeenCalledWith({taskIds: [1, 2], plannedDate: '2026-06-08'});
  });

  it('returns false and does not run success refresh when mutation fails', async () => {
    const showToast = vi.fn();
    const refreshCalendarData = vi.fn();
    const onMutationSuccess = vi.fn();
    vi.mocked(calendarApi.batchUnschedule).mockRejectedValue(new Error('批量取消失败'));
    const {result} = renderHook(() => useTaskSchedulingActions({showToast, refreshCalendarData, onMutationSuccess}));

    await expect(result.current.batchUnschedule({taskIds: [1, 2]})).resolves.toBe(false);
    expect(showToast).toHaveBeenCalledWith('批量取消失败', 'error');
    expect(refreshCalendarData).not.toHaveBeenCalled();
    expect(onMutationSuccess).not.toHaveBeenCalled();
  });

  it('clamps default timed scheduling duration to the remaining minutes in the same day', async () => {
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);
    const {result} = renderHook(() => useTaskSchedulingActions({
      showToast: vi.fn(),
      refreshCalendarData: vi.fn().mockResolvedValue(undefined),
    }));

    await expect(result.current.scheduleTime({
      taskId: 1,
      date: '2026-06-06',
      hour: 23,
      minute: 30,
    })).resolves.toBe(true);

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, {
      plannedDate: '2026-06-06',
      plannedEndDate: undefined,
      startAt: '2026-06-06T23:30:00.000',
      endAt: '2026-06-06T23:59:00.000',
      allDay: false,
    });
  });

  it('uses the minimum same-day end time for the last quarter-hour slot', async () => {
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);
    const {result} = renderHook(() => useTaskSchedulingActions({
      showToast: vi.fn(),
      refreshCalendarData: vi.fn().mockResolvedValue(undefined),
    }));

    await expect(result.current.scheduleTime({
      taskId: 1,
      date: '2026-06-06',
      hour: 23,
      minute: 45,
    })).resolves.toBe(true);

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, {
      plannedDate: '2026-06-06',
      plannedEndDate: undefined,
      startAt: '2026-06-06T23:45:00.000',
      endAt: '2026-06-06T23:59:00.000',
      allDay: false,
    });
  });

  it('returns true when refresh fails after a successful mutation', async () => {
    const showToast = vi.fn();
    const refreshCalendarData = vi.fn().mockRejectedValue(new Error('刷新失败'));
    const onMutationSuccess = vi.fn().mockResolvedValue(undefined);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);
    const {result} = renderHook(() => useTaskSchedulingActions({
      showToast,
      refreshCalendarData,
      onMutationSuccess,
    }));

    await expect(result.current.scheduleDate({taskId: 1, date: '2026-06-08'})).resolves.toBe(true);
    expect(showToast).toHaveBeenCalledWith('刷新失败', 'error');
    expect(onMutationSuccess).toHaveBeenCalledOnce();
  });

  it('returns true when success callback fails after a successful mutation', async () => {
    const showToast = vi.fn();
    const refreshCalendarData = vi.fn().mockResolvedValue(undefined);
    const onMutationSuccess = vi.fn().mockRejectedValue(new Error('同步失败'));
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);
    const {result} = renderHook(() => useTaskSchedulingActions({
      showToast,
      refreshCalendarData,
      onMutationSuccess,
    }));

    await expect(result.current.scheduleDate({taskId: 1, date: '2026-06-08'})).resolves.toBe(true);
    expect(refreshCalendarData).toHaveBeenCalledOnce();
    expect(showToast).toHaveBeenCalledWith('同步失败', 'error');
  });

  it('resizes a task without crossing the day boundary', async () => {
    const {result} = renderHook(() => useTaskSchedulingActions({
      showToast: vi.fn(),
      refreshCalendarData: vi.fn().mockResolvedValue(undefined),
    }));
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    await result.current.resizeTimedTask({
      taskId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T23:00:00.000',
      durationMinutes: 90,
    });

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
      endAt: '2026-06-06T23:59:00.000',
    }));
  });

  it('refreshes calendar data after a failed resize mutation', async () => {
    const showToast = vi.fn();
    const refreshCalendarData = vi.fn().mockResolvedValue(undefined);
    vi.mocked(calendarApi.updateTaskSchedule).mockRejectedValue(new Error('调整失败'));
    const {result} = renderHook(() => useTaskSchedulingActions({
      showToast,
      refreshCalendarData,
    }));

    await expect(result.current.resizeTimedTask({
      taskId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      durationMinutes: 120,
    })).resolves.toBe(false);

    expect(showToast).toHaveBeenCalledWith('调整失败', 'error');
    expect(refreshCalendarData).toHaveBeenCalledOnce();
  });
});

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
});

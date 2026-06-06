import {addMinutesToLocalDateTime, makeLocalDateTime} from '../../../../shared/lib/schedule';
import {calendarApi} from '../api/calendarApi';

const DEFAULT_TIMED_TASK_DURATION_MINUTES = 60;
const MIN_TIMED_TASK_DURATION_MINUTES = 15;

interface UseTaskSchedulingActionsArgs {
  showToast: (message: string, type?: 'success' | 'error') => void;
  refreshCalendarData: () => Promise<void>;
  onMutationSuccess?: () => Promise<void> | void;
}

function defaultTimedTaskEndAt(date: string, hour: number, minute: number): string {
  const startMinutes = hour * 60 + minute;
  const remainingWholeMinutes = 24 * 60 - 1 - startMinutes;
  const clampedDurationMinutes = Math.max(
    MIN_TIMED_TASK_DURATION_MINUTES,
    Math.min(DEFAULT_TIMED_TASK_DURATION_MINUTES, remainingWholeMinutes),
  );
  const endMinutes = Math.min(24 * 60 - 1, startMinutes + clampedDurationMinutes);

  return makeLocalDateTime(date, Math.floor(endMinutes / 60), endMinutes % 60);
}

function addDurationWithinDay(startAt: string, durationMinutes: number): string {
  const date = startAt.slice(0, 10);
  const startMinutes = Number(startAt.slice(11, 13)) * 60 + Number(startAt.slice(14, 16));
  const endMinutes = Math.min(23 * 60 + 59, startMinutes + durationMinutes);

  return makeLocalDateTime(date, Math.floor(endMinutes / 60), endMinutes % 60);
}

export function useTaskSchedulingActions({
  showToast,
  refreshCalendarData,
  onMutationSuccess,
}: UseTaskSchedulingActionsArgs) {
  async function persistMutation(action: () => Promise<unknown>, fallbackMessage: string): Promise<boolean> {
    try {
      await action();
    } catch (error) {
      showToast(error instanceof Error ? error.message : fallbackMessage, 'error');
      return false;
    }

    try {
      await refreshCalendarData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '日历数据刷新失败', 'error');
    }
    try {
      await onMutationSuccess?.();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '日历数据刷新失败', 'error');
    }
    return true;
  }

  async function scheduleDate(input: {taskId: number; date: string}): Promise<boolean> {
    return persistMutation(() => calendarApi.updateTaskSchedule(input.taskId, {
      plannedDate: input.date,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    }), '排期更新失败');
  }

  async function scheduleTime(input: {taskId: number; date: string; hour: number; minute: number}): Promise<boolean> {
    return persistMutation(() => {
      const startAt = makeLocalDateTime(input.date, input.hour, input.minute);
      const endAt = defaultTimedTaskEndAt(input.date, input.hour, input.minute);
      return calendarApi.updateTaskSchedule(input.taskId, {
        plannedDate: input.date,
        plannedEndDate: undefined,
        startAt,
        endAt,
        allDay: false,
      });
    }, '排期更新失败');
  }

  async function moveTimedTask(input: {taskId: number; date: string; hour: number; minute: number; durationMinutes: number}): Promise<boolean> {
    return persistMutation(() => {
      const startAt = makeLocalDateTime(input.date, input.hour, input.minute);
      const endAt = addMinutesToLocalDateTime(startAt, input.durationMinutes);
      return calendarApi.updateTaskSchedule(input.taskId, {
        plannedDate: input.date,
        plannedEndDate: undefined,
        startAt,
        endAt,
        allDay: false,
      });
    }, '排期更新失败');
  }

  async function resizeTimedTask(input: {taskId: number; plannedDate: string; startAt: string; durationMinutes: number}): Promise<boolean> {
    try {
      const endAt = addDurationWithinDay(input.startAt, input.durationMinutes);
      await calendarApi.updateTaskSchedule(input.taskId, {
        plannedDate: input.plannedDate,
        plannedEndDate: undefined,
        startAt: input.startAt,
        endAt,
        allDay: false,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : '排期更新失败', 'error');
      try {
        await refreshCalendarData();
      } catch (refreshError) {
        showToast(refreshError instanceof Error ? refreshError.message : '日历数据刷新失败', 'error');
      }
      return false;
    }

    try {
      await refreshCalendarData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '日历数据刷新失败', 'error');
    }
    try {
      await onMutationSuccess?.();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '日历数据刷新失败', 'error');
    }
    return true;
  }

  async function batchScheduleDate(input: {taskIds: number[]; date: string}): Promise<boolean> {
    return persistMutation(() => calendarApi.batchScheduleDate({
      taskIds: input.taskIds,
      plannedDate: input.date,
    }), '批量安排失败');
  }

  async function batchUnschedule(input: {taskIds: number[]}): Promise<boolean> {
    return persistMutation(() => calendarApi.batchUnschedule(input), '批量取消安排失败');
  }

  return {
    scheduleDate,
    scheduleTime,
    moveTimedTask,
    resizeTimedTask,
    batchScheduleDate,
    batchUnschedule,
  };
}

import {addMinutesToLocalDateTime, makeLocalDateTime} from '../../../../shared/lib/schedule';
import {calendarApi} from '../api/calendarApi';

interface UseTaskSchedulingActionsArgs {
  showToast: (message: string, type?: 'success' | 'error') => void;
  refreshCalendarData: () => Promise<void>;
  onMutationSuccess?: () => Promise<void> | void;
}

export function useTaskSchedulingActions({
  showToast,
  refreshCalendarData,
  onMutationSuccess,
}: UseTaskSchedulingActionsArgs) {
  async function persistMutation(action: () => Promise<unknown>, fallbackMessage: string): Promise<boolean> {
    try {
      await action();
      await refreshCalendarData();
      await onMutationSuccess?.();
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : fallbackMessage, 'error');
      return false;
    }
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
      const endAt = addMinutesToLocalDateTime(startAt, 60);
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
    return persistMutation(() => {
      const endAt = addMinutesToLocalDateTime(input.startAt, input.durationMinutes);
      return calendarApi.updateTaskSchedule(input.taskId, {
        plannedDate: input.plannedDate,
        plannedEndDate: undefined,
        startAt: input.startAt,
        endAt,
        allDay: false,
      });
    }, '排期更新失败');
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

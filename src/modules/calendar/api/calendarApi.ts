import type {Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {focusApi} from '../../focus/api/focusApi';
import {tasksApi, type TaskSchedulePayload} from '../../tasks/api/tasksApi';

export interface CalendarRange {
  dateFrom: string;
  dateTo: string;
}

export interface CalendarTaskFilters extends CalendarRange {
  categoryId?: number;
}

export const calendarApi = {
  getCalendarTasks(filters: CalendarTaskFilters): Promise<Task[]> {
    return tasksApi.getTasks(filters);
  },

  createCalendarTask(input: {title: string; categoryId: number; plannedDate: string; allDay: true}): Promise<Task> {
    return tasksApi.createTask(input);
  },

  updateTaskSchedule(taskId: number, schedule: TaskSchedulePayload): Promise<Task> {
    return tasksApi.updateTaskSchedule(taskId, schedule);
  },

  getFocusSessions(range: CalendarRange): Promise<TaskExecutionSession[]> {
    return focusApi.getSessions(range);
  },
};

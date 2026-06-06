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

export interface CalendarTaskPoolFilters {
  categoryId?: number;
  query?: string;
}

export interface CalendarAllDayWithoutTimeFilters extends CalendarRange, CalendarTaskPoolFilters {}

export interface CalendarCreateTaskInput {
  title: string;
  categoryId: number;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}

export const calendarApi = {
  getCalendarTasks(filters: CalendarTaskFilters): Promise<Task[]> {
    return tasksApi.getTasks(filters);
  },

  getUnscheduledTasks(filters?: CalendarTaskPoolFilters): Promise<Task[]> {
    return tasksApi.getTasks({...filters, scheduled: 'unscheduled'});
  },

  getAllDayWithoutTimeTasks(filters: CalendarAllDayWithoutTimeFilters): Promise<Task[]> {
    return tasksApi.getTasks({...filters, scheduled: 'all-day-without-time'});
  },

  createCalendarTask(input: CalendarCreateTaskInput): Promise<Task> {
    return tasksApi.createTask(input);
  },

  updateTaskSchedule(taskId: number, schedule: TaskSchedulePayload): Promise<Task> {
    return tasksApi.updateTaskSchedule(taskId, schedule);
  },

  batchScheduleDate(input: {taskIds: number[]; plannedDate: string}): Promise<Task[]> {
    return tasksApi.batchScheduleDate(input);
  },

  batchUnschedule(input: {taskIds: number[]}): Promise<Task[]> {
    return tasksApi.batchUnschedule(input);
  },

  getFocusSessions(range: CalendarRange): Promise<TaskExecutionSession[]> {
    return focusApi.getSessions(range);
  },
};

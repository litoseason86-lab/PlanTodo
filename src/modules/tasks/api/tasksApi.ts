import type {Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {requestJson} from '../../../shared/api/httpClient';

type ScheduledFilter = 'unscheduled' | 'scheduled' | 'all-day-without-time';

export interface TaskSchedulePayload {
  plannedDate?: string | null;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}

export const tasksApi = {
  getTasks(filters?: {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: TaskStatus;
    categoryId?: number;
    scheduled?: ScheduledFilter;
    query?: string;
  }): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters?.date) params.append('date', filters.date);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.categoryId) params.append('categoryId', String(filters.categoryId));
    if (filters?.scheduled) params.append('scheduled', filters.scheduled);
    if (filters?.query) params.append('query', filters.query);

    const query = params.toString();
    return requestJson<Task[]>(`/api/tasks${query ? `?${query}` : ''}`);
  },

  createTask(task: {
    title: string;
    categoryId: number;
    plannedDate?: string | null;
    plannedEndDate?: string;
    startAt?: string;
    endAt?: string;
    allDay?: boolean;
  }): Promise<Task> {
    return requestJson<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  },

  updateTaskStatus(id: number, status: TaskStatus): Promise<Task> {
    return requestJson<Task>(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({status}),
    });
  },

  updateTaskSchedule(
    id: number,
    schedule: TaskSchedulePayload,
  ): Promise<Task> {
    return requestJson<Task>(`/api/tasks/${id}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify(schedule),
    });
  },

  deleteTask(id: number): Promise<void> {
    return requestJson<void>(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  batchScheduleDate(input: {taskIds: number[]; plannedDate: string}): Promise<Task[]> {
    return requestJson<Task[]>('/api/tasks/batch-schedule', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  batchUnschedule(input: {taskIds: number[]}): Promise<Task[]> {
    return requestJson<Task[]>('/api/tasks/batch-unschedule', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
};

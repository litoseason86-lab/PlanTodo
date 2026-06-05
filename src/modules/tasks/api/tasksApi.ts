import type {Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {requestJson} from '../../../shared/api/httpClient';

export const tasksApi = {
  getTasks(filters?: {date?: string; status?: TaskStatus; categoryId?: number}): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters?.date) params.append('date', filters.date);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.categoryId) params.append('categoryId', String(filters.categoryId));

    const query = params.toString();
    return requestJson<Task[]>(`/api/tasks${query ? `?${query}` : ''}`);
  },

  createTask(task: {title: string; categoryId: number; plannedDate: string}): Promise<Task> {
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

  deleteTask(id: number): Promise<void> {
    return requestJson<void>(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  },
};

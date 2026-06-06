import type {TaskExecutionSession} from '../../../../shared/domain/entities';
import {requestJson} from '../../../shared/api/httpClient';

export const focusApi = {
  getSessions(filters?: {date?: string; dateFrom?: string; dateTo?: string}): Promise<TaskExecutionSession[]> {
    const params = new URLSearchParams();
    if (filters?.date) params.append('date', filters.date);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    const query = params.toString();
    return requestJson<TaskExecutionSession[]>(`/api/task-sessions${query ? `?${query}` : ''}`);
  },

  getRunningSession(): Promise<{session: TaskExecutionSession | null}> {
    return requestJson<{session: TaskExecutionSession | null}>('/api/task-sessions/running');
  },

  startSession(taskId: number): Promise<TaskExecutionSession> {
    return requestJson<TaskExecutionSession>(`/api/tasks/${taskId}/sessions/start`, {
      method: 'POST',
    });
  },

  stopSession(sessionId: number): Promise<TaskExecutionSession> {
    return requestJson<TaskExecutionSession>(`/api/task-sessions/${sessionId}/stop`, {
      method: 'POST',
    });
  },

  pauseSession(sessionId: number): Promise<TaskExecutionSession> {
    return requestJson<TaskExecutionSession>(`/api/task-sessions/${sessionId}/pause`, {
      method: 'POST',
    });
  },

  resumeSession(sessionId: number): Promise<TaskExecutionSession> {
    return requestJson<TaskExecutionSession>(`/api/task-sessions/${sessionId}/resume`, {
      method: 'POST',
    });
  },

  getSessionsByTask(taskId: number): Promise<TaskExecutionSession[]> {
    return requestJson<TaskExecutionSession[]>(`/api/tasks/${taskId}/sessions`);
  },
};
